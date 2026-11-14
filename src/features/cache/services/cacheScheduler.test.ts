import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createCacheScheduler } from "./cacheScheduler";
import type { CacheNovelProgress } from "../types";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import { SqlNovelRepository } from "../../../storage/repositories/novelRepository";
import { SqlChapterRepository } from "../../../storage/repositories/chapterRepository";
import { SqlQueueRepository } from "../../../storage/repositories/queueRepository";
import { MockHttpClient } from "../../../bridges/http/mockHttpClient";
import type { HttpClientBridge } from "../../../bridges/http/types";
import { createDefaultParserRegistry } from "../../../parsers/parserRegistry";
import {
  CACHE_TTL_MS,
  PREFETCH_INTERVAL_MS,
  SHORT_TIMEOUT_MS,
  STANDARD_TIMEOUT_MS,
} from "../../../shared/constants/cache";

const WORK_ID = "1177354054881162325";
const episodeUrl = (idx: number) =>
  `https://kakuyomu.jp/works/${WORK_ID}/episodes/ep-${idx}`;
const episodeHtml = (idx: number) =>
  `<html><body><div class='widget-episodeBody'><p>第${idx}話の本文</p></div></body></html>`;

async function seedNovel(
  novelRepo: SqlNovelRepository,
  chapterRepo: SqlChapterRepository,
  options: {
    workId?: string;
    chapterCount: number;
    cachedIndexes?: number[];
    downloadedAtByIndex?: (idx: number) => string;
  },
) {
  const workId = options.workId ?? WORK_ID;
  const novel = await novelRepo.upsertNovelWithToc(
    {
      siteType: "kakuyomu",
      remoteWorkId: workId,
      canonicalUrl: `https://kakuyomu.jp/works/${workId}`,
      title: `テスト作品-${workId}`,
      author: "テスト著者",
      synopsis: "あらすじ",
      chapters: Array.from({ length: options.chapterCount }, (_, i) => ({
        chapterIndex: i + 1,
        remoteChapterId: `ep-${i + 1}`,
        partTitle: "第一章",
        title: `第${i + 1}話`,
        url: `https://kakuyomu.jp/works/${workId}/episodes/ep-${i + 1}`,
        publishedAt: "2026-01-01T00:00:00Z",
      })),
      nextTocPageUrl: null,
    },
    "2026-01-01T00:00:00Z",
  );

  const cachedSet = new Set(options.cachedIndexes ?? []);
  for (const idx of cachedSet) {
    const downloadedAt = options.downloadedAtByIndex
      ? options.downloadedAtByIndex(idx)
      : new Date().toISOString();
    await chapterRepo.saveChapterBody(
      novel.id,
      idx,
      {
        remoteChapterId: `ep-${idx}`,
        title: `第${idx}話`,
        bodyHtml: `<p>既存本文${idx}</p>`,
        byteSize: 20,
        prevChapterUrl: null,
        nextChapterUrl: null,
      },
      downloadedAt,
    );
  }

  return novel;
}

describe("createCacheScheduler", () => {
  let novelRepo: SqlNovelRepository;
  let chapterRepo: SqlChapterRepository;
  let queueRepo: SqlQueueRepository;

  beforeEach(async () => {
    const db = await resetTestDb();
    novelRepo = new SqlNovelRepository(db);
    chapterRepo = new SqlChapterRepository(db);
    queueRepo = new SqlQueueRepository(db);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("優先度調停・同時接続数1・割り込み再開", () => {
    it("high > medium > low の優先順で最大同時 HTTP リクエスト数を 1 に制限して実行すること", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        chapterCount: 5,
      });

      let inFlight = 0;
      let maxInFlight = 0;
      const callOrder: string[] = [];

      let releaseFirstLow!: () => void;
      const firstLowGate = new Promise<void>((r) => {
        releaseFirstLow = r;
      });
      let firstLowStarted!: () => void;
      const onFirstLowStarted = new Promise<void>((r) => {
        firstLowStarted = r;
      });

      const httpClient: HttpClientBridge = {
        getHtml: async (opts) => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          const epMatch = /ep-(\d+)/.exec(opts.url);
          const epNum = Number(epMatch?.[1] ?? "0");
          callOrder.push(`ep-${epNum}`);

          try {
            if (epNum === 4 && callOrder.length === 1) {
              firstLowStarted();
              await new Promise<void>((resolve, reject) => {
                if (opts.signal?.aborted) {
                  reject(opts.signal.reason);
                  return;
                }
                opts.signal?.addEventListener(
                  "abort",
                  () => reject(opts.signal?.reason),
                  { once: true },
                );
                void firstLowGate.then(resolve);
              });
            }
            return {
              status: 200,
              url: opts.url,
              headers: {},
              html: episodeHtml(epNum),
            };
          } finally {
            inFlight -= 1;
          }
        },
      };

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 10,
      });

      const statuses: CacheNovelProgress[] = [];
      scheduler.subscribeProgress(novel.id, (p) => {
        statuses.push(p);
      });

      await scheduler.enqueueBatchCache(novel.id, [4, 5]);
      await onFirstLowStarted;

      // low 実行中（ch 4 ダウンロード中）に medium と high を同時投入する
      const mediumPromise = scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [2],
        priority: "medium",
      });
      const highPromise = scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [1],
        priority: "high",
      });

      await highPromise;
      await mediumPromise;

      // 上位完了後、low が自動再開して ch 4, ch 5 を完走すること
      releaseFirstLow();
      await vi.waitFor(() => {
        expect(scheduler.getNovelProgress(novel.id)?.status).toBe("completed");
      });

      expect(maxInFlight).toBe(1);
      // 最初に low(4) が開始 -> high(1) が即時割り込み -> medium(2) -> low(4, 5) 自動再開
      expect(callOrder).toEqual(["ep-4", "ep-1", "ep-2", "ep-4", "ep-5"]);

      // low が preempted -> running -> completed と遷移していること
      expect(
        statuses.some(
          (s) => s.status === "preempted" && s.pausedReason === "preempted",
        ),
      ).toBe(true);
      expect(
        statuses.some(
          (s) => s.status === "running" && s.pausedReason === "none",
        ),
      ).toBe(true);
      expect(scheduler.getNovelProgress(novel.id)?.isBatchCaching).toBe(false);

      scheduler.dispose();
    });

    it("high 割り込みで中断された low の downloading 行は retryCount を増加させず pending に戻り先頭へ再キューされること", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        chapterCount: 3,
      });

      let ch1AbortedCount = 0;
      let releaseHigh!: () => void;
      const highGate = new Promise<void>((r) => {
        releaseHigh = r;
      });
      let notifyLowStarted!: () => void;
      const lowStarted = new Promise<void>((r) => {
        notifyLowStarted = r;
      });

      const httpClient: HttpClientBridge = {
        getHtml: async (opts) => {
          if (opts.url.endsWith("ep-1")) {
            notifyLowStarted();
            return await new Promise((_, reject) => {
              opts.signal?.addEventListener(
                "abort",
                () => {
                  ch1AbortedCount += 1;
                  reject(new DOMException("Aborted", "AbortError"));
                },
                { once: true },
              );
            });
          }
          await highGate;
          return {
            status: 200,
            url: opts.url,
            headers: {},
            html: episodeHtml(3),
          };
        },
      };

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 10,
      });

      await scheduler.enqueueBatchCache(novel.id, [1, 2]);
      await lowStarted;

      const highPromise = scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [3],
        priority: "high",
      });

      await vi.waitFor(async () => {
        const items = await queueRepo.listByNovelId(novel.id);
        const ch1 = items.find((q) => q.chapterIndex === 1);
        expect(ch1?.status).toBe("pending");
        expect(ch1?.retryCount).toBe(0);
      });

      expect(ch1AbortedCount).toBe(1);
      expect(scheduler.getNovelProgress(novel.id)).toMatchObject({
        status: "preempted",
        pausedReason: "preempted",
        isBatchCaching: true,
      });

      await scheduler.pauseNovelTasks(novel.id);
      releaseHigh();
      await highPromise;
      scheduler.dispose();
    });

    it("medium スリープ中に high が割り込んだ場合、medium を即中断して high を 0ms 実行し、後に残 medium を再開すること", async () => {
      vi.useFakeTimers();
      const novel = await seedNovel(novelRepo, chapterRepo, {
        chapterCount: 4,
      });

      const httpClient = new MockHttpClient();
      for (let i = 1; i <= 4; i++) {
        httpClient.setResponse(episodeUrl(i), { html: episodeHtml(i) });
      }
      const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
      });

      const mediumPromise = scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [2, 3],
        priority: "medium",
      });

      // medium の初期インターバル 1500ms 待機中（まだ HTTP 未発火）に high を投入
      await vi.advanceTimersByTimeAsync(500);
      expect(getHtmlSpy).not.toHaveBeenCalled();

      await scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [1],
        priority: "high",
      });
      // high は 0ms で即時取得完了
      expect(getHtmlSpy).toHaveBeenCalledTimes(1);
      expect(getHtmlSpy.mock.calls[0]?.[0].url).toBe(episodeUrl(1));

      // 残り medium(2, 3) が自動再開・完了すること
      await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS * 2);
      await mediumPromise;

      expect(getHtmlSpy).toHaveBeenCalledTimes(3);
      const ch3 = await chapterRepo.getChapter(novel.id, 3);
      expect(ch3?.bodyHtml).toContain("第3話の本文");

      scheduler.dispose();
    });
  });

  describe("high 優先度の TTL・タイムアウト・エラー処理", () => {
    it("7日以内キャッシュ済みの話は HTTP 通信を行わず即 resolve し、空配列や事前 abort 時も通信しないこと", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedIndexes: [1],
      });
      const httpClient = new MockHttpClient();
      const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
      });

      await scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [],
        priority: "high",
      });
      const preAborted = new AbortController();
      preAborted.abort();
      await scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [2],
        priority: "medium",
        signal: preAborted.signal,
      });
      await scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [1],
        priority: "high",
      });

      expect(getHtmlSpy).not.toHaveBeenCalled();
      scheduler.dispose();
    });

    it("7日経過した古いキャッシュの high 取得は SHORT_TIMEOUT_MS を使用し、失敗時は既存キャッシュを維持して resolve すること", async () => {
      const eightDaysAgo = new Date(
        Date.now() - (CACHE_TTL_MS + 24 * 60 * 60 * 1000),
      ).toISOString();
      const novel = await seedNovel(novelRepo, chapterRepo, {
        chapterCount: 1,
        cachedIndexes: [1],
        downloadedAtByIndex: () => eightDaysAgo,
      });

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const httpClient = new MockHttpClient();
      httpClient.setResponse(episodeUrl(1), () => {
        throw new Error("timeout");
      });
      const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
      });

      await expect(
        scheduler.enqueuePrefetch({
          novelId: novel.id,
          chapterIndexes: [1],
          priority: "high",
        }),
      ).resolves.toBeUndefined();

      expect(getHtmlSpy).toHaveBeenCalledWith(
        expect.objectContaining({ timeoutMs: SHORT_TIMEOUT_MS }),
      );
      expect(warnSpy).toHaveBeenCalled();
      const ch1 = await chapterRepo.getChapter(novel.id, 1);
      expect(ch1?.bodyHtml).toBe("<p>既存本文1</p>");
      scheduler.dispose();
    });

    it("未キャッシュ話の high 取得は STANDARD_TIMEOUT_MS を使用し、通信エラー・HTTPエラー・パースエラー時に reject すること", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        chapterCount: 3,
      });

      const httpClient = new MockHttpClient();
      httpClient.setResponse(episodeUrl(1), () => {
        throw new Error("network down");
      });
      httpClient.setResponse(episodeUrl(2), { status: 404, html: "not found" });
      httpClient.setResponse(episodeUrl(3), {
        status: 200,
        html: "<html><body></body></html>",
      });
      const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

      const parserRegistry = createDefaultParserRegistry();
      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry,
      });

      await expect(
        scheduler.enqueuePrefetch({
          novelId: novel.id,
          chapterIndexes: [1],
          priority: "high",
        }),
      ).rejects.toThrow("network down");
      expect(getHtmlSpy).toHaveBeenCalledWith(
        expect.objectContaining({ timeoutMs: STANDARD_TIMEOUT_MS }),
      );

      await expect(
        scheduler.enqueuePrefetch({
          novelId: novel.id,
          chapterIndexes: [2],
          priority: "high",
        }),
      ).rejects.toThrow("HTTP 404");

      const parser = parserRegistry.requireParser(episodeUrl(3));
      vi.spyOn(parser, "parseChapterContent").mockImplementationOnce(() => {
        throw new Error("parse error");
      });
      await expect(
        scheduler.enqueuePrefetch({
          novelId: novel.id,
          chapterIndexes: [3],
          priority: "high",
        }),
      ).rejects.toThrow("parse error");

      scheduler.dispose();
    });
  });

  describe("medium 優先度のレート制限・エラー耐性・caller abort 分離", () => {
    it("初回および連続リクエスト間で prefetchIntervalMs 待機し、通信直前鮮度チェック・エラー時非 reject・バッチ進捗同期を行うこと", async () => {
      vi.useFakeTimers();
      const eightDaysAgo = new Date(
        Date.now() - (CACHE_TTL_MS + 86400000),
      ).toISOString();
      const novel = await seedNovel(novelRepo, chapterRepo, {
        chapterCount: 5,
        cachedIndexes: [2, 3],
        downloadedAtByIndex: (idx) =>
          idx === 3 ? eightDaysAgo : new Date().toISOString(),
      });

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const httpClient = new MockHttpClient();
      httpClient.setResponse(episodeUrl(1), { html: episodeHtml(1) });
      httpClient.setResponse(episodeUrl(3), { html: episodeHtml(3) });
      httpClient.setResponse(episodeUrl(4), { status: 500, html: "error" });
      httpClient.setResponse(episodeUrl(5), { html: episodeHtml(5) });
      const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
      });

      // バッチ（1, 3, 5）を登録後、1 は進行する前に medium が [2(新鮮), 3(期限切れ), 4(失敗), 5(未取得)] を先読み
      await scheduler.enqueueBatchCache(novel.id, [1, 3, 5]);

      const mediumPromise = scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [2, 3, 4, 5],
        priority: "medium",
      });

      // medium の初期待機終了後に第3話が取得開始される
      await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS);
      const ch3 = await chapterRepo.getChapter(novel.id, 3);
      expect(ch3?.bodyHtml).toContain("第3話の本文");

      // 第4話（500警告）→ 第5話取得完了（rejectしない）
      await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS * 2);
      await expect(mediumPromise).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();

      // 第2話は新鮮スキップのため通信していないこと
      expect(
        getHtmlSpy.mock.calls.some((c) => c[0].url === episodeUrl(2)),
      ).toBe(false);

      // バッチ残りの第1話も自動再開して完走すること
      await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS * 2);
      expect(scheduler.getNovelProgress(novel.id)?.status).toBe("completed");
      scheduler.dispose();
    });

    it("medium の caller signal が abort された場合、medium のみ停止して待機中 low タスクが自動再開すること", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        chapterCount: 3,
      });

      let onMediumStarted!: () => void;
      const mediumStarted = new Promise<void>((r) => {
        onMediumStarted = r;
      });
      const httpClient: HttpClientBridge = {
        getHtml: async (opts) => {
          if (opts.url.endsWith("ep-2")) {
            onMediumStarted();
            return await new Promise((_, reject) => {
              opts.signal?.addEventListener(
                "abort",
                () => reject(new DOMException("Aborted", "AbortError")),
                { once: true },
              );
            });
          }
          return {
            status: 200,
            url: opts.url,
            headers: {},
            html: episodeHtml(1),
          };
        },
      };

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 5,
      });

      const controller = new AbortController();
      const mediumPromise = scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [2, 3],
        priority: "medium",
        signal: controller.signal,
      });

      await scheduler.enqueueBatchCache(novel.id, [1]);
      await mediumStarted;

      controller.abort();
      await expect(mediumPromise).resolves.toBeUndefined();

      await vi.waitFor(() => {
        expect(scheduler.getNovelProgress(novel.id)?.status).toBe("completed");
      });
      const ch1 = await chapterRepo.getChapter(novel.id, 1);
      expect(ch1?.bodyHtml).toContain("第1話の本文");
      scheduler.dispose();
    });
  });

  describe("low 一括キャッシュ（キュー登録・リトライ上限・失敗保持・制御API）", () => {
    it("enqueueBatchCache が interrupted 回復・新鮮除外・maxRetryCount 除外・enqueueChapters 登録完了時点で即時 resolve し、重複起動を抑止すること", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        chapterCount: 4,
        cachedIndexes: [1],
      });

      // ch 2 を interrupted downloading、ch 4 を retryCount=3 (maxRetryCount 到達) として準備
      await queueRepo.enqueueChapters(novel.id, [
        { chapterIndex: 1, targetUrl: episodeUrl(1) },
        { chapterIndex: 2, targetUrl: episodeUrl(2) },
        { chapterIndex: 3, targetUrl: episodeUrl(3) },
        { chapterIndex: 4, targetUrl: episodeUrl(4) },
      ]);
      await queueRepo.updateStatus(novel.id, 2, "downloading");
      for (let i = 0; i < 3; i++) {
        await queueRepo.updateStatus(novel.id, 4, "failed", {
          lastError: "err",
          incrementRetry: true,
        });
      }

      const httpClient = new MockHttpClient();
      httpClient.setResponse(episodeUrl(2), { html: episodeHtml(2) });
      httpClient.setResponse(episodeUrl(3), () => {
        throw new Error("503 Unavailable");
      });

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 5,
      });

      // 全話取得を待つ前に即時 resolve すること
      await scheduler.enqueueBatchCache(novel.id, [1, 2, 3, 4]);
      expect(scheduler.isNovelBatchCaching(novel.id)).toBe(true);
      expect(scheduler.getNovelProgress(novel.id)).toMatchObject({
        total: 2,
        failedCount: 0,
      });

      // 重複起動時は追加キュー登録されないこと
      const enqueueSpy = vi.spyOn(queueRepo, "enqueueChapters");
      await scheduler.enqueueBatchCache(novel.id, [1, 2, 3, 4]);
      expect(enqueueSpy).not.toHaveBeenCalled();

      await vi.waitFor(() => {
        expect(scheduler.getNovelProgress(novel.id)?.status).toBe("completed");
      });

      // ch 3 失敗が failedChapterIndexes に記録され、ch 4 は maxRetryCount 到達で対象外のまま残ること
      expect(scheduler.getNovelProgress(novel.id)).toMatchObject({
        status: "completed",
        isBatchCaching: false,
        current: 2,
        total: 2,
        failedCount: 1,
        failedChapterIndexes: [3],
      });
      const items = await queueRepo.listByNovelId(novel.id);
      const q3 = items.find((q) => q.chapterIndex === 3);
      const q4 = items.find((q) => q.chapterIndex === 4);
      expect(q3?.status).toBe("failed");
      expect(q3?.retryCount).toBe(1);
      expect(q3?.lastError).toBe("503 Unavailable");
      expect(q4?.retryCount).toBe(3);

      scheduler.dispose();
    });

    it("対象話が 0 件の場合（全話キャッシュ済みまたは maxRetryCount 到達）は即座に completed を通知すること", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedIndexes: [1, 2],
      });
      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient: new MockHttpClient(),
        parserRegistry: createDefaultParserRegistry(),
      });

      const events: CacheNovelProgress[] = [];
      scheduler.subscribeProgress(novel.id, (p) => events.push(p));

      await scheduler.enqueueBatchCache(novel.id, [1, 2]);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        status: "completed",
        isBatchCaching: false,
        current: 0,
        total: 0,
        failedCount: 0,
      });
      expect(scheduler.isNovelBatchCaching(novel.id)).toBe(false);
      scheduler.dispose();
    });

    it("low で7日経過キャッシュの取得が失敗した場合は既存キャッシュを保持し completed 扱いとして継続すること", async () => {
      const eightDaysAgo = new Date(
        Date.now() - (CACHE_TTL_MS + 86400000),
      ).toISOString();
      const novel = await seedNovel(novelRepo, chapterRepo, {
        chapterCount: 1,
        cachedIndexes: [1],
        downloadedAtByIndex: () => eightDaysAgo,
      });

      const httpClient = new MockHttpClient();
      httpClient.setResponse(episodeUrl(1), () => {
        throw new Error("offline");
      });
      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 5,
      });

      await scheduler.enqueueBatchCache(novel.id, [1]);
      await vi.waitFor(() => {
        expect(scheduler.getNovelProgress(novel.id)?.status).toBe("completed");
      });
      expect(scheduler.getNovelProgress(novel.id)?.failedCount).toBe(0);
      scheduler.dispose();
    });

    it("pauseNovelTasks / cancelNovelTasks(clearQueue有無) / cancelAllTasks(clearQueue有無) / syncNovelProgress / subscribeProgress / dispose が仕様通り動作すること", async () => {
      const novelA = await seedNovel(novelRepo, chapterRepo, {
        workId: "work-a",
        chapterCount: 3,
      });
      const novelB = await seedNovel(novelRepo, chapterRepo, {
        workId: "work-b",
        chapterCount: 2,
      });

      let allowResolveB1!: () => void;
      let notifyA2Started!: () => void;
      const a2Started = new Promise<void>((r) => {
        notifyA2Started = r;
      });
      const httpClient: HttpClientBridge = {
        getHtml: async (opts) => {
          if (opts.url.includes("work-a") && opts.url.endsWith("ep-2")) {
            notifyA2Started();
            return await new Promise((_, reject) => {
              opts.signal?.addEventListener(
                "abort",
                () => reject(new DOMException("Aborted", "AbortError")),
                { once: true },
              );
            });
          }
          if (opts.url.includes("work-b") && opts.url.endsWith("ep-1")) {
            await new Promise<void>((r, reject) => {
              allowResolveB1 = r;
              opts.signal?.addEventListener(
                "abort",
                () => reject(new DOMException("Aborted", "AbortError")),
                { once: true },
              );
            });
          }
          const epNum = /ep-(\d+)/.exec(opts.url)?.[1] ?? "1";
          return {
            status: 200,
            url: opts.url,
            headers: {},
            html: episodeHtml(Number(epNum)),
          };
        },
      };

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 5,
      });

      expect(scheduler.getNovelProgress("non-existent")).toBeNull();

      const aStatuses: CacheNovelProgress["status"][] = [];
      const unsubscribeA = scheduler.subscribeProgress(novelA.id, (p) => {
        aStatuses.push(p.status);
      });

      await scheduler.enqueueBatchCache(novelA.id, [1, 2, 3]);
      await a2Started;

      // pauseNovelTasks: ep-2 の downloading を pending に戻し paused を通知
      await scheduler.pauseNovelTasks(novelA.id);
      expect(aStatuses.at(-1)).toBe("paused");
      expect(scheduler.isNovelBatchCaching(novelA.id)).toBe(false);
      const pausedQueueA = await queueRepo.listByNovelId(novelA.id);
      expect(pausedQueueA.map((q) => [q.chapterIndex, q.status])).toEqual([
        [2, "pending"],
        [3, "pending"],
      ]);

      // 購読解除後は通知されないが同期は安全に動作すること
      unsubscribeA();
      await chapterRepo.saveChapterBody(
        novelA.id,
        2,
        {
          remoteChapterId: "ep-2",
          title: "第2話",
          bodyHtml: "<p>WebView取得</p>",
          byteSize: 15,
          prevChapterUrl: null,
          nextChapterUrl: null,
        },
        new Date().toISOString(),
      );
      await queueRepo.deleteByNovelAndChapters(novelA.id, [2]);
      await scheduler.syncNovelProgress(novelA.id);
      await scheduler.syncNovelProgress("unknown-novel");

      // cancelNovelTasks(clearQueue: false) でキューを保持したまま cancelled になること
      await scheduler.enqueueBatchCache(novelA.id, [3]);
      await scheduler.cancelNovelTasks(novelA.id, { clearQueue: false });
      expect(scheduler.getNovelProgress(novelA.id)?.status).toBe("cancelled");
      expect((await queueRepo.listByNovelId(novelA.id)).length).toBe(1);

      // cancelNovelTasks(デフォルト clearQueue: true) でキューがクリアされること
      await scheduler.cancelNovelTasks(novelA.id);
      expect((await queueRepo.listByNovelId(novelA.id)).length).toBe(0);

      // cancelAllTasks(clearQueue: false) -> cancelAllTasks(true)
      await scheduler.enqueueBatchCache(novelB.id, [1, 2]);
      await scheduler.cancelAllTasks({ clearQueue: false });
      expect(scheduler.getNovelProgress(novelB.id)?.status).toBe("cancelled");
      expect((await queueRepo.listByNovelId(novelB.id)).length).toBe(2);

      await scheduler.cancelAllTasks();
      expect((await queueRepo.listByNovelId(novelB.id)).length).toBe(0);

      void allowResolveB1;
      scheduler.dispose();
      // 二重 dispose も安全であること
      scheduler.dispose();
    });
  });

  describe("Tombstone / 並行削除保護 (getChapter !== null)", () => {
    it("HTTP 通信直前または直後に getChapter が null を返した場合、残タスクを破棄して cancelled に遷移し保存・失敗更新を行わないこと", async () => {
      const novelPre = await seedNovel(novelRepo, chapterRepo, {
        workId: "tomb-pre",
        chapterCount: 2,
      });
      const novelPost = await seedNovel(novelRepo, chapterRepo, {
        workId: "tomb-post",
        chapterCount: 2,
      });

      const saveSpy = vi.spyOn(chapterRepo, "saveChapterBody");
      const updateStatusSpy = vi.spyOn(queueRepo, "updateStatus");

      // 通信前 Tombstone: 開始直後に novelPre を削除
      const httpClient: HttpClientBridge = {
        getHtml: async (opts) => {
          if (opts.url.includes("tomb-post")) {
            await novelRepo.deleteNovel(novelPost.id);
          }
          return {
            status: 200,
            url: opts.url,
            headers: {},
            html: episodeHtml(1),
          };
        },
      };

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 5,
      });

      await novelRepo.deleteNovel(novelPre.id);
      // getChapter が null のため high も書き込みを行わず終了
      await scheduler.enqueuePrefetch({
        novelId: novelPre.id,
        chapterIndexes: [1],
        priority: "high",
      });

      // 通信後 Tombstone: getHtml 中に novelPost を削除 -> low 残タスク破棄 & cancelled
      await scheduler.enqueueBatchCache(novelPost.id, [1, 2]);
      await vi.waitFor(() => {
        expect(scheduler.getNovelProgress(novelPost.id)?.status).toBe(
          "cancelled",
        );
      });

      expect(saveSpy).not.toHaveBeenCalled();
      expect(
        updateStatusSpy.mock.calls.some(([, , st]) => st === "failed"),
      ).toBe(false);

      scheduler.dispose();
    });

    it("low の通信前・失敗時 Tombstone および high/medium の通信後・失敗時 Tombstone でも安全中断し書き込みを行わないこと", async () => {
      const novelLowPre = await seedNovel(novelRepo, chapterRepo, {
        workId: "tomb-low-pre",
        chapterCount: 2,
      });
      const novelLowErr = await seedNovel(novelRepo, chapterRepo, {
        workId: "tomb-low-err",
        chapterCount: 1,
      });
      const novelHighPost = await seedNovel(novelRepo, chapterRepo, {
        workId: "tomb-high-post",
        chapterCount: 1,
      });
      const novelHighErr = await seedNovel(novelRepo, chapterRepo, {
        workId: "tomb-high-err",
        chapterCount: 1,
      });

      const saveSpy = vi.spyOn(chapterRepo, "saveChapterBody");
      const updateStatusSpy = vi.spyOn(queueRepo, "updateStatus");

      const httpClient: HttpClientBridge = {
        getHtml: async (opts) => {
          if (opts.url.includes("tomb-low-err")) {
            await novelRepo.deleteNovel(novelLowErr.id);
            throw new Error("net fail after delete");
          }
          if (opts.url.includes("tomb-high-post")) {
            await novelRepo.deleteNovel(novelHighPost.id);
            return {
              status: 200,
              url: opts.url,
              headers: {},
              html: episodeHtml(1),
            };
          }
          if (opts.url.includes("tomb-high-err")) {
            await novelRepo.deleteNovel(novelHighErr.id);
            throw new Error("high fail after delete");
          }
          return {
            status: 200,
            url: opts.url,
            headers: {},
            html: episodeHtml(1),
          };
        },
      };

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 5,
      });

      // low pre-HTTP Tombstone: enqueueBatchCache 後に DB 削除された状態でステップ開始
      await scheduler.enqueueBatchCache(novelLowPre.id, [1, 2]);
      await novelRepo.deleteNovel(novelLowPre.id);
      await vi.waitFor(() => {
        expect(scheduler.getNovelProgress(novelLowPre.id)?.status).toBe(
          "cancelled",
        );
      });

      // low error-path Tombstone
      await scheduler.enqueueBatchCache(novelLowErr.id, [1]);
      await vi.waitFor(() => {
        expect(scheduler.getNovelProgress(novelLowErr.id)?.status).toBe(
          "cancelled",
        );
      });

      // high post-HTTP & error-path Tombstone (reject せず書き込みも行わず終了)
      await expect(
        scheduler.enqueuePrefetch({
          novelId: novelHighPost.id,
          chapterIndexes: [1],
          priority: "high",
        }),
      ).resolves.toBeUndefined();
      await expect(
        scheduler.enqueuePrefetch({
          novelId: novelHighErr.id,
          chapterIndexes: [1],
          priority: "high",
        }),
      ).resolves.toBeUndefined();

      expect(saveSpy).not.toHaveBeenCalled();
      expect(
        updateStatusSpy.mock.calls.some(([, , st]) => st === "failed"),
      ).toBe(false);

      scheduler.dispose();
    });
  });

  describe("追加境界分岐（再同期・maxRetry上限・abort保護・dispose後防御）", () => {
    it("アクティブ/一時停止バッチに対する syncNovelProgress が外部保存を検知し、失敗解除・完了遷移（およびクリア）を行うこと", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "sync-active",
        chapterCount: 3,
      });

      let releaseCh1!: () => void;
      const ch1Gate = new Promise<void>((r) => {
        releaseCh1 = r;
      });
      let notifyCh1Started!: () => void;
      const ch1Started = new Promise<void>((r) => {
        notifyCh1Started = r;
      });

      const httpClient: HttpClientBridge = {
        getHtml: async (opts) => {
          if (opts.url.endsWith("ep-1")) {
            notifyCh1Started();
            await ch1Gate;
          }
          if (opts.url.endsWith("ep-2")) {
            throw new Error("temp fail");
          }
          return {
            status: 200,
            url: opts.url,
            headers: {},
            html: episodeHtml(3),
          };
        },
      };

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 5,
      });

      await scheduler.enqueueBatchCache(novel.id, [1, 2, 3]);
      await ch1Started;

      // ch1 待機中に ch3 が外部（WebView等）でキャッシュ保存 & キュー削除されたと仮定
      await chapterRepo.saveChapterBody(
        novel.id,
        3,
        {
          remoteChapterId: "ep-3",
          title: "第3話",
          bodyHtml: "<p>外部取得</p>",
          byteSize: 12,
          prevChapterUrl: null,
          nextChapterUrl: null,
        },
        new Date().toISOString(),
      );
      await queueRepo.deleteByNovelAndChapters(novel.id, [3]);
      await scheduler.syncNovelProgress(novel.id);
      expect(scheduler.getNovelProgress(novel.id)?.current).toBe(1);

      releaseCh1();
      await vi.waitFor(() => {
        expect(scheduler.getNovelProgress(novel.id)?.status).toBe("completed");
      });
      // ep-2 が失敗として残っていること
      expect(
        scheduler.getNovelProgress(novel.id)?.failedChapterIndexes,
      ).toEqual([2]);

      // 失敗話 ep-2 を外部取得で救済し syncNovelProgress -> failedChapterIndexes から消えること
      await chapterRepo.saveChapterBody(
        novel.id,
        2,
        {
          remoteChapterId: "ep-2",
          title: "第2話",
          bodyHtml: "<p>外部救済</p>",
          byteSize: 12,
          prevChapterUrl: null,
          nextChapterUrl: null,
        },
        new Date().toISOString(),
      );
      await queueRepo.deleteByNovelAndChapters(novel.id, [2]);
      await scheduler.syncNovelProgress(novel.id);
      expect(
        scheduler.getNovelProgress(novel.id)?.failedChapterIndexes,
      ).toEqual([]);

      // paused 状態から全残話を外部保存して syncNovelProgress -> completed 遷移すること
      const novelPaused = await seedNovel(novelRepo, chapterRepo, {
        workId: "sync-paused",
        chapterCount: 2,
      });
      await scheduler.enqueueBatchCache(novelPaused.id, [1, 2]);
      await scheduler.pauseNovelTasks(novelPaused.id);
      await chapterRepo.saveChapterBody(
        novelPaused.id,
        1,
        {
          remoteChapterId: "ep-1",
          title: "第1話",
          bodyHtml: "<p>ext1</p>",
          byteSize: 10,
          prevChapterUrl: null,
          nextChapterUrl: null,
        },
        new Date().toISOString(),
      );
      await chapterRepo.saveChapterBody(
        novelPaused.id,
        2,
        {
          remoteChapterId: "ep-2",
          title: "第2話",
          bodyHtml: "<p>ext2</p>",
          byteSize: 10,
          prevChapterUrl: null,
          nextChapterUrl: null,
        },
        new Date().toISOString(),
      );
      await queueRepo.deleteByNovelAndChapters(novelPaused.id, [1, 2]);
      await scheduler.syncNovelProgress(novelPaused.id);
      expect(scheduler.getNovelProgress(novelPaused.id)?.status).toBe(
        "completed",
      );

      scheduler.dispose();
    });

    it("signal を無視して解決する通信中の中断・cancelNovelTasks の高/中優先度中断・待機キュー内 signal abort・maxRetryCount 到達 0件・dispose 後ガードが安全に動作すること", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "edge-all",
        chapterCount: 4,
      });
      const novelQueued = await seedNovel(novelRepo, chapterRepo, {
        workId: "edge-queued",
        chapterCount: 2,
      });

      // retryCount = maxRetryCount (3) 到達済みキューを作成し 0 targets 時の failed 保持を確認
      await queueRepo.enqueueChapters(novelQueued.id, [
        {
          chapterIndex: 1,
          targetUrl: `https://kakuyomu.jp/works/edge-queued/episodes/ep-1`,
        },
      ]);
      for (let i = 0; i < 3; i++) {
        await queueRepo.updateStatus(novelQueued.id, 1, "failed", {
          lastError: "fail",
          incrementRetry: true,
        });
      }

      let releaseIgnoredHttp!: () => void;
      const ignoredHttpGate = new Promise<void>((r) => {
        releaseIgnoredHttp = r;
      });
      let notifyIgnoredStarted!: () => void;
      const ignoredStarted = new Promise<void>((r) => {
        notifyIgnoredStarted = r;
      });

      const httpClient: HttpClientBridge = {
        getHtml: async (opts) => {
          if (opts.url.includes("edge-all") && opts.url.endsWith("ep-1")) {
            notifyIgnoredStarted();
            // signal.aborted を無視して遅れて resolve するモック（abort後書き込み防止確認）
            await ignoredHttpGate;
          }
          return {
            status: 200,
            url: opts.url,
            headers: {},
            html: episodeHtml(1),
          };
        },
      };

      const saveSpy = vi.spyOn(chapterRepo, "saveChapterBody");
      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 10,
      });

      // unsubscribe 二重呼び出し安全確認
      const unsub = scheduler.subscribeProgress(novel.id, () => {});
      unsub();
      unsub();

      // targets=0 でも maxRetryCount 到達 failed 行があれば clearNovelQueue されず failedChapterIndexes に残ること
      await scheduler.enqueueBatchCache(novelQueued.id, [1]);
      expect(
        scheduler.getNovelProgress(novelQueued.id)?.failedChapterIndexes,
      ).toEqual([1]);

      // high 実行中（signal 無視して遅れて解決）にキュー積み込み -> queued signal abort + cancelNovelTasks 検証
      const highActivePromise = scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [1],
        priority: "high",
      });
      await ignoredStarted;

      const queuedController = new AbortController();
      const queuedMediumPromise = scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [2],
        priority: "medium",
        signal: queuedController.signal,
      });
      // キュー待機中に caller signal を abort -> キューから除去され即 resolve
      queuedController.abort();
      await expect(queuedMediumPromise).resolves.toBeUndefined();

      // 待機中の別タスクを積んで cancelNovelTasks でアクティブ+待機を両方キャンセル
      const cancelPending = scheduler.cancelNovelTasks(novel.id);
      releaseIgnoredHttp();
      await highActivePromise;
      await cancelPending;
      expect(saveSpy).not.toHaveBeenCalled();

      // low 実行中（signal 無視して解決）に pauseNovelTasks -> downloadAndPersistChapter の aborted 戻り確認
      let releaseLowIgnored!: () => void;
      const lowIgnoredGate = new Promise<void>((r) => {
        releaseLowIgnored = r;
      });
      let notifyLowIgnoredStarted!: () => void;
      const lowIgnoredStarted = new Promise<void>((r) => {
        notifyLowIgnoredStarted = r;
      });
      vi.spyOn(httpClient, "getHtml").mockImplementationOnce(async (opts) => {
        notifyLowIgnoredStarted();
        await lowIgnoredGate;
        return {
          status: 200,
          url: opts.url,
          headers: {},
          html: episodeHtml(2),
        };
      });

      await scheduler.enqueueBatchCache(novel.id, [2]);
      await lowIgnoredStarted;
      const pausePromise = scheduler.pauseNovelTasks(novel.id);
      releaseLowIgnored();
      await pausePromise;

      // dispose 後の enqueuePrefetch / enqueueBatchCache は何もしないこと
      scheduler.dispose();
      await scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [3],
        priority: "high",
      });
      await scheduler.enqueueBatchCache(novel.id, [3]);
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("medium が通信中に high で割り込まれた場合、残りの話数を保持して high 完了後に再開すること", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "med-preempt-http",
        chapterCount: 3,
      });

      let notifyCh2Started!: () => void;
      const ch2Started = new Promise<void>((r) => {
        notifyCh2Started = r;
      });
      let ch2Attempt = 0;

      const httpClient: HttpClientBridge = {
        getHtml: async (opts) => {
          if (opts.url.endsWith("ep-2") && ch2Attempt === 0) {
            ch2Attempt += 1;
            notifyCh2Started();
            return await new Promise((_, reject) => {
              opts.signal?.addEventListener(
                "abort",
                () => reject(new DOMException("Preempted", "AbortError")),
                { once: true },
              );
            });
          }
          const epNum = /ep-(\d+)/.exec(opts.url)?.[1] ?? "1";
          return {
            status: 200,
            url: opts.url,
            headers: {},
            html: episodeHtml(Number(epNum)),
          };
        },
      };

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 5,
      });

      const mediumPromise = scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [2, 3],
        priority: "medium",
      });
      await ch2Started;

      // medium の ep-2 通信中に high(ep-1) で割り込み
      await scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [1],
        priority: "high",
      });
      await mediumPromise;

      const ch1 = await chapterRepo.getChapter(novel.id, 1);
      const ch2 = await chapterRepo.getChapter(novel.id, 2);
      const ch3 = await chapterRepo.getChapter(novel.id, 3);
      expect(ch1?.bodyHtml).toContain("第1話の本文");
      expect(ch2?.bodyHtml).toContain("第2話の本文");
      expect(ch3?.bodyHtml).toContain("第3話の本文");
      scheduler.dispose();
    });

    it("待機中 high の caller signal 中断・cancelQueuedPrefetches の他作品除外・low 実行直前の Tombstone / 既新鮮スキップが正しく動作すること", async () => {
      const novelBlocker = await seedNovel(novelRepo, chapterRepo, {
        workId: "blocker",
        chapterCount: 2,
      });
      const novelPreDel = await seedNovel(novelRepo, chapterRepo, {
        workId: "pre-del-low",
        chapterCount: 2,
      });
      const novelFreshSkip = await seedNovel(novelRepo, chapterRepo, {
        workId: "fresh-skip-low",
        chapterCount: 2,
      });

      let releaseBlocker!: () => void;
      const blockerGate = new Promise<void>((r) => {
        releaseBlocker = r;
      });
      let notifyBlockerStarted!: () => void;
      const blockerStarted = new Promise<void>((r) => {
        notifyBlockerStarted = r;
      });

      const httpClient: HttpClientBridge = {
        getHtml: async (opts) => {
          if (opts.url.includes("blocker") && opts.url.endsWith("ep-1")) {
            notifyBlockerStarted();
            await blockerGate;
          }
          return {
            status: 200,
            url: opts.url,
            headers: {},
            html: episodeHtml(1),
          };
        },
      };

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 5,
      });

      // 1. ブロッカー high(ep-1) を起動して後続をキュー待機させる
      const blockerPromise = scheduler.enqueuePrefetch({
        novelId: novelBlocker.id,
        chapterIndexes: [1],
        priority: "high",
      });
      await blockerStarted;

      // 2. 待機中 high の caller signal abort
      const queuedHighCtrl = new AbortController();
      const queuedHighPromise = scheduler.enqueuePrefetch({
        novelId: novelBlocker.id,
        chapterIndexes: [2],
        priority: "high",
        signal: queuedHighCtrl.signal,
      });
      queuedHighCtrl.abort();
      await expect(queuedHighPromise).resolves.toBeUndefined();

      // 3. 待機キューに他作品タスクと対象作品タスクを両方積み、novelPreDel のみ cancelNovelTasks で除去
      const otherMediumPromise = scheduler.enqueuePrefetch({
        novelId: novelFreshSkip.id,
        chapterIndexes: [2],
        priority: "medium",
      });
      const targetMediumPromise = scheduler.enqueuePrefetch({
        novelId: novelPreDel.id,
        chapterIndexes: [2],
        priority: "medium",
      });

      // 4. high/medium 待機中に low バッチを登録（preempted で開始）し、low 実行前に DB 更新・削除を行う
      await scheduler.enqueueBatchCache(novelPreDel.id, [1]);
      await scheduler.enqueueBatchCache(novelFreshSkip.id, [1]);
      await novelRepo.deleteNovel(novelPreDel.id);
      await chapterRepo.saveChapterBody(
        novelFreshSkip.id,
        1,
        {
          remoteChapterId: "ep-1",
          title: "第1話",
          bodyHtml: "<p>既キャッシュ</p>",
          byteSize: 10,
          prevChapterUrl: null,
          nextChapterUrl: null,
        },
        new Date().toISOString(),
      );

      // novelPreDel のみキャンセル（novelFreshSkip の medium はキューに残る）
      await scheduler.cancelNovelTasks(novelPreDel.id);
      await expect(targetMediumPromise).resolves.toBeUndefined();

      // ブロッカー解除 -> pre-del(Tombstoneスキップ済み) / fresh-skip(既新鮮でHTTPなし完了) / otherMedium が完了
      releaseBlocker();
      await blockerPromise;
      await otherMediumPromise;

      await vi.waitFor(() => {
        expect(scheduler.getNovelProgress(novelFreshSkip.id)?.status).toBe(
          "completed",
        );
      });

      // high 実行前の low 事前 Tombstone (runLowStep 内の chapter === null) を個別検証
      const novelPreStep = await seedNovel(novelRepo, chapterRepo, {
        workId: "pre-step-tomb",
        chapterCount: 1,
      });
      let releaseHold!: () => void;
      const holdGate = new Promise<void>((r) => {
        releaseHold = r;
      });
      let notifyHoldStarted!: () => void;
      const holdStarted = new Promise<void>((r) => {
        notifyHoldStarted = r;
      });
      vi.spyOn(httpClient, "getHtml").mockImplementationOnce(async (opts) => {
        notifyHoldStarted();
        await holdGate;
        return {
          status: 200,
          url: opts.url,
          headers: {},
          html: episodeHtml(2),
        };
      });
      const holdPromise = scheduler.enqueuePrefetch({
        novelId: novelBlocker.id,
        chapterIndexes: [2],
        priority: "high",
      });
      await holdStarted;
      await scheduler.enqueueBatchCache(novelPreStep.id, [1]);
      await novelRepo.deleteNovel(novelPreStep.id);
      releaseHold();
      await holdPromise;
      await vi.waitFor(() => {
        expect(scheduler.getNovelProgress(novelPreStep.id)?.status).toBe(
          "cancelled",
        );
      });

      scheduler.dispose();
    });

    it("low が 1.5s スリープ中に medium または high が割り込むとスリープが即時中断され上位優先度が先に実行されること", async () => {
      vi.useFakeTimers();
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "low-sleep-preempt",
        chapterCount: 3,
      });

      const httpClient = new MockHttpClient();
      for (let i = 1; i <= 3; i++) {
        httpClient.setResponse(
          `https://kakuyomu.jp/works/low-sleep-preempt/episodes/ep-${i}`,
          { html: episodeHtml(i) },
        );
      }

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
      });

      await scheduler.enqueueBatchCache(novel.id, [1, 2]);
      // ep-1 完了後、ep-2 の前の 1500ms スリープに入った状態まで少し進める
      await vi.advanceTimersByTimeAsync(100);
      expect(scheduler.getNovelProgress(novel.id)?.current).toBe(1);

      // low スリープ中に medium を投入 -> low スリープを即中断し preempted に遷移
      const mediumPromise = scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [3],
        priority: "medium",
      });
      expect(scheduler.getNovelProgress(novel.id)?.status).toBe("preempted");

      await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS * 2);
      await mediumPromise;

      // medium 完了後、low が ep-2 を取得して完了すること
      await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS * 2);
      expect(scheduler.getNovelProgress(novel.id)?.status).toBe("completed");
      scheduler.dispose();
    });
  });
});

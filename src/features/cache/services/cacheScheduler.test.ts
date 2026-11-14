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

  describe("独立レビュー Round 1 指摘事項の境界・競合耐性", () => {
    it("enqueueBatchCache（targets > 0）でリトライ上限の既存 failed 行が clearNovelQueue で消去されず完了行のみ削除されること", async () => {
      const eightDaysAgo = new Date(
        Date.now() - (CACHE_TTL_MS + 86400000),
      ).toISOString();
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "preserve-failed-row",
        chapterCount: 3,
        cachedIndexes: [3],
        downloadedAtByIndex: () => eightDaysAgo,
      });

      // 第1話は retryCount = 3 (failed) で上限到達、第2話は未取得、第3話は古いキャッシュで失敗->completed行残存
      await queueRepo.enqueueChapters(novel.id, [
        { chapterIndex: 1, targetUrl: episodeUrl(1) },
      ]);
      for (let i = 0; i < 3; i++) {
        await queueRepo.updateStatus(novel.id, 1, "failed", {
          lastError: "前回エラー",
          incrementRetry: true,
        });
      }

      const clearSpy = vi.spyOn(queueRepo, "clearNovelQueue");
      const httpClient = new MockHttpClient();
      httpClient.setResponse(
        `https://kakuyomu.jp/works/preserve-failed-row/episodes/ep-2`,
        { html: episodeHtml(2) },
      );
      httpClient.setResponse(
        `https://kakuyomu.jp/works/preserve-failed-row/episodes/ep-3`,
        () => {
          throw new Error("stale refresh network error");
        },
      );

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 0,
      });

      await scheduler.enqueueBatchCache(novel.id, [1, 2, 3]);
      await vi.waitFor(() => {
        expect(scheduler.getNovelProgress(novel.id)?.status).toBe("completed");
      });

      expect(clearSpy).not.toHaveBeenCalled();

      const remainingQueue = await queueRepo.listByNovelId(novel.id);
      expect(remainingQueue.map((item) => item.chapterIndex)).toEqual([1]);
      expect(remainingQueue[0].status).toBe("failed");
      expect(remainingQueue[0].retryCount).toBe(3);

      scheduler.dispose();
    });

    it("downloadAndPersistChapter / runPrefetchTask / runLowStep の各 await 境界で AbortSignal 中断時に DB 更新や後続通信を抑止すること", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "await-abort-guards",
        chapterCount: 4,
        cachedIndexes: [3],
      });

      // 1. downloadAndPersistChapter の getChapter 後（HTTP 完了直後の Tombstone チェック）での abort
      const httpClient1 = new MockHttpClient();
      httpClient1.setResponse(
        `https://kakuyomu.jp/works/await-abort-guards/episodes/ep-1`,
        { html: episodeHtml(1) },
      );
      const scheduler1 = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient: httpClient1,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 0,
      });

      const controller1 = new AbortController();
      const saveSpy1 = vi.spyOn(chapterRepo, "saveChapterBody");
      const origGetChapter = chapterRepo.getChapter.bind(chapterRepo);
      let getCallCount1 = 0;
      const getSpy1 = vi
        .spyOn(chapterRepo, "getChapter")
        .mockImplementation(async (nId, chIdx) => {
          getCallCount1 += 1;
          const res = await origGetChapter(nId, chIdx);
          if (getCallCount1 === 2) {
            controller1.abort();
          }
          return res;
        });

      await scheduler1.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [1],
        priority: "medium",
        signal: controller1.signal,
      });
      expect(saveSpy1).not.toHaveBeenCalled();
      expect(scheduler1.getNovelProgress(novel.id)).toBeNull();
      getSpy1.mockRestore();
      saveSpy1.mockRestore();
      scheduler1.dispose();

      // 2. downloadAndPersistChapter の saveChapterBody 中の abort -> 保存完了後は queue 削除を実行（R1-22）
      const httpClient2 = new MockHttpClient();
      httpClient2.setResponse(
        `https://kakuyomu.jp/works/await-abort-guards/episodes/ep-1`,
        { html: episodeHtml(1) },
      );
      const scheduler2 = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient: httpClient2,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 0,
      });

      let releaseSave2!: () => void;
      const saveGate2 = new Promise<void>((r) => {
        releaseSave2 = r;
      });
      let notifySaveStarted2!: () => void;
      const onSaveStarted2 = new Promise<void>((r) => {
        notifySaveStarted2 = r;
      });
      const origSave2 = chapterRepo.saveChapterBody.bind(chapterRepo);
      const saveSpy2 = vi
        .spyOn(chapterRepo, "saveChapterBody")
        .mockImplementationOnce(async (...args) => {
          notifySaveStarted2();
          await saveGate2;
          return await origSave2(...args);
        });
      const deleteQueueSpy2 = vi.spyOn(queueRepo, "deleteByNovelAndChapters");

      const controller2 = new AbortController();
      const p2 = scheduler2.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [1],
        priority: "medium",
        signal: controller2.signal,
      });
      await onSaveStarted2;
      controller2.abort();
      releaseSave2();
      await p2;
      expect(deleteQueueSpy2).toHaveBeenCalledWith(novel.id, [1]);
      saveSpy2.mockRestore();
      deleteQueueSpy2.mockRestore();
      scheduler2.dispose();

      // 3. runPrefetchTask の pre-HTTP getChapter 中の abort -> httpClient.getHtml 未呼出
      const httpClient3 = new MockHttpClient();
      const getHtmlSpy3 = vi.spyOn(httpClient3, "getHtml");
      const scheduler3 = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient: httpClient3,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 0,
      });
      const controller3 = new AbortController();
      const getSpy3 = vi
        .spyOn(chapterRepo, "getChapter")
        .mockImplementationOnce(async (nId, chIdx) => {
          const res = await origGetChapter(nId, chIdx);
          controller3.abort();
          return res;
        });

      await scheduler3.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [2],
        priority: "medium",
        signal: controller3.signal,
      });
      expect(getHtmlSpy3).not.toHaveBeenCalled();
      getSpy3.mockRestore();
      getHtmlSpy3.mockRestore();
      scheduler3.dispose();

      // 4. runLowStep の pre-HTTP getChapter 中の pause -> fresh 章でも deleteByNovelAndChapters / updateStatus 未実行
      const httpClient4 = new MockHttpClient();
      const scheduler4 = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient: httpClient4,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 0,
      });
      let notifyLowGetStarted!: () => void;
      const onLowGetStarted = new Promise<void>((r) => {
        notifyLowGetStarted = r;
      });
      let releaseLowGet!: () => void;
      const lowGetGate = new Promise<void>((r) => {
        releaseLowGet = r;
      });
      const getSpy4 = vi
        .spyOn(chapterRepo, "getChapter")
        .mockImplementationOnce(async (nId, chIdx) => {
          notifyLowGetStarted();
          await lowGetGate;
          // 待機中に外部保存されて新鮮になった場合でも、pause 後なら deleteByNovelAndChapters は呼ばれない
          await chapterRepo.saveChapterBody(
            nId,
            chIdx,
            {
              remoteChapterId: "ep-4",
              title: "第4話",
              bodyHtml: "<p>外部保存</p>",
              byteSize: 16,
              prevChapterUrl: null,
              nextChapterUrl: null,
            },
            new Date().toISOString(),
          );
          return await origGetChapter(nId, chIdx);
        });
      const updateStatusSpy4 = vi.spyOn(queueRepo, "updateStatus");

      await scheduler4.enqueueBatchCache(novel.id, [4]);
      const deleteQueueSpy4 = vi.spyOn(queueRepo, "deleteByNovelAndChapters");
      await onLowGetStarted;
      const pausePromise4 = scheduler4.pauseNovelTasks(novel.id);
      releaseLowGet();
      await pausePromise4;

      expect(deleteQueueSpy4).not.toHaveBeenCalled();
      expect(updateStatusSpy4).not.toHaveBeenCalled();
      expect(scheduler4.getNovelProgress(novel.id)?.status).toBe("paused");
      getSpy4.mockRestore();
      deleteQueueSpy4.mockRestore();
      updateStatusSpy4.mockRestore();
      scheduler4.dispose();

      // 5. runLowStep の updateStatus("downloading") 中の abort -> resetInterruptedToPending で pending 復帰し HTTP 未実行
      const novel5 = await seedNovel(novelRepo, chapterRepo, {
        workId: "await-abort-downloading-status",
        chapterCount: 1,
      });
      const httpClient5 = new MockHttpClient();
      const getHtmlSpy5 = vi.spyOn(httpClient5, "getHtml");
      const scheduler5 = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient: httpClient5,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 0,
      });
      let notifyDlUpdate!: () => void;
      const onDlUpdate = new Promise<void>((r) => {
        notifyDlUpdate = r;
      });
      let releaseDlUpdate!: () => void;
      const dlUpdateGate = new Promise<void>((r) => {
        releaseDlUpdate = r;
      });
      const origUpdate5 = queueRepo.updateStatus.bind(queueRepo);
      const updateSpy5 = vi
        .spyOn(queueRepo, "updateStatus")
        .mockImplementationOnce(async (nId, chIdx, st, opts) => {
          await origUpdate5(nId, chIdx, st, opts);
          notifyDlUpdate();
          await dlUpdateGate;
        });
      await scheduler5.enqueueBatchCache(novel5.id, [1]);
      await onDlUpdate;
      const pausePromise5 = scheduler5.pauseNovelTasks(novel5.id);
      releaseDlUpdate();
      await pausePromise5;
      expect(getHtmlSpy5).not.toHaveBeenCalled();
      const q5 = await queueRepo.listByNovelId(novel5.id);
      expect(q5[0].status).toBe("pending");
      updateSpy5.mockRestore();
      getHtmlSpy5.mockRestore();
      scheduler5.dispose();
    });

    it("enqueueBatchCache の各 await 境界で dispose() された場合は後続リポジトリ操作やキュー起動を行わず終了すること", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "batch-dispose-guards",
        chapterCount: 2,
        cachedIndexes: [1],
      });

      const runDisposeBoundary = async (
        intercept: "reset" | "list" | "delete" | "clear" | "enqueue",
        indexes: number[],
      ) => {
        const httpClient = new MockHttpClient();
        const scheduler = createCacheScheduler({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          httpClient,
          parserRegistry: createDefaultParserRegistry(),
          prefetchIntervalMs: 0,
        });

        const origReset = queueRepo.resetInterruptedToPending.bind(queueRepo);
        const origListChapters =
          chapterRepo.listChaptersByNovelId.bind(chapterRepo);
        const origDelete = queueRepo.deleteByNovelAndChapters.bind(queueRepo);
        const origClear = queueRepo.clearNovelQueue.bind(queueRepo);
        const origEnqueue = queueRepo.enqueueChapters.bind(queueRepo);

        if (intercept === "reset") {
          vi.spyOn(
            queueRepo,
            "resetInterruptedToPending",
          ).mockImplementationOnce(async (nId) => {
            await origReset(nId);
            scheduler.dispose();
          });
        } else if (intercept === "list") {
          vi.spyOn(chapterRepo, "listChaptersByNovelId").mockImplementationOnce(
            async (nId) => {
              const res = await origListChapters(nId);
              scheduler.dispose();
              return res;
            },
          );
        } else if (intercept === "delete") {
          vi.spyOn(
            queueRepo,
            "deleteByNovelAndChapters",
          ).mockImplementationOnce(async (nId, chs) => {
            await origDelete(nId, chs);
            scheduler.dispose();
          });
        } else if (intercept === "clear") {
          vi.spyOn(queueRepo, "clearNovelQueue").mockImplementationOnce(
            async (nId) => {
              await origClear(nId);
              scheduler.dispose();
            },
          );
        } else {
          vi.spyOn(queueRepo, "enqueueChapters").mockImplementationOnce(
            async (nId, items) => {
              await origEnqueue(nId, items);
              scheduler.dispose();
            },
          );
        }

        await scheduler.enqueueBatchCache(novel.id, indexes);
        expect(scheduler.getNovelProgress(novel.id)).toBeNull();
        expect(scheduler.isNovelBatchCaching(novel.id)).toBe(false);
        vi.restoreAllMocks();
      };

      await runDisposeBoundary("reset", [1, 2]);
      await runDisposeBoundary("list", [1, 2]);
      await runDisposeBoundary("delete", [1, 2]);
      await runDisposeBoundary("clear", [1]);
      await runDisposeBoundary("enqueue", [2]);
    });

    it("cancelNovelTasks 待機中に別作品 high が到着してもキャンセル済み medium の中断理由が preempted に上書きされず再投入されないこと", async () => {
      const novel1 = await seedNovel(novelRepo, chapterRepo, {
        workId: "cancel-vs-preempt-1",
        chapterCount: 2,
      });
      const novel2 = await seedNovel(novelRepo, chapterRepo, {
        workId: "cancel-vs-preempt-2",
        chapterCount: 1,
      });

      let ep1FetchCount = 0;
      let notifyEp1Started!: () => void;
      const onEp1Started = new Promise<void>((r) => {
        notifyEp1Started = r;
      });
      let releaseEp1CancelWait!: () => void;
      const ep1CancelWait = new Promise<void>((r) => {
        releaseEp1CancelWait = r;
      });

      const httpClient: HttpClientBridge = {
        getHtml: async (opts) => {
          if (opts.url.includes("cancel-vs-preempt-1")) {
            ep1FetchCount += 1;
            if (ep1FetchCount === 1) {
              notifyEp1Started();
              // abort 後も cleanup のため少し遅れて reject する
              await new Promise<void>((_, reject) => {
                opts.signal?.addEventListener(
                  "abort",
                  () => {
                    void ep1CancelWait.then(() =>
                      reject(opts.signal?.reason ?? new Error("aborted")),
                    );
                  },
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
        prefetchIntervalMs: 0,
      });

      const mediumPromise = scheduler.enqueuePrefetch({
        novelId: novel1.id,
        chapterIndexes: [1, 2],
        priority: "medium",
      });
      await onEp1Started;

      const cancelPromise = scheduler.cancelNovelTasks(novel1.id);
      const highPromise = scheduler.enqueuePrefetch({
        novelId: novel2.id,
        chapterIndexes: [1],
        priority: "high",
      });

      releaseEp1CancelWait();
      await Promise.all([cancelPromise, mediumPromise, highPromise]);

      // novel1 の medium タスクは再キュー・再取得されず完了していること
      expect(ep1FetchCount).toBe(1);
      scheduler.dispose();
    });

    it("medium が最終話完了直後に high にプリエンプトされても空配列タスクが mediumQueue へ再投入されないこと", async () => {
      vi.useFakeTimers();
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "medium-empty-requeue",
        chapterCount: 3,
      });

      const httpClient = new MockHttpClient();
      for (let i = 1; i <= 3; i++) {
        httpClient.setResponse(
          `https://kakuyomu.jp/works/medium-empty-requeue/episodes/ep-${i}`,
          { html: episodeHtml(i) },
        );
      }
      const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 1500,
      });

      // medium [1] を先に投入し、待機中に low [3] を登録。ep-1 の deleteByNovelAndChapters 中に high [2] を投入
      let triggeredHigh = false;
      const origDel = queueRepo.deleteByNovelAndChapters.bind(queueRepo);
      vi.spyOn(queueRepo, "deleteByNovelAndChapters").mockImplementation(
        async (nId, chs) => {
          await origDel(nId, chs);
          if (!triggeredHigh && chs.includes(1)) {
            triggeredHigh = true;
            void scheduler.enqueuePrefetch({
              novelId: novel.id,
              chapterIndexes: [2],
              priority: "high",
            });
          }
        },
      );

      let mediumDone = false;
      const mediumPromise = scheduler
        .enqueuePrefetch({
          novelId: novel.id,
          chapterIndexes: [1],
          priority: "medium",
        })
        .then(() => {
          mediumDone = true;
        });
      await scheduler.enqueueBatchCache(novel.id, [3]);

      // medium 最初の 1500ms 待機を進めると medium [1] 完了＋high [2] 即時完了し、
      // high [2] の HTTP 完了から 1500ms 未満のため low [3] はまだ待機中（空タスク再投入の追加待ちなし）
      await vi.advanceTimersByTimeAsync(1600);
      expect(mediumDone).toBe(true);
      await mediumPromise;
      expect(getHtmlSpy).toHaveBeenCalledTimes(2);

      // さらに 1500ms 経過後に low [3] が実行されて完了する
      await vi.advanceTimersByTimeAsync(1500);
      expect(scheduler.getNovelProgress(novel.id)?.status).toBe("completed");
      expect(getHtmlSpy).toHaveBeenCalledTimes(3);
      scheduler.dispose();
    });

    it("runLowStep の失敗 catch 処理中に syncNovelProgress が当該話数を外部完了同期した場合、後続話数が誤削除・二重カウントされないこと", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "low-catch-sync-race",
        chapterCount: 2,
      });

      let rejectEp1Http!: (err: unknown) => void;
      let notifyEp1HttpStarted!: () => void;
      const onEp1HttpStarted = new Promise<void>((r) => {
        notifyEp1HttpStarted = r;
      });

      const httpClient: HttpClientBridge = {
        getHtml: async (opts) => {
          if (opts.url.includes("ep-1")) {
            notifyEp1HttpStarted();
            return await new Promise((_, reject) => {
              rejectEp1Http = reject;
            });
          }
          return {
            status: 200,
            url: opts.url,
            headers: {},
            html: episodeHtml(2),
          };
        },
      };

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 0,
      });

      await scheduler.enqueueBatchCache(novel.id, [1, 2]);
      await onEp1HttpStarted;

      // HTTP 失敗確定前に第1話が外部手段で取得完了・キュー削除・syncNovelProgress された状態を作る
      await chapterRepo.saveChapterBody(
        novel.id,
        1,
        {
          remoteChapterId: "ep-1",
          title: "第1話",
          bodyHtml: "<p>WebView取得</p>",
          byteSize: 20,
          prevChapterUrl: null,
          nextChapterUrl: null,
        },
        new Date().toISOString(),
      );
      await queueRepo.deleteByNovelAndChapters(novel.id, [1]);
      await scheduler.syncNovelProgress(novel.id);
      expect(scheduler.getNovelProgress(novel.id)?.current).toBe(1);

      // その直後に第1話の HTTP がネットワークエラー（getChapter !== null -> failed 記録）で失敗しても第2話はスキップされず取得完了すること
      rejectEp1Http(new Error("timeout"));

      await vi.waitFor(() => {
        expect(scheduler.getNovelProgress(novel.id)?.status).toBe("completed");
      });

      const progress = scheduler.getNovelProgress(novel.id);
      expect(progress?.current).toBe(2);
      expect(progress?.total).toBe(2);
      const ch2 = await chapterRepo.getChapter(novel.id, 2);
      expect(ch2?.bodyHtml).toContain("第2話の本文");
      scheduler.dispose();
    });

    it("onSignalAbort がキュー取り出し直後・実行開始前（idx === -1）の abort で後続タスクを誤削除せず即座に早期完了すること", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "signal-abort-idx-minus-1",
        chapterCount: 3,
      });
      const novel2 = await seedNovel(novelRepo, chapterRepo, {
        workId: "signal-abort-idx-minus-1-extra",
        chapterCount: 2,
      });

      const calledUrls: string[] = [];
      let releaseHighBlocker!: () => void;
      const highBlockerGate = new Promise<void>((r) => {
        releaseHighBlocker = r;
      });
      let notifyHighStarted!: () => void;
      const onHighStarted = new Promise<void>((r) => {
        notifyHighStarted = r;
      });

      const httpWithGate: HttpClientBridge = {
        getHtml: async (opts) => {
          calledUrls.push(opts.url);
          if (opts.url.includes("extra") && opts.url.includes("ep-2")) {
            notifyHighStarted();
            await highBlockerGate;
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
        httpClient: httpWithGate,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 0,
      });

      const blockerHigh = scheduler.enqueuePrefetch({
        novelId: novel2.id,
        chapterIndexes: [2],
        priority: "high",
      });
      await onHighStarted;

      // high 実行中に 2 作品分のバッチを登録 (ともに status = "preempted")
      await scheduler.enqueueBatchCache(novel.id, [1]);
      await scheduler.enqueueBatchCache(novel2.id, [1]);

      const controllerAbortTarget = new AbortController();
      let enqueuedPair = false;
      let aSettled = false;
      let bSettled = false;

      scheduler.subscribeProgress(novel.id, (progress) => {
        // syncActiveBatchesStatus(false) 1周目で novel が running になった瞬間に medium A/B を投入する
        // （enqueuePrefetch 内の syncActiveBatchesStatus(true) が novel を preempted へ戻した後、
        //   外側の syncActiveBatchesStatus(false) ループが 2周目で novel2 を running へ遷移させる）
        if (progress.status === "running" && !enqueuedPair) {
          enqueuedPair = true;
          void scheduler
            .enqueuePrefetch({
              novelId: novel.id,
              chapterIndexes: [2],
              priority: "medium",
              signal: controllerAbortTarget.signal,
            })
            .then(() => {
              aSettled = true;
            });
          void scheduler
            .enqueuePrefetch({
              novelId: novel.id,
              chapterIndexes: [3],
              priority: "medium",
            })
            .then(() => {
              bSettled = true;
            });
        }
      });

      scheduler.subscribeProgress(novel2.id, (progress) => {
        // 次ループで kickWorker が mediumQueue.shift() で A を取り出した直後・runPrefetchTask(A) 前に
        // syncActiveBatchesStatus(true) が novel2 を running -> preempted へ遷移させる瞬間に A を abort
        if (
          enqueuedPair &&
          progress.status === "preempted" &&
          !controllerAbortTarget.signal.aborted
        ) {
          controllerAbortTarget.abort();
        }
      });

      releaseHighBlocker();
      await blockerHigh;

      // kickWorker が A を取り出した直後の syncActiveBatchesStatus(true) で abort() 発火後にセンチネル投入
      await vi.waitFor(() => {
        expect(controllerAbortTarget.signal.aborted).toBe(true);
      });
      await scheduler.enqueuePrefetch({
        novelId: novel2.id,
        chapterIndexes: [1],
        priority: "medium",
      });

      expect(aSettled).toBe(true);
      expect(bSettled).toBe(true);
      expect(
        calledUrls.some(
          (u) => u.includes("signal-abort-idx-minus-1/") && u.includes("ep-2"),
        ),
      ).toBe(false);
      expect(
        calledUrls.some(
          (u) => u.includes("signal-abort-idx-minus-1/") && u.includes("ep-3"),
        ),
      ).toBe(true);
      scheduler.dispose();
    });

    it("pauseNovelTasks / cancelNovelTasks / cancelAllTasks 実行中に完了や失敗が重なっても completed 誤発火やキュー誤消去が起きないこと", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "cancel-pause-finalize-guard",
        chapterCount: 2,
      });

      // Case A: cancelNovelTasks({ clearQueue: false }) 待機中に別処理で保存・markChapterCompletedInBatch が走っても cancelled 維持・キュー非消去
      const httpA = new MockHttpClient();
      httpA.setResponse(
        `https://kakuyomu.jp/works/cancel-pause-finalize-guard/episodes/ep-1`,
        { html: episodeHtml(1) },
      );
      const schedulerA = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient: httpA,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 0,
      });

      let notifySaveA!: () => void;
      const onSaveA = new Promise<void>((r) => {
        notifySaveA = r;
      });
      let releaseSaveA!: () => void;
      const saveGateA = new Promise<void>((r) => {
        releaseSaveA = r;
      });
      const origSaveA = chapterRepo.saveChapterBody.bind(chapterRepo);
      const saveSpyA = vi
        .spyOn(chapterRepo, "saveChapterBody")
        .mockImplementationOnce(async (...args) => {
          notifySaveA();
          await saveGateA;
          return await origSaveA(...args);
        });
      const clearSpyA = vi.spyOn(queueRepo, "clearNovelQueue");
      const statusesA: string[] = [];
      schedulerA.subscribeProgress(novel.id, (p) => statusesA.push(p.status));

      await schedulerA.enqueueBatchCache(novel.id, [1]);
      await onSaveA;
      const cancelPromiseA = schedulerA.cancelNovelTasks(novel.id, {
        clearQueue: false,
      });
      // cancelNovelTasks が activeWorkPromise 待機中に、save 完了と外部 syncNovelProgress が競合
      releaseSaveA();
      await cancelPromiseA;

      expect(statusesA).not.toContain("completed");
      expect(schedulerA.getNovelProgress(novel.id)?.status).toBe("cancelled");
      expect(clearSpyA).not.toHaveBeenCalled();
      saveSpyA.mockRestore();
      clearSpyA.mockRestore();
      schedulerA.dispose();

      // Case B: cancelAllTasks({ clearQueue: false }) でも同様に completed 誤発火しないこと
      const novelB = await seedNovel(novelRepo, chapterRepo, {
        workId: "cancel-all-finalize-guard",
        chapterCount: 1,
      });
      const httpB = new MockHttpClient();
      httpB.setResponse(
        `https://kakuyomu.jp/works/cancel-all-finalize-guard/episodes/ep-1`,
        { html: episodeHtml(1) },
      );
      const schedulerB = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient: httpB,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 0,
      });
      let notifyDelB!: () => void;
      const onDelB = new Promise<void>((r) => {
        notifyDelB = r;
      });
      let releaseDelB!: () => void;
      const delGateB = new Promise<void>((r) => {
        releaseDelB = r;
      });
      const origDelB = queueRepo.deleteByNovelAndChapters.bind(queueRepo);
      const delSpyB = vi
        .spyOn(queueRepo, "deleteByNovelAndChapters")
        .mockImplementationOnce(async (nId, chs) => {
          notifyDelB();
          await delGateB;
          return await origDelB(nId, chs);
        });
      const statusesB: string[] = [];
      schedulerB.subscribeProgress(novelB.id, (p) => statusesB.push(p.status));

      await schedulerB.enqueueBatchCache(novelB.id, [1]);
      await onDelB;
      const cancelAllPromiseB = schedulerB.cancelAllTasks({
        clearQueue: false,
      });
      releaseDelB();
      await cancelAllPromiseB;

      expect(statusesB).not.toContain("completed");
      expect(schedulerB.getNovelProgress(novelB.id)?.status).toBe("cancelled");
      delSpyB.mockRestore();
      schedulerB.dispose();

      // Case C: pauseNovelTasks 待機中に runLowStep catch 側の updateStatus("failed") が走っても completed 誤発火や clearNovelQueue が起きないこと
      const novelC = await seedNovel(novelRepo, chapterRepo, {
        workId: "pause-catch-finalize-guard",
        chapterCount: 1,
      });
      const httpC: HttpClientBridge = {
        getHtml: async () => {
          throw new Error("network down");
        },
      };
      const schedulerC = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient: httpC,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 0,
      });
      let notifyFailUpdateC!: () => void;
      const onFailUpdateC = new Promise<void>((r) => {
        notifyFailUpdateC = r;
      });
      let releaseFailUpdateC!: () => void;
      const failUpdateGateC = new Promise<void>((r) => {
        releaseFailUpdateC = r;
      });
      const origUpdateStatusC = queueRepo.updateStatus.bind(queueRepo);
      const updateSpyC = vi
        .spyOn(queueRepo, "updateStatus")
        .mockImplementation(async (nId, chIdx, status, opts) => {
          if (status === "failed") {
            notifyFailUpdateC();
            await failUpdateGateC;
          }
          return await origUpdateStatusC(nId, chIdx, status, opts);
        });
      const clearSpyC = vi.spyOn(queueRepo, "clearNovelQueue");
      const statusesC: string[] = [];
      schedulerC.subscribeProgress(novelC.id, (p) => statusesC.push(p.status));

      await schedulerC.enqueueBatchCache(novelC.id, [1]);
      await onFailUpdateC;
      const pausePromiseC = schedulerC.pauseNovelTasks(novelC.id);
      releaseFailUpdateC();
      await pausePromiseC;

      expect(statusesC).not.toContain("completed");
      expect(schedulerC.getNovelProgress(novelC.id)?.status).toBe("paused");
      expect(clearSpyC).not.toHaveBeenCalled();
      updateSpyC.mockRestore();
      clearSpyC.mockRestore();
      schedulerC.dispose();
    });

    it("cancelAllTasks および dispose が実行中プリフェッチの aborted フラグを立てて再投入を防ぎ安全終了すること", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "cancel-all-and-dispose-prefetch",
        chapterCount: 2,
      });

      const runWithActivePrefetch = async (mode: "cancelAll" | "dispose") => {
        let fetchCount = 0;
        let notifyStarted!: () => void;
        const onStarted = new Promise<void>((r) => {
          notifyStarted = r;
        });
        let releaseGate!: () => void;
        const gate = new Promise<void>((r) => {
          releaseGate = r;
        });
        const http: HttpClientBridge = {
          getHtml: async (opts) => {
            fetchCount += 1;
            notifyStarted();
            await gate;
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
          httpClient: http,
          parserRegistry: createDefaultParserRegistry(),
          prefetchIntervalMs: 0,
        });
        const p = scheduler.enqueuePrefetch({
          novelId: novel.id,
          chapterIndexes: [1, 2],
          priority: "medium",
        });
        await onStarted;
        if (mode === "cancelAll") {
          const cancelP = scheduler.cancelAllTasks();
          releaseGate();
          await Promise.all([cancelP, p]);
          scheduler.dispose();
        } else {
          scheduler.dispose();
          releaseGate();
          await p;
        }
        expect(fetchCount).toBe(1);
      };

      await runWithActivePrefetch("cancelAll");
      await runWithActivePrefetch("dispose");
    });
  });

  describe("R1-16: スケジューラ全体 1.5 秒レート制限", () => {
    it("high リクエスト完了直後に low バッチを開始した場合、前回 HTTP 完了時刻から 1500ms 経過するまで low リクエストを発行しないこと", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "r1-16-high-to-low",
        chapterCount: 2,
      });

      const httpClient = new MockHttpClient();
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-16-high-to-low/episodes/ep-1",
        { html: episodeHtml(1) },
      );
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-16-high-to-low/episodes/ep-2",
        { html: episodeHtml(2) },
      );
      const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: PREFETCH_INTERVAL_MS,
      });

      await scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [1],
        priority: "high",
      });
      expect(getHtmlSpy).toHaveBeenCalledTimes(1);

      await scheduler.enqueueBatchCache(novel.id, [2]);
      await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS - 100);
      expect(getHtmlSpy).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(100);
      expect(getHtmlSpy).toHaveBeenCalledTimes(2);
      expect(scheduler.getNovelProgress(novel.id)?.status).toBe("completed");
      scheduler.dispose();
    });

    it("medium リクエスト完了直後に low バッチを実行した場合も、前回 HTTP 完了時刻から 1500ms 経過するまで low リクエストを発行しないこと", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "r1-16-medium-to-low",
        chapterCount: 2,
      });

      const httpClient = new MockHttpClient();
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-16-medium-to-low/episodes/ep-1",
        { html: episodeHtml(1) },
      );
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-16-medium-to-low/episodes/ep-2",
        { html: episodeHtml(2) },
      );
      const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: PREFETCH_INTERVAL_MS,
      });

      const mediumPromise = scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [1],
        priority: "medium",
      });
      await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS);
      await mediumPromise;
      expect(getHtmlSpy).toHaveBeenCalledTimes(1);

      await scheduler.enqueueBatchCache(novel.id, [2]);
      await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS - 100);
      expect(getHtmlSpy).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(100);
      expect(getHtmlSpy).toHaveBeenCalledTimes(2);
      expect(scheduler.getNovelProgress(novel.id)?.status).toBe("completed");
      scheduler.dispose();
    });

    it("異なる小説の low リクエスト間および pause 後の再投入でも 1500ms 間隔を維持し、1500ms 経過済みや high 失敗時も完了時刻基準で制御すること", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const novelA = await seedNovel(novelRepo, chapterRepo, {
        workId: "r1-16-novel-a",
        chapterCount: 2,
      });
      const novelB = await seedNovel(novelRepo, chapterRepo, {
        workId: "r1-16-novel-b",
        chapterCount: 3,
      });

      const httpClient = new MockHttpClient();
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-16-novel-a/episodes/ep-1",
        { html: episodeHtml(1) },
      );
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-16-novel-a/episodes/ep-2",
        () => {
          throw new Error("HTTP 500");
        },
      );
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-16-novel-b/episodes/ep-1",
        { html: episodeHtml(1) },
      );
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-16-novel-b/episodes/ep-2",
        { html: episodeHtml(2) },
      );
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-16-novel-b/episodes/ep-3",
        { html: episodeHtml(3) },
      );
      const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: PREFETCH_INTERVAL_MS,
      });

      // 1. novelA の low [1] 完了直後に novelB の low [1] を投入しても 1500ms 待機する
      await scheduler.enqueueBatchCache(novelA.id, [1]);
      await vi.advanceTimersByTimeAsync(0);
      expect(getHtmlSpy).toHaveBeenCalledTimes(1);

      await scheduler.enqueueBatchCache(novelB.id, [1]);
      await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS - 100);
      expect(getHtmlSpy).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(100);
      expect(getHtmlSpy).toHaveBeenCalledTimes(2);

      // 2. high が HTTP エラーで終了した場合も完了時刻が更新され、直後の low は 1500ms 待機する
      await expect(
        scheduler.enqueuePrefetch({
          novelId: novelA.id,
          chapterIndexes: [2],
          priority: "high",
        }),
      ).rejects.toThrow("HTTP 500");
      expect(getHtmlSpy).toHaveBeenCalledTimes(3);

      // 1600ms 以上経過していれば次の low は追加待機なしで即時開始する（remainingMs <= 0）
      await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS + 100);
      await scheduler.enqueueBatchCache(novelB.id, [2]);
      await vi.advanceTimersByTimeAsync(0);
      expect(getHtmlSpy).toHaveBeenCalledTimes(4);
      expect(scheduler.getNovelProgress(novelB.id)?.status).toBe("completed");

      // 3. pause 後に即時再投入しても前回完了時刻から 1500ms 待機する
      await scheduler.enqueueBatchCache(novelB.id, [3]);
      await scheduler.pauseNovelTasks(novelB.id);
      await scheduler.enqueueBatchCache(novelB.id, [3]);
      await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS - 100);
      expect(getHtmlSpy).toHaveBeenCalledTimes(4);

      await vi.advanceTimersByTimeAsync(100);
      expect(getHtmlSpy).toHaveBeenCalledTimes(5);
      expect(scheduler.getNovelProgress(novelB.id)?.status).toBe("completed");
      scheduler.dispose();
    });

    it("low の 1500ms レート制限スリープ中に high が割り込んだ場合は即時割り込み実行し、high 完了後に再度 1500ms 待って low を実行すること", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "r1-16-sleep-interrupt",
        chapterCount: 3,
      });

      const httpClient = new MockHttpClient();
      for (let i = 1; i <= 3; i++) {
        httpClient.setResponse(
          `https://kakuyomu.jp/works/r1-16-sleep-interrupt/episodes/ep-${i}`,
          { html: episodeHtml(i) },
        );
      }
      const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: PREFETCH_INTERVAL_MS,
      });

      // ep-1 (high) 直後に low [2] を投入して 1500ms 待機状態にする
      await scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [1],
        priority: "high",
      });
      await scheduler.enqueueBatchCache(novel.id, [2]);
      await vi.advanceTimersByTimeAsync(500);
      expect(getHtmlSpy).toHaveBeenCalledTimes(1);

      // low 待機中に high [3] を投入すると即座に実行される
      await scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [3],
        priority: "high",
      });
      expect(getHtmlSpy).toHaveBeenCalledTimes(2);
      expect(getHtmlSpy.mock.calls[1]?.[0].url).toContain("ep-3");

      // high [3] 完了から 1400ms ではまだ low [2] は開始せず、1500ms 到達で実行される
      await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS - 100);
      expect(getHtmlSpy).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(100);
      expect(getHtmlSpy).toHaveBeenCalledTimes(3);
      expect(scheduler.getNovelProgress(novel.id)?.status).toBe("completed");
      scheduler.dispose();
    });
  });

  describe("R1-22: saveChapterBody 成功後のキュー削除・バッチ進捗確定と非アクティブ時失敗解除", () => {
    it("low 最終話の saveChapterBody 実行中に high が割り込んで signal が abort されても queue 削除と completed 遷移が完了すること", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "r1-22-abort-during-save",
        chapterCount: 2,
      });

      const httpClient = new MockHttpClient();
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-22-abort-during-save/episodes/ep-1",
        { html: episodeHtml(1) },
      );
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-22-abort-during-save/episodes/ep-2",
        { html: episodeHtml(2) },
      );
      const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 0,
      });

      let notifySaveStarted!: () => void;
      const onSaveStarted = new Promise<void>((r) => {
        notifySaveStarted = r;
      });
      let releaseSave!: () => void;
      const saveGate = new Promise<void>((r) => {
        releaseSave = r;
      });
      const origSave = chapterRepo.saveChapterBody.bind(chapterRepo);
      vi.spyOn(chapterRepo, "saveChapterBody").mockImplementationOnce(
        async (...args) => {
          notifySaveStarted();
          await saveGate;
          return await origSave(...args);
        },
      );
      const deleteQueueSpy = vi.spyOn(queueRepo, "deleteByNovelAndChapters");

      const progressEvents: CacheNovelProgress[] = [];
      scheduler.subscribeProgress(novel.id, (p) => progressEvents.push(p));

      await scheduler.enqueueBatchCache(novel.id, [1]);
      await onSaveStarted;

      // saveChapterBody 中に high [2] が割り込み、low の signal を abort する
      const highPromise = scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [2],
        priority: "high",
      });
      releaseSave();
      await highPromise;

      expect(deleteQueueSpy).toHaveBeenCalledWith(novel.id, [1]);
      expect(await queueRepo.listByNovelId(novel.id)).toEqual([]);
      const progress = scheduler.getNovelProgress(novel.id);
      expect(progress?.status).toBe("completed");
      expect(progress?.current).toBe(1);
      expect(progress?.total).toBe(1);
      expect(progressEvents.some((p) => p.status === "completed")).toBe(true);
      // ep-1 の再取得が走っていないこと（ep-1 と ep-2 の計 2 回のみ）
      expect(getHtmlSpy).toHaveBeenCalledTimes(2);
      scheduler.dispose();
    });

    it("paused または失敗付き completed 状態のバッチでも high/medium で失敗話を保存したら failedChapterIndexes が解除・通知され、非失敗話では不要通知しないこと", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "r1-22-clear-failed-when-inactive",
        chapterCount: 3,
      });

      const httpClient = new MockHttpClient();
      let failEp1 = true;
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-22-clear-failed-when-inactive/episodes/ep-1",
        () => {
          if (failEp1) {
            throw new Error("一時エラー");
          }
          return { html: episodeHtml(1) };
        },
      );
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-22-clear-failed-when-inactive/episodes/ep-2",
        { html: episodeHtml(2) },
      );
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-22-clear-failed-when-inactive/episodes/ep-3",
        { html: episodeHtml(3) },
      );

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 0,
      });

      const events: CacheNovelProgress[] = [];
      scheduler.subscribeProgress(novel.id, (p) => events.push(p));

      // まず ep-1 のみバッチ実行して failed 付きの completed 状態（isBatchCaching=false）にする
      await scheduler.enqueueBatchCache(novel.id, [1]);
      await vi.waitFor(() => {
        expect(scheduler.getNovelProgress(novel.id)?.status).toBe("completed");
      });
      expect(
        scheduler.getNovelProgress(novel.id)?.failedChapterIndexes,
      ).toEqual([1]);

      // 非失敗話 ep-2 を high で取得しても failedChapterIndexes は変化せず不要な通知もしない
      const eventCountBeforeNonFailed = events.length;
      await scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [2],
        priority: "high",
      });
      expect(events.length).toBe(eventCountBeforeNonFailed);
      expect(
        scheduler.getNovelProgress(novel.id)?.failedChapterIndexes,
      ).toEqual([1]);

      // high で失敗話 ep-1 を保存すると failedChapterIndexes から削除され通知される
      failEp1 = false;
      await scheduler.enqueuePrefetch({
        novelId: novel.id,
        chapterIndexes: [1],
        priority: "high",
      });
      expect(events.length).toBe(eventCountBeforeNonFailed + 1);
      expect(
        scheduler.getNovelProgress(novel.id)?.failedChapterIndexes,
      ).toEqual([]);

      // paused 状態でも同様に別作品で ep-1 失敗後に pause し、failed 付き paused 状態で medium 保存する
      const novel2 = await seedNovel(novelRepo, chapterRepo, {
        workId: "r1-22-paused-failed",
        chapterCount: 2,
      });
      let failN2Ep1 = true;
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-22-paused-failed/episodes/ep-1",
        () => {
          if (failN2Ep1) {
            throw new Error("失敗1");
          }
          return { html: episodeHtml(1) };
        },
      );
      let notifyEp2Http!: () => void;
      const onEp2Http = new Promise<void>((r) => {
        notifyEp2Http = r;
      });
      let releaseEp2Http!: () => void;
      const ep2HttpGate = new Promise<void>((r) => {
        releaseEp2Http = r;
      });
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-22-paused-failed/episodes/ep-2",
        async () => {
          notifyEp2Http();
          await ep2HttpGate;
          return { html: episodeHtml(2) };
        },
      );

      const pausedEvents: CacheNovelProgress[] = [];
      scheduler.subscribeProgress(novel2.id, (p) => pausedEvents.push(p));

      await scheduler.enqueueBatchCache(novel2.id, [1, 2]);
      await onEp2Http;
      const pausePromise = scheduler.pauseNovelTasks(novel2.id);
      releaseEp2Http();
      await pausePromise;

      expect(scheduler.getNovelProgress(novel2.id)?.status).toBe("paused");
      expect(
        scheduler.getNovelProgress(novel2.id)?.failedChapterIndexes,
      ).toEqual([1]);

      failN2Ep1 = false;
      const countBeforeMedium = pausedEvents.length;
      await scheduler.enqueuePrefetch({
        novelId: novel2.id,
        chapterIndexes: [1],
        priority: "medium",
      });
      expect(pausedEvents.length).toBe(countBeforeMedium + 1);
      expect(
        scheduler.getNovelProgress(novel2.id)?.failedChapterIndexes,
      ).toEqual([]);
      expect(scheduler.getNovelProgress(novel2.id)?.status).toBe("paused");
      scheduler.dispose();
    });
  });

  describe("R1-15: 失敗あり完了時の完了済み・非failedキュー行クリーンアップ", () => {
    it("failedChapterIndexes が残るバッチ完了時でも古いキャッシュ失敗行や既存の完了/待機行が削除され、failed 行のみ残ること", async () => {
      const eightDaysAgo = new Date(
        Date.now() - (CACHE_TTL_MS + 86400000),
      ).toISOString();
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "r1-15-finalize-cleanup",
        chapterCount: 4,
        cachedIndexes: [3, 4],
        downloadedAtByIndex: (idx) =>
          idx === 3 ? eightDaysAgo : new Date().toISOString(),
      });

      // ch 4 は新鮮キャッシュ済みだが古い completed 行がキューに残っている状態を再現
      await queueRepo.enqueueChapters(novel.id, [
        { chapterIndex: 4, targetUrl: episodeUrl(4) },
      ]);
      await queueRepo.updateStatus(novel.id, 4, "completed");

      const httpClient = new MockHttpClient();
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-15-finalize-cleanup/episodes/ep-1",
        () => {
          throw new Error("未キャッシュ取得失敗");
        },
      );
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-15-finalize-cleanup/episodes/ep-2",
        { html: episodeHtml(2) },
      );
      httpClient.setResponse(
        "https://kakuyomu.jp/works/r1-15-finalize-cleanup/episodes/ep-3",
        () => {
          throw new Error("古いキャッシュ再取得失敗");
        },
      );

      const updateStatusSpy = vi.spyOn(queueRepo, "updateStatus");
      const deleteSpy = vi.spyOn(queueRepo, "deleteByNovelAndChapters");

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 0,
      });

      // ch 4 を対象外にした状態で [1, 2, 3] を実行 -> ch 1 failed (failedChapterIndexes.size > 0), ch 2 saved, ch 3 stale fallback
      await scheduler.enqueueBatchCache(novel.id, [1, 2, 3]);
      await vi.waitFor(() => {
        expect(scheduler.getNovelProgress(novel.id)?.status).toBe("completed");
      });

      expect(updateStatusSpy).not.toHaveBeenCalledWith(
        novel.id,
        3,
        "completed",
      );
      expect(deleteSpy).toHaveBeenCalledWith(novel.id, [3]);

      const remaining = await queueRepo.listByNovelId(novel.id);
      expect(remaining.map((r) => r.chapterIndex)).toEqual([1]);
      expect(remaining[0].status).toBe("failed");
      scheduler.dispose();
    });

    it("enqueueBatchCache の targets.length === 0 高速パスでも remainingFailed がある場合に非 failed 行が削除され failed 行のみ保持されること", async () => {
      const novel = await seedNovel(novelRepo, chapterRepo, {
        workId: "r1-15-empty-targets-cleanup",
        chapterCount: 3,
        cachedIndexes: [2],
      });

      // ch 1 は retryCount=1 の failed（maxRetryCount: 1 で除外対象）、ch 3 は対象外の完了済み行として残存
      await queueRepo.enqueueChapters(novel.id, [
        { chapterIndex: 1, targetUrl: episodeUrl(1) },
        { chapterIndex: 3, targetUrl: episodeUrl(3) },
      ]);
      await queueRepo.updateStatus(novel.id, 1, "failed", {
        lastError: "前回失敗",
        incrementRetry: true,
      });
      await queueRepo.updateStatus(novel.id, 3, "completed");

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient: new MockHttpClient(),
        parserRegistry: createDefaultParserRegistry(),
        maxRetryCount: 1,
        prefetchIntervalMs: 0,
      });

      await scheduler.enqueueBatchCache(novel.id, [1, 2]);
      expect(scheduler.getNovelProgress(novel.id)?.status).toBe("completed");
      expect(
        scheduler.getNovelProgress(novel.id)?.failedChapterIndexes,
      ).toEqual([1]);

      const remaining = await queueRepo.listByNovelId(novel.id);
      expect(remaining.map((r) => r.chapterIndex)).toEqual([1]);
      expect(remaining[0].status).toBe("failed");
      scheduler.dispose();
    });
  });
});

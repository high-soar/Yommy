import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ServiceProvider,
  ServiceContext,
  type ServiceContextValue,
} from "../../../app/ServiceProvider";
import {
  useNovelDetail,
  DEFAULT_FETCH_ERROR_MESSAGE,
  DEFAULT_REFRESH_ERROR_MESSAGE,
  DEFAULT_DELETE_ERROR_MESSAGE,
  DEFAULT_CLEAR_CACHE_ERROR_MESSAGE,
} from "./useNovelDetail";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import { SqlNovelRepository } from "../../../storage/repositories/novelRepository";
import { SqlChapterRepository } from "../../../storage/repositories/chapterRepository";
import { SqlQueueRepository } from "../../../storage/repositories/queueRepository";
import { MockHttpClient } from "../../../bridges/http/mockHttpClient";
import type {
  HttpClientBridge,
  HttpResponse,
} from "../../../bridges/http/types";
import type {
  ChapterRepository,
  QueueRepository,
  NovelRepository,
} from "../../../storage/types";
import {
  ParserRegistry,
  createDefaultParserRegistry,
} from "../../../parsers/parserRegistry";
import type { SyncEngine } from "../../cloud-sync/services/syncEngine";
import type { CacheNovelProgress, CacheScheduler } from "../../cache/types";
import { createCacheScheduler } from "../../cache/services/cacheScheduler";
import workIndexHtml from "../../../parsers/kakuyomu/__fixtures__/work_index.html?raw";
import episodeContentHtml from "../../../parsers/kakuyomu/__fixtures__/episode_content.html?raw";
import narouWorkIndexSerializedHtml from "../../../parsers/narou/__fixtures__/work_index_serialized.html?raw";
import narouWorkIndexPage2Html from "../../../parsers/narou/__fixtures__/work_index_page2.html?raw";
import {
  SHORT_TIMEOUT_MS,
  STANDARD_TIMEOUT_MS,
  CACHE_TTL_MS,
} from "../../../shared/constants/cache";

describe("useNovelDetail", () => {
  beforeEach(async () => {
    await resetTestDb();
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createWrapper =
    (services?: React.ComponentProps<typeof ServiceProvider>["services"]) =>
    ({ children }: { children: React.ReactNode }) =>
      React.createElement(ServiceProvider, { services }, children);

  const createWithoutSchedulerWrapper =
    (services: {
      novelRepository: NovelRepository;
      chapterRepository: ChapterRepository;
      queueRepository: QueueRepository;
      httpClient: HttpClientBridge;
      parserRegistry?: ParserRegistry;
      syncEngine?: SyncEngine;
    }) =>
    ({ children }: { children: React.ReactNode }) => {
      const value = {
        ...services,
        parserRegistry:
          services.parserRegistry ?? createDefaultParserRegistry(),
        cacheScheduler: undefined,
        isReady: true,
        error: null,
      } as unknown as ServiceContextValue;
      return React.createElement(ServiceContext.Provider, { value }, children);
    };

  const createMockCacheScheduler = (): {
    scheduler: CacheScheduler;
    emitProgress: (progress: CacheNovelProgress) => void;
  } => {
    const listeners = new Map<
      string,
      Set<(progress: CacheNovelProgress) => void>
    >();
    const scheduler: CacheScheduler = {
      enqueuePrefetch: vi.fn().mockResolvedValue(undefined),
      enqueueBatchCache: vi.fn().mockResolvedValue(undefined),
      pauseNovelTasks: vi.fn().mockResolvedValue(undefined),
      cancelNovelTasks: vi.fn().mockResolvedValue(undefined),
      cancelAllTasks: vi.fn().mockResolvedValue(undefined),
      isNovelBatchCaching: vi.fn().mockReturnValue(false),
      getNovelProgress: vi.fn().mockReturnValue(null),
      subscribeProgress: vi.fn((novelId, listener) => {
        let set = listeners.get(novelId);
        if (!set) {
          set = new Set();
          listeners.set(novelId, set);
        }
        set.add(listener);
        return () => {
          set?.delete(listener);
        };
      }),
      syncNovelProgress: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
    };
    const emitProgress = (progress: CacheNovelProgress) => {
      const set = listeners.get(progress.novelId);
      if (set) {
        for (const listener of set) {
          listener(progress);
        }
      }
    };
    return { scheduler, emitProgress };
  };

  const KAKUYOMU_WORK_ID = "1177354054881162325";
  const KAKUYOMU_EPISODE_IDS = [
    "1177354054881162326",
    "1177354054881162327",
    "1177354054881162328",
    "1177354054881162329",
  ];

  const seedSampleNovel = async (
    novelRepo: SqlNovelRepository,
    chapterCount: number = 2,
  ) => {
    return await novelRepo.upsertNovelWithToc(
      {
        siteType: "kakuyomu",
        remoteWorkId: KAKUYOMU_WORK_ID,
        canonicalUrl: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}`,
        title: "境界迷宮と異界の魔術師",
        author: "小野崎えいじ",
        synopsis: "異界の魔術師の物語",
        chapters: Array.from({ length: chapterCount }, (_, i) => ({
          chapterIndex: i + 1,
          remoteChapterId: KAKUYOMU_EPISODE_IDS[i],
          partTitle: i >= 2 ? "第二章" : "第一章",
          title: `第${i + 1}話`,
          url: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}/episodes/${KAKUYOMU_EPISODE_IDS[i]}`,
          publishedAt: "2026-01-01T00:00:00Z",
        })),
        nextTocPageUrl: null,
      },
      "2026-01-01T00:00:00Z",
    );
  };

  describe("初期ロード・作品および目次一覧取得 (AC-ND-01, AC-ND-02, AC-ND-07)", () => {
    it("初期化完了後に指定 novelId の作品情報および目次一覧を取得できること (AC-ND-01, AC-ND-02)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
        }),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.novel).not.toBeNull();
      expect(result.current.novel?.title).toBe("境界迷宮と異界の魔術師");
      expect(result.current.novel?.author).toBe("小野崎えいじ");
      expect(result.current.novel?.totalChapters).toBe(2);
      expect(result.current.chapters).toHaveLength(2);
      expect(result.current.chapters[0].title).toBe("第1話");
      expect(result.current.chapters[1].title).toBe("第2話");
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.isDeleteDialogOpen).toBe(false);
      expect(result.current.isDeleting).toBe(false);
      expect(result.current.refreshMessage).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("存在しない作品IDが指定された場合、novel が null、chapters が空配列となりエラーにはならないこと (AC-ND-07)", async () => {
      const { result } = renderHook(
        () => useNovelDetail("non-existent-novel-id"),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.novel).toBeNull();
      expect(result.current.chapters).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("初期ロード中にリポジトリが例外をスローした場合、error にメッセージがセットされること", async () => {
      const customRepo = {
        getNovelById: vi.fn().mockRejectedValue(new Error("DB読み込み失敗")),
        listNovels: vi.fn(),
        upsertNovelWithToc: vi.fn(),
        updateBookmark: vi.fn(),
        deleteNovel: vi.fn(),
      };

      const { result } = renderHook(() => useNovelDetail("kakuyomu:123"), {
        wrapper: createWrapper({
          novelRepository: customRepo as unknown as SqlNovelRepository,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe("DB読み込み失敗");
      expect(result.current.novel).toBeNull();
    });

    it("初期ロードで非Error例外が発生した場合にデフォルトのエラーメッセージがセットされること", async () => {
      const customRepo = {
        getNovelById: vi.fn().mockRejectedValue("不明なエラー文字列"),
        listNovels: vi.fn(),
        upsertNovelWithToc: vi.fn(),
        updateBookmark: vi.fn(),
        deleteNovel: vi.fn(),
      };

      const { result } = renderHook(() => useNovelDetail("kakuyomu:123"), {
        wrapper: createWrapper({
          novelRepository: customRepo as unknown as SqlNovelRepository,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe(DEFAULT_FETCH_ERROR_MESSAGE);
    });

    it("初期ロード時のキュー状態同期で例外が発生した場合でもクラッシュせず安全に無視されること (R1-02)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1);

      const resetSpy = vi
        .spyOn(queueRepo, "resetInterruptedToPending")
        .mockRejectedValueOnce(new Error("キュー同期失敗"));

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(resetSpy).toHaveBeenCalledTimes(1);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.novel).not.toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("アンマウント後に初期データ取得が解決してもステート更新エラーが発生しないこと", async () => {
      let resolveGetNovel: ((value: unknown) => void) | null = null;
      const customRepo = {
        getNovelById: vi.fn(
          () =>
            new Promise((resolve) => {
              resolveGetNovel = resolve;
            }),
        ),
        listNovels: vi.fn(),
        upsertNovelWithToc: vi.fn(),
        updateBookmark: vi.fn(),
        deleteNovel: vi.fn(),
      };

      const { unmount } = renderHook(() => useNovelDetail("kakuyomu:123"), {
        wrapper: createWrapper({
          novelRepository: customRepo as unknown as SqlNovelRepository,
        }),
      });

      await waitFor(() => {
        expect(customRepo.getNovelById).toHaveBeenCalled();
      });

      unmount();

      await act(async () => {
        resolveGetNovel?.(null);
      });

      expect(customRepo.getNovelById).toHaveBeenCalled();
    });

    it("syncQueueState の非同期待機中にアンマウントされた場合、安全にステート更新をスキップすること (186行目)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1);

      let resolveList: ((value: unknown) => void) | null = null;
      const listPromise = new Promise((resolve) => {
        resolveList = resolve;
      });
      const listSpy = vi
        .spyOn(queueRepo, "listByNovelId")
        .mockImplementation(() => listPromise as never);

      const { unmount } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
        }),
      });

      // syncQueueState 内で listByNovelId が呼ばれるまで待機
      await waitFor(() => {
        expect(listSpy).toHaveBeenCalled();
      });

      // 初回ロードで listByNovelId 待機中にアンマウント
      unmount();

      resolveList!([]);
      await act(async () => {
        await Promise.resolve();
      });
    });
  });

  describe("手動再読み込み (reloadDetail)", () => {
    it("reloadDetail を呼び出すと最新の作品情報および目次一覧が再取得されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1);

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.chapters).toHaveLength(1);

      // 外部から2話目を追加更新
      await seedSampleNovel(novelRepo, 2);

      await act(async () => {
        await result.current.reloadDetail();
      });

      expect(result.current.chapters).toHaveLength(2);
      expect(result.current.novel?.totalChapters).toBe(2);
    });

    it("reloadDetail で例外が発生した場合、error にメッセージが設定されローディングが解除されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1);

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({ novelRepository: novelRepo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // getNovelById を一時的に失敗させる
      vi.spyOn(novelRepo, "getNovelById").mockRejectedValueOnce(
        new Error("再読み込み時ネットワークエラー"),
      );

      await act(async () => {
        await result.current.reloadDetail();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe("再読み込み時ネットワークエラー");

      // 非Error例外の場合
      vi.spyOn(novelRepo, "getNovelById").mockRejectedValueOnce("非Error例外");

      await act(async () => {
        await result.current.reloadDetail();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(DEFAULT_FETCH_ERROR_MESSAGE);
    });
  });

  describe("目次再取得・差分更新 (refreshToc, AC-ND-05)", () => {
    it("refreshToc: novel が null の場合は何も実行せず false を返すこと", async () => {
      const { result } = renderHook(() => useNovelDetail("non-existent-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success = true;
      await act(async () => {
        success = await result.current.refreshToc();
      });

      expect(success).toBe(false);
      expect(result.current.refreshMessage).toBeNull();
    });

    it("refreshToc: 目次を再取得して差分新着話数がある場合、目次が更新され「目次を更新しました（+N話）」の通知が設定されること (AC-ND-05)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1); // 最初は1話のみ

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.chapters).toHaveLength(1);

      // MockHttpClient はデフォルトで全4話の workIndexHtml を返す
      let success = false;
      await act(async () => {
        success = await result.current.refreshToc();
      });

      expect(success).toBe(true);
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.chapters).toHaveLength(4);
      expect(result.current.refreshMessage).toBe("目次を更新しました（+3話）");
      expect(result.current.error).toBeNull();
    });

    it("refreshToc: hasNewUpdate === true の場合、clearNewUpdate が呼ばれ、キュー状態が同期されること (R1-18)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1);
      // hasNewUpdate を true に設定
      await db.execute("UPDATE novels SET has_new_update = 1 WHERE id = ?", [
        seeded.id,
      ]);

      const clearNewUpdateSpy = vi.spyOn(novelRepo, "clearNewUpdate");

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 初回ロードで clearNewUpdate が1回呼ばれる
      expect(clearNewUpdateSpy).toHaveBeenCalledTimes(1);

      // 再び markNewUpdate を実行
      await db.execute("UPDATE novels SET has_new_update = 1 WHERE id = ?", [
        seeded.id,
      ]);

      let success = false;
      await act(async () => {
        success = await result.current.refreshToc();
      });

      expect(success).toBe(true);
      expect(clearNewUpdateSpy).toHaveBeenCalledTimes(2);
      expect(result.current.novel?.hasNewUpdate).toBe(false);
    });

    it("refreshToc: 差分新着話数がない（0話）場合、「最新の状態です」の通知が設定されること (AC-ND-05)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 4);

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.chapters).toHaveLength(4);

      let success = false;
      await act(async () => {
        success = await result.current.refreshToc();
      });

      expect(success).toBe(true);
      expect(result.current.refreshMessage).toBe("最新の状態です");
      expect(result.current.error).toBeNull();
    });

    it("refreshToc: 複数ページ目次作品（なろう）の目次更新時に全ページが fetchFullNovelIndex で結合されて差分更新されること (Issue #239)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);

      // 初期状態として 1 ページ目の 3 話のみ保存しておく
      await novelRepo.upsertNovelWithToc(
        {
          siteType: "narou",
          remoteWorkId: "n9669bk",
          canonicalUrl: "https://ncode.syosetu.com/n9669bk/",
          title: "無職転生 - 異世界行ったら本気だす",
          author: "理不尽な孫の手",
          synopsis: "あらすじ本文",
          chapters: [
            {
              chapterIndex: 1,
              remoteChapterId: "1",
              partTitle: "第1章 幼年期",
              title: "プロローグ",
              url: "https://ncode.syosetu.com/n9669bk/1/",
              publishedAt: "2012/11/22 17:00",
            },
            {
              chapterIndex: 2,
              remoteChapterId: "2",
              partTitle: "第1章 幼年期",
              title: "第1話 ガキ相手でも本気",
              url: "https://ncode.syosetu.com/n9669bk/2/",
              publishedAt: "2012/11/23 18:00",
            },
            {
              chapterIndex: 3,
              remoteChapterId: "3",
              partTitle: "第2章 少年期",
              title: "第2話 魔法の練習",
              url: "https://ncode.syosetu.com/n9669bk/3/",
              publishedAt: "2012/11/24 10:00",
            },
          ],
          nextTocPageUrl: "https://ncode.syosetu.com/n9669bk/?p=2",
        },
        new Date().toISOString(),
      );

      const httpClient = new MockHttpClient();
      httpClient.setResponse("https://ncode.syosetu.com/n9669bk/", () => ({
        status: 200,
        url: "https://ncode.syosetu.com/n9669bk/",
        headers: {},
        html: narouWorkIndexSerializedHtml,
      }));
      httpClient.setResponse("https://ncode.syosetu.com/n9669bk/?p=2", () => ({
        status: 200,
        url: "https://ncode.syosetu.com/n9669bk/?p=2",
        headers: {},
        html: narouWorkIndexPage2Html,
      }));

      const { result } = renderHook(() => useNovelDetail("narou:n9669bk"), {
        wrapper: createWrapper({
          httpClient,
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.chapters).toHaveLength(3);

      let success = false;
      await act(async () => {
        success = await result.current.refreshToc();
      });

      expect(success).toBe(true);
      expect(result.current.refreshMessage).toBe("目次を更新しました（+2話）");
      expect(result.current.chapters).toHaveLength(5);
      expect(result.current.chapters[3].partTitle).toBe("第2章 少年期");
      expect(result.current.error).toBeNull();
    });

    it("refreshToc: HTTP通信またはパース処理でエラーが発生した場合、既存データを維持して error をセットし false を返すこと (AC-ND-05)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      const mockHttp = new MockHttpClient();
      mockHttp.setResponse(
        new RegExp(`^https://kakuyomu\\.jp/works/${KAKUYOMU_WORK_ID}$`),
        () => {
          throw new Error("HTTP 503 サービス一時停止中");
        },
      );

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          httpClient: mockHttp,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success = true;
      await act(async () => {
        success = await result.current.refreshToc();
      });

      expect(success).toBe(false);
      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.error).toBe("HTTP 503 サービス一時停止中");
      expect(result.current.refreshMessage).toBeNull();
      // 既存の2話が維持されていること
      expect(result.current.chapters).toHaveLength(2);
      expect(result.current.novel?.totalChapters).toBe(2);
    });

    it("refreshToc: 非Error例外が発生した場合にデフォルトのエラーメッセージがセットされること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      const mockHttp = new MockHttpClient();
      mockHttp.setResponse(
        new RegExp(`^https://kakuyomu\\.jp/works/${KAKUYOMU_WORK_ID}$`),
        () => {
          throw "非Error例外";
        },
      );

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          httpClient: mockHttp,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success = true;
      await act(async () => {
        success = await result.current.refreshToc();
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe(DEFAULT_REFRESH_ERROR_MESSAGE);

      // 空文字メッセージの Error インスタンス
      mockHttp.setResponse(
        new RegExp(`^https://kakuyomu\\.jp/works/${KAKUYOMU_WORK_ID}$`),
        () => {
          throw new Error("");
        },
      );

      await act(async () => {
        success = await result.current.refreshToc();
      });
      expect(success).toBe(false);
      expect(result.current.error).toBe(DEFAULT_REFRESH_ERROR_MESSAGE);
    });

    it("refreshToc: 処理中（isRefreshing === true）の多重実行が無効化されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      let resolveHttp: ((value: HttpResponse) => void) | null = null;
      const mockHttp = new MockHttpClient();
      mockHttp.setResponse(
        new RegExp(`^https://kakuyomu\\.jp/works/${KAKUYOMU_WORK_ID}$`),
        () =>
          new Promise((resolve) => {
            resolveHttp = resolve;
          }),
      );

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          httpClient: mockHttp,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let firstPromise: Promise<boolean>;
      act(() => {
        firstPromise = result.current.refreshToc();
      });

      expect(result.current.isRefreshing).toBe(true);

      // 多重実行
      let secondResult = true;
      await act(async () => {
        secondResult = await result.current.refreshToc();
      });
      expect(secondResult).toBe(false);

      // 目次更新中の削除実行試行（無効化されて false が返る）
      let deleteResult = true;
      await act(async () => {
        deleteResult = await result.current.confirmDeleteNovel();
      });
      expect(deleteResult).toBe(false);

      // 1回目を完了させる
      await act(async () => {
        resolveHttp?.({
          status: 200,
          url: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}`,
          headers: {},
          html: workIndexHtml,
        });
        await firstPromise;
      });

      expect(result.current.isRefreshing).toBe(false);
    });

    it("refreshToc: 外部で作品が削除されていた場合、updateOnly: true により削除作品が再INSERTされないこと (R1-02)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      const mockHttp = new MockHttpClient();
      mockHttp.setResponse(`https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}`, {
        status: 200,
        headers: {},
        html: workIndexHtml,
      });

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          httpClient: mockHttp,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 外部で作品を削除
      await novelRepo.deleteNovel(seeded.id, 1730000000000);

      // refreshToc を実行
      let ok = false;
      await act(async () => {
        ok = await result.current.refreshToc();
      });
      expect(ok).toBe(false);

      // 作品は復活していないこと
      const novel = await novelRepo.getNovelById(seeded.id);
      expect(novel).toBeNull();

      // Tombstone も消えていないこと
      const deletedNovels = await novelRepo.getDeletedNovels();
      expect(deletedNovels).toHaveLength(1);
      expect(deletedNovels[0].id).toBe(seeded.id);
    });
  });

  describe("作品削除確認ダイアログ制御 (openDeleteDialog / closeDeleteDialog)", () => {
    it("openDeleteDialog / closeDeleteDialog で削除確認ダイアログの開閉が正しく制御されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({ novelRepository: novelRepo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isDeleteDialogOpen).toBe(false);

      act(() => {
        result.current.openDeleteDialog();
      });
      expect(result.current.isDeleteDialogOpen).toBe(true);

      act(() => {
        result.current.closeDeleteDialog();
      });
      expect(result.current.isDeleteDialogOpen).toBe(false);
    });
  });

  describe("作品削除確定・カスケード削除 (confirmDeleteNovel, AC-ND-06)", () => {
    it("confirmDeleteNovel: 作品を削除し、ダイアログを閉じて true を返すこと (AC-ND-06)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.openDeleteDialog();
      });
      expect(result.current.isDeleteDialogOpen).toBe(true);

      let success = false;
      await act(async () => {
        success = await result.current.confirmDeleteNovel();
      });

      expect(success).toBe(true);
      expect(result.current.isDeleteDialogOpen).toBe(false);
      expect(result.current.isDeleting).toBe(false);
      expect(result.current.error).toBeNull();

      // DB から作品およびチャプター（カスケード）が削除されていること
      const dbNovel = await novelRepo.getNovelById(seeded.id);
      expect(dbNovel).toBeNull();
      const dbChapters = await chapterRepo.listChaptersByNovelId(seeded.id);
      expect(dbChapters).toEqual([]);
    });

    it("confirmDeleteNovel: 作品削除時に syncEngine.notifyChanged が呼び出されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      const mockSyncEngine = {
        notifyChanged: vi.fn().mockResolvedValue(undefined),
      };

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          syncEngine: mockSyncEngine as unknown as SyncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.openDeleteDialog();
      });

      await act(async () => {
        await result.current.confirmDeleteNovel();
      });

      expect(mockSyncEngine.notifyChanged).toHaveBeenCalledTimes(1);
    });

    it("confirmDeleteNovel: syncEngine.notifyChanged が例外を送出してもエラーにならず正常に削除完了すること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      const mockSyncEngine = {
        notifyChanged: vi.fn().mockRejectedValue(new Error("Push failed")),
      };

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          syncEngine: mockSyncEngine as unknown as SyncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.openDeleteDialog();
      });

      let success = false;
      await act(async () => {
        success = await result.current.confirmDeleteNovel();
      });

      expect(success).toBe(true);
      expect(mockSyncEngine.notifyChanged).toHaveBeenCalledTimes(1);
    });

    it("confirmDeleteNovel: 削除処理中にエラーが発生した場合、ダイアログを開いたまま error をセットし false を返すこと (AC-ND-06)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({ novelRepository: novelRepo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.openDeleteDialog();
      });

      vi.spyOn(novelRepo, "deleteNovel").mockRejectedValueOnce(
        new Error("削除処理でDB制約違反"),
      );

      let success = true;
      await act(async () => {
        success = await result.current.confirmDeleteNovel();
      });

      expect(success).toBe(false);
      expect(result.current.isDeleteDialogOpen).toBe(true);
      expect(result.current.isDeleting).toBe(false);
      expect(result.current.error).toBe("削除処理でDB制約違反");

      // 非Error例外の場合
      vi.spyOn(novelRepo, "deleteNovel").mockRejectedValueOnce(
        "不明な削除例外",
      );

      await act(async () => {
        success = await result.current.confirmDeleteNovel();
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe(DEFAULT_DELETE_ERROR_MESSAGE);

      // 空文字メッセージの Error インスタンス
      vi.spyOn(novelRepo, "deleteNovel").mockRejectedValueOnce(new Error(""));

      await act(async () => {
        success = await result.current.confirmDeleteNovel();
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe(DEFAULT_DELETE_ERROR_MESSAGE);
    });

    it("confirmDeleteNovel: 削除処理中（isDeleting === true）の closeDialog 呼び出しおよび多重実行が無効化されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      let resolveDelete: (() => void) | null = null;
      vi.spyOn(novelRepo, "deleteNovel").mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDelete = resolve;
          }),
      );

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({ novelRepository: novelRepo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.openDeleteDialog();
      });

      let deletePromise: Promise<boolean>;
      act(() => {
        deletePromise = result.current.confirmDeleteNovel();
      });

      expect(result.current.isDeleting).toBe(true);

      // 削除処理中の closeDeleteDialog は無視される
      act(() => {
        result.current.closeDeleteDialog();
      });
      expect(result.current.isDeleteDialogOpen).toBe(true);

      // 削除処理中の多重削除呼び出しは即座に false
      let secondDeleteResult = true;
      await act(async () => {
        secondDeleteResult = await result.current.confirmDeleteNovel();
      });
      expect(secondDeleteResult).toBe(false);

      // 削除処理中の refreshToc は即座に false
      let refreshResult = true;
      await act(async () => {
        refreshResult = await result.current.refreshToc();
      });
      expect(refreshResult).toBe(false);

      // 削除を完了させる
      await act(async () => {
        resolveDelete?.();
        await deletePromise;
      });

      expect(result.current.isDeleting).toBe(false);
      expect(result.current.isDeleteDialogOpen).toBe(false);
    });

    it("初回ロード時に novel.hasNewUpdate === true の場合 clearNewUpdate が呼び出されること (AC-ND-10)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const seeded = await seedSampleNovel(novelRepo);

      // 直接 has_new_update = 1 に設定
      await db.execute("UPDATE novels SET has_new_update = 1 WHERE id = ?", [
        seeded.id,
      ]);

      const clearSpy = vi.spyOn(novelRepo, "clearNewUpdate");

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({ novelRepository: novelRepo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(clearSpy).toHaveBeenCalledWith(seeded.id);
    });
  });

  describe("未取得話一括キャッシュ処理 (AC-ND-11, AC-ND-12, AC-ND-13)", () => {
    const createMockHttpClient = () => {
      const client = new MockHttpClient();
      client.setResponse(/kakuyomu\.jp\/works\/.*\/episodes\/.*/, {
        status: 200,
        headers: {},
        html: episodeContentHtml,
      });
      client.setResponse(/kakuyomu\.jp\/works\/.*/, {
        status: 200,
        headers: {},
        html: workIndexHtml,
      });
      return client;
    };

    const createDummyContent = (
      index: number,
      bodyHtml: string = "<p>本文</p>",
      byteSize: number = 100,
    ) => ({
      remoteChapterId: KAKUYOMU_EPISODE_IDS[index - 1] ?? `ep-${index}`,
      title: `第${index}話`,
      bodyHtml,
      byteSize,
      prevChapterUrl: null,
      nextChapterUrl: null,
    });

    describe("isAllCached 判定 (AC-ND-13)", () => {
      it("全話が有効キャッシュ済み（7日以内）の場合、isAllCached が true となること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        const now = new Date().toISOString();
        await chapterRepo.saveChapterBody(
          seeded.id,
          1,
          createDummyContent(1, "<p>本文1</p>"),
          now,
        );
        await chapterRepo.saveChapterBody(
          seeded.id,
          2,
          createDummyContent(2, "<p>本文2</p>"),
          now,
        );

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isAllCached).toBe(true);
      });

      it("一部の話が未キャッシュの場合、isAllCached が false となること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        // 第1話のみキャッシュ
        await chapterRepo.saveChapterBody(
          seeded.id,
          1,
          createDummyContent(1, "<p>本文1</p>"),
          new Date().toISOString(),
        );

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isAllCached).toBe(false);
      });

      it("全話キャッシュ済みでも一部が7日経過している場合、isAllCached が false となること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        const staleTime = new Date(
          Date.now() - CACHE_TTL_MS - 10000,
        ).toISOString();
        const freshTime = new Date().toISOString();

        await chapterRepo.saveChapterBody(
          seeded.id,
          1,
          createDummyContent(1, "<p>本文1</p>"),
          staleTime,
        );
        await chapterRepo.saveChapterBody(
          seeded.id,
          2,
          createDummyContent(2, "<p>本文2</p>"),
          freshTime,
        );

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isAllCached).toBe(false);
      });

      it("総話数が 0 話の場合は isAllCached が false となること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 0);

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({ novelRepository: novelRepo }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isAllCached).toBe(false);
      });
    });

    describe("startBatchCache 実行と進捗・完了処理 (AC-ND-11)", () => {
      it("未取得話が直列に取得・保存され、進捗・バッジ・完了メッセージが更新されること", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        const httpClient = createMockHttpClient();
        const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            httpClient,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isBatchCaching).toBe(false);
        expect(result.current.batchCacheProgress).toBeNull();
        expect(result.current.chapters[0].downloadedAt).toBeNull();
        expect(result.current.chapters[1].downloadedAt).toBeNull();

        let batchPromise: Promise<void>;
        act(() => {
          batchPromise = result.current.startBatchCache();
        });

        expect(result.current.isBatchCaching).toBe(true);

        // 1話目取得完了
        await waitFor(() => {
          expect(getHtmlSpy).toHaveBeenCalledTimes(1);
        });
        expect(getHtmlSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            timeoutMs: STANDARD_TIMEOUT_MS,
          }),
        );

        // レートリミット（1.5秒）を進める
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1600);
        });

        // 2話目取得完了
        await waitFor(() => {
          expect(getHtmlSpy).toHaveBeenCalledTimes(2);
        });

        await act(async () => {
          await batchPromise;
        });

        await waitFor(() => {
          expect(result.current.isBatchCaching).toBe(false);
        });
        expect(result.current.batchCacheProgress).toBeNull();
        expect(result.current.refreshMessage).toBe(
          "全話のキャッシュを取得しました",
        );
        expect(result.current.isAllCached).toBe(true);
        expect(result.current.novel?.cachedChapters).toBe(2);
        expect(result.current.novel?.totalByteSize).toBeGreaterThan(0);
        expect(result.current.chapters[0].downloadedAt).not.toBeNull();
        expect(result.current.chapters[1].downloadedAt).not.toBeNull();

        vi.useRealTimers();
      });

      it("7日経過キャッシュが存在する場合、SHORT_TIMEOUT_MS で取得を試みること", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 1);

        const staleTime = new Date(
          Date.now() - CACHE_TTL_MS - 2000,
        ).toISOString();
        await chapterRepo.saveChapterBody(
          seeded.id,
          1,
          createDummyContent(1, "<p>古い本文</p>"),
          staleTime,
        );

        const httpClient = createMockHttpClient();
        const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            httpClient,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        let batchPromise: Promise<void>;
        act(() => {
          batchPromise = result.current.startBatchCache();
        });

        await waitFor(() => {
          expect(getHtmlSpy).toHaveBeenCalledTimes(1);
        });
        expect(getHtmlSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            timeoutMs: SHORT_TIMEOUT_MS,
          }),
        );

        await act(async () => {
          await batchPromise;
        });

        await waitFor(() => {
          expect(result.current.isBatchCaching).toBe(false);
        });
        expect(result.current.refreshMessage).toBe(
          "全話のキャッシュを取得しました",
        );

        vi.useRealTimers();
      });

      it("対象エピソードが存在しない（0件）場合、通信を行わずに「全話キャッシュ済みです」を設定して即時終了すること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 0);

        const httpClient = createMockHttpClient();
        const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            httpClient,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
          await result.current.startBatchCache();
        });

        expect(getHtmlSpy).not.toHaveBeenCalled();
        expect(result.current.isBatchCaching).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.refreshMessage).toBe("全話キャッシュ済みです");
      });

      it("7日経過した古いキャッシュ（hasStaleCache）の再取得時にエラーが発生した場合、例外を送出せず既存キャッシュを維持して次話へ継続すること", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        // 第1話は7日経過した古いキャッシュ
        const staleTime = new Date(
          Date.now() - CACHE_TTL_MS - 5000,
        ).toISOString();
        await chapterRepo.saveChapterBody(
          seeded.id,
          1,
          createDummyContent(1, "<p>古い第1話本文</p>"),
          staleTime,
        );

        const httpClient = new MockHttpClient();
        httpClient.setResponse(
          new RegExp(
            `kakuyomu\\.jp/works/.*/episodes/${KAKUYOMU_EPISODE_IDS[0]}`,
          ),
          {
            status: 500,
            headers: {},
            html: "Internal Server Error",
          },
        );
        httpClient.setResponse(
          new RegExp(
            `kakuyomu\\.jp/works/.*/episodes/${KAKUYOMU_EPISODE_IDS[1]}`,
          ),
          {
            status: 200,
            headers: {},
            html: episodeContentHtml,
          },
        );

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            httpClient,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        let batchPromise: Promise<void>;
        act(() => {
          batchPromise = result.current.startBatchCache();
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1600);
        });

        await act(async () => {
          await batchPromise;
        });

        await waitFor(() => {
          expect(result.current.isBatchCaching).toBe(false);
        });
        expect(result.current.error).toBeNull();
        expect(result.current.refreshMessage).toBe(
          "全話のキャッシュを取得しました",
        );
        expect(result.current.chapters[0].downloadedAt).toBe(staleTime);
        expect(result.current.chapters[1].downloadedAt).not.toBeNull();

        vi.useRealTimers();
      });
    });

    describe("cancelBatchCache および中断制御 (AC-ND-12)", () => {
      it("一括キャッシュ実行中に cancelBatchCache を呼び出すと安全に中断され、取得済み話数は維持されること", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 3);

        const httpClient = createMockHttpClient();
        const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            httpClient,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        let batchPromise: Promise<void>;
        act(() => {
          batchPromise = result.current.startBatchCache();
        });

        // 第1話取得完了
        await waitFor(() => {
          expect(getHtmlSpy).toHaveBeenCalledTimes(1);
        });

        // 待機中にキャンセル
        act(() => {
          result.current.cancelBatchCache();
        });

        await act(async () => {
          await batchPromise;
        });

        await waitFor(() => {
          expect(result.current.isBatchCaching).toBe(false);
        });
        expect(result.current.batchCacheProgress).toBeNull();
        expect(result.current.error).toBeNull(); // キャンセルはエラーではない
        expect(getHtmlSpy).toHaveBeenCalledTimes(1); // 2話目以降は実行されない
        expect(result.current.chapters[0].downloadedAt).not.toBeNull();
        expect(result.current.chapters[1].downloadedAt).toBeNull();
        // R2-16: 一括キャッシュ途中中断時にもメモリ上の novel.updatedAt が書き換わらず元の値を保持すること
        expect(result.current.novel?.updatedAt).toBe("2026-01-01T00:00:00Z");

        vi.useRealTimers();
      });

      it("通信処理中に cancelBatchCache が呼ばれた場合、即座に中断されエラーにならないこと", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        const httpClient = new MockHttpClient();
        const getHtmlSpy = vi.spyOn(httpClient, "getHtml");
        httpClient.setResponse(
          /kakuyomu\.jp\/works\/.*\/episodes\/.*/,
          async (options) => {
            return new Promise<HttpResponse>((_resolve, reject) => {
              options.signal?.addEventListener("abort", () => {
                reject(options.signal?.reason ?? new Error("Aborted"));
              });
            });
          },
        );

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            httpClient,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        let batchPromise: Promise<void>;
        act(() => {
          batchPromise = result.current.startBatchCache();
        });

        // HTTP 通信が開始されるのを待機
        await waitFor(() => {
          expect(getHtmlSpy).toHaveBeenCalled();
        });

        // 通信処理中に cancelBatchCache が呼ばれた場合、一時停止されること
        act(() => {
          result.current.cancelBatchCache();
        });

        await act(async () => {
          await batchPromise;
        });

        await waitFor(() => {
          expect(result.current.isBatchCaching).toBe(false);
        });
        expect(result.current.error).toBeNull();
      });

      it("CacheScheduler 注入時、コンポーネントアンマウントで一括キャッシュは中断されずバックグラウンド継続すること (No. 451, Issue #344)", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        let scheduler: CacheScheduler | null = null;
        try {
          const db = await resetTestDb();
          const novelRepo = new SqlNovelRepository(db);
          const chapterRepo = new SqlChapterRepository(db);
          const queueRepo = new SqlQueueRepository(db);
          const seeded = await seedSampleNovel(novelRepo, 2);

          const resetSpy = vi.spyOn(queueRepo, "resetInterruptedToPending");
          const httpClient = createMockHttpClient();
          // ServiceProvider 自体のアンマウントで dispose されない外部 CacheScheduler を注入し、画面遷移を模擬する
          scheduler = createCacheScheduler({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            queueRepository: queueRepo,
            httpClient,
            parserRegistry: createDefaultParserRegistry(),
          });

          const { result, unmount } = renderHook(
            () => useNovelDetail(seeded.id),
            {
              wrapper: createWrapper({
                novelRepository: novelRepo,
                chapterRepository: chapterRepo,
                queueRepository: queueRepo,
                httpClient,
                cacheScheduler: scheduler,
              }),
            },
          );

          await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
          });

          await act(async () => {
            await result.current.startBatchCache();
          });

          const resetCallsBeforeUnmount = resetSpy.mock.calls.length;

          // 画面遷移（アンマウント）しても resetInterruptedToPending は呼ばれず継続する
          unmount();
          expect(resetSpy).toHaveBeenCalledTimes(resetCallsBeforeUnmount);

          await act(async () => {
            await vi.advanceTimersByTimeAsync(2000);
          });

          await waitFor(async () => {
            const chaptersAfter = await chapterRepo.listChaptersByNovelId(
              seeded.id,
            );
            expect(chaptersAfter[0].downloadedAt).not.toBeNull();
            expect(chaptersAfter[1].downloadedAt).not.toBeNull();
          });
        } finally {
          scheduler?.dispose();
          vi.useRealTimers();
        }
      });
    });

    describe("エラーハンドリングと排他制御 (AC-ND-11, AC-ND-12, AC-ND-25)", () => {
      it("特定エピソード取得時にHTTPエラーが発生した場合でもループを中断せず残りの話を取得し、失敗話が failed に記録されエラーメッセージが設定されること (AC-ND-25)", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const queueRepo = new SqlQueueRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 3);

        const httpClient = new MockHttpClient();
        // 第1話は失敗（500）
        httpClient.setResponse(
          new RegExp(
            `kakuyomu\\.jp/works/.*/episodes/${KAKUYOMU_EPISODE_IDS[0]}`,
          ),
          {
            status: 500,
            headers: {},
            html: "Internal Server Error",
          },
        );
        // 第2話・第3話は成功
        httpClient.setResponse(
          new RegExp(
            `kakuyomu\\.jp/works/.*/episodes/${KAKUYOMU_EPISODE_IDS[1]}`,
          ),
          {
            status: 200,
            headers: {},
            html: episodeContentHtml,
          },
        );
        httpClient.setResponse(
          new RegExp(
            `kakuyomu\\.jp/works/.*/episodes/${KAKUYOMU_EPISODE_IDS[2]}`,
          ),
          {
            status: 200,
            headers: {},
            html: episodeContentHtml,
          },
        );

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            queueRepository: queueRepo,
            httpClient,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        let batchPromise: Promise<void>;
        act(() => {
          batchPromise = result.current.startBatchCache();
        });

        // 1話目失敗後、1.5秒進めて2話目・3話目へ
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1600);
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1600);
        });

        await act(async () => {
          await batchPromise;
        });

        await waitFor(() => {
          expect(result.current.isBatchCaching).toBe(false);
        });
        expect(result.current.error).toBe(
          "1話の取得に失敗しました（再試行可能）",
        );
        expect(result.current.failedCacheCount).toBe(1);
        expect(result.current.pendingCacheCount).toBe(0);
        expect(result.current.failedChapterIndexes).toEqual([1]);

        // 第1話は未取得、第2話・第3話は取得済み
        expect(result.current.chapters[0].downloadedAt).toBeNull();
        expect(result.current.chapters[1].downloadedAt).not.toBeNull();
        expect(result.current.chapters[2].downloadedAt).not.toBeNull();

        // キューテーブルの確認: 第1話のみ failed で残存し、第2話・第3話の completed は削除されていること
        const queueItems = await queueRepo.listByNovelId(seeded.id);
        expect(queueItems).toHaveLength(1);
        expect(queueItems[0].chapterIndex).toBe(1);
        expect(queueItems[0].status).toBe("failed");
        expect(queueItems[0].retryCount).toBe(1);

        vi.useRealTimers();
      });

      it("一括キャッシュ実行中の多重 startBatchCache は無視される一方、refreshToc や confirmDeleteNovel は非ブロッキングで協調実行できること (Issue #344)", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
          const db = await resetTestDb();
          const novelRepo = new SqlNovelRepository(db);
          const chapterRepo = new SqlChapterRepository(db);
          const queueRepo = new SqlQueueRepository(db);
          const seeded = await seedSampleNovel(novelRepo, 2);

          const { scheduler, emitProgress } = createMockCacheScheduler();
          vi.mocked(scheduler.enqueueBatchCache).mockImplementation(
            async (targetNovelId, targetIndexes) => {
              vi.mocked(scheduler.isNovelBatchCaching).mockReturnValue(true);
              emitProgress({
                novelId: targetNovelId,
                isBatchCaching: true,
                status: "running",
                current: 0,
                total: targetIndexes.length,
                failedCount: 0,
                failedChapterIndexes: [],
                pausedReason: "none",
              });
            },
          );

          const httpClient = new MockHttpClient();
          httpClient.setResponse(
            new RegExp(`kakuyomu\\.jp/works/${KAKUYOMU_WORK_ID}$`),
            {
              status: 200,
              headers: {},
              html: workIndexHtml,
            },
          );

          const { result } = renderHook(() => useNovelDetail(seeded.id), {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              queueRepository: queueRepo,
              httpClient,
              cacheScheduler: scheduler,
            }),
          });

          await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
          });

          await act(async () => {
            await result.current.startBatchCache();
          });
          expect(result.current.isBatchCaching).toBe(true);
          expect(scheduler.enqueueBatchCache).toHaveBeenCalledTimes(1);

          // 実行中の多重 startBatchCache は無視される
          await act(async () => {
            await result.current.startBatchCache();
          });
          expect(scheduler.enqueueBatchCache).toHaveBeenCalledTimes(1);

          // 実行中の refreshToc は pauseNovelTasks を経て成功し、残余話数を再登録する
          let refreshOk = false;
          await act(async () => {
            refreshOk = await result.current.refreshToc();
          });
          expect(refreshOk).toBe(true);
          expect(scheduler.pauseNovelTasks).toHaveBeenCalledWith(seeded.id);
          expect(scheduler.enqueueBatchCache).toHaveBeenCalledTimes(2);

          // 実行中の confirmDeleteNovel は cancelNovelTasks(clearQueue: true) を経て削除成功する
          let deleteOk = false;
          await act(async () => {
            deleteOk = await result.current.confirmDeleteNovel();
          });
          expect(deleteOk).toBe(true);
          expect(scheduler.cancelNovelTasks).toHaveBeenCalledWith(seeded.id, {
            clearQueue: true,
          });
          expect(await novelRepo.getNovelById(seeded.id)).toBeNull();
        } finally {
          vi.useRealTimers();
        }
      });
    });

    describe("本文キャッシュ削除パイプライン (AC-ND-20, AC-ND-21, AC-ND-22, TR-19)", () => {
      it("初期状態で isClearCacheDialogOpen === false, isClearingCache === false であること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isClearCacheDialogOpen).toBe(false);
        expect(result.current.isClearingCache).toBe(false);
      });

      it("openClearCacheDialog でダイアログが開き、closeClearCacheDialog で閉じられること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        act(() => {
          result.current.openClearCacheDialog();
        });
        expect(result.current.isClearCacheDialogOpen).toBe(true);

        act(() => {
          result.current.closeClearCacheDialog();
        });
        expect(result.current.isClearCacheDialogOpen).toBe(false);
      });

      it("confirmClearCache({ onlyRead: true }) で既読話の本文キャッシュのみ削除され、容量と話一覧が即時反映されること (AC-ND-22, TR-19)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        // 2話とも本文を保存
        const now = new Date().toISOString();
        await chapterRepo.saveChapterBody(
          seeded.id,
          1,
          createDummyContent(1, "<p>第1話本文</p>", 100),
          now,
        );
        await chapterRepo.saveChapterBody(
          seeded.id,
          2,
          createDummyContent(2, "<p>第2話本文</p>", 200),
          now,
        );
        // 第1話のみ既読化
        await chapterRepo.markChapterRead(seeded.id, 1, true);

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.novel?.cachedChapters).toBe(2);
        expect(result.current.novel?.totalByteSize).toBe(300);

        act(() => {
          result.current.openClearCacheDialog();
        });
        expect(result.current.isClearCacheDialogOpen).toBe(true);

        let deletedCount = 0;
        await act(async () => {
          deletedCount = await result.current.confirmClearCache({
            onlyRead: true,
          });
        });

        expect(deletedCount).toBe(1);
        expect(result.current.isClearCacheDialogOpen).toBe(false);
        expect(result.current.isClearingCache).toBe(false);
        expect(result.current.refreshMessage).toBe(
          "本文キャッシュを削除しました（1話）",
        );

        // 即時反映された novel と chapters の検証
        expect(result.current.novel?.cachedChapters).toBe(1);
        expect(result.current.novel?.totalByteSize).toBe(200);

        // 第1話は未取得、第2話は取得済みのまま保持
        expect(result.current.chapters[0].downloadedAt).toBeNull();
        expect(result.current.chapters[0].isRead).toBe(true); // 既読状態は保持
        expect(result.current.chapters[1].downloadedAt).not.toBeNull();
      });

      it("confirmClearCache({ onlyRead: false }) で全話の本文キャッシュが削除され、容量と話一覧が即時反映されること (AC-ND-22, TR-19)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        const now = new Date().toISOString();
        await chapterRepo.saveChapterBody(
          seeded.id,
          1,
          createDummyContent(1, "<p>第1話本文</p>", 100),
          now,
        );
        await chapterRepo.saveChapterBody(
          seeded.id,
          2,
          createDummyContent(2, "<p>第2話本文</p>", 200),
          now,
        );

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.novel?.cachedChapters).toBe(2);

        act(() => {
          result.current.openClearCacheDialog();
        });

        let deletedCount = 0;
        await act(async () => {
          deletedCount = await result.current.confirmClearCache({
            onlyRead: false,
          });
        });

        expect(deletedCount).toBe(2);
        expect(result.current.isClearCacheDialogOpen).toBe(false);
        expect(result.current.isClearingCache).toBe(false);
        expect(result.current.refreshMessage).toBe(
          "本文キャッシュを削除しました（2話）",
        );

        expect(result.current.novel?.cachedChapters).toBe(0);
        expect(result.current.novel?.totalByteSize).toBe(0);
        expect(result.current.chapters[0].downloadedAt).toBeNull();
        expect(result.current.chapters[1].downloadedAt).toBeNull();
      });

      it("confirmClearCache で削除対象が 0 件のときは DB 再クエリを行わず早期通知メッセージが設定されること (R1-09)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        act(() => {
          result.current.openClearCacheDialog();
        });

        const getNovelSpy = vi.spyOn(novelRepo, "getNovelById");
        const listChaptersSpy = vi.spyOn(chapterRepo, "listChaptersByNovelId");

        let deletedCount = 0;
        await act(async () => {
          deletedCount = await result.current.confirmClearCache({
            onlyRead: false,
          });
        });

        expect(deletedCount).toBe(0);
        expect(result.current.isClearCacheDialogOpen).toBe(false);
        expect(result.current.refreshMessage).toBe(
          "削除対象の本文キャッシュはありませんでした",
        );
        expect(getNovelSpy).not.toHaveBeenCalled();
        expect(listChaptersSpy).not.toHaveBeenCalled();
      });

      it("confirmClearCache: 削除対象が0件の場合でも syncQueueState が実行されキュー状態が最新化されること (R1-18)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const queueRepo = new SqlQueueRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        const resetInterruptedSpy = vi.spyOn(
          queueRepo,
          "resetInterruptedToPending",
        );

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            queueRepository: queueRepo,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        resetInterruptedSpy.mockClear();
        const listQueueSpy = vi.spyOn(queueRepo, "listByNovelId");

        let deletedCount = 0;
        await act(async () => {
          deletedCount = await result.current.confirmClearCache({
            onlyRead: true, // 既読話なしのため 0 件
          });
        });

        expect(deletedCount).toBe(0);
        // cancelNovelTasks(clearQueue: false) と syncQueueState の両方で呼ばれる
        expect(resetInterruptedSpy).toHaveBeenCalledTimes(2);
        expect(listQueueSpy).toHaveBeenCalled();
      });

      it("confirmClearCache 失敗時（deleteCachedBodies で例外）はダイアログを開いたまま error がセットされること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        // deleteCachedBodies が例外を投げるようにモック化
        vi.spyOn(chapterRepo, "deleteCachedBodies").mockRejectedValueOnce(
          new Error("DB書き込み失敗"),
        );

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        act(() => {
          result.current.openClearCacheDialog();
        });
        expect(result.current.isClearCacheDialogOpen).toBe(true);

        let deletedCount = -1;
        await act(async () => {
          deletedCount = await result.current.confirmClearCache({
            onlyRead: false,
          });
        });

        expect(deletedCount).toBe(0);
        // ダイアログは閉じない
        expect(result.current.isClearCacheDialogOpen).toBe(true);
        expect(result.current.isClearingCache).toBe(false);
        expect(result.current.error).toBe("DB書き込み失敗");
      });

      it("confirmClearCache 失敗時、非Error例外がスローされた場合は DEFAULT_CLEAR_CACHE_ERROR_MESSAGE がセットされること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        vi.spyOn(chapterRepo, "deleteCachedBodies").mockRejectedValueOnce(
          "文字列エラー",
        );

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        act(() => {
          result.current.openClearCacheDialog();
        });

        await act(async () => {
          await result.current.confirmClearCache({ onlyRead: true });
        });

        expect(result.current.error).toBe(DEFAULT_CLEAR_CACHE_ERROR_MESSAGE);
      });

      it("キャッシュ削除実行中の closeClearCacheDialog や他の非同期処理（refreshToc, startBatchCache, confirmDeleteNovel, confirmClearCache）が相互にガードされること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        let resolveDelete!: (count: number) => void;
        vi.spyOn(chapterRepo, "deleteCachedBodies").mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveDelete = resolve;
            }),
        );

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        act(() => {
          result.current.openClearCacheDialog();
        });

        let clearPromise: Promise<number>;
        act(() => {
          clearPromise = result.current.confirmClearCache({ onlyRead: false });
        });

        expect(result.current.isClearingCache).toBe(true);

        // 削除中は closeClearCacheDialog を呼んでもダイアログは閉じない
        act(() => {
          result.current.closeClearCacheDialog();
        });
        expect(result.current.isClearCacheDialogOpen).toBe(true);

        // 削除中の confirmClearCache 重複呼び出しはガードされて 0 を返す
        let secondClear = -1;
        await act(async () => {
          secondClear = await result.current.confirmClearCache({
            onlyRead: true,
          });
        });
        expect(secondClear).toBe(0);

        // 削除中の refreshToc はガードされて false を返す
        let refreshResult = true;
        await act(async () => {
          refreshResult = await result.current.refreshToc();
        });
        expect(refreshResult).toBe(false);

        // 削除中の confirmDeleteNovel はガードされて false を返す
        let deleteResult = true;
        await act(async () => {
          deleteResult = await result.current.confirmDeleteNovel();
        });
        expect(deleteResult).toBe(false);

        // 削除を完了させる
        await act(async () => {
          resolveDelete(2);
          await clearPromise;
        });

        expect(result.current.isClearingCache).toBe(false);
        expect(result.current.isClearCacheDialogOpen).toBe(false);
      });

      it("目次更新中（isRefreshing === true）や作品削除中（isDeleting === true）は confirmClearCache がガードされ 0 を返すこと", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        let resolveRefresh!: () => void;
        const httpClient = new MockHttpClient();
        httpClient.setResponse(
          /kakuyomu\.jp\/works\/1177354054881162325$/,
          () =>
            new Promise((resolve) => {
              resolveRefresh = () =>
                resolve({
                  status: 200,
                  headers: {},
                  html: workIndexHtml,
                });
            }),
        );

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            httpClient,
          }),
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        let refreshPromise: Promise<boolean>;
        act(() => {
          refreshPromise = result.current.refreshToc();
        });

        expect(result.current.isRefreshing).toBe(true);

        // 更新中は confirmClearCache がガードされる
        let clearResult = -1;
        await act(async () => {
          clearResult = await result.current.confirmClearCache({
            onlyRead: false,
          });
        });
        expect(clearResult).toBe(0);

        await act(async () => {
          resolveRefresh();
          await refreshPromise;
        });

        expect(result.current.isRefreshing).toBe(false);
      });
    });
  });

  describe("お気に入り（★）トグルとクラウド同期連携 (Issue #266)", () => {
    it("toggleFavorite 呼び出しで novelRepository.setFavorite が実行され、novel.isFavorite が反転し syncEngine.notifyChanged が呼ばれること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1);

      const mockSyncEngine = {
        notifyChanged: vi.fn().mockResolvedValue(undefined),
        pullAndMerge: vi.fn().mockResolvedValue(undefined),
        pushLocalChanges: vi.fn().mockResolvedValue(undefined),
      };

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          syncEngine: mockSyncEngine as unknown as SyncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.novel?.isFavorite).toBe(false);

      let success = false;
      await act(async () => {
        success = await result.current.toggleFavorite();
      });

      expect(success).toBe(true);
      expect(result.current.novel?.isFavorite).toBe(true);
      expect(mockSyncEngine.notifyChanged).toHaveBeenCalledTimes(1);

      // 解除トグル
      await act(async () => {
        success = await result.current.toggleFavorite();
      });

      expect(success).toBe(true);
      expect(result.current.novel?.isFavorite).toBe(false);
      expect(mockSyncEngine.notifyChanged).toHaveBeenCalledTimes(2);
    });

    it("更新中（isRefreshing === true）などの排他処理中は toggleFavorite がガードされ false を返すこと", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1);

      let resolveRefresh: () => void = () => {};
      const httpClient = new MockHttpClient();
      httpClient.setResponse(
        seeded.canonicalUrl,
        () =>
          new Promise((resolve) => {
            resolveRefresh = () =>
              resolve({
                status: 200,
                url: seeded.canonicalUrl,
                headers: {},
                html: workIndexHtml,
              });
          }),
      );

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          httpClient,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let refreshPromise: Promise<boolean>;
      act(() => {
        refreshPromise = result.current.refreshToc();
      });
      expect(result.current.isRefreshing).toBe(true);

      let favResult = true;
      await act(async () => {
        favResult = await result.current.toggleFavorite();
      });
      expect(favResult).toBe(false);

      await act(async () => {
        resolveRefresh();
        await refreshPromise;
      });
      expect(result.current.isRefreshing).toBe(false);
    });

    it("novel === null のときは toggleFavorite が false を返すこと", async () => {
      const customNovelRepo = {
        getNovelById: vi.fn().mockResolvedValue(null),
        listNovels: vi.fn().mockResolvedValue([]),
        upsertNovelWithToc: vi.fn(),
        updateBookmark: vi.fn(),
        setFavorite: vi.fn(),
        deleteNovel: vi.fn(),
        clearNewUpdate: vi.fn(),
        updateLastCheckedAt: vi.fn(),
      };

      const { result } = renderHook(() => useNovelDetail("non-existent-id"), {
        wrapper: createWrapper({
          novelRepository: customNovelRepo as unknown as NovelRepository,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.novel).toBeNull();

      let res = true;
      await act(async () => {
        res = await result.current.toggleFavorite();
      });
      expect(res).toBe(false);
    });

    it("setFavorite で例外が発生した場合は error が設定され false を返すこと", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1);

      vi.spyOn(novelRepo, "setFavorite").mockRejectedValue(
        new Error("DB書き込みエラー"),
      );

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let res = true;
      await act(async () => {
        res = await result.current.toggleFavorite();
      });

      expect(res).toBe(false);
      expect(result.current.error).toBe("DB書き込みエラー");
    });
  });

  describe("永続ダウンロードキュー統合・中断再開・失敗話再試行 (AC-ND-24, AC-ND-25)", () => {
    const createDummyContent = (
      index: number,
      bodyHtml: string = "<p>本文</p>",
      byteSize: number = 100,
    ) => ({
      remoteChapterId: KAKUYOMU_EPISODE_IDS[index - 1] ?? `ep-${index}`,
      title: `第${index}話`,
      bodyHtml,
      byteSize,
      prevChapterUrl: null,
      nextChapterUrl: null,
    });

    it("初回ロード時に downloading 状態のレコードが pending にリセットされ、State に反映されること (AC-ND-24)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 3);

      // 中断された downloading レコードを作成
      await queueRepo.enqueueChapters(seeded.id, [
        { chapterIndex: 2, targetUrl: "https://example.com/2" },
      ]);
      await queueRepo.updateStatus(seeded.id, 2, "downloading");

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // downloading が pending に戻り、pendingCacheCount = 1
      expect(result.current.pendingCacheCount).toBe(1);
      expect(result.current.failedCacheCount).toBe(0);
      expect(result.current.failedChapterIndexes).toEqual([]);

      const items = await queueRepo.listByNovelId(seeded.id);
      expect(items[0].status).toBe("pending");
    });

    it("初回ロード時に既に有効キャッシュ済み（Fresh）の話または completed レコードがキューから自動除外されること (AC-ND-24)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      // 第1話を有効キャッシュ済みとする
      await chapterRepo.saveChapterBody(
        seeded.id,
        1,
        createDummyContent(1, "<p>本文</p>", 100),
        new Date().toISOString(),
      );

      // キューには第1話（completed）と第2話（failed）を登録
      await queueRepo.enqueueChapters(seeded.id, [
        { chapterIndex: 1, targetUrl: "https://example.com/1" },
        { chapterIndex: 2, targetUrl: "https://example.com/2" },
      ]);
      await queueRepo.updateStatus(seeded.id, 1, "completed");
      await queueRepo.updateStatus(seeded.id, 2, "failed", {
        lastError: "エラー",
      });

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 第1話は除外され、第2話の failed のみ残る
      expect(result.current.pendingCacheCount).toBe(0);
      expect(result.current.failedCacheCount).toBe(1);
      expect(result.current.failedChapterIndexes).toEqual([2]);

      const items = await queueRepo.listByNovelId(seeded.id);
      expect(items).toHaveLength(1);
      expect(items[0].chapterIndex).toBe(2);
    });

    it("全話が有効キャッシュ済みの場合、キューが自動クリーンアップ（clearNovelQueue）されること (AC-ND-24)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1);

      await chapterRepo.saveChapterBody(
        seeded.id,
        1,
        createDummyContent(1, "<p>本文</p>", 100),
        new Date().toISOString(),
      );

      await queueRepo.enqueueChapters(seeded.id, [
        { chapterIndex: 1, targetUrl: "https://example.com/1" },
      ]);

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAllCached).toBe(true);
      expect(result.current.pendingCacheCount).toBe(0);
      expect(result.current.failedCacheCount).toBe(0);

      const items = await queueRepo.listByNovelId(seeded.id);
      expect(items).toHaveLength(0);
    });

    it("一括キャッシュ中断時に downloading が pending に戻り、再開時に残り話数を分母として進捗が進むこと (AC-ND-24)", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 3);

      const httpClient = new MockHttpClient();
      httpClient.setResponse(/kakuyomu\.jp\/works\/.*\/episodes\/.*/, {
        status: 200,
        headers: {},
        html: episodeContentHtml,
      });

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          httpClient,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 1回目: 開始
      let batchPromise1: Promise<void>;
      act(() => {
        batchPromise1 = result.current.startBatchCache();
      });

      // 第1話取得完了直後に中断
      await waitFor(() => {
        expect(result.current.chapters[0].downloadedAt).not.toBeNull();
      });

      act(() => {
        result.current.cancelBatchCache();
      });

      await act(async () => {
        await batchPromise1;
      });

      await waitFor(() => {
        expect(result.current.isBatchCaching).toBe(false);
        expect(result.current.pendingCacheCount).toBe(2);
      });

      // 2回目: 再開（残り2話）
      let batchPromise2: Promise<void>;
      act(() => {
        batchPromise2 = result.current.startBatchCache();
      });

      expect(result.current.isBatchCaching).toBe(true);
      expect(result.current.batchCacheProgress?.total).toBe(2);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1600);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1600);
      });

      await act(async () => {
        await batchPromise2;
      });

      await waitFor(() => {
        expect(result.current.isBatchCaching).toBe(false);
      });
      expect(result.current.isAllCached).toBe(true);
      expect(result.current.pendingCacheCount).toBe(0);
      expect(result.current.failedCacheCount).toBe(0);

      const queueItems = await queueRepo.listByNovelId(seeded.id);
      expect(queueItems).toHaveLength(0);

      vi.useRealTimers();
    });

    it("失敗話が存在する状態で再試行（startBatchCache）を実行すると、pending にリセットされて再取得が成功しキューが全削除されること (AC-ND-25)", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      // 第1話は取得済み
      await chapterRepo.saveChapterBody(
        seeded.id,
        1,
        createDummyContent(1, "<p>本文</p>", 100),
        new Date().toISOString(),
      );

      // 第2話は失敗でキューに残っている
      await queueRepo.enqueueChapters(seeded.id, [
        { chapterIndex: 2, targetUrl: "https://example.com/2" },
      ]);
      await queueRepo.updateStatus(seeded.id, 2, "failed", {
        lastError: "タイムアウト",
        incrementRetry: true,
      });

      const httpClient = new MockHttpClient();
      httpClient.setResponse(/kakuyomu\.jp\/works\/.*\/episodes\/.*/, {
        status: 200,
        headers: {},
        html: episodeContentHtml,
      });

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          httpClient,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.failedCacheCount).toBe(1);
      expect(result.current.failedChapterIndexes).toEqual([2]);

      // 再試行
      let batchPromise: Promise<void>;
      act(() => {
        batchPromise = result.current.startBatchCache();
      });

      // 開始直後は失敗件数がリセットされて 0 になること (AC-ND-25)
      expect(result.current.isBatchCaching).toBe(true);
      expect(result.current.failedCacheCount).toBe(0);
      expect(result.current.failedChapterIndexes).toEqual([]);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1600);
      });

      await act(async () => {
        await batchPromise;
      });

      await waitFor(() => {
        expect(result.current.isBatchCaching).toBe(false);
      });
      expect(result.current.isAllCached).toBe(true);
      expect(result.current.failedCacheCount).toBe(0);
      expect(result.current.failedChapterIndexes).toEqual([]);

      const items = await queueRepo.listByNovelId(seeded.id);
      expect(items).toHaveLength(0);

      vi.useRealTimers();
    });

    it("本文キャッシュ削除（confirmClearCache）実行後に download_queue の状態が再取得されて State に反映されること (AC-ND-22, AC-ND-24)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      await chapterRepo.saveChapterBody(
        seeded.id,
        1,
        createDummyContent(1, "<p>第1話本文</p>", 100),
        new Date().toISOString(),
      );

      // 第2話は失敗でキューに残存
      await queueRepo.enqueueChapters(seeded.id, [
        { chapterIndex: 2, targetUrl: "https://example.com/2" },
      ]);
      await queueRepo.updateStatus(seeded.id, 2, "failed", {
        lastError: "通信エラー",
      });

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.failedCacheCount).toBe(1);

      // 全キャッシュ削除を実行（ChapterRepository は deleteCachedBodies でキューも削除する）
      await act(async () => {
        await result.current.confirmClearCache({ onlyRead: false });
      });

      // キャッシュ削除後にキュー状態が再取得され、failedCacheCount = 0 になること
      expect(result.current.failedCacheCount).toBe(0);
      expect(result.current.failedChapterIndexes).toEqual([]);
      expect(result.current.pendingCacheCount).toBe(0);
    });

    it("残存キューに failed レコードが存在していても該当話が既にキャッシュ済みの場合は failedCacheCount が 0 になること (R1-44)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1);

      // 第1話の本文を保存（キャッシュ済み）
      await chapterRepo.saveChapterBody(
        seeded.id,
        1,
        createDummyContent(1, "<p>第1話本文</p>", 100),
        new Date().toISOString(),
      );

      // 過去に失敗したキュー行を強制的に挿入（TTL経過などによる孤児行のシミュレーション）
      await db.execute(
        `INSERT INTO download_queue (novel_id, chapter_index, target_url, status, created_at, updated_at)
         VALUES (?, 1, 'https://example.com/1', 'failed', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');`,
        [seeded.id],
      );

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // キャッシュ済みのため failedCacheCount は 0 になること
      expect(result.current.failedCacheCount).toBe(0);
      expect(result.current.failedChapterIndexes).toEqual([]);
    });

    it("本文パース時に例外が発生した場合でもループを中断せず残りの話を取得し、失敗話が failed に記録されること", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);
      const httpClient = new MockHttpClient();
      httpClient.setResponse(/kakuyomu\.jp\/works\/.*\/episodes\/.*/, {
        status: 200,
        headers: {},
        html: episodeContentHtml,
      });

      const mockParser = {
        siteType: "kakuyomu" as const,
        name: "Kakuyomu",
        canHandle: () => true,
        parseNovelIndex: vi.fn(),
        parseChapterContent: vi.fn(),
      };
      let parseCount = 0;
      mockParser.parseChapterContent.mockImplementation(
        (_html: string, _url: string) => {
          parseCount++;
          if (parseCount === 1) {
            throw new Error("不正なHTML構文です");
          }
          return createDummyContent(2, "<p>第2話</p>", 200);
        },
      );

      const parserRegistry = {
        getParser: vi.fn().mockReturnValue(mockParser),
        requireParser: vi.fn().mockReturnValue(mockParser),
        getAllParsers: vi.fn().mockReturnValue([mockParser]),
      };

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          httpClient,
          parserRegistry: parserRegistry as unknown as ParserRegistry,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        void result.current.startBatchCache();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      await waitFor(() => {
        expect(result.current.isBatchCaching).toBe(false);
      });
      expect(result.current.failedCacheCount).toBe(1);
      expect(result.current.failedChapterIndexes).toEqual([1]);
      expect(result.current.error).toBe(
        "1話の取得に失敗しました（再試行可能）",
      );

      const items = await queueRepo.listByNovelId(seeded.id);
      expect(items).toHaveLength(1);
      expect(items[0].chapterIndex).toBe(1);
      expect(items[0].status).toBe("failed");
      expect(items[0].lastError).toBe("不正なHTML構文です");

      vi.useRealTimers();
    });

    it("一括キャッシュ開始時に予期せぬ例外が発生した場合は外側 catch でエラーメッセージが設定されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1);
      const httpClient = new MockHttpClient();

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          httpClient,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // マウント後に enqueueChapters を失敗させる
      vi.spyOn(queueRepo, "enqueueChapters").mockRejectedValueOnce(
        new Error("DB接続エラー"),
      );

      await act(async () => {
        await result.current.startBatchCache();
      });

      expect(result.current.error).toBe("DB接続エラー");
      expect(result.current.isBatchCaching).toBe(false);
    });

    it("本文パース失敗時に signal.aborted が立っている場合、pending に戻されて中断されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);
      const httpClient = new MockHttpClient();
      httpClient.setResponse(/kakuyomu\.jp\/works\/.*\/episodes\/.*/, {
        status: 200,
        headers: {},
        html: episodeContentHtml,
      });

      let abortHook: (() => void) | null = null;
      const mockParser = {
        siteType: "kakuyomu" as const,
        name: "Kakuyomu",
        canHandle: () => true,
        parseNovelIndex: vi.fn(),
        parseChapterContent: vi.fn().mockImplementation(() => {
          if (abortHook) {
            abortHook();
          }
          throw new DOMException("The operation was aborted", "AbortError");
        }),
      };

      const parserRegistry = {
        getParser: vi.fn().mockReturnValue(mockParser),
        requireParser: vi.fn().mockReturnValue(mockParser),
        getAllParsers: vi.fn().mockReturnValue([mockParser]),
      };

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          httpClient,
          parserRegistry: parserRegistry as unknown as ParserRegistry,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      abortHook = () => {
        result.current.cancelBatchCache();
      };

      await act(async () => {
        await result.current.startBatchCache();
      });

      await waitFor(() => {
        expect(result.current.isBatchCaching).toBe(false);
      });
      const items = await queueRepo.listByNovelId(seeded.id);
      expect(items.every((it) => it.status === "pending")).toBe(true);
    });
  });

  describe("クラウド同期 Pull 完了時のサイレント自動更新 (AC-ND-28)", () => {
    it("reloadDetail({ silent: true }) を呼び出すと isLoading を true にせず最新しおり・既読状態が反映されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 3);

      const loadingTransitions: boolean[] = [];
      const { result } = renderHook(
        () => {
          const hookResult = useNovelDetail(seeded.id);
          loadingTransitions.push(hookResult.isLoading);
          return hookResult;
        },
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      loadingTransitions.length = 0;

      // 外部（他端末Pull）によるしおり・既読更新をシミュレート（インフライト中の isLoading も false 維持を検証）
      await novelRepo.updateBookmark(seeded.id, 3, 0);
      await chapterRepo.markChapterRead(seeded.id, 1, true);
      await chapterRepo.markChapterRead(seeded.id, 2, true);
      const updatedNovel = await novelRepo.getNovelById(seeded.id);

      let resolveDeferredNovel: ((val: typeof updatedNovel) => void) | null =
        null;
      vi.spyOn(novelRepo, "getNovelById").mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveDeferredNovel = resolve;
          }),
      );

      let reloadPromise: Promise<void> | undefined;
      act(() => {
        reloadPromise = result.current.reloadDetail({ silent: true });
      });
      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        resolveDeferredNovel?.(updatedNovel);
        await reloadPromise;
      });

      expect(loadingTransitions.every((v) => v === false)).toBe(true);
      expect(result.current.novel?.bookmarkChapterIndex).toBe(3);
      expect(
        result.current.chapters.find((c) => c.chapterIndex === 1)?.isRead,
      ).toBe(true);
      expect(
        result.current.chapters.find((c) => c.chapterIndex === 2)?.isRead,
      ).toBe(true);
    });

    it("syncEngine.subscribePullCompleted で pulled: true が通知されたときサイレント更新され、pulled: false やエラー時は一覧を破壊しないこと", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      let capturedListener:
        ((result: { pulled: boolean; mergedNovels: number }) => void) | null =
        null;
      const unsubscribeMock = vi.fn();
      const mockSyncEngine = {
        subscribePullCompleted: vi.fn((listener) => {
          capturedListener = listener;
          return unsubscribeMock;
        }),
        pullAndMerge: vi.fn(),
        notifyChanged: vi.fn().mockResolvedValue(undefined),
      };

      const { result, unmount } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          syncEngine: mockSyncEngine as unknown as SyncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(mockSyncEngine.subscribePullCompleted).toHaveBeenCalledTimes(1);

      const getByIdSpy = vi.spyOn(novelRepo, "getNovelById");
      const callsBeforeFalse = getByIdSpy.mock.calls.length;

      // pulled: false では再取得されないこと
      await act(async () => {
        capturedListener?.({ pulled: false, mergedNovels: 0 });
      });
      expect(getByIdSpy.mock.calls.length).toBe(callsBeforeFalse);

      // pulled: true でサイレント更新されること
      await novelRepo.updateBookmark(seeded.id, 2, 0);
      await act(async () => {
        capturedListener?.({ pulled: true, mergedNovels: 1 });
      });
      await waitFor(() => {
        expect(result.current.novel?.bookmarkChapterIndex).toBe(2);
      });
      expect(result.current.isLoading).toBe(false);

      // アンマウント後のサイレント reloadDetail 解決時や失敗時でも安全で、unsubscribe が呼ばれること
      unmount();
      expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    });

    it("アンマウント中の reloadDetail 解決・エラー時も状態更新リークを起こさないこと", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1);

      const { result, unmount } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const deferredFetch: { resolve: ((v: null) => void) | null } = {
        resolve: null,
      };
      vi.spyOn(novelRepo, "getNovelById").mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            deferredFetch.resolve = resolve;
          }),
      );

      let pendingPromise: Promise<void> | undefined;
      act(() => {
        pendingPromise = result.current.reloadDetail({ silent: true });
      });

      unmount();
      deferredFetch.resolve?.(null);
      await pendingPromise;

      // アンマウント後のエラーケース
      vi.spyOn(novelRepo, "getNovelById").mockRejectedValueOnce(
        new Error("unmounted error"),
      );
      await result.current.reloadDetail({ silent: true });
    });
  });

  describe("Round 1 修正検証 (R1-02, R1-22, R1-31)", () => {
    it("R1-02: startBatchCache で通信結果が Abort 後に正常解決しても saveChapterBody を呼ばずキューを pending に戻して中断すること (AC-ND-12)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      let resolveHttp: ((res: HttpResponse) => void) | null = null;
      const httpClient = {
        getHtml: vi.fn(
          async () =>
            new Promise<HttpResponse>((resolve) => {
              resolveHttp = resolve;
            }),
        ),
      };

      const saveSpy = vi.spyOn(chapterRepo, "saveChapterBody");

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          httpClient,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let batchPromise: Promise<void> | undefined;
      act(() => {
        batchPromise = result.current.startBatchCache();
      });

      await waitFor(() => {
        expect(resolveHttp).not.toBeNull();
      });

      // 中断を実行したうえで、MockHttpClient は reject せず 200 OK で遅れて解決する競合を再現
      act(() => {
        result.current.cancelBatchCache();
      });

      resolveHttp!({
        status: 200,
        html: episodeContentHtml,
        url: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}/episodes/${KAKUYOMU_EPISODE_IDS[0]}`,
        headers: {},
      });

      await act(async () => {
        await batchPromise;
      });

      await waitFor(() => {
        expect(result.current.isBatchCaching).toBe(false);
      });
      expect(saveSpy).not.toHaveBeenCalled();
      expect(result.current.pendingCacheCount).toBe(2);
      expect(result.current.novel?.cachedChapters).toBe(0);
      const queueItems = await queueRepo.listByNovelId(seeded.id);
      expect(queueItems.every((item) => item.status === "pending")).toBe(true);
    });

    it("R1-02: React.StrictMode 下でも一括キャッシュ失敗時に failedCacheCount が failedChapterIndexes.length と常に一致すること (AC-ND-25)", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const queueRepo = new SqlQueueRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        const httpClient = new MockHttpClient();
        httpClient.setResponse(
          new RegExp(KAKUYOMU_EPISODE_IDS[0]),
          async () => {
            throw new Error("Network failure");
          },
        );
        httpClient.setResponse(new RegExp(KAKUYOMU_EPISODE_IDS[1]), {
          status: 200,
          html: episodeContentHtml,
          url: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}/episodes/${KAKUYOMU_EPISODE_IDS[1]}`,
        });

        const StrictWrapper = ({ children }: { children: React.ReactNode }) =>
          React.createElement(
            React.StrictMode,
            null,
            React.createElement(
              ServiceProvider,
              {
                services: {
                  novelRepository: novelRepo,
                  chapterRepository: chapterRepo,
                  queueRepository: queueRepo,
                  httpClient,
                },
              },
              children,
            ),
          );

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: StrictWrapper,
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
          await result.current.startBatchCache();
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1600);
        });

        await waitFor(() => {
          expect(result.current.isBatchCaching).toBe(false);
        });
        expect(result.current.failedChapterIndexes).toEqual([1]);
        expect(result.current.failedCacheCount).toBe(
          result.current.failedChapterIndexes.length,
        );
        expect(result.current.failedCacheCount).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("R1-02: startBatchCache 実行中にアンマウントされた場合、0件早期リターンや完了後の setState リークを起こさないこと", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1);

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        // ケースA: 0件早期リターン（全話フレッシュキャッシュ済み）で clearNovelQueue 待機中にアンマウント
        await chapterRepo.saveChapterBody(
          seeded.id,
          1,
          {
            remoteChapterId: KAKUYOMU_EPISODE_IDS[0],
            title: "第1話",
            bodyHtml: "<p>本文</p>",
            byteSize: 6,
            prevChapterUrl: null,
            nextChapterUrl: null,
          },
          new Date().toISOString(),
        );

        let resolveClear: (() => void) | null = null;
        vi.spyOn(queueRepo, "clearNovelQueue").mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              resolveClear = resolve;
            }),
        );

        const hookA = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            queueRepository: queueRepo,
          }),
        });

        await waitFor(() => {
          expect(hookA.result.current.isLoading).toBe(false);
        });

        let earlyPromise: Promise<void> | undefined;
        act(() => {
          earlyPromise = hookA.result.current.startBatchCache();
        });

        await waitFor(() => {
          expect(resolveClear).not.toBeNull();
        });

        hookA.unmount();
        resolveClear!();
        await earlyPromise;

        // ケースB: 本文保存後に getNovelById 待機中でアンマウント
        const dbB = await resetTestDb();
        const novelRepoB = new SqlNovelRepository(dbB);
        const chapterRepoB = new SqlChapterRepository(dbB);
        const queueRepoB = new SqlQueueRepository(dbB);
        const seededB = await seedSampleNovel(novelRepoB, 1);

        const httpClientB = new MockHttpClient();
        httpClientB.setResponse(/kakuyomu\.jp\/works\/.*\/episodes\/.*/, {
          status: 200,
          html: episodeContentHtml,
          url: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}/episodes/${KAKUYOMU_EPISODE_IDS[0]}`,
        });

        let resolveLatestNovel: ((v: typeof seededB | null) => void) | null =
          null;
        const origGetById = novelRepoB.getNovelById.bind(novelRepoB);
        let callCount = 0;
        vi.spyOn(novelRepoB, "getNovelById").mockImplementation(async (id) => {
          callCount++;
          if (callCount === 2) {
            return new Promise((resolve) => {
              resolveLatestNovel = resolve;
            });
          }
          return origGetById(id);
        });

        const hookB = renderHook(() => useNovelDetail(seededB.id), {
          wrapper: createWrapper({
            novelRepository: novelRepoB,
            chapterRepository: chapterRepoB,
            queueRepository: queueRepoB,
            httpClient: httpClientB,
          }),
        });

        await waitFor(() => {
          expect(hookB.result.current.isLoading).toBe(false);
        });

        act(() => {
          void hookB.result.current.startBatchCache();
        });

        await waitFor(() => {
          expect(resolveLatestNovel).not.toBeNull();
        });

        hookB.unmount();
        resolveLatestNovel!(seededB);
        await act(async () => {
          await Promise.resolve();
        });

        expect(errorSpy).not.toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
      }
    });

    it("R1-22: refreshToc / confirmClearCache 実行中に subscribePullCompleted が発火した場合は完了後へ遅延し、一括キャッシュ実行中は即座にサイレント更新すること (AC-ND-28, Issue #344)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1);

      let capturedListener:
        ((result: { pulled: boolean; mergedNovels: number }) => void) | null =
        null;
      const mockSyncEngine = {
        subscribePullCompleted: vi.fn((listener) => {
          capturedListener = listener;
          return vi.fn();
        }),
        pullAndMerge: vi.fn(),
        notifyChanged: vi.fn().mockResolvedValue(undefined),
      };

      // 1. startBatchCache 中の即時反映（非ブロッキング）
      let resolveBatchHttp: ((res: HttpResponse) => void) | null = null;
      let resolveTocHttp: ((res: HttpResponse) => void) | null = null;
      const httpClient = new MockHttpClient();
      httpClient.setResponse(
        /kakuyomu\.jp\/works\/.*\/episodes\/.*/,
        async () =>
          new Promise<HttpResponse>((resolve) => {
            resolveBatchHttp = resolve;
          }),
      );
      httpClient.setResponse(
        new RegExp(`kakuyomu\\.jp/works/${KAKUYOMU_WORK_ID}$`),
        async () =>
          new Promise<HttpResponse>((resolve) => {
            resolveTocHttp = resolve;
          }),
      );

      const { result, unmount } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          httpClient,
          syncEngine: mockSyncEngine as unknown as SyncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const listChaptersSpy = vi.spyOn(chapterRepo, "listChaptersByNovelId");
      const getByIdSpy = vi.spyOn(novelRepo, "getNovelById");

      // 1-a. startBatchCache 開始中に Pull 通知 -> 即座にサイレント reloadDetail が走り新しおりが反映されること
      let batchPromise: Promise<void> | undefined;
      act(() => {
        batchPromise = result.current.startBatchCache();
      });
      await waitFor(() => expect(resolveBatchHttp).not.toBeNull());

      await novelRepo.updateBookmark(seeded.id, 1, 0.25);
      act(() => {
        capturedListener?.({ pulled: true, mergedNovels: 1 });
      });
      await waitFor(() => {
        expect(result.current.novel?.bookmarkChapterIndex).toBe(1);
        expect(result.current.novel?.bookmarkScrollProgress).toBe(0.25);
      });
      expect(result.current.isBatchCaching).toBe(true);

      resolveBatchHttp!({
        status: 200,
        html: episodeContentHtml,
        url: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}/episodes/${KAKUYOMU_EPISODE_IDS[0]}`,
        headers: {},
      });
      await act(async () => {
        await batchPromise;
      });
      await waitFor(() => {
        expect(result.current.isBatchCaching).toBe(false);
      });
      expect(result.current.isLoading).toBe(false);

      // 2. refreshToc 中の遅延
      let refreshPromise: Promise<boolean> | undefined;
      act(() => {
        refreshPromise = result.current.refreshToc();
      });
      await waitFor(() => expect(resolveTocHttp).not.toBeNull());

      const getByIdDuringRefresh = getByIdSpy.mock.calls.length;
      await novelRepo.updateBookmark(seeded.id, 1, 0.5);
      act(() => {
        capturedListener?.({ pulled: true, mergedNovels: 1 });
      });
      expect(getByIdSpy).toHaveBeenCalledTimes(getByIdDuringRefresh);

      resolveTocHttp!({
        status: 200,
        html: workIndexHtml,
        url: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}`,
        headers: {},
      });
      await act(async () => {
        await refreshPromise;
      });
      await waitFor(() => {
        expect(result.current.novel?.bookmarkScrollProgress).toBe(0.5);
      });

      // 3. confirmClearCache 中の遅延
      let resolveClearBodies: ((deleted: number) => void) | null = null;
      vi.spyOn(chapterRepo, "deleteCachedBodies").mockImplementationOnce(
        () =>
          new Promise<number>((resolve) => {
            resolveClearBodies = resolve;
          }),
      );

      let clearPromise: Promise<number> | undefined;
      act(() => {
        clearPromise = result.current.confirmClearCache({ onlyRead: true });
      });
      await waitFor(() => expect(resolveClearBodies).not.toBeNull());

      const getByIdDuringClear = getByIdSpy.mock.calls.length;
      await novelRepo.updateBookmark(seeded.id, 1, 0.75);
      act(() => {
        capturedListener?.({ pulled: true, mergedNovels: 1 });
      });
      expect(getByIdSpy).toHaveBeenCalledTimes(getByIdDuringClear);

      resolveClearBodies!(0);
      await act(async () => {
        await clearPromise;
      });
      await waitFor(() => {
        expect(result.current.novel?.bookmarkScrollProgress).toBe(0.75);
      });

      // 4. pendingSilentReload 保持中にアンマウントされた場合は flush しないこと
      resolveTocHttp = null;
      let pendingRefresh: Promise<boolean> | undefined;
      act(() => {
        pendingRefresh = result.current.refreshToc();
      });
      await waitFor(() => expect(resolveTocHttp).not.toBeNull());

      const listCallsBeforeUnmount = listChaptersSpy.mock.calls.length;
      act(() => {
        capturedListener?.({ pulled: true, mergedNovels: 1 });
      });
      unmount();
      resolveTocHttp!({
        status: 200,
        html: workIndexHtml,
        url: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}`,
        headers: {},
      });
      await pendingRefresh;
      // refreshToc 自体は 1 回 listChaptersByNovelId を呼ぶが、unmount 後の遅延 reloadDetail は走らない
      expect(listChaptersSpy).toHaveBeenCalledTimes(listCallsBeforeUnmount + 1);
    });

    it("R1-22: confirmDeleteNovel 失敗時は遅延サイレント更新を完了後に実行し、成功（削除完了）時は破棄して reloadDetail を呼ばないこと (AC-ND-28)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1);

      let capturedListener:
        ((result: { pulled: boolean; mergedNovels: number }) => void) | null =
        null;
      const mockSyncEngine = {
        subscribePullCompleted: vi.fn((listener) => {
          capturedListener = listener;
          return vi.fn();
        }),
        pullAndMerge: vi.fn(),
        notifyChanged: vi.fn().mockResolvedValue(undefined),
      };

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          syncEngine: mockSyncEngine as unknown as SyncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const getByIdSpy = vi.spyOn(novelRepo, "getNovelById");

      // ケース1: deleteNovel が失敗したときは finally で遅延 reloadDetail が走り状態同期すること
      let rejectDelete: ((err: Error) => void) | null = null;
      vi.spyOn(novelRepo, "deleteNovel").mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectDelete = reject;
          }),
      );

      let deleteFailPromise: Promise<boolean> | undefined;
      act(() => {
        deleteFailPromise = result.current.confirmDeleteNovel();
      });
      await waitFor(() => expect(rejectDelete).not.toBeNull());

      await novelRepo.updateBookmark(seeded.id, 1, 0.9);
      const getCallsBeforePullFail = getByIdSpy.mock.calls.length;
      act(() => {
        capturedListener?.({ pulled: true, mergedNovels: 1 });
      });
      expect(getByIdSpy).toHaveBeenCalledTimes(getCallsBeforePullFail);

      rejectDelete!(new Error("Delete failed"));
      await act(async () => {
        await deleteFailPromise;
      });
      await waitFor(() => {
        expect(result.current.novel?.bookmarkScrollProgress).toBe(0.9);
      });

      // ケース2: deleteNovel が成功したときは削除済み作品への reloadDetail を実行しないこと
      let resolveDelete: (() => void) | null = null;
      vi.spyOn(novelRepo, "deleteNovel").mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveDelete = resolve;
          }),
      );

      let deleteOkPromise: Promise<boolean> | undefined;
      act(() => {
        deleteOkPromise = result.current.confirmDeleteNovel();
      });
      await waitFor(() => expect(resolveDelete).not.toBeNull());

      const getCallsBeforePullSuccess = getByIdSpy.mock.calls.length;
      act(() => {
        capturedListener?.({ pulled: true, mergedNovels: 1 });
      });

      resolveDelete!();
      let deleted = false;
      await act(async () => {
        deleted = (await deleteOkPromise) ?? false;
      });
      expect(deleted).toBe(true);
      expect(getByIdSpy).toHaveBeenCalledTimes(getCallsBeforePullSuccess);
    });

    it("R1-22: reloadDetail 実行時に hasNewUpdate === true の作品を取得した場合、clearNewUpdate を呼び出して State 上も hasNewUpdate: false を保持すること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1);

      const { result, unmount } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await db.execute("UPDATE novels SET has_new_update = 1 WHERE id = ?", [
        seeded.id,
      ]);
      const clearSpy = vi.spyOn(novelRepo, "clearNewUpdate");

      await act(async () => {
        await result.current.reloadDetail({ silent: true });
      });

      expect(clearSpy).toHaveBeenCalledWith(seeded.id);
      expect(result.current.novel?.hasNewUpdate).toBe(false);
      const stored = await novelRepo.getNovelById(seeded.id);
      expect(stored?.hasNewUpdate).toBe(false);

      // clearNewUpdate 完了待機中にアンマウントされても安全に中断すること
      await db.execute("UPDATE novels SET has_new_update = 1 WHERE id = ?", [
        seeded.id,
      ]);
      let resolveClearNewUpdate: (() => void) | null = null;
      clearSpy.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveClearNewUpdate = resolve;
          }),
      );
      let reloadPending: Promise<void> | undefined;
      act(() => {
        reloadPending = result.current.reloadDetail({ silent: true });
      });
      await waitFor(() => expect(resolveClearNewUpdate).not.toBeNull());
      unmount();
      resolveClearNewUpdate!();
      await reloadPending;
    });

    it("R1-31: reloadDetail({ silent: true }) 失敗時は error を設定せず既存表示を保持し、非サイレント reloadDetail() 失敗時のみ error を設定すること（アンマウント時除く）(AC-ND-28)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1);

      const { result, unmount } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // サイレント失敗: error は null のまま既存 novel を保持する
      const getByIdSpy = vi
        .spyOn(novelRepo, "getNovelById")
        .mockRejectedValueOnce(new Error("Silent pull failure"));

      await act(async () => {
        await result.current.reloadDetail({ silent: true });
      });

      expect(result.current.error).toBeNull();
      expect(result.current.novel?.id).toBe(seeded.id);
      expect(result.current.isLoading).toBe(false);

      // 非サイレント失敗（マウント中）: error が設定される
      getByIdSpy.mockRejectedValueOnce(new Error("Explicit reload failure"));
      await act(async () => {
        await result.current.reloadDetail();
      });

      expect(result.current.error).toBe("Explicit reload failure");
      expect(result.current.isLoading).toBe(false);

      // 非サイレント失敗（アンマウント後）: setError リークを起こさない
      unmount();
      getByIdSpy.mockRejectedValueOnce(new Error("Unmounted explicit failure"));
      await result.current.reloadDetail();
    });

    it("Gate 5-1: confirmClearCache の各 await 境界および失敗時にアンマウントされていた場合、後続 DB 同期や状態更新を行わないこと", async () => {
      // 1. deleteCachedBodies 待機中のアンマウント（deletedCount > 0）
      const dbA = await resetTestDb();
      const novelRepoA = new SqlNovelRepository(dbA);
      const chapterRepoA = new SqlChapterRepository(dbA);
      const queueRepoA = new SqlQueueRepository(dbA);
      const seededA = await seedSampleNovel(novelRepoA, 2);

      const hookA = renderHook(() => useNovelDetail(seededA.id), {
        wrapper: createWrapper({
          novelRepository: novelRepoA,
          chapterRepository: chapterRepoA,
          queueRepository: queueRepoA,
        }),
      });
      await waitFor(() => expect(hookA.result.current.isLoading).toBe(false));

      let resolveDeleteA: ((count: number) => void) | null = null;
      vi.spyOn(chapterRepoA, "deleteCachedBodies").mockImplementationOnce(
        () =>
          new Promise<number>((resolve) => {
            resolveDeleteA = resolve;
          }),
      );
      const getNovelSpyA = vi.spyOn(novelRepoA, "getNovelById");
      const listChaptersSpyA = vi.spyOn(chapterRepoA, "listChaptersByNovelId");
      const listQueueSpyA = vi.spyOn(queueRepoA, "listByNovelId");

      let clearPromiseA: Promise<number> | undefined;
      act(() => {
        clearPromiseA = hookA.result.current.confirmClearCache({
          onlyRead: false,
        });
      });
      await waitFor(() => expect(resolveDeleteA).not.toBeNull());

      const novelCallsBeforeA = getNovelSpyA.mock.calls.length;
      const chapterCallsBeforeA = listChaptersSpyA.mock.calls.length;
      const queueCallsBeforeA = listQueueSpyA.mock.calls.length;

      hookA.unmount();
      resolveDeleteA!(2);
      const deletedA = await clearPromiseA;
      expect(deletedA).toBe(2);
      expect(getNovelSpyA).toHaveBeenCalledTimes(novelCallsBeforeA);
      expect(listChaptersSpyA).toHaveBeenCalledTimes(chapterCallsBeforeA);
      expect(listQueueSpyA).toHaveBeenCalledTimes(queueCallsBeforeA);

      // 2. Promise.all([getNovelById, listChaptersByNovelId]) 待機中のアンマウント
      const dbB = await resetTestDb();
      const novelRepoB = new SqlNovelRepository(dbB);
      const chapterRepoB = new SqlChapterRepository(dbB);
      const queueRepoB = new SqlQueueRepository(dbB);
      const seededB = await seedSampleNovel(novelRepoB, 2);

      const hookB = renderHook(() => useNovelDetail(seededB.id), {
        wrapper: createWrapper({
          novelRepository: novelRepoB,
          chapterRepository: chapterRepoB,
          queueRepository: queueRepoB,
        }),
      });
      await waitFor(() => expect(hookB.result.current.isLoading).toBe(false));

      vi.spyOn(chapterRepoB, "deleteCachedBodies").mockResolvedValueOnce(1);
      let resolveRefreshNovelB: ((n: typeof seededB | null) => void) | null =
        null;
      vi.spyOn(novelRepoB, "getNovelById").mockImplementationOnce(
        () =>
          new Promise<typeof seededB | null>((resolve) => {
            resolveRefreshNovelB = resolve;
          }),
      );
      const listQueueSpyB = vi.spyOn(queueRepoB, "listByNovelId");

      let clearPromiseB: Promise<number> | undefined;
      act(() => {
        clearPromiseB = hookB.result.current.confirmClearCache({
          onlyRead: false,
        });
      });
      await waitFor(() => expect(resolveRefreshNovelB).not.toBeNull());

      const queueCallsBeforeB = listQueueSpyB.mock.calls.length;
      hookB.unmount();
      resolveRefreshNovelB!(seededB);
      await clearPromiseB;
      expect(listQueueSpyB).toHaveBeenCalledTimes(queueCallsBeforeB);

      // 3. deleteCachedBodies 失敗時にアンマウント済みでも安全に 0 を返すこと
      const dbC = await resetTestDb();
      const novelRepoC = new SqlNovelRepository(dbC);
      const chapterRepoC = new SqlChapterRepository(dbC);
      const queueRepoC = new SqlQueueRepository(dbC);
      const seededC = await seedSampleNovel(novelRepoC, 1);

      const hookC = renderHook(() => useNovelDetail(seededC.id), {
        wrapper: createWrapper({
          novelRepository: novelRepoC,
          chapterRepository: chapterRepoC,
          queueRepository: queueRepoC,
        }),
      });
      await waitFor(() => expect(hookC.result.current.isLoading).toBe(false));

      let rejectDeleteC: ((err: Error) => void) | null = null;
      vi.spyOn(chapterRepoC, "deleteCachedBodies").mockImplementationOnce(
        () =>
          new Promise<number>((_resolve, reject) => {
            rejectDeleteC = reject;
          }),
      );
      let clearPromiseC: Promise<number> | undefined;
      act(() => {
        clearPromiseC = hookC.result.current.confirmClearCache({
          onlyRead: false,
        });
      });
      await waitFor(() => expect(rejectDeleteC).not.toBeNull());
      hookC.unmount();
      rejectDeleteC!(new Error("Unmounted clear failure"));
      expect(await clearPromiseC).toBe(0);
    });

    it("Gate 5-1: toggleFavorite の待機中に novel が null 化してもクラッシュせず null を維持し、アンマウント後の完了・失敗時にもリークしないこと", async () => {
      // 1. 待機中に並行 reloadDetail で novel が null になった場合の null 安全性検証
      const dbA = await resetTestDb();
      const novelRepoA = new SqlNovelRepository(dbA);
      const chapterRepoA = new SqlChapterRepository(dbA);
      const seededA = await seedSampleNovel(novelRepoA, 1);

      const hookA = renderHook(() => useNovelDetail(seededA.id), {
        wrapper: createWrapper({
          novelRepository: novelRepoA,
          chapterRepository: chapterRepoA,
        }),
      });
      await waitFor(() => expect(hookA.result.current.isLoading).toBe(false));

      let resolveSetFavA: (() => void) | null = null;
      vi.spyOn(novelRepoA, "setFavorite").mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveSetFavA = resolve;
          }),
      );

      let favPromiseA: Promise<boolean> | undefined;
      act(() => {
        favPromiseA = hookA.result.current.toggleFavorite();
      });
      await waitFor(() => expect(resolveSetFavA).not.toBeNull());

      // 並行 reloadDetail で作品が削除/未存在（null）として再読込されたケースを再現
      vi.spyOn(novelRepoA, "getNovelById").mockResolvedValueOnce(null);
      await act(async () => {
        await hookA.result.current.reloadDetail({ silent: true });
      });
      expect(hookA.result.current.novel).toBeNull();

      resolveSetFavA!();
      let favResultA = false;
      await act(async () => {
        favResultA = (await favPromiseA) ?? false;
      });
      expect(favResultA).toBe(true);
      expect(hookA.result.current.novel).toBeNull();

      // 2. setFavorite 解決前アンマウント・失敗前アンマウント時の安全終了
      const dbB = await resetTestDb();
      const novelRepoB = new SqlNovelRepository(dbB);
      const chapterRepoB = new SqlChapterRepository(dbB);
      const seededB = await seedSampleNovel(novelRepoB, 1);

      const hookB = renderHook(() => useNovelDetail(seededB.id), {
        wrapper: createWrapper({
          novelRepository: novelRepoB,
          chapterRepository: chapterRepoB,
        }),
      });
      await waitFor(() => expect(hookB.result.current.isLoading).toBe(false));

      let resolveSetFavB: (() => void) | null = null;
      vi.spyOn(novelRepoB, "setFavorite").mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveSetFavB = resolve;
          }),
      );

      let favPromiseB: Promise<boolean> | undefined;
      act(() => {
        favPromiseB = hookB.result.current.toggleFavorite();
      });
      await waitFor(() => expect(resolveSetFavB).not.toBeNull());
      hookB.unmount();
      resolveSetFavB!();
      expect(await favPromiseB).toBe(true);

      const dbC = await resetTestDb();
      const novelRepoC = new SqlNovelRepository(dbC);
      const chapterRepoC = new SqlChapterRepository(dbC);
      const seededC = await seedSampleNovel(novelRepoC, 1);

      const hookC = renderHook(() => useNovelDetail(seededC.id), {
        wrapper: createWrapper({
          novelRepository: novelRepoC,
          chapterRepository: chapterRepoC,
        }),
      });
      await waitFor(() => expect(hookC.result.current.isLoading).toBe(false));

      let rejectSetFavC: ((err: Error) => void) | null = null;
      vi.spyOn(novelRepoC, "setFavorite").mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectSetFavC = reject;
          }),
      );

      let favPromiseC: Promise<boolean> | undefined;
      act(() => {
        favPromiseC = hookC.result.current.toggleFavorite();
      });
      await waitFor(() => expect(rejectSetFavC).not.toBeNull());
      hookC.unmount();
      rejectSetFavC!(new Error("Unmounted toggle failure"));
      expect(await favPromiseC).toBe(false);
    });
  });

  describe("CacheScheduler 統合・非ブロッキング協調制御 (Issue #344)", () => {
    const createDummyBody = (
      idx: number,
      html: string,
      byteSize: number = 128,
    ) => ({
      remoteChapterId: KAKUYOMU_EPISODE_IDS[idx - 1] ?? `ep-${idx}`,
      title: `第${idx}話`,
      bodyHtml: html,
      byteSize,
      prevChapterUrl: null,
      nextChapterUrl: null,
    });

    it("マウント時および reloadDetail 時に isNovelBatchCaching === true なら resetInterruptedToPending をスキップし、running / preempted の進行状態を即時復元すること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 3);
      const resetSpy = vi.spyOn(queueRepo, "resetInterruptedToPending");

      const { scheduler } = createMockCacheScheduler();
      vi.mocked(scheduler.isNovelBatchCaching).mockReturnValue(true);
      vi.mocked(scheduler.getNovelProgress).mockReturnValue({
        novelId: seeded.id,
        isBatchCaching: true,
        status: "running",
        current: 1,
        total: 3,
        failedCount: 0,
        failedChapterIndexes: [],
        pausedReason: "none",
      });

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          cacheScheduler: scheduler,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isBatchCaching).toBe(true);
      expect(result.current.batchCacheProgress).toEqual({
        current: 1,
        total: 3,
      });
      expect(resetSpy).not.toHaveBeenCalled();

      // preempted 状態で reloadDetail しても resetInterruptedToPending はスキップされ、進行状態が復元される
      vi.mocked(scheduler.getNovelProgress).mockReturnValue({
        novelId: seeded.id,
        isBatchCaching: true,
        status: "preempted",
        current: 2,
        total: 3,
        failedCount: 1,
        failedChapterIndexes: [1],
        pausedReason: "preempted",
      });

      await act(async () => {
        await result.current.reloadDetail({ silent: true });
      });

      expect(resetSpy).not.toHaveBeenCalled();
      expect(result.current.isBatchCaching).toBe(true);
      expect(result.current.batchCacheProgress).toEqual({
        current: 2,
        total: 3,
      });
      expect(result.current.failedChapterIndexes).toEqual([1]);
    });

    it("subscribeProgress の running / preempted / paused / cancelled / completed 各遷移で進捗・DB状態・updatedAt保持・通知/エラーが正しく反映されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      const { scheduler, emitProgress } = createMockCacheScheduler();

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          cacheScheduler: scheduler,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const originalUpdatedAt = result.current.novel?.updatedAt;
      expect(originalUpdatedAt).toBe("2026-01-01T00:00:00Z");

      // DB に第1話キャッシュを保存して running 通知（別値 updatedAt が DB/モックにあっても保持する）
      await chapterRepo.saveChapterBody(
        seeded.id,
        1,
        createDummyBody(1, "<p>第1話</p>", 256),
        new Date().toISOString(),
      );
      await queueRepo.enqueueChapters(seeded.id, [
        { chapterIndex: 2, targetUrl: "https://example.com/2" },
      ]);
      const origGetById = novelRepo.getNovelById.bind(novelRepo);
      vi.spyOn(novelRepo, "getNovelById").mockImplementation(async (id) => {
        const fetched = await origGetById(id);
        return fetched
          ? { ...fetched, updatedAt: "2099-12-31T00:00:00Z" }
          : null;
      });

      act(() => {
        emitProgress({
          novelId: seeded.id,
          isBatchCaching: true,
          status: "running",
          current: 1,
          total: 2,
          failedCount: 0,
          failedChapterIndexes: [],
          pausedReason: "none",
        });
      });

      await waitFor(() => {
        expect(result.current.chapters[0].downloadedAt).not.toBeNull();
        expect(result.current.pendingCacheCount).toBe(1);
      });
      expect(result.current.isBatchCaching).toBe(true);
      expect(result.current.batchCacheProgress).toEqual({
        current: 1,
        total: 2,
      });
      expect(result.current.novel?.cachedChapters).toBe(1);
      expect(result.current.novel?.totalByteSize).toBe(256);
      expect(result.current.novel?.updatedAt).toBe(originalUpdatedAt);

      // preempted 遷移
      act(() => {
        emitProgress({
          novelId: seeded.id,
          isBatchCaching: true,
          status: "preempted",
          current: 1,
          total: 2,
          failedCount: 0,
          failedChapterIndexes: [],
          pausedReason: "preempted",
        });
      });
      expect(result.current.isBatchCaching).toBe(true);

      // paused 遷移（完了メッセージもエラーも設定しない）
      act(() => {
        emitProgress({
          novelId: seeded.id,
          isBatchCaching: false,
          status: "paused",
          current: 1,
          total: 2,
          failedCount: 0,
          failedChapterIndexes: [],
          pausedReason: "none",
        });
      });
      await waitFor(() => {
        expect(result.current.isBatchCaching).toBe(false);
        expect(result.current.batchCacheProgress).toBeNull();
      });
      expect(result.current.pendingCacheCount).toBe(1);
      expect(result.current.refreshMessage).toBeNull();
      expect(result.current.error).toBeNull();

      // cancelled 遷移（完了メッセージもエラーも設定しない）
      await queueRepo.clearNovelQueue(seeded.id);
      act(() => {
        emitProgress({
          novelId: seeded.id,
          isBatchCaching: false,
          status: "cancelled",
          current: 1,
          total: 2,
          failedCount: 0,
          failedChapterIndexes: [],
          pausedReason: "none",
        });
      });
      await waitFor(() => {
        expect(result.current.pendingCacheCount).toBe(0);
      });
      expect(result.current.isBatchCaching).toBe(false);
      expect(result.current.batchCacheProgress).toBeNull();
      expect(result.current.refreshMessage).toBeNull();
      expect(result.current.error).toBeNull();

      // completed（失敗あり）遷移
      act(() => {
        emitProgress({
          novelId: seeded.id,
          isBatchCaching: false,
          status: "completed",
          current: 2,
          total: 2,
          failedCount: 1,
          failedChapterIndexes: [2],
          pausedReason: "none",
        });
      });
      await waitFor(() => {
        expect(result.current.error).toBe(
          "1話の取得に失敗しました（再試行可能）",
        );
      });
      expect(result.current.failedCacheCount).toBe(1);
      expect(result.current.failedChapterIndexes).toEqual([2]);

      // completed（全話成功）遷移
      await chapterRepo.saveChapterBody(
        seeded.id,
        2,
        createDummyBody(2, "<p>第2話</p>", 256),
        new Date().toISOString(),
      );
      act(() => {
        emitProgress({
          novelId: seeded.id,
          isBatchCaching: false,
          status: "completed",
          current: 2,
          total: 2,
          failedCount: 0,
          failedChapterIndexes: [],
          pausedReason: "none",
        });
      });
      await waitFor(() => {
        expect(result.current.refreshMessage).toBe(
          "全話のキャッシュを取得しました",
        );
        expect(result.current.isAllCached).toBe(true);
      });
      expect(result.current.error).toBeNull();
      expect(result.current.failedCacheCount).toBe(0);
    });

    it("subscribeProgress の非同期 DB 同期中にアンマウントまたは削除された場合、状態更新リークを起こさないこと", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      const { scheduler, emitProgress } = createMockCacheScheduler();
      const { result, unmount } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          cacheScheduler: scheduler,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let resolvePendingGet: ((v: typeof seeded | null) => void) | null = null;
      vi.spyOn(novelRepo, "getNovelById").mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePendingGet = resolve;
          }),
      );

      act(() => {
        emitProgress({
          novelId: seeded.id,
          isBatchCaching: true,
          status: "running",
          current: 1,
          total: 2,
          failedCount: 0,
          failedChapterIndexes: [],
          pausedReason: "none",
        });
      });
      await waitFor(() => expect(resolvePendingGet).not.toBeNull());

      // アンマウント後に解決しても安全に無視される
      unmount();
      resolvePendingGet!(seeded);
      await act(async () => {
        await Promise.resolve();
      });

      // 古い sync シーケンス番号の完了は無視される（別フックインスタンスで削除・競合確認）
      const db2 = await resetTestDb();
      const novelRepo2 = new SqlNovelRepository(db2);
      const chapterRepo2 = new SqlChapterRepository(db2);
      const queueRepo2 = new SqlQueueRepository(db2);
      const seeded2 = await seedSampleNovel(novelRepo2, 2);
      const mock2 = createMockCacheScheduler();
      const hook2 = renderHook(() => useNovelDetail(seeded2.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo2,
          chapterRepository: chapterRepo2,
          queueRepository: queueRepo2,
          cacheScheduler: mock2.scheduler,
        }),
      });
      await waitFor(() => expect(hook2.result.current.isLoading).toBe(false));

      let resolveStaleSync: ((v: typeof seeded2 | null) => void) | null = null;
      vi.spyOn(novelRepo2, "getNovelById").mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStaleSync = resolve;
          }),
      );
      act(() => {
        mock2.emitProgress({
          novelId: seeded2.id,
          isBatchCaching: true,
          status: "running",
          current: 1,
          total: 2,
          failedCount: 0,
          failedChapterIndexes: [],
          pausedReason: "none",
        });
      });
      await waitFor(() => expect(resolveStaleSync).not.toBeNull());

      // 新しい進捗イベントおよび削除で古いイベント結果が無効化される
      await act(async () => {
        await hook2.result.current.confirmDeleteNovel();
      });
      resolveStaleSync!(seeded2);
      await act(async () => {
        await Promise.resolve();
      });

      // syncProgressFromDb の prev===null / fetchedNovel===null / DB同期エラー時の安全処理
      const db3 = await resetTestDb();
      const novelRepo3 = new SqlNovelRepository(db3);
      const chapterRepo3 = new SqlChapterRepository(db3);
      const queueRepo3 = new SqlQueueRepository(db3);
      const mock3 = createMockCacheScheduler();
      const targetNovelId3 = `kakuyomu:${KAKUYOMU_WORK_ID}`;
      const hook3 = renderHook(() => useNovelDetail(targetNovelId3), {
        wrapper: createWrapper({
          novelRepository: novelRepo3,
          chapterRepository: chapterRepo3,
          queueRepository: queueRepo3,
          cacheScheduler: mock3.scheduler,
        }),
      });
      await waitFor(() => expect(hook3.result.current.isLoading).toBe(false));
      expect(hook3.result.current.novel).toBeNull();

      // DB に未存在時（fetchedNovel === null）のイベント無視と DB エラー時の安全無視
      const listChaptersSpy3 = vi.spyOn(chapterRepo3, "listChaptersByNovelId");
      act(() => {
        mock3.emitProgress({
          novelId: targetNovelId3,
          isBatchCaching: true,
          status: "running",
          current: 0,
          total: 1,
          failedCount: 0,
          failedChapterIndexes: [],
          pausedReason: "none",
        });
      });
      await waitFor(() => expect(listChaptersSpy3).toHaveBeenCalledTimes(1));

      await seedSampleNovel(novelRepo3, 1);
      act(() => {
        mock3.emitProgress({
          novelId: targetNovelId3,
          isBatchCaching: true,
          status: "running",
          current: 1,
          total: 1,
          failedCount: 0,
          failedChapterIndexes: [],
          pausedReason: "none",
        });
      });
      await waitFor(() => expect(hook3.result.current.novel).not.toBeNull());

      listChaptersSpy3.mockRejectedValueOnce(new Error("進捗同期DBエラー"));
      act(() => {
        mock3.emitProgress({
          novelId: targetNovelId3,
          isBatchCaching: false,
          status: "paused",
          current: 1,
          total: 1,
          failedCount: 0,
          failedChapterIndexes: [],
          pausedReason: "none",
        });
      });
      await waitFor(() => expect(listChaptersSpy3).toHaveBeenCalledTimes(3));
      await act(async () => {
        await Promise.resolve();
      });
      expect(hook3.result.current.error).toBeNull();
    });

    it("startBatchCache: retryCount >= 3 の話数も除外せず enqueueBatchCache へ渡し、enqueue 失敗時・待機中アンマウント・待機中キャンセル時の動作が正しいこと", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 3);

      // 第1話は retryCount=3 失敗、第2話は1回失敗、第3話は未登録で全話対象
      await queueRepo.enqueueChapters(seeded.id, [
        { chapterIndex: 1, targetUrl: "https://example.com/1" },
        { chapterIndex: 2, targetUrl: "https://example.com/2" },
      ]);
      for (let i = 0; i < 3; i++) {
        await queueRepo.updateStatus(seeded.id, 1, "failed", {
          lastError: "上限失敗",
          incrementRetry: true,
        });
      }
      await queueRepo.updateStatus(seeded.id, 2, "failed", {
        lastError: "一時失敗",
        incrementRetry: true,
      });

      const { scheduler } = createMockCacheScheduler();
      const { result, unmount } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          cacheScheduler: scheduler,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.startBatchCache();
      });
      expect(scheduler.enqueueBatchCache).toHaveBeenCalledWith(
        seeded.id,
        [1, 2, 3],
      );

      // enqueueBatchCache 失敗（Error および非Error）時のハンドリング
      vi.mocked(scheduler.enqueueBatchCache).mockRejectedValueOnce(
        new Error("スケジューラエラー"),
      );
      await act(async () => {
        await result.current.startBatchCache();
      });
      expect(result.current.error).toBe("スケジューラエラー");
      expect(result.current.isBatchCaching).toBe(false);
      expect(result.current.batchCacheProgress).toBeNull();

      vi.mocked(scheduler.enqueueBatchCache).mockRejectedValueOnce("unknown");
      await act(async () => {
        await result.current.startBatchCache();
      });
      expect(result.current.error).toBe("キャッシュの取得に失敗しました");
      expect(result.current.isBatchCaching).toBe(false);

      // enqueueBatchCache 待機中にアンマウントされた場合は後続状態変更を行わない
      let resolveEnqueue: (() => void) | null = null;
      vi.mocked(scheduler.enqueueBatchCache).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveEnqueue = resolve;
          }),
      );
      let pendingStart: Promise<void> | undefined;
      act(() => {
        pendingStart = result.current.startBatchCache();
      });
      await waitFor(() => expect(resolveEnqueue).not.toBeNull());
      unmount();
      resolveEnqueue!();
      await pendingStart;
      expect(scheduler.enqueueBatchCache).toHaveBeenCalledTimes(4);

      // enqueueBatchCache 待機中に cancelBatchCache された場合は即座に解除されること
      const hookCancel = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          cacheScheduler: scheduler,
        }),
      });
      await waitFor(() =>
        expect(hookCancel.result.current.isLoading).toBe(false),
      );
      await act(async () => {
        await hookCancel.result.current.reloadDetail();
      });
      let resolveEnqueueCancel: (() => void) | null = null;
      vi.mocked(scheduler.enqueueBatchCache).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveEnqueueCancel = resolve;
          }),
      );
      let pendingCancelStart: Promise<void> | undefined;
      act(() => {
        pendingCancelStart = hookCancel.result.current.startBatchCache();
      });
      await waitFor(() => expect(resolveEnqueueCancel).not.toBeNull());
      act(() => {
        hookCancel.result.current.cancelBatchCache();
      });
      resolveEnqueueCancel!();
      await act(async () => {
        await pendingCancelStart;
      });
      expect(scheduler.enqueueBatchCache).toHaveBeenCalledTimes(5);
      expect(hookCancel.result.current.isBatchCaching).toBe(false);
      expect(hookCancel.result.current.batchCacheProgress).toBeNull();
    });

    it("subscribeProgress: paused・completed 遷移時も DB に残存する未キャッシュ failed 行を syncProgressFromDb で再同期し、既キャッシュ化後は除外されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 3);

      // 第1話は複数回失敗済みの未キャッシュ failed、第2〜3話は pending
      await queueRepo.enqueueChapters(seeded.id, [
        { chapterIndex: 1, targetUrl: "https://example.com/1" },
        { chapterIndex: 2, targetUrl: "https://example.com/2" },
        { chapterIndex: 3, targetUrl: "https://example.com/3" },
      ]);
      for (let i = 0; i < 3; i++) {
        await queueRepo.updateStatus(seeded.id, 1, "failed", {
          lastError: "上限失敗",
          incrementRetry: true,
        });
      }

      const { scheduler, emitProgress } = createMockCacheScheduler();
      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          cacheScheduler: scheduler,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.failedChapterIndexes).toEqual([1]);
      });
      expect(result.current.pendingCacheCount).toBe(2);

      // running → paused（progress.failedChapterIndexes が [] でも DB の [1] が再同期保持される）
      act(() => {
        emitProgress({
          novelId: seeded.id,
          isBatchCaching: true,
          status: "running",
          current: 0,
          total: 2,
          failedCount: 0,
          failedChapterIndexes: [],
          pausedReason: "none",
        });
      });
      await waitFor(() => {
        expect(result.current.failedChapterIndexes).toEqual([1]);
      });

      act(() => {
        emitProgress({
          novelId: seeded.id,
          isBatchCaching: false,
          status: "paused",
          current: 0,
          total: 2,
          failedCount: 0,
          failedChapterIndexes: [],
          pausedReason: "none",
        });
      });
      await waitFor(() => {
        expect(result.current.isBatchCaching).toBe(false);
        expect(result.current.failedChapterIndexes).toEqual([1]);
      });
      expect(result.current.failedCacheCount).toBe(1);
      expect(result.current.pendingCacheCount).toBe(2);

      // completed 通知時も DB に未キャッシュ failed が残っていれば維持される
      act(() => {
        emitProgress({
          novelId: seeded.id,
          isBatchCaching: false,
          status: "completed",
          current: 2,
          total: 2,
          failedCount: 0,
          failedChapterIndexes: [],
          pausedReason: "none",
        });
      });
      await waitFor(() => {
        expect(result.current.refreshMessage).toBe(
          "全話のキャッシュを取得しました",
        );
        expect(result.current.failedChapterIndexes).toEqual([1]);
      });

      // 第1話の本文キャッシュ保存後に通知が届いた場合は既キャッシュ済みの [1] が除外される
      await chapterRepo.saveChapterBody(
        seeded.id,
        1,
        createDummyBody(1, "<p>第1話</p>", 128),
        new Date().toISOString(),
      );
      act(() => {
        emitProgress({
          novelId: seeded.id,
          isBatchCaching: false,
          status: "paused",
          current: 1,
          total: 2,
          failedCount: 0,
          failedChapterIndexes: [],
          pausedReason: "none",
        });
      });
      await waitFor(() => {
        expect(result.current.failedChapterIndexes).toEqual([]);
      });
      expect(result.current.failedCacheCount).toBe(0);
    });

    it("startBatchCache: enqueueBatchCache 待機中に削除・キャッシュ削除等の排他操作が割り込んだ場合、完了前後を問わず進行状態を誤って維持しないこと", async () => {
      // 1. 排他操作（confirmClearCache）が進行中のまま enqueueBatchCache が解決した場合
      const db1 = await resetTestDb();
      const novelRepo1 = new SqlNovelRepository(db1);
      const chapterRepo1 = new SqlChapterRepository(db1);
      const queueRepo1 = new SqlQueueRepository(db1);
      const seeded1 = await seedSampleNovel(novelRepo1, 2);
      const mock1 = createMockCacheScheduler();
      const hook1 = renderHook(() => useNovelDetail(seeded1.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo1,
          chapterRepository: chapterRepo1,
          queueRepository: queueRepo1,
          cacheScheduler: mock1.scheduler,
        }),
      });
      await waitFor(() => expect(hook1.result.current.isLoading).toBe(false));

      let resolveEnqueue1: (() => void) | null = null;
      vi.mocked(mock1.scheduler.enqueueBatchCache).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveEnqueue1 = resolve;
          }),
      );
      let resolveClear1: ((deleted: number) => void) | null = null;
      vi.spyOn(chapterRepo1, "deleteCachedBodies").mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveClear1 = resolve;
          }),
      );

      let pendingBatch1: Promise<void> | undefined;
      act(() => {
        pendingBatch1 = hook1.result.current.startBatchCache();
      });
      await waitFor(() => expect(resolveEnqueue1).not.toBeNull());

      let pendingClear1: Promise<number> | undefined;
      act(() => {
        pendingClear1 = hook1.result.current.confirmClearCache({
          onlyRead: false,
        });
      });
      await waitFor(() => expect(resolveClear1).not.toBeNull());

      resolveEnqueue1!();
      await act(async () => {
        await pendingBatch1;
      });
      resolveClear1!(0);
      await act(async () => {
        await pendingClear1;
      });
      expect(mock1.scheduler.cancelNovelTasks).toHaveBeenCalledWith(
        seeded1.id,
        { clearQueue: true },
      );
      expect(hook1.result.current.isBatchCaching).toBe(false);
      expect(hook1.result.current.batchCacheProgress).toBeNull();

      // 2. enqueueBatchCache 待機中に confirmDeleteNovel が完了した場合（isDeletedRef.current === true）
      const db2 = await resetTestDb();
      const novelRepo2 = new SqlNovelRepository(db2);
      const chapterRepo2 = new SqlChapterRepository(db2);
      const queueRepo2 = new SqlQueueRepository(db2);
      const seeded2 = await seedSampleNovel(novelRepo2, 2);
      const mock2 = createMockCacheScheduler();
      const hook2 = renderHook(() => useNovelDetail(seeded2.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo2,
          chapterRepository: chapterRepo2,
          queueRepository: queueRepo2,
          cacheScheduler: mock2.scheduler,
        }),
      });
      await waitFor(() => expect(hook2.result.current.isLoading).toBe(false));

      let resolveEnqueue2: (() => void) | null = null;
      vi.mocked(mock2.scheduler.enqueueBatchCache).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveEnqueue2 = resolve;
          }),
      );
      let pendingBatch2: Promise<void> | undefined;
      act(() => {
        pendingBatch2 = hook2.result.current.startBatchCache();
      });
      await waitFor(() => expect(resolveEnqueue2).not.toBeNull());

      await act(async () => {
        const deleted = await hook2.result.current.confirmDeleteNovel();
        expect(deleted).toBe(true);
      });

      resolveEnqueue2!();
      await act(async () => {
        await pendingBatch2;
      });
      expect(mock2.scheduler.cancelNovelTasks).toHaveBeenCalledWith(
        seeded2.id,
        { clearQueue: true },
      );
      expect(hook2.result.current.isBatchCaching).toBe(false);
      expect(hook2.result.current.batchCacheProgress).toBeNull();

      // 3. enqueueBatchCache 待機中に confirmClearCache が先に完了した場合（exclusiveOpSeq 変更検知）
      const db3 = await resetTestDb();
      const novelRepo3 = new SqlNovelRepository(db3);
      const chapterRepo3 = new SqlChapterRepository(db3);
      const queueRepo3 = new SqlQueueRepository(db3);
      const seeded3 = await seedSampleNovel(novelRepo3, 2);
      const mock3 = createMockCacheScheduler();
      const hook3 = renderHook(() => useNovelDetail(seeded3.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo3,
          chapterRepository: chapterRepo3,
          queueRepository: queueRepo3,
          cacheScheduler: mock3.scheduler,
        }),
      });
      await waitFor(() => expect(hook3.result.current.isLoading).toBe(false));

      let resolveEnqueue3: (() => void) | null = null;
      vi.mocked(mock3.scheduler.enqueueBatchCache).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveEnqueue3 = resolve;
          }),
      );
      let pendingBatch3: Promise<void> | undefined;
      act(() => {
        pendingBatch3 = hook3.result.current.startBatchCache();
      });
      await waitFor(() => expect(resolveEnqueue3).not.toBeNull());

      await act(async () => {
        await hook3.result.current.confirmClearCache({ onlyRead: true });
      });

      resolveEnqueue3!();
      await act(async () => {
        await pendingBatch3;
      });
      expect(mock3.scheduler.cancelNovelTasks).toHaveBeenCalledWith(
        seeded3.id,
        { clearQueue: false },
      );
      expect(hook3.result.current.isBatchCaching).toBe(false);
      expect(hook3.result.current.batchCacheProgress).toBeNull();
    });

    it("startBatchCache: enqueueBatchCache 待機中に cancelBatchCache された場合も直前の failedChapterIndexes・failedCacheCount が維持されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);
      await queueRepo.enqueueChapters(seeded.id, [
        { chapterIndex: 1, targetUrl: "https://example.com/1" },
      ]);
      await queueRepo.updateStatus(seeded.id, 1, "failed", {
        lastError: "前回エラー",
        incrementRetry: true,
      });

      const { scheduler } = createMockCacheScheduler();
      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          cacheScheduler: scheduler,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.failedChapterIndexes).toEqual([1]);
      });

      let resolveEnqueue: (() => void) | null = null;
      vi.mocked(scheduler.enqueueBatchCache).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveEnqueue = resolve;
          }),
      );
      let pendingStart: Promise<void> | undefined;
      act(() => {
        pendingStart = result.current.startBatchCache();
      });
      await waitFor(() => expect(resolveEnqueue).not.toBeNull());

      act(() => {
        result.current.cancelBatchCache();
      });

      resolveEnqueue!();
      await act(async () => {
        await pendingStart;
      });
      expect(scheduler.pauseNovelTasks).toHaveBeenCalledWith(seeded.id);
      expect(result.current.isBatchCaching).toBe(false);
      expect(result.current.batchCacheProgress).toBeNull();
      expect(result.current.failedChapterIndexes).toEqual([1]);
      expect(result.current.failedCacheCount).toBe(1);
    });

    it("cancelBatchCache: CacheScheduler 注入時は pauseNovelTasks(novelId) を呼び出すこと", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 1);
      const { scheduler } = createMockCacheScheduler();

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          cacheScheduler: scheduler,
        }),
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.cancelBatchCache();
      });
      expect(scheduler.pauseNovelTasks).toHaveBeenCalledWith(seeded.id);
    });

    it("refreshToc: pauseNovelTasks 待機前から即時 isRefreshing === true となり(No. 450)、失敗時・全話既キャッシュ時は再登録せず、各 await 境界のアンマウントで後続を実行しないこと", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      const { scheduler } = createMockCacheScheduler();
      vi.mocked(scheduler.isNovelBatchCaching).mockReturnValue(true);

      let resolvePause: (() => void) | null = null;
      vi.mocked(scheduler.pauseNovelTasks).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolvePause = resolve;
          }),
      );

      const httpClient = new MockHttpClient();
      const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

      const hookA = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          httpClient,
          cacheScheduler: scheduler,
        }),
      });
      await waitFor(() => expect(hookA.result.current.isLoading).toBe(false));

      // pauseNovelTasks 待機中でも即座に isRefreshing === true
      let refreshPromiseA: Promise<boolean> | undefined;
      act(() => {
        refreshPromiseA = hookA.result.current.refreshToc();
      });
      expect(hookA.result.current.isRefreshing).toBe(true);
      await waitFor(() => expect(resolvePause).not.toBeNull());

      // pauseNovelTasks 中にアンマウントされると通信へ進まない
      hookA.unmount();
      resolvePause!();
      expect(await refreshPromiseA).toBe(false);
      expect(getHtmlSpy).not.toHaveBeenCalled();

      // TOC 取得失敗時は enqueueBatchCache を再呼び出ししない
      const hookB = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          httpClient,
          cacheScheduler: scheduler,
        }),
      });
      await waitFor(() => expect(hookB.result.current.isLoading).toBe(false));
      httpClient.setResponse(
        new RegExp(`kakuyomu\\.jp/works/${KAKUYOMU_WORK_ID}$`),
        () => {
          throw new Error("HTTP 500 Server Error");
        },
      );
      let okB = true;
      await act(async () => {
        okB = await hookB.result.current.refreshToc();
      });
      expect(okB).toBe(false);
      expect(scheduler.enqueueBatchCache).not.toHaveBeenCalled();

      // TOC 成功後、全話既キャッシュの場合は再エンキューせず、queue 読込中にアンマウントしても再エンキューしない
      await chapterRepo.saveChapterBody(
        seeded.id,
        1,
        createDummyBody(1, "<p>1</p>"),
        new Date().toISOString(),
      );
      await chapterRepo.saveChapterBody(
        seeded.id,
        2,
        createDummyBody(2, "<p>2</p>"),
        new Date().toISOString(),
      );
      // 4話ある workIndexHtml を返し、3・4話目を status === "failed" にして remainingIndexes === 0 をテスト
      await queueRepo.enqueueChapters(seeded.id, [
        { chapterIndex: 3, targetUrl: "https://example.com/3" },
        { chapterIndex: 4, targetUrl: "https://example.com/4" },
      ]);
      for (const chIdx of [3, 4]) {
        for (let i = 0; i < 3; i++) {
          await queueRepo.updateStatus(seeded.id, chIdx, "failed", {
            lastError: "上限",
            incrementRetry: true,
          });
        }
      }
      httpClient.setResponse(
        new RegExp(`kakuyomu\\.jp/works/${KAKUYOMU_WORK_ID}$`),
        { status: 200, headers: {}, html: workIndexHtml },
      );
      let okB2 = false;
      await act(async () => {
        okB2 = await hookB.result.current.refreshToc();
      });
      expect(okB2).toBe(true);
      expect(scheduler.enqueueBatchCache).not.toHaveBeenCalled();

      // listByNovelId(再エンキュー判定)待機中のアンマウントで enqueueBatchCache を呼ばない
      await queueRepo.clearNovelQueue(seeded.id);
      const origList = queueRepo.listByNovelId.bind(queueRepo);
      let queueCallCount = 0;
      let resolveListOnRefresh: (() => void) | null = null;
      vi.spyOn(queueRepo, "listByNovelId").mockImplementation(async (id) => {
        queueCallCount++;
        const res = await origList(id);
        // syncQueueState の 2 回の listByNovelId の後、refreshToc の再エンキュー判定 (3回目) で待機
        if (queueCallCount === 3) {
          await new Promise<void>((resolve) => {
            resolveListOnRefresh = resolve;
          });
        }
        return res;
      });
      let refreshPromiseB3: Promise<boolean> | undefined;
      act(() => {
        refreshPromiseB3 = hookB.result.current.refreshToc();
      });
      await waitFor(() => expect(resolveListOnRefresh).not.toBeNull());
      hookB.unmount();
      resolveListOnRefresh!();
      await refreshPromiseB3;
      expect(scheduler.enqueueBatchCache).not.toHaveBeenCalled();
    });

    it("confirmClearCache: onlyRead オプションに応じた cancelNovelTasks({ clearQueue }) 呼び出しと待機中アンマウント時の安全終了、および一括キャッシュ中の toggleFavorite 成功を確認すること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);
      const { scheduler } = createMockCacheScheduler();

      const { result, unmount } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          cacheScheduler: scheduler,
        }),
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // isBatchCaching === true 中でも toggleFavorite が実行できる
      vi.mocked(scheduler.getNovelProgress).mockReturnValue({
        novelId: seeded.id,
        isBatchCaching: true,
        status: "running",
        current: 0,
        total: 2,
        failedCount: 0,
        failedChapterIndexes: [],
        pausedReason: "none",
      });
      let favOk = false;
      await act(async () => {
        favOk = await result.current.toggleFavorite();
      });
      expect(favOk).toBe(true);
      expect(result.current.novel?.isFavorite).toBe(true);

      // onlyRead: true -> clearQueue: false
      await act(async () => {
        await result.current.confirmClearCache({ onlyRead: true });
      });
      expect(scheduler.cancelNovelTasks).toHaveBeenLastCalledWith(seeded.id, {
        clearQueue: false,
      });

      // onlyRead: false -> clearQueue: true
      await act(async () => {
        await result.current.confirmClearCache({ onlyRead: false });
      });
      expect(scheduler.cancelNovelTasks).toHaveBeenLastCalledWith(seeded.id, {
        clearQueue: true,
      });

      // cancelNovelTasks 待機中にアンマウントされた場合は deleteCachedBodies を呼ばない
      const deleteBodiesSpy = vi.spyOn(chapterRepo, "deleteCachedBodies");
      let resolveCancel: (() => void) | null = null;
      vi.mocked(scheduler.cancelNovelTasks).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveCancel = resolve;
          }),
      );
      let clearPromise: Promise<number> | undefined;
      act(() => {
        clearPromise = result.current.confirmClearCache({ onlyRead: false });
      });
      await waitFor(() => expect(resolveCancel).not.toBeNull());
      unmount();
      resolveCancel!();
      expect(await clearPromise).toBe(0);
      expect(deleteBodiesSpy).not.toHaveBeenCalled();
    });
  });

  describe("cacheScheduler 未注入時のレガシー直列フォールバック (Issue #344)", () => {
    const createDummyBody = (
      idx: number,
      html: string,
      byteSize: number = 128,
    ) => ({
      remoteChapterId: KAKUYOMU_EPISODE_IDS[idx - 1] ?? `ep-${idx}`,
      title: `第${idx}話`,
      bodyHtml: html,
      byteSize,
      prevChapterUrl: null,
      nextChapterUrl: null,
    });

    it("cacheScheduler 未注入時、直列一括キャッシュ・古いキャッシュ救済・HTTP/パース失敗継続・完了処理が動作すること", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const queueRepo = new SqlQueueRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 4);

        // 第1話は7日超キャッシュ済み（失敗時フォールバック）、第2話はHTTP 500、第3話はパース失敗、第4話は成功
        const staleTime = new Date(
          Date.now() - CACHE_TTL_MS - 5000,
        ).toISOString();
        await chapterRepo.saveChapterBody(
          seeded.id,
          1,
          createDummyBody(1, "<p>古い第1話</p>", 100),
          staleTime,
        );

        const httpClient = new MockHttpClient();
        httpClient.setResponse(new RegExp(KAKUYOMU_EPISODE_IDS[0]), {
          status: 500,
          headers: {},
          html: "Server Error",
        });
        httpClient.setResponse(new RegExp(KAKUYOMU_EPISODE_IDS[1]), {
          status: 500,
          headers: {},
          html: "Server Error",
        });
        httpClient.setResponse(new RegExp(KAKUYOMU_EPISODE_IDS[2]), {
          status: 200,
          headers: {},
          html: episodeContentHtml,
        });
        httpClient.setResponse(new RegExp(KAKUYOMU_EPISODE_IDS[3]), {
          status: 200,
          headers: {},
          html: episodeContentHtml,
        });

        const baseRegistry = createDefaultParserRegistry();
        const baseParser = baseRegistry.requireParser(seeded.canonicalUrl);
        const origParse = baseParser.parseChapterContent.bind(baseParser);
        vi.spyOn(baseParser, "parseChapterContent")
          .mockImplementation(origParse)
          .mockImplementationOnce(() => {
            throw new Error("パース異常");
          });

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWithoutSchedulerWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            queueRepository: queueRepo,
            httpClient,
            parserRegistry: baseRegistry,
          }),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let batchPromise: Promise<void> | undefined;
        act(() => {
          batchPromise = result.current.startBatchCache();
        });

        for (let step = 0; step < 3; step++) {
          await act(async () => {
            await vi.advanceTimersByTimeAsync(1600);
          });
        }
        await act(async () => {
          await batchPromise;
        });

        expect(result.current.isBatchCaching).toBe(false);
        expect(result.current.failedChapterIndexes).toEqual([2, 3]);
        expect(result.current.error).toBe(
          "2話の取得に失敗しました（再試行可能）",
        );
        expect(result.current.chapters[3].downloadedAt).not.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("cacheScheduler 未注入時、全話成功（旧キャッシュ更新）および外側例外（enqueueChapters失敗）を処理できること", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const queueRepo = new SqlQueueRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 3);

        // 第1話は鮮度内、第2話は古いキャッシュ（7日超経過）、第3話は未キャッシュ
        await chapterRepo.saveChapterBody(
          seeded.id,
          1,
          createDummyBody(1, "<p>鮮度内</p>", 100),
          new Date().toISOString(),
        );
        await chapterRepo.saveChapterBody(
          seeded.id,
          2,
          createDummyBody(2, "<p>旧キャッシュ</p>", 100),
          new Date(Date.now() - CACHE_TTL_MS - 10_000).toISOString(),
        );

        const httpClient = new MockHttpClient();
        httpClient.setResponse(/kakuyomu\.jp\/works\/.*\/episodes\/.*/, {
          status: 200,
          headers: {},
          html: episodeContentHtml,
        });

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWithoutSchedulerWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            queueRepository: queueRepo,
            httpClient,
          }),
        });
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
          await result.current.startBatchCache();
        });
        expect(result.current.refreshMessage).toBe(
          "全話のキャッシュを取得しました",
        );

        // 外側例外 catch 確認（鮮度切れ状態にして enqueueChapters を失敗させる）
        await chapterRepo.deleteCachedBodies(seeded.id, { onlyRead: false });
        await act(async () => {
          await result.current.reloadDetail({ silent: true });
        });
        vi.spyOn(queueRepo, "enqueueChapters").mockRejectedValueOnce(
          "unexpected error",
        );
        await act(async () => {
          await result.current.startBatchCache();
        });
        expect(result.current.error).toBe("キャッシュの取得に失敗しました");
        expect(result.current.isBatchCaching).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it("cacheScheduler 未注入時、HTTP中/HTTP失敗中/パース中/待機中のキャンセルとアンマウント時の abort + resetInterruptedToPending が動作すること", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        // 1. HTTP 解決後 Abort, HTTP エラー後 Abort, 待機中 Abort, アンマウント時 Abort
        const db1 = await resetTestDb();
        const novelRepo1 = new SqlNovelRepository(db1);
        const chapterRepo1 = new SqlChapterRepository(db1);
        const queueRepo1 = new SqlQueueRepository(db1);
        const seeded1 = await seedSampleNovel(novelRepo1, 3);
        const resetSpy1 = vi.spyOn(queueRepo1, "resetInterruptedToPending");

        let resolveDelayedHttp: ((res: HttpResponse) => void) | null = null;
        let httpMode: "resolve" | "reject" | "instant" = "resolve";
        const httpClient1: HttpClientBridge = {
          getHtml: vi.fn(async (opts) => {
            if (httpMode === "instant") {
              return {
                status: 200,
                headers: {},
                html: episodeContentHtml,
                url: opts.url,
              };
            }
            if (httpMode === "resolve") {
              return new Promise<HttpResponse>((resolve) => {
                resolveDelayedHttp = resolve;
              });
            }
            return new Promise<HttpResponse>((_resolve, reject) => {
              opts.signal?.addEventListener("abort", () => {
                reject(new DOMException("Aborted", "AbortError"));
              });
            });
          }),
        };

        const hook1 = renderHook(() => useNovelDetail(seeded1.id), {
          wrapper: createWithoutSchedulerWrapper({
            novelRepository: novelRepo1,
            chapterRepository: chapterRepo1,
            queueRepository: queueRepo1,
            httpClient: httpClient1,
          }),
        });
        await waitFor(() => expect(hook1.result.current.isLoading).toBe(false));

        // 1a. HTTP 解決直前に cancelBatchCache -> 解決後も保存せず pending
        let p1: Promise<void> | undefined;
        act(() => {
          p1 = hook1.result.current.startBatchCache();
        });
        await waitFor(() => expect(resolveDelayedHttp).not.toBeNull());
        act(() => {
          hook1.result.current.cancelBatchCache();
        });
        resolveDelayedHttp!({
          status: 200,
          headers: {},
          html: episodeContentHtml,
          url: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}/episodes/${KAKUYOMU_EPISODE_IDS[0]}`,
        });
        await act(async () => {
          await p1;
        });
        expect(hook1.result.current.isBatchCaching).toBe(false);

        // 1b. HTTP reject + abort
        httpMode = "reject";
        let p2: Promise<void> | undefined;
        act(() => {
          p2 = hook1.result.current.startBatchCache();
        });
        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
        });
        act(() => {
          hook1.result.current.cancelBatchCache();
        });
        await act(async () => {
          await p2;
        });
        expect(hook1.result.current.error).toBeNull();

        // 1c. レートリミット待機中に cancelBatchCache
        httpMode = "instant";
        let p3: Promise<void> | undefined;
        act(() => {
          p3 = hook1.result.current.startBatchCache();
        });
        await waitFor(() =>
          expect(hook1.result.current.batchCacheProgress?.current).toBe(1),
        );
        act(() => {
          hook1.result.current.cancelBatchCache();
        });
        await act(async () => {
          await p3;
        });
        expect(hook1.result.current.isBatchCaching).toBe(false);

        // 1d. アンマウント時に abort + resetInterruptedToPending が呼ばれる
        act(() => {
          void hook1.result.current.startBatchCache();
        });
        await act(async () => {
          await Promise.resolve();
        });
        const resetCountBeforeUnmount = resetSpy1.mock.calls.length;
        hook1.unmount();
        expect(resetSpy1).toHaveBeenCalledTimes(resetCountBeforeUnmount + 1);

        // 2. パース中 AbortError
        const db2 = await resetTestDb();
        const novelRepo2 = new SqlNovelRepository(db2);
        const chapterRepo2 = new SqlChapterRepository(db2);
        const queueRepo2 = new SqlQueueRepository(db2);
        const seeded2 = await seedSampleNovel(novelRepo2, 1);
        const httpClient2 = new MockHttpClient();
        httpClient2.setResponse(/kakuyomu\.jp\/works\/.*\/episodes\/.*/, {
          status: 200,
          headers: {},
          html: episodeContentHtml,
        });
        let triggerAbort: (() => void) | null = null;
        const abortingParser = {
          siteType: "kakuyomu" as const,
          name: "Kakuyomu",
          canHandle: () => true,
          parseNovelIndex: vi.fn(),
          parseChapterContent: vi.fn(() => {
            triggerAbort?.();
            throw new DOMException("Aborted", "AbortError");
          }),
        };
        const hook2 = renderHook(() => useNovelDetail(seeded2.id), {
          wrapper: createWithoutSchedulerWrapper({
            novelRepository: novelRepo2,
            chapterRepository: chapterRepo2,
            queueRepository: queueRepo2,
            httpClient: httpClient2,
            parserRegistry: {
              getParser: () => abortingParser,
              requireParser: () => abortingParser,
              getAllParsers: () => [abortingParser],
            } as unknown as ParserRegistry,
          }),
        });
        await waitFor(() => expect(hook2.result.current.isLoading).toBe(false));
        triggerAbort = () => {
          hook2.result.current.cancelBatchCache();
        };
        await act(async () => {
          await hook2.result.current.startBatchCache();
        });
        expect(hook2.result.current.pendingCacheCount).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("R1-15: !cacheScheduler フォールバック時の失敗あり完了キュークリーンアップ", () => {
    it("失敗話が残る場合でも古いキャッシュフォールバック行・完了済み行・対象外非failed行が削除され、failed行のみ残ること", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        // Case A: 古いキャッシュ失敗(ch1) + 新規失敗(ch2) + 成功(ch3) + 既存対象外completed行(ch4)
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const queueRepo = new SqlQueueRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 4);

        const staleTime = new Date(
          Date.now() - CACHE_TTL_MS - 5000,
        ).toISOString();
        await chapterRepo.saveChapterBody(
          seeded.id,
          1,
          {
            remoteChapterId: KAKUYOMU_EPISODE_IDS[0],
            title: "第1話",
            bodyHtml: "<p>古い第1話</p>",
            byteSize: 100,
            prevChapterUrl: null,
            nextChapterUrl: null,
          },
          staleTime,
        );
        await chapterRepo.saveChapterBody(
          seeded.id,
          4,
          {
            remoteChapterId: KAKUYOMU_EPISODE_IDS[3],
            title: "第4話",
            bodyHtml: "<p>新鮮第4話</p>",
            byteSize: 100,
            prevChapterUrl: null,
            nextChapterUrl: null,
          },
          new Date().toISOString(),
        );

        const httpClient = new MockHttpClient();
        httpClient.setResponse(new RegExp(KAKUYOMU_EPISODE_IDS[0]), {
          status: 500,
          headers: {},
          html: "Server Error",
        });
        httpClient.setResponse(
          new RegExp(KAKUYOMU_EPISODE_IDS[1]),
          async () => {
            // バッチ実行中に完了済み行が残存したケースも再現し、完了時に削除されることを検証する
            await queueRepo.enqueueChapters(seeded.id, [
              {
                chapterIndex: 4,
                targetUrl: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}/episodes/${KAKUYOMU_EPISODE_IDS[3]}`,
              },
            ]);
            await queueRepo.updateStatus(seeded.id, 4, "completed");
            return {
              status: 500,
              headers: {},
              html: "Server Error",
            };
          },
        );
        httpClient.setResponse(new RegExp(KAKUYOMU_EPISODE_IDS[2]), {
          status: 200,
          headers: {},
          html: episodeContentHtml,
        });

        const updateStatusSpy = vi.spyOn(queueRepo, "updateStatus");
        const deleteSpy = vi.spyOn(queueRepo, "deleteByNovelAndChapters");

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWithoutSchedulerWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            queueRepository: queueRepo,
            httpClient,
          }),
        });
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let batchPromise: Promise<void> | undefined;
        act(() => {
          batchPromise = result.current.startBatchCache();
        });
        for (let step = 0; step < 3; step++) {
          await act(async () => {
            await vi.advanceTimersByTimeAsync(1600);
          });
        }
        await act(async () => {
          await batchPromise;
        });

        expect(updateStatusSpy).not.toHaveBeenCalledWith(
          seeded.id,
          1,
          "completed",
        );
        expect(updateStatusSpy).not.toHaveBeenCalledWith(
          seeded.id,
          3,
          "completed",
        );
        expect(deleteSpy).toHaveBeenCalledWith(seeded.id, [1]);
        expect(deleteSpy).toHaveBeenCalledWith(seeded.id, [3]);
        expect(deleteSpy).toHaveBeenCalledWith(seeded.id, [4]);

        const remaining = await queueRepo.listByNovelId(seeded.id);
        expect(remaining.map((item) => item.chapterIndex)).toEqual([2]);
        expect(remaining[0].status).toBe("failed");

        // Case B: failed 行のみ残存する状態（nonFailedIndexes.length === 0）で再失敗しても正常完了すること
        let retryPromise: Promise<void> | undefined;
        act(() => {
          retryPromise = result.current.startBatchCache();
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1600);
        });
        await act(async () => {
          await retryPromise;
        });
        const remainingAfterRetry = await queueRepo.listByNovelId(seeded.id);
        expect(remainingAfterRetry.map((item) => item.chapterIndex)).toEqual([
          2,
        ]);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("R1-11: 手動一括再試行の上限撤廃と refreshToc 再開の failed 除外・進捗整合", () => {
    it("CacheScheduler 実体使用時、retryCount >= 3 の failed 話も startBatchCache で再試行・キャッシュ保存され全話完了となること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      const seeded = await seedSampleNovel(novelRepo, 2);

      // 第1話を retryCount = 3 の failed、第2話を既キャッシュとして準備
      await chapterRepo.saveChapterBody(
        seeded.id,
        2,
        {
          remoteChapterId: KAKUYOMU_EPISODE_IDS[1],
          title: "第2話",
          bodyHtml: "<p>2</p>",
          byteSize: 10,
          prevChapterUrl: null,
          nextChapterUrl: null,
        },
        new Date().toISOString(),
      );
      await queueRepo.enqueueChapters(seeded.id, [
        {
          chapterIndex: 1,
          targetUrl: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}/episodes/${KAKUYOMU_EPISODE_IDS[0]}`,
        },
      ]);
      for (let i = 0; i < 3; i++) {
        await queueRepo.updateStatus(seeded.id, 1, "failed", {
          lastError: "通信失敗",
          incrementRetry: true,
        });
      }

      const httpClient = new MockHttpClient();
      httpClient.setResponse(new RegExp(KAKUYOMU_EPISODE_IDS[0]), {
        status: 200,
        headers: {},
        html: episodeContentHtml,
      });

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 0,
      });

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          httpClient,
          cacheScheduler: scheduler,
        }),
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.failedChapterIndexes).toEqual([1]);

      await act(async () => {
        await result.current.startBatchCache();
      });

      await waitFor(() => {
        expect(result.current.isBatchCaching).toBe(false);
        expect(result.current.isAllCached).toBe(true);
      });
      expect(result.current.failedChapterIndexes).toEqual([]);
      expect(result.current.refreshMessage).toBe(
        "全話のキャッシュを取得しました",
      );
      expect(await queueRepo.listByNovelId(seeded.id)).toEqual([]);
      scheduler.dispose();
    });

    it("!cacheScheduler フォールバック時も retryCount >= 3 の failed 話を除外せず再試行できること", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const queueRepo = new SqlQueueRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 1);

        await queueRepo.enqueueChapters(seeded.id, [
          {
            chapterIndex: 1,
            targetUrl: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}/episodes/${KAKUYOMU_EPISODE_IDS[0]}`,
          },
        ]);
        for (let i = 0; i < 4; i++) {
          await queueRepo.updateStatus(seeded.id, 1, "failed", {
            lastError: "過去失敗",
            incrementRetry: true,
          });
        }

        const httpClient = new MockHttpClient();
        httpClient.setResponse(new RegExp(KAKUYOMU_EPISODE_IDS[0]), {
          status: 200,
          headers: {},
          html: episodeContentHtml,
        });

        const { result } = renderHook(() => useNovelDetail(seeded.id), {
          wrapper: createWithoutSchedulerWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            queueRepository: queueRepo,
            httpClient,
          }),
        });
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
          await result.current.startBatchCache();
        });
        expect(result.current.failedChapterIndexes).toEqual([]);
        expect(result.current.refreshMessage).toBe(
          "全話のキャッシュを取得しました",
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("refreshToc 自動再開時は status === 'failed'（retryCount < 3 含む）を除外して残話・新規話のみを再開し、完了時も失敗話を保持して誤通知しないこと", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);
      // 初期 2 話、workIndexHtml で 4 話へ増加するシナリオ
      const seeded = await seedSampleNovel(novelRepo, 2);

      // ch 1 は retryCount=1 の failed、ch 2 は pending
      await queueRepo.enqueueChapters(seeded.id, [
        {
          chapterIndex: 1,
          targetUrl: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}/episodes/${KAKUYOMU_EPISODE_IDS[0]}`,
        },
        {
          chapterIndex: 2,
          targetUrl: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}/episodes/${KAKUYOMU_EPISODE_IDS[1]}`,
        },
      ]);
      await queueRepo.updateStatus(seeded.id, 1, "failed", {
        lastError: "前回エラー",
        incrementRetry: true,
      });

      const httpClient = new MockHttpClient();
      httpClient.setResponse(
        new RegExp(`kakuyomu\\.jp/works/${KAKUYOMU_WORK_ID}$`),
        {
          status: 200,
          headers: {},
          html: workIndexHtml,
        },
      );
      let releaseEp2Http!: () => void;
      const ep2HttpGate = new Promise<void>((r) => {
        releaseEp2Http = r;
      });
      let notifyEp2Started!: () => void;
      const ep2Started = new Promise<void>((r) => {
        notifyEp2Started = r;
      });
      httpClient.setResponse(new RegExp(KAKUYOMU_EPISODE_IDS[1]), async () => {
        notifyEp2Started();
        await ep2HttpGate;
        return { status: 200, headers: {}, html: episodeContentHtml };
      });
      httpClient.setResponse(new RegExp(KAKUYOMU_EPISODE_IDS[2]), {
        status: 200,
        headers: {},
        html: episodeContentHtml,
      });
      httpClient.setResponse(new RegExp(KAKUYOMU_EPISODE_IDS[3]), {
        status: 200,
        headers: {},
        html: episodeContentHtml,
      });

      const scheduler = createCacheScheduler({
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        queueRepository: queueRepo,
        httpClient,
        parserRegistry: createDefaultParserRegistry(),
        prefetchIntervalMs: 0,
      });
      const enqueueSpy = vi.spyOn(scheduler, "enqueueBatchCache");

      const { result } = renderHook(() => useNovelDetail(seeded.id), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          queueRepository: queueRepo,
          httpClient,
          cacheScheduler: scheduler,
        }),
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // ch 2 のみを対象にしてバッチ進行中に refreshToc を呼ぶ
      await scheduler.enqueueBatchCache(seeded.id, [2]);
      await ep2Started;
      enqueueSpy.mockClear();

      let refreshPromise: Promise<boolean> | undefined;
      act(() => {
        refreshPromise = result.current.refreshToc();
      });
      // refreshToc 内の pauseNovelTasks が完了できるよう ep-2 の待機を解除
      releaseEp2Http();

      await act(async () => {
        expect(await refreshPromise).toBe(true);
      });

      // failed 状態の ch 1 は除外され、[2, 3, 4] のみ再投入される（ch 2 が完了済みなら [3, 4]）
      expect(enqueueSpy).toHaveBeenCalledTimes(1);
      expect(enqueueSpy.mock.calls[0]?.[1]).not.toContain(1);
      expect(enqueueSpy.mock.calls[0]?.[1]).toEqual(
        expect.arrayContaining([3, 4]),
      );

      await waitFor(() => {
        expect(result.current.isBatchCaching).toBe(false);
        expect(result.current.failedChapterIndexes).toEqual([1]);
      });
      expect(result.current.refreshMessage).not.toBe(
        "全話のキャッシュを取得しました",
      );
      expect(result.current.failedCacheCount).toBe(1);
      scheduler.dispose();
    });
  });
});

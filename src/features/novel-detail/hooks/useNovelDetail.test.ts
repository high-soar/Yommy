import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ServiceProvider } from "../../../app/ServiceProvider";
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
import type { HttpResponse } from "../../../bridges/http/types";
import type { NovelRepository } from "../../../storage/types";
import { ParserRegistry } from "../../../parsers/parserRegistry";
import type { SyncEngine } from "../../cloud-sync/services/syncEngine";
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

  const createWrapper =
    (services?: React.ComponentProps<typeof ServiceProvider>["services"]) =>
    ({ children }: { children: React.ReactNode }) =>
      React.createElement(ServiceProvider, { services }, children);

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

      vi.spyOn(queueRepo, "resetInterruptedToPending").mockRejectedValueOnce(
        new Error("キュー同期失敗"),
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

        expect(result.current.isBatchCaching).toBe(false);
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

        expect(result.current.isBatchCaching).toBe(false);
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

        expect(result.current.isBatchCaching).toBe(false);
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

        expect(result.current.isBatchCaching).toBe(false);
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

        act(() => {
          result.current.cancelBatchCache();
        });

        await act(async () => {
          await batchPromise;
        });

        expect(result.current.isBatchCaching).toBe(false);
        expect(result.current.error).toBeNull();
      });

      it("コンポーネントアンマウント時に一括キャッシュが即時中断されること", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 3);

        const httpClient = createMockHttpClient();

        const { result, unmount } = renderHook(
          () => useNovelDetail(seeded.id),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        act(() => {
          void result.current.startBatchCache();
        });

        // アンマウント
        unmount();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(3000);
        });

        vi.useRealTimers();
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

        expect(result.current.isBatchCaching).toBe(false);
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

      it("一括キャッシュ実行中の startBatchCache 多重実行や refreshToc, confirmDeleteNovel が防止されること", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        const httpClient = createMockHttpClient();

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

        // 実行中の多重 startBatchCache は無視される
        await act(async () => {
          await result.current.startBatchCache();
        });

        // 実行中の refreshToc は false
        let refreshOk = true;
        await act(async () => {
          refreshOk = await result.current.refreshToc();
        });
        expect(refreshOk).toBe(false);

        // 実行中の confirmDeleteNovel は false
        let deleteOk = true;
        await act(async () => {
          deleteOk = await result.current.confirmDeleteNovel();
        });
        expect(deleteOk).toBe(false);

        // キャンセルして後片付け
        act(() => {
          result.current.cancelBatchCache();
        });
        await act(async () => {
          await batchPromise;
        });

        vi.useRealTimers();
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

        let deletedCount = 0;
        await act(async () => {
          deletedCount = await result.current.confirmClearCache({
            onlyRead: true, // 既読話なしのため 0 件
          });
        });

        expect(deletedCount).toBe(0);
        expect(resetInterruptedSpy).toHaveBeenCalledTimes(1);
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

      expect(result.current.isBatchCaching).toBe(false);
      // 残り2話が pending
      expect(result.current.pendingCacheCount).toBe(2);

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

      expect(result.current.isBatchCaching).toBe(false);
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

      expect(result.current.isBatchCaching).toBe(false);
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

      expect(result.current.isBatchCaching).toBe(false);
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

      expect(result.current.isBatchCaching).toBe(false);
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

      expect(saveSpy).not.toHaveBeenCalled();
      expect(result.current.isBatchCaching).toBe(false);
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
          if (callCount === 1) {
            return origGetById(id);
          }
          return new Promise((resolve) => {
            resolveLatestNovel = resolve;
          });
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

        let batchPromiseB: Promise<void> | undefined;
        act(() => {
          batchPromiseB = hookB.result.current.startBatchCache();
        });

        await waitFor(() => {
          expect(resolveLatestNovel).not.toBeNull();
        });

        hookB.unmount();
        resolveLatestNovel!(seededB);
        await batchPromiseB;

        expect(errorSpy).not.toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
      }
    });

    it("R1-22: startBatchCache / refreshToc / confirmClearCache 実行中に subscribePullCompleted が発火した場合、処理中は待機し完了後に遅延サイレント更新すること (AC-ND-28)", async () => {
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

      // 1. startBatchCache 中の遅延
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

      // 1-a. startBatchCache 開始中に Pull 通知 -> 即時 reloadDetail されないこと
      let batchPromise: Promise<void> | undefined;
      act(() => {
        batchPromise = result.current.startBatchCache();
      });
      await waitFor(() => expect(resolveBatchHttp).not.toBeNull());

      const listCallsDuringBatch = listChaptersSpy.mock.calls.length;
      await novelRepo.updateBookmark(seeded.id, 1, 0.25);
      act(() => {
        capturedListener?.({ pulled: true, mergedNovels: 1 });
      });
      expect(listChaptersSpy).toHaveBeenCalledTimes(listCallsDuringBatch);

      // 一括キャッシュ完了後に遅延 reloadDetail({ silent: true }) が走り新しおりが反映されること
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
        expect(result.current.novel?.bookmarkChapterIndex).toBe(1);
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
});

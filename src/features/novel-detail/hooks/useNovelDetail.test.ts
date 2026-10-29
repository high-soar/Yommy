import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ServiceProvider } from "../../../app/ServiceProvider";
import {
  useNovelDetail,
  DEFAULT_FETCH_ERROR_MESSAGE,
  DEFAULT_REFRESH_ERROR_MESSAGE,
  DEFAULT_DELETE_ERROR_MESSAGE,
} from "./useNovelDetail";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import { SqlNovelRepository } from "../../../storage/repositories/novelRepository";
import { SqlChapterRepository } from "../../../storage/repositories/chapterRepository";
import { MockHttpClient } from "../../../bridges/http/mockHttpClient";
import type { HttpResponse } from "../../../bridges/http/types";
import workIndexHtml from "../../../parsers/kakuyomu/__fixtures__/work_index.html?raw";
import episodeContentHtml from "../../../parsers/kakuyomu/__fixtures__/episode_content.html?raw";
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
    ) => ({
      remoteChapterId: KAKUYOMU_EPISODE_IDS[index - 1] ?? `ep-${index}`,
      title: `第${index}話`,
      bodyHtml,
      byteSize: 100,
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

      it("対象エピソードが存在しない（0件）場合、通信を行わずに即時終了すること", async () => {
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

        vi.useRealTimers();
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

    describe("エラーハンドリングと排他制御 (AC-ND-11, AC-ND-12)", () => {
      it("エピソード取得時にHTTPエラーが発生した場合、インラインエラーが設定され一括キャッシュが停止すること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedSampleNovel(novelRepo, 2);

        const httpClient = new MockHttpClient();
        httpClient.setResponse(/kakuyomu\.jp\/works\/.*\/episodes\/.*/, {
          status: 500,
          headers: {},
          html: "Internal Server Error",
        });

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

        expect(result.current.isBatchCaching).toBe(false);
        expect(result.current.error).toContain(
          "第1話の取得に失敗したためキャッシュを中断しました",
        );
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
  });
});

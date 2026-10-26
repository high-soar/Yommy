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

  const seedSampleNovel = async (
    novelRepo: SqlNovelRepository,
    chapterCount: number = 2,
  ) => {
    return await novelRepo.upsertNovelWithToc(
      {
        siteType: "kakuyomu",
        remoteWorkId: "16817330658027210412",
        canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
        title: "境界迷宮と異界の魔術師",
        author: "小野崎えいじ",
        synopsis: "異界の魔術師の物語",
        chapters: Array.from({ length: chapterCount }, (_, i) => ({
          chapterIndex: i + 1,
          remoteChapterId: `ep_${i + 1}`,
          partTitle: i >= 2 ? "第二章" : "第一章",
          title: `第${i + 1}話`,
          url: `https://kakuyomu.jp/works/16817330658027210412/episodes/ep_${i + 1}`,
          publishedAt: "2026-01-01T00:00:00Z",
        })),
        nextTocPageUrl: null,
      },
      "2026-01-01T00:00:00Z",
    );
  };

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

    // 先に4話取得済みの状態にしておく
    const { result } = renderHook(
      () => useNovelDetail("kakuyomu:16817330658027210412"),
      {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
        }),
      },
    );

    // 最初に事前登録（4話）
    await act(async () => {
      await seedSampleNovel(novelRepo, 4);
      await result.current.reloadDetail();
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
      /^https:\/\/kakuyomu\.jp\/works\/16817330658027210412$/,
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
      /^https:\/\/kakuyomu\.jp\/works\/16817330658027210412$/,
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
  });

  it("refreshToc: 処理中（isRefreshing === true）の多重実行が無効化されること", async () => {
    const db = await resetTestDb();
    const novelRepo = new SqlNovelRepository(db);
    const seeded = await seedSampleNovel(novelRepo, 2);

    let resolveHttp: ((value: HttpResponse) => void) | null = null;
    const mockHttp = new MockHttpClient();
    mockHttp.setResponse(
      /^https:\/\/kakuyomu\.jp\/works\/16817330658027210412$/,
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

    // 1回目を完了させる
    await act(async () => {
      resolveHttp?.({
        status: 200,
        url: "https://kakuyomu.jp/works/16817330658027210412",
        headers: {},
        html: workIndexHtml,
      });
      await firstPromise;
    });

    expect(result.current.isRefreshing).toBe(false);
  });

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
    vi.spyOn(novelRepo, "deleteNovel").mockRejectedValueOnce("不明な削除例外");

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

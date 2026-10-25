import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { useBookshelf } from "./useBookshelf";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import { SqlNovelRepository } from "../../../storage/repositories/novelRepository";
import { MockHttpClient } from "../../../bridges/http/mockHttpClient";
import type { HttpResponse } from "../../../bridges/http/types";
import workIndexHtml from "../../../parsers/kakuyomu/__fixtures__/work_index.html?raw";

describe("useBookshelf", () => {
  beforeEach(async () => {
    await resetTestDb();
    localStorage.clear();
    vi.clearAllMocks();
  });

  const createWrapper =
    (services?: React.ComponentProps<typeof ServiceProvider>["services"]) =>
    ({ children }: { children: React.ReactNode }) =>
      React.createElement(ServiceProvider, { services }, children);

  it("初期化完了後に本棚の作品一覧を取得し、未登録時は空配列であること (AC-BS-01)", async () => {
    const { result } = renderHook(() => useBookshelf(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.novels).toEqual([]);
    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.dialogError).toBeNull();
  });

  it("登録済み作品が存在する場合、初期ロードで作品サマリー一覧が設定されること (AC-BS-04)", async () => {
    const db = await resetTestDb();
    const repo = new SqlNovelRepository(db);
    await repo.upsertNovelWithToc(
      {
        siteType: "kakuyomu",
        remoteWorkId: "12345",
        canonicalUrl: "https://kakuyomu.jp/works/12345",
        title: "テスト事前登録作品",
        author: "テスト作者",
        synopsis: "あらすじ",
        chapters: [
          {
            chapterIndex: 1,
            remoteChapterId: "c1",
            partTitle: null,
            title: "第1話",
            url: "https://kakuyomu.jp/works/12345/episodes/c1",
            publishedAt: "2026-01-01T00:00:00Z",
          },
        ],
        nextTocPageUrl: null,
      },
      "2026-01-01T00:00:00Z",
    );

    const { result } = renderHook(() => useBookshelf(), {
      wrapper: createWrapper({ novelRepository: repo }),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.novels).toHaveLength(1);
    expect(result.current.novels[0].title).toBe("テスト事前登録作品");
    expect(result.current.novels[0].totalChapters).toBe(1);
  });

  it("openDialog / closeDialog でダイアログ開閉とエラークリアが正しく制御されること", async () => {
    const { result } = renderHook(() => useBookshelf(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.openDialog();
    });
    expect(result.current.isDialogOpen).toBe(true);

    act(() => {
      result.current.closeDialog();
    });
    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.dialogError).toBeNull();
  });

  it("未対応 URL や不正な文字列の場合は HTTP 通信を行わずにバリデーションエラーを返すこと (AC-BS-03)", async () => {
    const mockHttp = new MockHttpClient();
    const getHtmlSpy = vi.spyOn(mockHttp, "getHtml");

    const { result } = renderHook(() => useBookshelf(), {
      wrapper: createWrapper({ httpClient: mockHttp }),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.openDialog();
    });

    let success = true;
    await act(async () => {
      success = await result.current.addNovelByUrl(
        "https://example.com/invalid",
      );
    });

    expect(success).toBe(false);
    expect(getHtmlSpy).not.toHaveBeenCalled();
    expect(result.current.dialogError).toBe(
      "対応していないURLです。カクヨムの作品URLを入力してください。",
    );
    expect(result.current.isDialogOpen).toBe(true);
    expect(result.current.isSubmitting).toBe(false);

    // 空文字や空白のみの場合
    await act(async () => {
      success = await result.current.addNovelByUrl("   ");
    });
    expect(success).toBe(false);
    expect(result.current.dialogError).toBe(
      "対応していないURLです。カクヨムの作品URLを入力してください。",
    );
  });

  it("カクヨム作品トップURLから目次を取得してDBに保存し、本棚一覧を更新してダイアログを閉じること (AC-BS-02)", async () => {
    const { result } = renderHook(() => useBookshelf(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.openDialog();
    });

    let success = false;
    await act(async () => {
      success = await result.current.addNovelByUrl(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
    });

    expect(success).toBe(true);
    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.dialogError).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.novels).toHaveLength(1);
    expect(result.current.novels[0].title).toBe("境界迷宮と異界の魔術師");
    expect(result.current.novels[0].totalChapters).toBe(4);
  });

  it("カクヨムエピソードURLを入力した場合も正規化して作品・目次を登録できること (AC-BS-02)", async () => {
    const { result } = renderHook(() => useBookshelf(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.openDialog();
    });

    let success = false;
    await act(async () => {
      success = await result.current.addNovelByUrl(
        "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162327",
      );
    });

    expect(success).toBe(true);
    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.novels).toHaveLength(1);
  });

  it("HTTP通信またはパース処理でエラーが発生した場合、dialogError をセットしダイアログを閉じずに再試行可能とすること (AC-BS-03)", async () => {
    const mockHttp = new MockHttpClient();
    mockHttp.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, () => {
      throw new Error("ネットワーク接続エラー (500)");
    });

    const { result } = renderHook(() => useBookshelf(), {
      wrapper: createWrapper({ httpClient: mockHttp }),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.openDialog();
    });

    let success = true;
    await act(async () => {
      success = await result.current.addNovelByUrl(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
    });

    expect(success).toBe(false);
    expect(result.current.isDialogOpen).toBe(true);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.dialogError).toBe("ネットワーク接続エラー (500)");

    // 再試行: 正常なモック応答に差し替えて実行
    mockHttp.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, (options) => ({
      status: 200,
      url: options.url,
      headers: {},
      html: workIndexHtml,
    }));

    await act(async () => {
      success = await result.current.addNovelByUrl(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
    });

    expect(success).toBe(true);
    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.dialogError).toBeNull();
  });

  it("非Errorオブジェクト例外またはメッセージが空のErrorが発生した場合にデフォルトのエラーメッセージがセットされること", async () => {
    const mockHttp = new MockHttpClient();
    mockHttp.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, () => {
      throw "非Error例外文字列";
    });

    const { result } = renderHook(() => useBookshelf(), {
      wrapper: createWrapper({ httpClient: mockHttp }),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.openDialog();
    });

    let success = true;
    await act(async () => {
      success = await result.current.addNovelByUrl(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
    });

    expect(success).toBe(false);
    expect(result.current.dialogError).toBe("作品情報の取得に失敗しました");

    // 空文字メッセージの Error インスタンス
    mockHttp.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, () => {
      throw new Error("");
    });

    await act(async () => {
      success = await result.current.addNovelByUrl(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
    });
    expect(success).toBe(false);
    expect(result.current.dialogError).toBe("作品情報の取得に失敗しました");
  });

  it("処理中（isSubmitting === true）の二重送信およびダイアログクローズが無効化されること", async () => {
    let resolveHttp: ((value: HttpResponse) => void) | null = null;
    const mockHttp = new MockHttpClient();
    mockHttp.setResponse(
      /^https:\/\/kakuyomu\.jp\/works\/\d+$/,
      () =>
        new Promise((resolve) => {
          resolveHttp = resolve;
        }),
    );

    const { result } = renderHook(() => useBookshelf(), {
      wrapper: createWrapper({ httpClient: mockHttp }),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.openDialog();
    });

    // 1回目のリクエスト開始（未完了のまま待機）
    let firstCallPromise: Promise<boolean>;
    act(() => {
      firstCallPromise = result.current.addNovelByUrl(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
    });

    expect(result.current.isSubmitting).toBe(true);

    // 処理中のダイアログクローズ試行（無視されること）
    act(() => {
      result.current.closeDialog();
    });
    expect(result.current.isDialogOpen).toBe(true);

    // 処理中の二重送信試行（false が即時返却されること）
    let secondResult = true;
    await act(async () => {
      secondResult = await result.current.addNovelByUrl(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
    });
    expect(secondResult).toBe(false);

    // 1回目のリクエストを完了させる
    await act(async () => {
      resolveHttp?.({
        status: 200,
        url: "https://kakuyomu.jp/works/16817330658027210412",
        headers: {},
        html: workIndexHtml,
      });
      await firstCallPromise;
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.isDialogOpen).toBe(false);
  });

  it("アンマウント後に初期一覧取得が完了してもステート更新エラーが発生しないこと", async () => {
    let resolveList: ((value: unknown) => void) | null = null;
    const customRepo = {
      listNovels: vi.fn(
        () =>
          new Promise((resolve) => {
            resolveList = resolve;
          }),
      ),
      upsertNovelWithToc: vi.fn(),
    } as unknown as SqlNovelRepository;

    const { unmount } = renderHook(() => useBookshelf(), {
      wrapper: createWrapper({ novelRepository: customRepo }),
    });

    await waitFor(() => {
      expect(customRepo.listNovels).toHaveBeenCalled();
    });

    // 初期取得が完了する前にアンマウント
    unmount();

    await act(async () => {
      resolveList?.([]);
    });

    expect(customRepo.listNovels).toHaveBeenCalled();
  });

  it("reloadNovels を呼び出すと最新の作品一覧が再取得されること", async () => {
    const db = await resetTestDb();
    const repo = new SqlNovelRepository(db);

    const { result } = renderHook(() => useBookshelf(), {
      wrapper: createWrapper({ novelRepository: repo }),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.novels).toHaveLength(0);

    // 外部で1件追加
    await repo.upsertNovelWithToc(
      {
        siteType: "kakuyomu",
        remoteWorkId: "999",
        canonicalUrl: "https://kakuyomu.jp/works/999",
        title: "外部追加作品",
        author: "作者",
        synopsis: "あらすじ",
        chapters: [],
        nextTocPageUrl: null,
      },
      "2026-01-01T00:00:00Z",
    );

    await act(async () => {
      await result.current.reloadNovels();
    });

    expect(result.current.novels).toHaveLength(1);
    expect(result.current.novels[0].title).toBe("外部追加作品");
  });
});

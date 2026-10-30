import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider } from "../../../app/router";
import { useNovelSearch } from "./useNovelSearch";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import { MockHttpClient } from "../../../bridges/http/mockHttpClient";
import searchApolloHtml from "../../../parsers/kakuyomu/__fixtures__/search_results_apollo.html?raw";
import searchEmptyHtml from "../../../parsers/kakuyomu/__fixtures__/search_results_empty.html?raw";
import workIndexHtml from "../../../parsers/kakuyomu/__fixtures__/work_index.html?raw";
import type { HttpResponse } from "../../../bridges/http/types";

describe("useNovelSearch", () => {
  let mockHttpClient: MockHttpClient;

  beforeEach(async () => {
    await resetTestDb();
    localStorage.clear();
    window.history.replaceState(null, "", "/search");
    vi.clearAllMocks();

    mockHttpClient = new MockHttpClient();
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/search.*page=2/,
      (options) => ({
        status: 200,
        url: options.url,
        headers: {},
        html: searchApolloHtml,
      }),
    );
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/search.*empty/,
      (options) => ({
        status: 200,
        url: options.url,
        headers: {},
        html: searchEmptyHtml,
      }),
    );
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/search/,
      (options) => ({
        status: 200,
        url: options.url,
        headers: {},
        html: searchApolloHtml,
      }),
    );
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/works\/\d+$/,
      (options) => ({
        status: 200,
        url: options.url,
        headers: {},
        html: workIndexHtml,
      }),
    );
  });

  const createWrapper =
    (initialPath = "/search") =>
    ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        ServiceProvider,
        { services: { httpClient: mockHttpClient } },
        React.createElement(RouterProvider, { initialPath }, children),
      );

  it("初期状態が正しく初期化されること (AC-SE-01)", async () => {
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.selectedSite).toBe("kakuyomu");
    });

    expect(result.current.keyword).toBe("");
    expect(result.current.order).toBe("weekly_ranking");
    expect(result.current.serialStatus).toBe("all");
    expect(result.current.genre).toBeUndefined();
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isLoadingMore).toBe(false);
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.addingWorkId).toBeNull();
    expect(result.current.hasSearched).toBe(false);
  });

  it("キーワード検索を実行して検索結果およびページ情報を取得できること (AC-SE-02)", async () => {
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });
    expect(result.current.keyword).toBe("異世界");

    await act(async () => {
      await result.current.search();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.items.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
    expect(result.current.items[0].title).toBeDefined();
    expect(result.current.hasSearched).toBe(true);
  });

  it("検索APIが失敗した場合は error ステートにメッセージが設定されること", async () => {
    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/search/, () => {
      throw new Error("HTTP 500: Internal Server Error");
    });

    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("エラー");
    });

    await act(async () => {
      await result.current.search();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toContain("HTTP 500");
    expect(result.current.items).toEqual([]);

    // 非 Error 例外（文字列）
    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/search/, () => {
      throw "ネットワーク文字列エラー";
    });

    await act(async () => {
      await result.current.search();
    });

    expect(result.current.error).toBe("ネットワーク文字列エラー");
  });

  it("検索結果が0件の場合は items が空配列となること", async () => {
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("empty");
    });

    await act(async () => {
      await result.current.search();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.hasSearched).toBe(true);
  });

  it("次ページ読み込み (loadMore) でアイテムが追記されること (AC-SE-08)", async () => {
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });

    await act(async () => {
      await result.current.search();
    });

    const initialCount = result.current.items.length;
    expect(initialCount).toBeGreaterThan(0);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.items.length).toBe(initialCount * 2);
  });

  it("hasNextPage が false のときは loadMore を呼び出しても通信を行わないこと", async () => {
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("empty");
    });

    await act(async () => {
      await result.current.search();
    });

    expect(result.current.hasNextPage).toBe(false);

    const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");
    await act(async () => {
      await result.current.loadMore();
    });

    expect(getHtmlSpy).not.toHaveBeenCalled();
  });

  it("並び順変更時に自動で再検索が実行されること (AC-SE-03)", async () => {
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });

    await act(async () => {
      await result.current.search();
    });

    const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");

    await act(async () => {
      result.current.setOrder("popular");
    });

    expect(result.current.order).toBe("popular");
    expect(getHtmlSpy).toHaveBeenCalled();
  });

  it("連載状況およびジャンル変更時に自動で再検索が実行されること (AC-SE-04)", async () => {
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });

    await act(async () => {
      await result.current.search();
    });

    const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");

    await act(async () => {
      result.current.setSerialStatus("completed");
    });
    expect(result.current.serialStatus).toBe("completed");
    expect(getHtmlSpy).toHaveBeenCalled();

    await act(async () => {
      result.current.setGenre("fantasy");
    });
    expect(result.current.genre).toBe("fantasy");
    expect(getHtmlSpy).toHaveBeenCalledTimes(2);
  });

  it("ジャンル選択後に「すべて（undefined）」へ切り替えた際、genre パラメータが正しく解除されて再検索されること (AC-SE-04)", async () => {
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });

    await act(async () => {
      await result.current.search();
    });

    const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");

    // まず特定ジャンルを選択
    await act(async () => {
      result.current.setGenre("fantasy");
    });
    expect(result.current.genre).toBe("fantasy");
    expect(getHtmlSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("genre_name=fantasy"),
      }),
    );

    // 次にジャンルを「すべて (undefined)」に切り替え
    await act(async () => {
      result.current.setGenre(undefined);
    });
    expect(result.current.genre).toBeUndefined();
    expect(getHtmlSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: expect.not.stringContaining("genre_name"),
      }),
    );
  });

  it("addNovelToBookshelf で作品トップHTMLを取得・パースして SQLite へ保存し、registeredWorkIds に反映すること (AC-SE-06)", async () => {
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });

    await act(async () => {
      await result.current.search();
    });

    const targetItem = result.current.items[0];
    expect(result.current.registeredWorkIds.has(targetItem.remoteWorkId)).toBe(
      false,
    );

    let savedNovelId: string | null = null;
    await act(async () => {
      savedNovelId = await result.current.addNovelToBookshelf(targetItem);
    });

    expect(savedNovelId).toBe(`kakuyomu:${targetItem.remoteWorkId}`);
    expect(result.current.registeredWorkIds.has(targetItem.remoteWorkId)).toBe(
      true,
    );
    expect(result.current.addingWorkId).toBeNull();
  });

  it("addNovelToBookshelf 実行中にエラーが発生した場合は error が設定され null を返すこと", async () => {
    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, () => {
      throw new Error("作品詳細の取得に失敗しました");
    });

    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });

    await act(async () => {
      await result.current.search();
    });

    const targetItem = result.current.items[0];
    let savedNovelId: string | null = "dummy";
    await act(async () => {
      savedNovelId = await result.current.addNovelToBookshelf(targetItem);
    });

    expect(savedNovelId).toBeNull();
    expect(result.current.error).toContain("作品詳細の取得に失敗しました");
    expect(result.current.addingWorkId).toBeNull();
  });

  it("同一作品の追加処理中（addingWorkId === item.remoteWorkId）に再度 addNovelToBookshelf を呼び出した場合、多重実行を防止し直ちに null を返すこと", async () => {
    const resolves: Array<(val: HttpResponse) => void> = [];
    let fetchCount = 0;

    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });
    await act(async () => {
      await result.current.search();
    });

    const item1 = result.current.items[0];
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/works\/\d+$/,
      (options) => {
        if (options.url === item1.workUrl) {
          fetchCount++;
          return new Promise<HttpResponse>((resolve) => {
            resolves.push(resolve);
          });
        }
        return {
          status: 200,
          url: options.url,
          headers: {},
          html: workIndexHtml,
        };
      },
    );

    let promise1: Promise<string | null>;
    act(() => {
      promise1 = result.current.addNovelToBookshelf(item1);
    });
    expect(result.current.addingWorkId).toBe(item1.remoteWorkId);

    // 重複呼び出し（ガードにより即時 null が返るべき）
    let secondResult: string | null = "dummy";
    let isSecondResolved = false;
    const promise2 = result.current.addNovelToBookshelf(item1).then((res) => {
      isSecondResolved = true;
      secondResult = res;
      return res;
    });
    await Promise.resolve();

    try {
      expect(isSecondResolved).toBe(true);
      expect(secondResult).toBeNull();
      expect(fetchCount).toBe(1);
    } finally {
      resolves.forEach((resolve) =>
        resolve({
          url: item1.workUrl,
          status: 200,
          headers: {},
          html: workIndexHtml,
        }),
      );
      await promise1!;
      await promise2;
    }
    await waitFor(() => {
      expect(result.current.addingWorkId).toBeNull();
    });
  });

  it("同一作品の追加処理中（addingWorkId === item.remoteWorkId）に handleCardSelect を呼び出した場合、多重実行を防止し何もしないこと", async () => {
    const resolves: Array<(val: HttpResponse) => void> = [];
    let fetchCount = 0;

    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper("/search"),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });
    await act(async () => {
      await result.current.search();
    });

    const item1 = result.current.items[0];
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/works\/\d+$/,
      (options) => {
        if (options.url === item1.workUrl) {
          fetchCount++;
          return new Promise<HttpResponse>((resolve) => {
            resolves.push(resolve);
          });
        }
        return {
          status: 200,
          url: options.url,
          headers: {},
          html: workIndexHtml,
        };
      },
    );

    let promise1: Promise<string | null>;
    act(() => {
      promise1 = result.current.addNovelToBookshelf(item1);
    });
    expect(result.current.addingWorkId).toBe(item1.remoteWorkId);

    // 追加処理中に同一作品の handleCardSelect を呼び出す
    let isSelectResolved = false;
    const selectPromise = result.current.handleCardSelect(item1).then(() => {
      isSelectResolved = true;
    });
    await Promise.resolve();

    try {
      expect(isSelectResolved).toBe(true);
      expect(fetchCount).toBe(1);
      expect(window.location.pathname).toBe("/search");
    } finally {
      resolves.forEach((resolve) =>
        resolve({
          url: item1.workUrl,
          status: 200,
          headers: {},
          html: workIndexHtml,
        }),
      );
      await promise1!;
      await selectPromise;
    }
  });

  it("先行する作品追加完了時に後続作品の addingWorkId が上書き解除されないこと", async () => {
    let resolveFirst: ((val: HttpResponse) => void) | null = null;
    let resolveSecond: ((val: HttpResponse) => void) | null = null;

    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });
    await act(async () => {
      await result.current.search();
    });

    const item1 = result.current.items[0];
    const item2 = result.current.items[1];
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/works\/\d+$/,
      (options) => {
        if (options.url === item1.workUrl) {
          return new Promise<HttpResponse>((resolve) => {
            resolveFirst = resolve;
          });
        }
        if (options.url === item2.workUrl) {
          return new Promise<HttpResponse>((resolve) => {
            resolveSecond = resolve;
          });
        }
        return {
          status: 200,
          url: options.url,
          headers: {},
          html: workIndexHtml,
        };
      },
    );

    let promise1: Promise<string | null>;
    act(() => {
      promise1 = result.current.addNovelToBookshelf(item1);
    });
    expect(result.current.addingWorkId).toBe(item1.remoteWorkId);

    let promise2: Promise<string | null>;
    act(() => {
      promise2 = result.current.addNovelToBookshelf(item2);
    });
    expect(result.current.addingWorkId).toBe(item2.remoteWorkId);

    await act(async () => {
      resolveFirst!({
        url: item1.workUrl,
        status: 200,
        headers: {},
        html: workIndexHtml,
      });
      await promise1!;
    });
    expect(result.current.addingWorkId).toBe(item2.remoteWorkId);

    await act(async () => {
      resolveSecond!({
        url: item2.workUrl,
        status: 200,
        headers: {},
        html: workIndexHtml,
      });
      await promise2!;
    });
    expect(result.current.addingWorkId).toBeNull();
  });

  it("先行する作品追加が失敗した際も後続作品の addingWorkId が上書き解除されないこと", async () => {
    let rejectFirst: ((err: Error) => void) | null = null;
    let resolveSecond: ((val: HttpResponse) => void) | null = null;

    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });
    await act(async () => {
      await result.current.search();
    });

    const item1 = result.current.items[0];
    const item2 = result.current.items[1];
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/works\/\d+$/,
      (options) => {
        if (options.url === item1.workUrl) {
          return new Promise<HttpResponse>((_, reject) => {
            rejectFirst = reject;
          });
        }
        if (options.url === item2.workUrl) {
          return new Promise<HttpResponse>((resolve) => {
            resolveSecond = resolve;
          });
        }
        return {
          status: 200,
          url: options.url,
          headers: {},
          html: workIndexHtml,
        };
      },
    );

    let promise1: Promise<string | null>;
    act(() => {
      promise1 = result.current.addNovelToBookshelf(item1);
    });
    expect(result.current.addingWorkId).toBe(item1.remoteWorkId);

    let promise2: Promise<string | null>;
    act(() => {
      promise2 = result.current.addNovelToBookshelf(item2);
    });
    expect(result.current.addingWorkId).toBe(item2.remoteWorkId);

    await act(async () => {
      rejectFirst!(new Error("Network Error"));
      await promise1!;
    });
    expect(result.current.addingWorkId).toBe(item2.remoteWorkId);

    await act(async () => {
      resolveSecond!({
        url: item2.workUrl,
        status: 200,
        headers: {},
        html: workIndexHtml,
      });
      await promise2!;
    });
    expect(result.current.addingWorkId).toBeNull();
  });

  it("handleCardSelect: 登録済み作品カード選択時は直ちに作品詳細 (/novels/:novelId) へ /search 探索元付きで遷移すること (AC-SE-07)", async () => {
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });

    await act(async () => {
      await result.current.search();
    });

    const targetItem = result.current.items[0];
    await act(async () => {
      await result.current.addNovelToBookshelf(targetItem);
    });

    expect(result.current.registeredWorkIds.has(targetItem.remoteWorkId)).toBe(
      true,
    );

    await act(async () => {
      await result.current.handleCardSelect(targetItem);
    });

    expect(window.location.pathname).toBe(
      `/novels/${encodeURIComponent(`kakuyomu:${targetItem.remoteWorkId}`)}`,
    );
  });

  it("handleCardSelect: 未登録作品カード選択時は自動で本棚追加を実行してから作品詳細へ遷移すること (AC-SE-07)", async () => {
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });

    await act(async () => {
      await result.current.search();
    });

    const targetItem = result.current.items[0];
    expect(result.current.registeredWorkIds.has(targetItem.remoteWorkId)).toBe(
      false,
    );

    await act(async () => {
      await result.current.handleCardSelect(targetItem);
    });

    expect(result.current.registeredWorkIds.has(targetItem.remoteWorkId)).toBe(
      true,
    );
    expect(window.location.pathname).toBe(
      `/novels/${encodeURIComponent(`kakuyomu:${targetItem.remoteWorkId}`)}`,
    );
  });

  it("retry を呼び出すと現在の条件で再検索が行われること", async () => {
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });

    await act(async () => {
      await result.current.search();
    });

    const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");

    await act(async () => {
      await result.current.retry();
    });

    expect(getHtmlSpy).toHaveBeenCalled();
  });

  it("未対応サイト（narou等）を選択して検索した場合はエラーメッセージが設定されること", async () => {
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setSelectedSite("narou");
    });

    await act(async () => {
      await result.current.search();
    });

    expect(result.current.error).toContain("検索機能が未実装のサイトです");
  });

  it("loadMore でエラーが発生した場合（Errorおよび非Error）に error ステートが設定されること", async () => {
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });

    await act(async () => {
      await result.current.search();
    });

    // Error インスタンスによる失敗
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/search.*page=2/,
      () => {
        throw new Error("次ページ取得失敗");
      },
    );

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.error).toBe("次ページ取得失敗");

    // 非 Error 例外（文字列）による失敗
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/search.*page=2/,
      () => {
        throw "文字列エラー";
      },
    );

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.error).toBe("文字列エラー");
  });

  it("loadMore でパーサーが未実装サイトの場合はエラーメッセージが設定されること", async () => {
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });

    await act(async () => {
      await result.current.search();
    });

    act(() => {
      result.current.setSelectedSite("narou");
    });

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.error).toContain("検索機能が未実装のサイトです");
  });

  it("addNovelToBookshelf で非Error例外がスローされた場合も error ステートが設定されること", async () => {
    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, () => {
      throw "未知のネットワークエラー";
    });

    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });

    await act(async () => {
      await result.current.search();
    });

    const targetItem = result.current.items[0];
    let savedId: string | null = "dummy";
    await act(async () => {
      savedId = await result.current.addNovelToBookshelf(targetItem);
    });

    expect(savedId).toBeNull();
    expect(result.current.error).toBe("未知のネットワークエラー");
  });

  it("handleCardSelect で未登録作品の追加が失敗した場合は画面遷移しないこと", async () => {
    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, () => {
      throw new Error("作品取得エラー");
    });

    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });

    await act(async () => {
      await result.current.search();
    });

    const targetItem = result.current.items[0];
    window.history.pushState(null, "", "/search");

    await act(async () => {
      await result.current.handleCardSelect(targetItem);
    });

    expect(window.location.pathname).toBe("/search");
  });

  it("handleCardSelect で登録済みだが listNovels で見つからない場合もフォールバックIDで詳細画面へ遷移すること", async () => {
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });

    await act(async () => {
      await result.current.search();
    });

    const targetItem = result.current.items[0];

    // 手動で registeredWorkIds に追加した状態をシミュレート
    await act(async () => {
      await result.current.addNovelToBookshelf(targetItem);
    });

    // Repository の listNovels を空配列にモックして found が undefined になるケースを検証
    const repo = (
      window as unknown as {
        __yommyServices?: {
          novelRepository: { listNovels: () => Promise<unknown[]> };
        };
      }
    ).__yommyServices?.novelRepository;
    if (repo) {
      vi.spyOn(repo, "listNovels").mockResolvedValueOnce([]);
    }

    await act(async () => {
      await result.current.handleCardSelect(targetItem);
    });

    expect(window.location.pathname).toBe(
      `/novels/${encodeURIComponent(`kakuyomu:${targetItem.remoteWorkId}`)}`,
    );
  });

  it("handleCardSelect で登録済み作品の listNovels 呼び出しが例外をスローしてもフォールバックIDで安全に遷移すること", async () => {
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });

    await act(async () => {
      await result.current.search();
    });

    const targetItem = {
      ...result.current.items[0],
      siteType: "kakuyomu" as const,
    };

    await act(async () => {
      await result.current.addNovelToBookshelf(targetItem);
    });

    const repo = (
      window as unknown as {
        __yommyServices?: {
          novelRepository: { listNovels: () => Promise<unknown[]> };
        };
      }
    ).__yommyServices?.novelRepository;
    if (repo) {
      vi.spyOn(repo, "listNovels").mockRejectedValueOnce(
        new Error("DB connection failure"),
      );
    }

    await act(async () => {
      await result.current.handleCardSelect(targetItem);
    });

    expect(window.location.pathname).toBe(
      `/novels/${encodeURIComponent(`kakuyomu:${targetItem.remoteWorkId}`)}`,
    );
  });

  it("refreshRegisteredIds で listNovels が例外をスローしても正常に処理が継続すること", async () => {
    const failingRepo = {
      listNovels: vi.fn().mockRejectedValue(new Error("DBエラー")),
      upsertNovelWithToc: vi.fn(),
    };

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        ServiceProvider,
        {
          services: {
            httpClient: mockHttpClient,
            novelRepository: failingRepo as never,
          },
        },
        React.createElement(
          RouterProvider,
          { initialPath: "/search" },
          children,
        ),
      );

    const { result } = renderHook(() => useNovelSearch(), { wrapper });

    await waitFor(() => {
      expect(failingRepo.listNovels).toHaveBeenCalled();
    });
    expect(result.current.registeredWorkIds.size).toBe(0);
  });

  it("novelRepository が存在しない場合も refreshRegisteredIds がクラッシュしないこと", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        ServiceProvider,
        {
          services: {
            httpClient: mockHttpClient,
            novelRepository: undefined as never,
          },
        },
        React.createElement(
          RouterProvider,
          { initialPath: "/search" },
          children,
        ),
      );

    const { result } = renderHook(() => useNovelSearch(), { wrapper });

    await waitFor(() => {
      expect(result.current.registeredWorkIds.size).toBe(0);
    });
  });
});

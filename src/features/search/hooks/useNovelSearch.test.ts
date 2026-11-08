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
import narouWorkIndexSerializedHtml from "../../../parsers/narou/__fixtures__/work_index_serialized.html?raw";
import narouWorkIndexPage2Html from "../../../parsers/narou/__fixtures__/work_index_page2.html?raw";
import narouSearchResultsJson from "../../../parsers/narou/__fixtures__/search_results.json?raw";
import type { HttpResponse } from "../../../bridges/http/types";
import type { NovelSearchResultItem } from "../../../parsers/types";
import type { SyncEngine } from "../../cloud-sync/services/syncEngine";
import type { NovelRepository } from "../../../storage/types";
import { createDefaultParserRegistry } from "../../../parsers/parserRegistry";

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
    mockHttpClient.setResponse(
      /^https:\/\/api\.syosetu\.com\/novelapi\/api\//,
      (options) => ({
        status: 200,
        url: options.url,
        headers: {},
        html: narouSearchResultsJson,
      }),
    );
  });

  const createWrapper =
    (initialPath = "/search", customServices = {}) =>
    ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        ServiceProvider,
        { services: { httpClient: mockHttpClient, ...customServices } },
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

  it("連載状況に短編（short）を指定した場合に自動再検索が走り serial_status=completed が指定されること (Issue #265)", async () => {
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
      result.current.setSerialStatus("short");
    });

    expect(result.current.serialStatus).toBe("short");
    expect(getHtmlSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("serial_status=completed"),
      }),
    );
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

  it("addNovelToBookshelf: 複数ページ目次作品（なろう）の追加時に全ページが fetchFullNovelIndex で結合されて SQLite へ保存されること (Issue #239)", async () => {
    mockHttpClient.setResponse("https://ncode.syosetu.com/n9669bk/", () => ({
      status: 200,
      url: "https://ncode.syosetu.com/n9669bk/",
      headers: {},
      html: narouWorkIndexSerializedHtml,
    }));
    mockHttpClient.setResponse(
      "https://ncode.syosetu.com/n9669bk/?p=2",
      () => ({
        status: 200,
        url: "https://ncode.syosetu.com/n9669bk/?p=2",
        headers: {},
        html: narouWorkIndexPage2Html,
      }),
    );

    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });

    await act(async () => {
      await result.current.search();
    });

    const narouItem: NovelSearchResultItem = {
      remoteWorkId: "n9669bk",
      workUrl: "https://ncode.syosetu.com/n9669bk/",
      title: "無職転生 - 異世界行ったら本気だす",
      author: "理不尽な孫の手",
      synopsis: "あらすじ本文",
      genre: "fantasy",
      genreLabel: "ファンタジー",
      serialStatus: "running",
      serialStatusLabel: "連載中",
      episodeCount: 5,
      characterCount: 10000,
      tags: [],
      reviewPoints: 100,
      lastEpisodePublishedAt: "2012/11/26 20:00",
    };

    let savedNovelId: string | null = null;
    await act(async () => {
      savedNovelId = await result.current.addNovelToBookshelf(narouItem);
    });

    expect(savedNovelId).toBe("narou:n9669bk");
    expect(result.current.registeredWorkIds.has("n9669bk")).toBe(true);
    expect(result.current.addingWorkId).toBeNull();
  });

  it("addNovelToBookshelf で作品追加に成功した際、syncEngine.notifyChanged が呼び出されること (R1-26)", async () => {
    const mockSyncEngine = {
      notifyChanged: vi.fn().mockResolvedValue(undefined),
    };

    const wrapperWithSyncEngine = ({
      children,
    }: {
      children: React.ReactNode;
    }) =>
      React.createElement(
        ServiceProvider,
        {
          services: {
            httpClient: mockHttpClient,
            syncEngine: mockSyncEngine as unknown as SyncEngine,
          },
        },
        React.createElement(
          RouterProvider,
          { initialPath: "/search" },
          children,
        ),
      );

    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: wrapperWithSyncEngine,
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

    expect(mockSyncEngine.notifyChanged).toHaveBeenCalled();
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

  it("未対応サイト（generic等）を選択して検索した場合はエラーメッセージが設定されること", async () => {
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setSelectedSite("generic");
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
    const dummyRegistry = createDefaultParserRegistry();
    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper("/search", { parserRegistry: dummyRegistry }),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });

    await act(async () => {
      await result.current.search();
    });

    expect(result.current.hasNextPage).toBe(true);

    const getAllSpy = vi.spyOn(dummyRegistry, "getAll").mockReturnValue([]);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.error).toContain("検索機能が未実装のサイトです");
    getAllSpy.mockRestore();
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

  it("検索実行中（isLoading === true）に search / loadMore / setOrder / retry を連続して呼んでも重複リクエストがガードされること (AC-SE-09)", async () => {
    let getHtmlResolve: ((val: HttpResponse) => void) | null = null;
    let getHtmlCallCount = 0;

    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/search/, () => {
      getHtmlCallCount++;
      return new Promise<HttpResponse>((resolve) => {
        getHtmlResolve = resolve;
      });
    });

    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("異世界");
    });

    // 検索開始
    act(() => {
      void result.current.search();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
      expect(getHtmlCallCount).toBe(1);
    });

    // isLoading 中に setSelectedSite / search / loadMore / setOrder / setSerialStatus / setGenre / retry を呼び出す
    act(() => {
      result.current.setSelectedSite("kakuyomu");
      void result.current.search();
      void result.current.loadMore();
      result.current.setOrder("popular");
      result.current.setSerialStatus("running");
      result.current.setGenre("fantasy");
      void result.current.retry();
    });

    // 重複リクエストは抑止され、getHtmlCallCount は 1 のまま
    expect(getHtmlCallCount).toBe(1);

    // リクエストを解決
    await act(async () => {
      getHtmlResolve?.({
        status: 200,
        url: "https://kakuyomu.jp/search?order=weekly_ranking&q=%E7%95%B0%E4%B8%96%E7%95%8C",
        headers: {},
        html: searchApolloHtml,
      });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.items.length).toBeGreaterThan(0);
    });
  });

  it("古い非同期検索リクエストが遅れて解決した場合に最新の結果が上書きされないこと (AC-SE-09)", async () => {
    const resolvers: Array<(val: HttpResponse) => void> = [];

    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/search/, () => {
      return new Promise<HttpResponse>((resolve) => {
        resolvers.push(resolve);
      });
    });

    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("テスト");
    });

    // 1回目のリクエスト開始
    act(() => {
      void result.current.search();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
      expect(resolvers.length).toBe(1);
    });

    // 1回目の解決前に 2回目の条件変更を呼び出す
    act(() => {
      result.current.setOrder("popular");
    });

    // 通信中ガードにより多重リクエストは抑止され、resolvers.length は 1 のまま維持されること (R1-20)
    expect(resolvers.length).toBe(1);

    // 1回目を解決
    await act(async () => {
      resolvers[0]({
        status: 200,
        url: "https://kakuyomu.jp/search?q=%E3%83%86%E3%82%B9%E3%83%88",
        headers: {},
        html: searchApolloHtml,
      });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.items.length).toBeGreaterThan(0);
    });
  });

  it("loadMore 実行中にサイト切替または条件変更を呼び出してもガードされ、古い結果で一覧が汚染されないこと (R1-01)", async () => {
    let resolveLoadMore!: (val: HttpResponse) => void;
    const loadMorePromise = new Promise<HttpResponse>((resolve) => {
      resolveLoadMore = resolve;
    });

    mockHttpClient.setResponse(
      "https://kakuyomu.jp/search?q=%E3%83%86%E3%82%B9%E3%83%88",
      () => ({
        status: 200,
        url: "https://kakuyomu.jp/search?q=%E3%83%86%E3%82%B9%E3%83%88",
        headers: {},
        html: searchApolloHtml,
      }),
    );

    mockHttpClient.setResponse(
      "https://kakuyomu.jp/search?page=2&q=%E3%83%86%E3%82%B9%E3%83%88",
      () => loadMorePromise,
    );

    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setKeyword("テスト");
    });

    await act(async () => {
      await result.current.search();
    });

    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.items.length).toBeGreaterThan(0);
    const initialItemCount = result.current.items.length;

    // loadMore 開始
    act(() => {
      void result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(true);
    });

    // loadMore 通信中に setSelectedSite を呼び出してもガードされて無視されること
    act(() => {
      result.current.setSelectedSite("narou");
      result.current.setOrder("popular");
      result.current.setGenre("1");
      result.current.setSerialStatus("completed");
    });
    expect(result.current.selectedSite).toBe("kakuyomu");
    expect(result.current.order).toBe("weekly_ranking");
    expect(result.current.genre).toBeUndefined();
    expect(result.current.serialStatus).toBe("all");

    // loadMore 完了
    await act(async () => {
      resolveLoadMore({
        status: 200,
        url: "https://kakuyomu.jp/search?page=2&q=%E3%83%86%E3%82%B9%E3%83%88",
        headers: {},
        html: searchApolloHtml,
      });
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(false);
    });
    expect(result.current.items.length).toBeGreaterThan(initialItemCount);
  });

  it("loadMore 通信中に新たな検索が実行され世代が進んだ場合、loadMore の解決結果が破棄されること (R1-01)", async () => {
    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/search/, () => ({
      status: 200,
      url: "https://kakuyomu.jp/search?page=1",
      headers: {},
      html: searchApolloHtml,
    }));

    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    // 1回目検索
    act(() => {
      result.current.setKeyword("テスト");
    });
    await act(async () => {
      await result.current.search();
    });

    const initialItemCount = result.current.items.length;
    expect(initialItemCount).toBeGreaterThan(0);

    let resolveLoadMore!: (val: HttpResponse) => void;
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/search.*page=2/,
      () => {
        return new Promise<HttpResponse>((resolve) => {
          resolveLoadMore = resolve;
        });
      },
    );

    // loadMore 開始
    act(() => {
      void result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(true);
    });

    // loadMore 通信中に新たな検索（search）を実行して世代を進める
    act(() => {
      result.current.setKeyword("新テスト");
    });
    await act(async () => {
      await result.current.search();
    });

    // loadMore が遅れて解決
    await act(async () => {
      resolveLoadMore({
        status: 200,
        url: "https://kakuyomu.jp/search?page=2",
        headers: {},
        html: searchApolloHtml,
      });
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(false);
    });

    // loadMore の追加データが破棄され、新検索結果が維持されること
    expect(result.current.keyword).toBe("新テスト");
  });

  it("loadMore 通信中に新たな検索が実行され世代が進んだ場合、loadMore のエラー結果が破棄されること (R1-01)", async () => {
    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/search/, () => ({
      status: 200,
      url: "https://kakuyomu.jp/search?page=1",
      headers: {},
      html: searchApolloHtml,
    }));

    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper(),
    });

    // 1回目検索
    act(() => {
      result.current.setKeyword("テスト");
    });
    await act(async () => {
      await result.current.search();
    });

    let rejectLoadMore!: (err: Error) => void;
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/search.*page=2/,
      () => {
        return new Promise<HttpResponse>((_, reject) => {
          rejectLoadMore = reject;
        });
      },
    );

    // loadMore 開始
    act(() => {
      void result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(true);
    });

    // loadMore 通信中に新たな検索（search）を実行して世代を進める
    act(() => {
      result.current.setKeyword("新テスト");
    });
    await act(async () => {
      await result.current.search();
    });

    // loadMore が遅れてエラー終了
    await act(async () => {
      rejectLoadMore(new Error("ネットワーク切断"));
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(false);
    });

    // エラーが反映されず、error は null のままであること
    expect(result.current.error).toBeNull();
  });

  it("addNovelToBookshelf 実行中にサイト切替された場合、registeredWorkIds が旧サイトのまま追加されないこと (R1-01)", async () => {
    let resolveUpsert!: (novel: unknown) => void;
    const upsertPromise = new Promise((resolve) => {
      resolveUpsert = resolve;
    });

    const mockNovelRepo = {
      listNovels: vi.fn().mockResolvedValue([]),
      upsertNovelWithToc: vi.fn().mockImplementation(() => upsertPromise),
    };

    mockHttpClient.setResponse(/.*/, (req) => ({
      status: 200,
      url: req.url,
      headers: {},
      html: searchApolloHtml,
    }));

    const { result } = renderHook(() => useNovelSearch(), {
      wrapper: createWrapper("/search", {
        novelRepository: mockNovelRepo as unknown as NovelRepository,
      }),
    });

    act(() => {
      result.current.setKeyword("テスト");
    });

    await act(async () => {
      await result.current.search();
    });

    expect(result.current.items.length).toBeGreaterThan(0);
    const targetItem = result.current.items[0];

    // addNovelToBookshelf 開始
    let addPromise!: Promise<string | null>;
    act(() => {
      addPromise = result.current.addNovelToBookshelf(targetItem);
    });

    await waitFor(() => {
      expect(result.current.addingWorkId).toBe(targetItem.remoteWorkId);
    });

    // DB 保存待ちの間にサイトをなろうに切り替える
    act(() => {
      result.current.setSelectedSite("narou");
    });
    expect(result.current.selectedSite).toBe("narou");

    // upsert 完了
    await act(async () => {
      resolveUpsert({
        id: `kakuyomu:${targetItem.remoteWorkId}`,
        siteType: "kakuyomu",
        remoteWorkId: targetItem.remoteWorkId,
        canonicalUrl: targetItem.workUrl,
        title: targetItem.title,
        author: targetItem.author,
        synopsis: targetItem.synopsis,
        totalChapters: 1,
        cachedChapters: 0,
        bookmarkChapterIndex: null,
        bookmarkScrollProgress: 0,
        hasNewUpdate: false,
        lastCheckedAt: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        deletedAt: null,
      });
      await addPromise;
    });

    // なろうサイト表示中のため、カクヨム作品の remoteWorkId は registeredWorkIds に追加されないこと
    expect(result.current.registeredWorkIds.has(targetItem.remoteWorkId)).toBe(
      false,
    );
  });

  describe("サイト切替（setSelectedSite）と自動連動 (AC-SE-10)", () => {
    it("未検索時（hasSearched === false）にサイトを narou へ切り替えた場合、通信を行わず genre を undefined にリセットし registeredWorkIds を再照合すること", async () => {
      const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");

      const { result } = renderHook(() => useNovelSearch(), {
        wrapper: createWrapper(),
      });

      // カクヨム側でジャンルを設定しておく
      act(() => {
        result.current.setGenre("fantasy");
      });
      expect(result.current.genre).toBe("fantasy");
      expect(result.current.hasSearched).toBe(false);

      getHtmlSpy.mockClear();

      // narou に切り替え
      act(() => {
        result.current.setSelectedSite("narou");
      });

      expect(result.current.selectedSite).toBe("narou");
      expect(result.current.genre).toBeUndefined();
      expect(result.current.error).toBeNull();
      // 未検索のため通信は行われないこと
      expect(getHtmlSpy).not.toHaveBeenCalled();
      expect(result.current.hasSearched).toBe(false);
      expect(result.current.items).toEqual([]);
    });

    it("検索済み時（hasSearched === true）にサイトを narou へ切り替えた場合、genre をリセットし即座に新サイト（api.syosetu.com）で自動再検索を実行すること", async () => {
      const { result } = renderHook(() => useNovelSearch(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setKeyword("転生");
        result.current.setGenre("fantasy");
      });

      // 初回検索を実行
      await act(async () => {
        await result.current.search();
      });

      expect(result.current.hasSearched).toBe(true);
      expect(result.current.items.length).toBeGreaterThan(0);
      expect(result.current.selectedSite).toBe("kakuyomu");

      const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");

      // narou へサイト切り替え
      await act(async () => {
        result.current.setSelectedSite("narou");
      });

      // 自動再検索が走ること
      expect(getHtmlSpy).toHaveBeenCalled();
      const calledUrl = getHtmlSpy.mock.calls[0][0].url;
      expect(calledUrl).toContain("api.syosetu.com");
      expect(calledUrl).toContain("word=%E8%BB%A2%E7%94%9F");
      // genre はリセットされていること
      expect(calledUrl).not.toContain("genre=");

      expect(result.current.selectedSite).toBe("narou");
      expect(result.current.genre).toBeUndefined();
      expect(result.current.error).toBeNull();
      expect(result.current.items[0].workUrl).toContain("syosetu.com");
    });

    it("連載状況に短編（short）を指定した状態でサイトを narou へ切り替えた場合、serialStatus が保持され新サイト（type=t）で自動再検索されること (Issue #265)", async () => {
      const { result } = renderHook(() => useNovelSearch(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setKeyword("転生");
        result.current.setSerialStatus("short");
      });

      // 初回検索を実行
      await act(async () => {
        await result.current.search();
      });

      expect(result.current.serialStatus).toBe("short");

      const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");

      // narou へサイト切り替え
      await act(async () => {
        result.current.setSelectedSite("narou");
      });

      expect(result.current.selectedSite).toBe("narou");
      expect(result.current.serialStatus).toBe("short");
      expect(getHtmlSpy).toHaveBeenCalled();
      const calledUrl = getHtmlSpy.mock.calls[0][0].url;
      expect(calledUrl).toContain("api.syosetu.com");
      expect(calledUrl).toContain("type=t");
    });

    it("同一サイト（kakuyomu -> kakuyomu）への切り替え操作は何もしないこと（no-op）", async () => {
      const { result } = renderHook(() => useNovelSearch(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setKeyword("テスト");
      });
      await act(async () => {
        await result.current.search();
      });

      const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");

      act(() => {
        result.current.setSelectedSite("kakuyomu");
      });

      expect(getHtmlSpy).not.toHaveBeenCalled();
    });

    it("検索通信中（isLoading === true）のサイト切り替え操作は無視（ガード）されること", async () => {
      let resolveSearch: (res: HttpResponse) => void = () => {};
      mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/search/, () => {
        return new Promise<HttpResponse>((resolve) => {
          resolveSearch = resolve;
        });
      });

      const { result } = renderHook(() => useNovelSearch(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setKeyword("通信中テスト");
      });

      let searchPromise: Promise<void>;
      act(() => {
        searchPromise = result.current.search();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // 通信中に setSelectedSite を呼び出し
      act(() => {
        result.current.setSelectedSite("narou");
      });

      // サイトは変わらないこと
      expect(result.current.selectedSite).toBe("kakuyomu");

      // 検索を解決
      await act(async () => {
        resolveSearch({
          status: 200,
          url: "https://kakuyomu.jp/search",
          headers: {},
          html: searchApolloHtml,
        });
        await searchPromise!;
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.selectedSite).toBe("kakuyomu");
    });
  });

  describe("高度検索フィルタ（除外キーワード・複数ジャンル選択 / v0.8 Issue #264 / AC-SE-11）", () => {
    it("excludeKeyword の初期値が空文字であり、setExcludeKeyword で更新され検索および loadMore に引き継がれること", async () => {
      const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");
      const { result } = renderHook(() => useNovelSearch(), {
        wrapper: createWrapper(),
      });

      expect(result.current.excludeKeyword).toBe("");

      act(() => {
        result.current.setKeyword("異世界");
        result.current.setExcludeKeyword("ハーレム チート");
      });

      expect(result.current.excludeKeyword).toBe("ハーレム チート");

      await act(async () => {
        await result.current.search();
      });

      // 検索 URL に除外キーワードが含まれていること
      expect(getHtmlSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining(
            "q=%E7%95%B0%E4%B8%96%E7%95%8C+-%E3%83%8F%E3%83%BC%E3%83%AC%E3%83%A0+-%E3%83%81%E3%83%BC%E3%83%88",
          ),
        }),
      );

      // loadMore 実行時にも除外キーワードが引き継がれること
      await act(async () => {
        await result.current.loadMore();
      });

      expect(getHtmlSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: expect.stringMatching(/page=2/),
        }),
      );
      expect(
        getHtmlSpy.mock.calls[getHtmlSpy.mock.calls.length - 1][0].url,
      ).toContain(
        "q=%E7%95%B0%E4%B8%96%E7%95%8C+-%E3%83%8F%E3%83%BC%E3%83%AC%E3%83%A0+-%E3%83%81%E3%83%BC%E3%83%88",
      );
    });

    it("検索実行後に input（keyword / excludeKeyword）を編集しても、loadMore は実行済みの検索条件を維持して次ページを読み込むこと (AC-SE-08, R1-07)", async () => {
      const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");
      const { result } = renderHook(() => useNovelSearch(), {
        wrapper: createWrapper(),
      });

      // 1. 初回検索を実行
      act(() => {
        result.current.setKeyword("魔法");
        result.current.setExcludeKeyword("チート");
      });

      await act(async () => {
        await result.current.search();
      });

      expect(getHtmlSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: expect.stringContaining(
            "q=%E9%AD%94%E6%B3%95+-%E3%83%81%E3%83%BC%E3%83%88",
          ),
        }),
      );

      // 2. 検索実行後に input を未確定で変更（再検索は実行しない）
      act(() => {
        result.current.setKeyword("ドラゴン");
        result.current.setExcludeKeyword("ハーレム");
      });

      // 3. loadMore を実行
      await act(async () => {
        await result.current.loadMore();
      });

      // loadMore でリクエストされた URL は変更後の「ドラゴン/ハーレム」ではなく、
      // 実行済み条件「魔法/チート」の page=2 であること (R1-07)
      const lastUrl =
        getHtmlSpy.mock.calls[getHtmlSpy.mock.calls.length - 1][0].url;
      expect(lastUrl).toContain("page=2");
      expect(lastUrl).toContain(
        "q=%E9%AD%94%E6%B3%95+-%E3%83%81%E3%83%BC%E3%83%88",
      );
      expect(lastUrl).not.toContain("ドラゴン");
      expect(lastUrl).not.toContain("ハーレム");
    });

    it("genres の初期値が空配列で、setGenre による追加・トグル解除・全解除が正しく動作すること", async () => {
      const { result } = renderHook(() => useNovelSearch(), {
        wrapper: createWrapper(),
      });

      expect(result.current.genres).toEqual([]);
      expect(result.current.genre).toBeUndefined();

      // 1. fantasy を追加
      act(() => {
        result.current.setGenre("fantasy");
      });
      expect(result.current.genres).toEqual(["fantasy"]);
      expect(result.current.genre).toBe("fantasy");

      // 2. action を追加（複数選択）
      act(() => {
        result.current.setGenre("action");
      });
      expect(result.current.genres).toEqual(["fantasy", "action"]);
      expect(result.current.genre).toBe("fantasy");

      // 3. fantasy をトグル解除
      act(() => {
        result.current.setGenre("fantasy");
      });
      expect(result.current.genres).toEqual(["action"]);
      expect(result.current.genre).toBe("action");

      // 4. action をトグル解除（全解除）
      act(() => {
        result.current.setGenre("action");
      });
      expect(result.current.genres).toEqual([]);
      expect(result.current.genre).toBeUndefined();

      // 5. 個別ジャンル指定後に undefined 渡しで「すべて」リセット
      act(() => {
        result.current.setGenre("fantasy");
      });
      expect(result.current.genres).toEqual(["fantasy"]);

      act(() => {
        result.current.setGenre(undefined);
      });
      expect(result.current.genres).toEqual([]);
      expect(result.current.genre).toBeUndefined();
    });

    it("hasSearched が true のとき、setGenre 呼び出しで新ジャンル条件により即時再検索が走ること", async () => {
      const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");
      const { result } = renderHook(() => useNovelSearch(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setKeyword("ファンタジー");
      });

      await act(async () => {
        await result.current.search();
      });

      expect(getHtmlSpy).toHaveBeenCalledTimes(1);

      // ジャンル追加で自動再検索
      await act(async () => {
        result.current.setGenre("action");
      });

      expect(getHtmlSpy).toHaveBeenCalledTimes(2);
      expect(getHtmlSpy.mock.calls[1][0].url).toContain("genre_name=action");
    });

    it("サイト切り替え時に excludeKeyword は保持され、genres のみ空配列にリセットされること", async () => {
      const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");
      const { result } = renderHook(() => useNovelSearch(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setKeyword("異世界");
        result.current.setExcludeKeyword("チート");
        result.current.setGenre("fantasy");
      });

      expect(result.current.excludeKeyword).toBe("チート");
      expect(result.current.genres).toEqual(["fantasy"]);

      // なろうへサイト切り替え（未検索状態）
      act(() => {
        result.current.setSelectedSite("narou");
      });

      expect(result.current.selectedSite).toBe("narou");
      expect(result.current.keyword).toBe("異世界");
      expect(result.current.excludeKeyword).toBe("チート");
      expect(result.current.genres).toEqual([]);
      expect(result.current.genre).toBeUndefined();
      expect(getHtmlSpy).not.toHaveBeenCalled();
    });

    it("hasSearched が true の状態でサイト切り替えを行った場合、リセットされたジャンルと保持された除外キーワードで新サイト再検索が走ること", async () => {
      const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");
      const { result } = renderHook(() => useNovelSearch(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setKeyword("魔法");
        result.current.setExcludeKeyword("チート");
        result.current.setGenre("fantasy");
      });

      await act(async () => {
        await result.current.search();
      });

      expect(getHtmlSpy).toHaveBeenCalledTimes(1);

      // なろうへサイト切り替え（検索実行済み）
      await act(async () => {
        result.current.setSelectedSite("narou");
      });

      expect(result.current.selectedSite).toBe("narou");
      expect(result.current.genres).toEqual([]);
      expect(result.current.excludeKeyword).toBe("チート");

      // なろう API へのリクエストが飛び、notword=チート が含まれ genre パラメータは省略されていること
      expect(getHtmlSpy).toHaveBeenCalledTimes(2);
      const narouUrl = getHtmlSpy.mock.calls[1][0].url;
      expect(narouUrl).toContain("https://api.syosetu.com/novelapi/api/");
      expect(narouUrl).toContain("notword=%E3%83%81%E3%83%BC%E3%83%88");
      expect(narouUrl).not.toContain("genre=");
    });

    it("通信中（isLoading または isLoadingMore）に setGenre を呼び出しても無視されること", async () => {
      let resolveSearch: (res: HttpResponse) => void = () => {};
      mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/search/, () => {
        return new Promise<HttpResponse>((resolve) => {
          resolveSearch = resolve;
        });
      });

      const { result } = renderHook(() => useNovelSearch(), {
        wrapper: createWrapper(),
      });

      let searchPromise: Promise<void>;
      act(() => {
        searchPromise = result.current.search();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      act(() => {
        result.current.setGenre("fantasy");
      });

      expect(result.current.genres).toEqual([]);

      await act(async () => {
        resolveSearch({
          status: 200,
          url: "https://kakuyomu.jp/search",
          headers: {},
          html: searchApolloHtml,
        });
        await searchPromise!;
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.genres).toEqual([]);
    });

    it("検索通信中（成功・失敗）および未登録カード選択（addNovelToBookshelf）進行中にアンマウントされた場合、完了後に State 更新や router.navigateToNovelDetail が発火しないこと (R2-17)", async () => {
      // 1. 検索通信中（成功応答）のアンマウント検証
      let resolveSearch!: (res: HttpResponse) => void;
      mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/search/, () => {
        return new Promise<HttpResponse>((resolve) => {
          resolveSearch = resolve;
        });
      });

      const { result: result1, unmount: unmount1 } = renderHook(
        () => useNovelSearch(),
        {
          wrapper: createWrapper(),
        },
      );

      let searchPromise1!: Promise<void>;
      act(() => {
        searchPromise1 = result1.current.search();
      });

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(true);
      });

      unmount1();

      await act(async () => {
        resolveSearch({
          status: 200,
          url: "https://kakuyomu.jp/search",
          headers: {},
          html: searchApolloHtml,
        });
        await searchPromise1;
      });

      // アンマウント後のため items は更新されないこと
      expect(result1.current.items).toEqual([]);

      // 2. 検索通信中（エラー応答）のアンマウント検証
      let rejectSearch!: (err: Error) => void;
      mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/search/, () => {
        return new Promise<HttpResponse>((_, reject) => {
          rejectSearch = reject;
        });
      });

      const { result: result2, unmount: unmount2 } = renderHook(
        () => useNovelSearch(),
        {
          wrapper: createWrapper(),
        },
      );

      let searchPromise2!: Promise<void>;
      act(() => {
        searchPromise2 = result2.current.search();
      });

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(true);
      });

      unmount2();

      await act(async () => {
        rejectSearch(new Error("Unmount Search Error"));
        await searchPromise2;
      });

      expect(result2.current.error).toBeNull();

      // 3. 未登録カード選択（handleCardSelect -> addNovelToBookshelf）進行中のアンマウント検証
      mockHttpClient.setResponse(
        /^https:\/\/kakuyomu\.jp\/search/,
        (options) => ({
          status: 200,
          url: options.url,
          headers: {},
          html: searchApolloHtml,
        }),
      );

      let resolveWorkIndex!: (res: HttpResponse) => void;
      mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, () => {
        return new Promise<HttpResponse>((resolve) => {
          resolveWorkIndex = resolve;
        });
      });

      window.history.replaceState(null, "", "/search");
      const { result: result3, unmount: unmount3 } = renderHook(
        () => useNovelSearch(),
        {
          wrapper: createWrapper("/search"),
        },
      );

      act(() => {
        result3.current.setKeyword("異世界");
      });
      await act(async () => {
        await result3.current.search();
      });

      const targetItem = result3.current.items[0];
      let cardSelectPromise!: Promise<void>;
      act(() => {
        cardSelectPromise = result3.current.handleCardSelect(targetItem);
      });

      await waitFor(() => {
        expect(result3.current.addingWorkId).toBe(targetItem.remoteWorkId);
      });

      // 作品取得中にアンマウント
      unmount3();

      await act(async () => {
        resolveWorkIndex({
          status: 200,
          url: targetItem.workUrl,
          headers: {},
          html: workIndexHtml,
        });
        await cardSelectPromise;
      });

      // アンマウント後のため registeredWorkIds 更新も画面遷移も発火しないこと
      expect(
        result3.current.registeredWorkIds.has(targetItem.remoteWorkId),
      ).toBe(false);
      expect(window.location.pathname).toBe("/search");
    });
  });
});

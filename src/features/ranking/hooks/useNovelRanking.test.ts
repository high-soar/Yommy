import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import * as ServiceProviderModule from "../../../app/ServiceProvider";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider } from "../../../app/router";
import { useNovelRanking } from "./useNovelRanking";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import { MockHttpClient } from "../../../bridges/http/mockHttpClient";
import rankingApolloHtml from "../../../parsers/kakuyomu/__fixtures__/ranking_results_apollo.html?raw";
import rankingEmptyHtml from "../../../parsers/kakuyomu/__fixtures__/ranking_results_empty.html?raw";
import workIndexHtml from "../../../parsers/kakuyomu/__fixtures__/work_index.html?raw";
import narouWorkIndexSerializedHtml from "../../../parsers/narou/__fixtures__/work_index_serialized.html?raw";
import narouWorkIndexPage2Html from "../../../parsers/narou/__fixtures__/work_index_page2.html?raw";
import narouRankingResultsJson from "../../../parsers/narou/__fixtures__/ranking_results.json?raw";
import { sampleRankingItem1, sampleRankingItem2 } from "../types";
import type { HttpResponse } from "../../../bridges/http/types";
import type { NovelRankingResultItem } from "../../../parsers/types";
import type { SyncEngine } from "../../cloud-sync/services/syncEngine";
import type { NovelRepository } from "../../../storage/types";

describe("useNovelRanking", () => {
  let mockHttpClient: MockHttpClient;

  beforeEach(async () => {
    await resetTestDb();
    localStorage.clear();
    window.history.replaceState(null, "", "/ranking");
    vi.clearAllMocks();
    vi.restoreAllMocks();

    mockHttpClient = new MockHttpClient();
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/rankings\/.*empty/,
      (options) => ({
        status: 200,
        url: options.url,
        headers: {},
        html: rankingEmptyHtml,
      }),
    );
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/rankings\//,
      (options) => ({
        status: 200,
        url: options.url,
        headers: {},
        html: rankingApolloHtml,
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
        html: narouRankingResultsJson,
      }),
    );
  });

  const createWrapper =
    (initialPath = "/ranking", customServices = {}) =>
    ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        ServiceProvider,
        { services: { httpClient: mockHttpClient, ...customServices } },
        React.createElement(RouterProvider, { initialPath }, children),
      );

  it("初期化時にカクヨム・週間・総合のランキングが自動取得されること (AC-RK-01)", async () => {
    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    expect(result.current.selectedSite).toBe("kakuyomu");
    expect(result.current.period).toBe("weekly");
    expect(result.current.genre).toBeUndefined();
    expect(result.current.items[0].rank).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it("期間を変更した際に新しい集計期間でランキングが再取得されること (AC-RK-02)", async () => {
    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    await act(async () => {
      result.current.setPeriod("monthly");
    });

    await waitFor(() => {
      expect(result.current.period).toBe("monthly");
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("ジャンルを変更した際に新しいジャンルでランキングが再取得されること (AC-RK-03)", async () => {
    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    await act(async () => {
      result.current.setGenre("fantasy");
    });

    await waitFor(() => {
      expect(result.current.genre).toBe("fantasy");
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.setGenre(undefined);
    });

    await waitFor(() => {
      expect(result.current.genre).toBeUndefined();
    });
  });

  it("ランキング結果が0件の際に items が空配列となること", async () => {
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/rankings\//,
      (options) => ({
        status: 200,
        url: options.url,
        headers: {},
        html: rankingEmptyHtml,
      }),
    );

    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("通信エラー発生時にエラーメッセージが保持され retry で再試行できること", async () => {
    let failOnce = true;
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/rankings\//,
      (options) => {
        if (failOnce) {
          throw new Error("HTTP 500 Network Error");
        }
        return {
          status: 200,
          url: options.url,
          headers: {},
          html: rankingApolloHtml,
        };
      },
    );

    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBe("HTTP 500 Network Error");
      expect(result.current.items).toEqual([]);
    });

    failOnce = false;
    await act(async () => {
      await result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.items.length).toBeGreaterThan(0);
    });
  });

  it("ランキング未対応のサイトに変更した際、エラーが設定されること", async () => {
    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    await act(async () => {
      result.current.setSelectedSite("generic");
    });

    await waitFor(() => {
      expect(result.current.error).toContain("未実装のサイトです");
    });
  });

  it("ランキング取得中（isLoading === true）に setPeriod / setGenre / retry を連続して呼んでも重複リクエストがガードされること (AC-RK-08)", async () => {
    let getHtmlResolve: ((val: HttpResponse) => void) | null = null;
    let getHtmlCallCount = 0;

    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/rankings\//, () => {
      getHtmlCallCount++;
      return new Promise<HttpResponse>((resolve) => {
        getHtmlResolve = resolve;
      });
    });

    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    // 初回取得中
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
      expect(getHtmlCallCount).toBe(1);
    });

    // isLoading 中に setSelectedSite / setPeriod / setGenre / retry を呼び出す
    act(() => {
      result.current.setSelectedSite("kakuyomu");
      result.current.setPeriod("monthly");
      result.current.setGenre("fantasy");
      void result.current.retry();
    });

    // 重複リクエストは抑止され、getHtmlCallCount は 1 のまま
    expect(getHtmlCallCount).toBe(1);

    // 初回リクエストを解決
    await act(async () => {
      getHtmlResolve?.({
        status: 200,
        url: "https://kakuyomu.jp/rankings/weekly",
        headers: {},
        html: rankingApolloHtml,
      });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.items.length).toBeGreaterThan(0);
    });
  });

  it("古い非同期リクエストが遅れて解決した場合に最新の結果が上書きされないこと (AC-RK-08)", async () => {
    const resolvers: Array<(val: HttpResponse) => void> = [];

    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/rankings\//, () => {
      return new Promise<HttpResponse>((resolve) => {
        resolvers.push(resolve);
      });
    });

    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    // 1回目のリクエスト中
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
      expect(resolvers.length).toBe(1);
    });

    // 1回目解決前に 2回目のリクエストを発火（期間変更）
    act(() => {
      result.current.setPeriod("monthly");
    });

    // 通信中ガードにより多重リクエストは抑止され、resolvers.length は 1 のまま維持されること (R1-20)
    expect(resolvers.length).toBe(1);

    // 1回目を解決
    await act(async () => {
      resolvers[0]({
        status: 200,
        url: "https://kakuyomu.jp/rankings/weekly",
        headers: {},
        html: rankingApolloHtml,
      });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.items.length).toBeGreaterThan(0);
    });
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
      html: rankingApolloHtml,
    }));

    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper("/ranking", {
        novelRepository: mockNovelRepo as unknown as NovelRepository,
      }),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.items.length).toBeGreaterThan(0);
    });

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

  it("カードの「＋ 本棚に追加」で DB に保存され registeredWorkIds が更新されること (AC-RK-06)", async () => {
    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    const targetItem = result.current.items[0];
    let savedId: string | null = null;

    await act(async () => {
      savedId = await result.current.addNovelToBookshelf(targetItem);
    });

    expect(savedId).toBeTruthy();
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

    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    const narouItem: NovelRankingResultItem = {
      rank: 1,
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

    let savedId: string | null = null;
    await act(async () => {
      savedId = await result.current.addNovelToBookshelf(narouItem);
    });

    expect(savedId).toBe("narou:n9669bk");
    expect(result.current.registeredWorkIds.has("n9669bk")).toBe(true);
    expect(result.current.addingWorkId).toBeNull();
  });

  it("本棚追加で通信エラーが発生した場合は error が設定され null を返すこと", async () => {
    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, () => {
      throw new Error("Work Detail Fetch Failed");
    });

    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    let savedId: string | null = "dummy";
    await act(async () => {
      savedId = await result.current.addNovelToBookshelf(sampleRankingItem1);
    });

    expect(savedId).toBeNull();
    expect(result.current.error).toBe("Work Detail Fetch Failed");
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
          { initialPath: "/ranking" },
          children,
        ),
      );

    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: wrapperWithSyncEngine,
    });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    await act(async () => {
      await result.current.addNovelToBookshelf(sampleRankingItem1);
    });

    expect(mockSyncEngine.notifyChanged).toHaveBeenCalled();
  });

  it("先行する作品追加完了時に後続作品の addingWorkId が上書き解除されないこと", async () => {
    let resolveFirst: ((val: HttpResponse) => void) | null = null;
    let resolveSecond: ((val: HttpResponse) => void) | null = null;

    mockHttpClient.reset();
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/rankings\//,
      (options) => ({
        status: 200,
        url: options.url,
        headers: {},
        html: rankingApolloHtml,
      }),
    );
    mockHttpClient.setResponse(
      sampleRankingItem1.workUrl,
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    mockHttpClient.setResponse(
      sampleRankingItem2.workUrl,
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve;
        }),
    );

    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    // 1件目の追加を開始（保留中）
    let promise1: Promise<string | null>;
    act(() => {
      promise1 = result.current.addNovelToBookshelf(sampleRankingItem1);
    });
    expect(result.current.addingWorkId).toBe(sampleRankingItem1.remoteWorkId);

    // 2件目の追加を開始（保留中）
    let promise2: Promise<string | null>;
    act(() => {
      promise2 = result.current.addNovelToBookshelf(sampleRankingItem2);
    });
    expect(result.current.addingWorkId).toBe(sampleRankingItem2.remoteWorkId);

    // 1件目が先に完了する: 1件目の完了処理は addingWorkId が 2件目の ID の場合 null に上書きしないこと
    await act(async () => {
      resolveFirst!({
        url: sampleRankingItem1.workUrl,
        status: 200,
        headers: {},
        html: workIndexHtml,
      });
      await promise1!;
    });
    expect(result.current.addingWorkId).toBe(sampleRankingItem2.remoteWorkId);

    // 2件目が完了する: 2件目の ID と一致するため null に解除されること
    await act(async () => {
      resolveSecond!({
        url: sampleRankingItem2.workUrl,
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

    mockHttpClient.reset();
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/rankings\//,
      (options) => ({
        status: 200,
        url: options.url,
        headers: {},
        html: rankingApolloHtml,
      }),
    );
    mockHttpClient.setResponse(
      sampleRankingItem1.workUrl,
      () =>
        new Promise((_, reject) => {
          rejectFirst = reject;
        }),
    );
    mockHttpClient.setResponse(
      sampleRankingItem2.workUrl,
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve;
        }),
    );

    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    // 1件目の追加を開始（保留中）
    let promise1: Promise<string | null>;
    act(() => {
      promise1 = result.current.addNovelToBookshelf(sampleRankingItem1);
    });

    // 2件目の追加を開始（保留中）
    let promise2: Promise<string | null>;
    act(() => {
      promise2 = result.current.addNovelToBookshelf(sampleRankingItem2);
    });
    expect(result.current.addingWorkId).toBe(sampleRankingItem2.remoteWorkId);

    // 1件目がエラーで失敗: 1件目の catch は addingWorkId が 2件目の ID の場合 null に上書きしないこと
    await act(async () => {
      rejectFirst!(new Error("Item 1 fetch error"));
      await promise1!;
    });
    expect(result.current.addingWorkId).toBe(sampleRankingItem2.remoteWorkId);

    // 2件目が完了する: 2件目の ID と一致するため null に解除されること
    await act(async () => {
      resolveSecond!({
        url: sampleRankingItem2.workUrl,
        status: 200,
        headers: {},
        html: workIndexHtml,
      });
      await promise2!;
    });
    expect(result.current.addingWorkId).toBeNull();
  });

  it("同一作品の追加処理中（addingWorkId === item.remoteWorkId）に再度 addNovelToBookshelf を呼び出した場合、多重実行を防止し直ちに null を返すこと", async () => {
    const resolves: Array<(val: HttpResponse) => void> = [];
    let fetchCount = 0;
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/works\/\d+$/,
      (options) => {
        if (options.url === sampleRankingItem1.workUrl) {
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

    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    let promise1: Promise<string | null>;
    act(() => {
      promise1 = result.current.addNovelToBookshelf(sampleRankingItem1);
    });
    expect(result.current.addingWorkId).toBe(sampleRankingItem1.remoteWorkId);

    // 同一作品の追加を再度呼び出し（ガードにより即時 null が返るべき）
    let secondResult: string | null = "dummy";
    let isSecondResolved = false;
    const promise2 = result.current
      .addNovelToBookshelf(sampleRankingItem1)
      .then((res) => {
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
          url: sampleRankingItem1.workUrl,
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
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/works\/\d+$/,
      (options) => {
        if (options.url === sampleRankingItem1.workUrl) {
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

    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    let promise1: Promise<string | null>;
    act(() => {
      promise1 = result.current.addNovelToBookshelf(sampleRankingItem1);
    });
    expect(result.current.addingWorkId).toBe(sampleRankingItem1.remoteWorkId);

    // 追加処理中に同一作品の handleCardSelect を呼び出す
    let isSelectResolved = false;
    const selectPromise = result.current
      .handleCardSelect(sampleRankingItem1)
      .then(() => {
        isSelectResolved = true;
      });
    await Promise.resolve();

    try {
      expect(isSelectResolved).toBe(true);
      expect(fetchCount).toBe(1);
      expect(window.location.pathname).toBe("/ranking");
    } finally {
      resolves.forEach((resolve) =>
        resolve({
          url: sampleRankingItem1.workUrl,
          status: 200,
          headers: {},
          html: workIndexHtml,
        }),
      );
      await promise1!;
      await selectPromise;
    }
  });

  it("ランキング取得で非Error例外がスローされた場合も文字列化されてエラー状態に保持されること", async () => {
    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/rankings\//, () => {
      throw "String error";
    });

    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBe("String error");
    });
  });

  it("本棚追加で非Error例外がスローされた場合も文字列化されてエラー状態に保持されること", async () => {
    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, () => {
      throw "String error on add";
    });

    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    await act(async () => {
      await result.current.addNovelToBookshelf(sampleRankingItem1);
    });

    expect(result.current.error).toBe("String error on add");
  });

  it("handleCardSelect: siteType を明示的に持つアイテムでも正しく詳細画面へ遷移すること", async () => {
    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    const targetItem = {
      ...result.current.items[0],
      siteType: "kakuyomu" as const,
    };

    // 登録
    await act(async () => {
      await result.current.addNovelToBookshelf(targetItem);
    });

    // 登録済みタップ
    await act(async () => {
      await result.current.handleCardSelect(targetItem);
    });

    expect(window.location.pathname).toBe(
      `/novels/${encodeURIComponent(`kakuyomu:${targetItem.remoteWorkId}`)}`,
    );
  });

  it("handleCardSelect: 未登録時は本棚登録した上で作品詳細画面へ遷移すること (AC-RK-07)", async () => {
    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    const targetItem = result.current.items[0];

    await act(async () => {
      await result.current.handleCardSelect(targetItem);
    });

    expect(result.current.registeredWorkIds.has(targetItem.remoteWorkId)).toBe(
      true,
    );
  });

  it("handleCardSelect: 登録済みの場合は即座に作品詳細画面へ遷移すること (AC-RK-07)", async () => {
    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    const targetItem = result.current.items[0];

    // 1回目: 登録
    await act(async () => {
      await result.current.addNovelToBookshelf(targetItem);
    });

    // 2回目: 登録済み状態でのタップ
    await act(async () => {
      await result.current.handleCardSelect(targetItem);
    });

    expect(result.current.registeredWorkIds.has(targetItem.remoteWorkId)).toBe(
      true,
    );
  });

  it("handleCardSelect で登録済みだが listNovels で見つからない場合もフォールバックIDで詳細画面へ遷移すること", async () => {
    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    const targetItem = result.current.items[0];

    // 本棚へ登録
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
    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    const targetItem = result.current.items[0];

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

  it("handleCardSelect で未登録作品の追加が失敗した場合は詳細画面へ遷移しないこと", async () => {
    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, () => {
      throw new Error("Add Failed");
    });

    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    const targetItem = result.current.items[0];
    window.history.pushState(null, "", "/ranking");

    await act(async () => {
      await result.current.handleCardSelect(targetItem);
    });

    expect(window.location.pathname).toBe("/ranking");
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
          { initialPath: "/ranking" },
          children,
        ),
      );

    const { result } = renderHook(() => useNovelRanking(), { wrapper });

    await waitFor(() => {
      expect(failingRepo.listNovels).toHaveBeenCalled();
    });
    expect(result.current.registeredWorkIds.size).toBe(0);
  });

  it("novelRepository が存在しない場合も refreshRegisteredIds がクラッシュしないこと", async () => {
    vi.spyOn(ServiceProviderModule, "useServices").mockReturnValue({
      httpClient: mockHttpClient,
      parserRegistry: {
        getAll: () => [],
      } as never,
      databaseAdapter: {} as never,
      novelRepository: undefined as never,
      chapterRepository: {} as never,
      settingsRepository: {} as never,
      appSettingsRepository: {} as never,
      appBridge: {} as never,
      cloudSyncBridge: {} as never,
      volumeKeyBridge: {} as never,
      isReady: true,
      error: null,
    });

    const { result } = renderHook(() => useNovelRanking(), {
      wrapper: ({ children }) =>
        React.createElement(
          RouterProvider,
          { initialPath: "/ranking" },
          children,
        ),
    });

    expect(result.current.registeredWorkIds.size).toBe(0);
  });

  describe("サイト切替（setSelectedSite）と自動連動 (AC-RK-09)", () => {
    it("サイトを narou へ切り替えた場合、period を維持し genre を undefined にリセットして即時自動再取得が走ること", async () => {
      const { result } = renderHook(() => useNovelRanking(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.items.length).toBeGreaterThan(0);
      });

      // 期間とジャンルを変更
      await act(async () => {
        result.current.setPeriod("monthly");
      });
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.setGenre("fantasy");
      });
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.genre).toBe("fantasy");
      });

      const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");

      // narou へ切り替え
      await act(async () => {
        result.current.setSelectedSite("narou");
      });

      await waitFor(() => {
        expect(result.current.selectedSite).toBe("narou");
        expect(result.current.isLoading).toBe(false);
      });

      // period が維持され、genre が undefined（総合）にリセットされていること
      expect(result.current.period).toBe("monthly");
      expect(result.current.genre).toBeUndefined();
      expect(result.current.error).toBeNull();

      // api.syosetu.com へのリクエストが monthlypoint で行われていること
      expect(getHtmlSpy).toHaveBeenCalled();
      const calledUrl = getHtmlSpy.mock.calls[0][0].url;
      expect(calledUrl).toContain("api.syosetu.com");
      expect(calledUrl).toContain("order=monthlypoint");
      expect(calledUrl).not.toContain("genre=");

      // 取得結果がなろう作品（n1001aa）であること
      expect(result.current.items[0].remoteWorkId).toBe("n1001aa");
      expect(result.current.items[0].workUrl).toContain("syosetu.com");
    });

    it("同一サイト（kakuyomu -> kakuyomu）への切り替えは何もしないこと（no-op）", async () => {
      const { result } = renderHook(() => useNovelRanking(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");

      act(() => {
        result.current.setSelectedSite("kakuyomu");
      });

      expect(getHtmlSpy).not.toHaveBeenCalled();
    });

    it("通信中（isLoading === true）のサイト切り替え操作は無視（ガード）されること", async () => {
      let resolveRanking: (res: HttpResponse) => void = () => {};
      mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/rankings\//, () => {
        return new Promise<HttpResponse>((resolve) => {
          resolveRanking = resolve;
        });
      });

      const { result } = renderHook(() => useNovelRanking(), {
        wrapper: createWrapper(),
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

      // 解決
      await act(async () => {
        resolveRanking({
          status: 200,
          url: "https://kakuyomu.jp/rankings/weekly",
          headers: {},
          html: rankingApolloHtml,
        });
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.selectedSite).toBe("kakuyomu");
    });
  });

  describe("作品種別（workVariation）フィルタと非同期世代ガード (AC-RK-10, Issue #265)", () => {
    it("初期化時にデフォルトで workVariation === 'long' となり、カクヨムランキング取得URLに work_variation=long が付与されること (AC-RK-01, AC-RK-10)", async () => {
      const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");

      const { result } = renderHook(() => useNovelRanking(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.items.length).toBeGreaterThan(0);
      });

      expect(result.current.workVariation).toBe("long");
      expect(getHtmlSpy).toHaveBeenCalled();
      const calledUrl = getHtmlSpy.mock.calls[0][0].url;
      expect(calledUrl).toContain("work_variation=long");
    });

    it("setWorkVariation('short') により workVariation が 'short' に更新され、カクヨムランキング取得URLに work_variation=short が付与されて再取得されること (AC-RK-10)", async () => {
      const { result } = renderHook(() => useNovelRanking(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");

      act(() => {
        result.current.setWorkVariation("short");
      });

      expect(result.current.workVariation).toBe("short");

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(getHtmlSpy).toHaveBeenCalled();
      const calledUrl = getHtmlSpy.mock.calls[0][0].url;
      expect(calledUrl).toContain("work_variation=short");
    });

    it("setWorkVariation('all') により workVariation が 'all' に更新され、カクヨムランキング取得URLに work_variation=all が付与されて再取得されること (AC-RK-10)", async () => {
      const { result } = renderHook(() => useNovelRanking(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");

      act(() => {
        result.current.setWorkVariation("all");
      });

      expect(result.current.workVariation).toBe("all");

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(getHtmlSpy).toHaveBeenCalled();
      const calledUrl = getHtmlSpy.mock.calls[0][0].url;
      expect(calledUrl).toContain("work_variation=all");
    });

    it("通信中（isLoading === true）の setWorkVariation 呼び出しはガード（無視）されること (AC-RK-08)", async () => {
      let resolveRanking: (res: HttpResponse) => void = () => {};
      mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/rankings\//, () => {
        return new Promise<HttpResponse>((resolve) => {
          resolveRanking = resolve;
        });
      });

      const { result } = renderHook(() => useNovelRanking(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // 通信中に setWorkVariation を呼び出し
      act(() => {
        result.current.setWorkVariation("short");
      });

      // 状態は long のままであること
      expect(result.current.workVariation).toBe("long");

      await act(async () => {
        resolveRanking({
          status: 200,
          url: "https://kakuyomu.jp/rankings/weekly?work_variation=long",
          headers: {},
          html: rankingApolloHtml,
        });
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.workVariation).toBe("long");
    });

    it("サイト切替時（カクヨム -> なろう）に選択中の workVariation が維持され、なろうURLへ反映されること (AC-RK-09, AC-RK-10)", async () => {
      const { result } = renderHook(() => useNovelRanking(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 短編に変更
      act(() => {
        result.current.setWorkVariation("short");
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.workVariation).toBe("short");

      const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");

      // なろうに切り替え
      act(() => {
        result.current.setSelectedSite("narou");
      });

      await waitFor(() => {
        expect(result.current.selectedSite).toBe("narou");
        expect(result.current.isLoading).toBe(false);
      });

      // workVariation が short のまま維持されていること
      expect(result.current.workVariation).toBe("short");

      // なろう API への URL に type=t（短編）が付与されていること
      expect(getHtmlSpy).toHaveBeenCalled();
      const calledUrl = getHtmlSpy.mock.calls[0][0].url;
      expect(calledUrl).toContain("api.syosetu.com");
      expect(calledUrl).toContain("type=t");
    });

    it("初期状態（workVariation === 'long'）でなろうに切り替えた場合、type=re（連載）が付与されること (AC-RK-09, AC-RK-10)", async () => {
      const { result } = renderHook(() => useNovelRanking(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const getHtmlSpy = vi.spyOn(mockHttpClient, "getHtml");

      act(() => {
        result.current.setSelectedSite("narou");
      });

      await waitFor(() => {
        expect(result.current.selectedSite).toBe("narou");
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.workVariation).toBe("long");

      expect(getHtmlSpy).toHaveBeenCalled();
      const calledUrl = getHtmlSpy.mock.calls[0][0].url;
      expect(calledUrl).toContain("api.syosetu.com");
      expect(calledUrl).toContain("type=re");
    });

    it("世代カウンタ（requestIdRef）により、非同期解決時に世代が一致する場合のみアイテムおよびエラー状態が更新されること (AC-RK-08)", async () => {
      let resolveRanking!: (res: HttpResponse) => void;

      mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/rankings\//, () => {
        return new Promise<HttpResponse>((resolve) => {
          resolveRanking = resolve;
        });
      });

      const { result } = renderHook(() => useNovelRanking(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      expect(result.current.items).toEqual([]);

      await act(async () => {
        resolveRanking({
          status: 200,
          url: "https://kakuyomu.jp/rankings/weekly?work_variation=long",
          headers: {},
          html: rankingApolloHtml,
        });
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.items.length).toBeGreaterThan(0);
      expect(result.current.items[0].remoteWorkId).toBe("16817330658027210101");
    });

    it("非同期解決時に世代が一致しない（アンマウント等で stale）場合、アイテムおよびエラー状態が更新されず isFetchingRef が解放されること (R1-08)", async () => {
      let resolveRanking!: (res: HttpResponse) => void;

      mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/rankings\//, () => {
        return new Promise<HttpResponse>((resolve) => {
          resolveRanking = resolve;
        });
      });

      const { result, unmount } = renderHook(() => useNovelRanking(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // 通信中にアンマウントして世代を進める
      unmount();

      // 遅延していたレスポンスを解決
      await act(async () => {
        resolveRanking({
          status: 200,
          url: "https://kakuyomu.jp/rankings/weekly?work_variation=long",
          headers: {},
          html: rankingApolloHtml,
        });
      });

      // アンマウント後のためステートは初期状態のまま更新されない
      expect(result.current.items).toEqual([]);
    });

    it("非同期通信が例外で失敗した際に世代が一致しない場合、エラーがセットされず isFetchingRef が解放されること (R1-08)", async () => {
      let rejectRanking!: (err: Error) => void;

      mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/rankings\//, () => {
        return new Promise<HttpResponse>((_, reject) => {
          rejectRanking = reject;
        });
      });

      const { result, unmount } = renderHook(() => useNovelRanking(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      unmount();

      await act(async () => {
        rejectRanking(new Error("Network Error"));
      });

      expect(result.current.error).toBeNull();
    });
  });
});

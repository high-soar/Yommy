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
import { sampleRankingItem1 } from "../types";

describe("useNovelRanking", () => {
  let mockHttpClient: MockHttpClient;

  beforeEach(async () => {
    await resetTestDb();
    localStorage.clear();
    window.history.replaceState(null, "", "/ranking");
    vi.clearAllMocks();

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
  });

  const createWrapper =
    (initialPath = "/ranking") =>
    ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        ServiceProvider,
        { services: { httpClient: mockHttpClient } },
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
      result.current.setSelectedSite("narou");
    });

    await waitFor(() => {
      expect(result.current.error).toContain("未実装のサイトです");
    });
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
      appBridge: {} as never,
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
});

import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./RankingContainer.stories";
import { RankingContainer } from "./RankingContainer";
import * as RankingPageModule from "./RankingPage";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider } from "../../../app/router";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import { MockHttpClient } from "../../../bridges/http/mockHttpClient";
import rankingApolloHtml from "../../../parsers/kakuyomu/__fixtures__/ranking_results_apollo.html?raw";
import workIndexHtml from "../../../parsers/kakuyomu/__fixtures__/work_index.html?raw";
import narouRankingResultsJson from "../../../parsers/narou/__fixtures__/ranking_results.json?raw";

const { Default } = composeStories(stories);

describe("RankingContainer コンポーネント", () => {
  let mockHttpClient: MockHttpClient;

  beforeEach(async () => {
    await resetTestDb();
    localStorage.clear();
    vi.clearAllMocks();

    mockHttpClient = new MockHttpClient();
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

  const renderWithProviders = (props = {}) => {
    return render(
      <ServiceProvider services={{ httpClient: mockHttpClient }}>
        <RouterProvider initialPath="/ranking">
          <RankingContainer {...props} />
        </RouterProvider>
      </ServiceProvider>,
    );
  };

  it("Default ストーリー: ランキング画面が描画され作品一覧が自動取得され、子コンポーネント（RankingPage）に初期Propsが正しく伝搬されること (AC-RK-01, R1-21)", async () => {
    const pageSpy = vi.spyOn(RankingPageModule, "RankingPage");
    render(<Default />);

    await waitFor(() => {
      expect(screen.getByTestId("ranking-page")).toBeInTheDocument();
      expect(pageSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          selectedSite: "kakuyomu",
          selectedPeriod: "weekly",
          selectedWorkVariation: "long",
          selectedGenre: undefined,
        }),
        undefined,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("ranking-results-list")).toBeInTheDocument();
    });
    pageSpy.mockRestore();
  });

  it("期間セレクタで集計期間を切り替えた際にランキングが再取得されること (AC-RK-02)", async () => {
    const pageSpy = vi.spyOn(RankingPageModule, "RankingPage");
    renderWithProviders();

    await waitFor(() => {
      expect(pageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedPeriod: "weekly",
        }),
        undefined,
      );
    });

    const lastCallProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    act(() => {
      lastCallProps.onSelectPeriod("monthly");
    });

    await waitFor(() => {
      expect(pageSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          selectedPeriod: "monthly",
        }),
        undefined,
      );
    });

    pageSpy.mockRestore();
  });

  it("ジャンルピルでジャンルを切り替えた際にランキングが再取得されること (AC-RK-03)", async () => {
    const pageSpy = vi.spyOn(RankingPageModule, "RankingPage");
    renderWithProviders();

    await waitFor(() => {
      expect(pageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedGenre: undefined,
        }),
        undefined,
      );
    });

    const lastCallProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    act(() => {
      lastCallProps.onSelectGenre("fantasy");
    });

    await waitFor(() => {
      expect(pageSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          selectedGenre: "fantasy",
        }),
        undefined,
      );
    });

    pageSpy.mockRestore();
  });

  it("カードの onAddNovel 呼び出しで本棚に登録され registeredWorkIds に追加されること (AC-RK-06)", async () => {
    const pageSpy = vi.spyOn(RankingPageModule, "RankingPage");
    renderWithProviders();

    await waitFor(() => {
      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      expect(lastProps.items.length).toBeGreaterThan(0);
    });

    const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    const targetItem = lastProps.items[0];

    act(() => {
      lastProps.onAddNovel(targetItem);
    });

    await waitFor(() => {
      const currentProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      expect(currentProps.registeredWorkIds.has(targetItem.remoteWorkId)).toBe(
        true,
      );
    });

    pageSpy.mockRestore();
  });

  it("onSelectNovel が指定されている場合、未登録カードタップ時に本棚追加の上で onSelectNovel が呼ばれること (AC-RK-07)", async () => {
    const pageSpy = vi.spyOn(RankingPageModule, "RankingPage");
    const handleSelectNovel = vi.fn();

    renderWithProviders({ onSelectNovel: handleSelectNovel });

    await waitFor(() => {
      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      expect(lastProps.items.length).toBeGreaterThan(0);
    });

    const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    const targetItem = lastProps.items[0];

    act(() => {
      lastProps.onSelectCard(targetItem);
    });

    await waitFor(() => {
      expect(handleSelectNovel).toHaveBeenCalledTimes(1);
    });

    pageSpy.mockRestore();
  });

  it("onSelectNovel が指定されている場合、すでに登録済みのカードタップ時は即座に onSelectNovel が呼ばれること (AC-RK-07)", async () => {
    const pageSpy = vi.spyOn(RankingPageModule, "RankingPage");
    const handleSelectNovel = vi.fn();

    renderWithProviders({ onSelectNovel: handleSelectNovel });

    await waitFor(() => {
      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      expect(lastProps.items.length).toBeGreaterThan(0);
    });

    let lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    const targetItem = lastProps.items[0];

    // まず本棚に追加
    act(() => {
      lastProps.onAddNovel(targetItem);
    });

    await waitFor(() => {
      const currentProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      expect(currentProps.registeredWorkIds.has(targetItem.remoteWorkId)).toBe(
        true,
      );
    });

    // 登録済み状態でカードタップ
    lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    act(() => {
      lastProps.onSelectCard(targetItem);
    });

    await waitFor(() => {
      expect(handleSelectNovel).toHaveBeenCalledTimes(1);
    });

    pageSpy.mockRestore();
  });

  it("onSelectNovel が指定されていない場合、未登録作品の onSelectCard 呼び出しで作品が自動登録されること", async () => {
    const pageSpy = vi.spyOn(RankingPageModule, "RankingPage");
    renderWithProviders();

    await waitFor(() => {
      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      expect(lastProps.items.length).toBeGreaterThan(0);
    });

    const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    const targetItem = lastProps.items[0];

    act(() => {
      lastProps.onSelectCard(targetItem);
    });

    await waitFor(() => {
      const currentProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      expect(currentProps.registeredWorkIds.has(targetItem.remoteWorkId)).toBe(
        true,
      );
    });

    pageSpy.mockRestore();
  });

  it("onSelectNovel 指定時に未登録作品の追加が失敗した場合は onSelectNovel が呼ばれないこと", async () => {
    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, () => {
      throw new Error("TOC Fetch Failed");
    });

    const pageSpy = vi.spyOn(RankingPageModule, "RankingPage");
    const handleSelectNovel = vi.fn();

    renderWithProviders({ onSelectNovel: handleSelectNovel });

    await waitFor(() => {
      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      expect(lastProps.items.length).toBeGreaterThan(0);
    });

    const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    const targetItem = lastProps.items[0];

    act(() => {
      lastProps.onSelectCard(targetItem);
    });

    await waitFor(() => {
      const currentProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      expect(currentProps.error).not.toBeNull();
    });

    expect(handleSelectNovel).not.toHaveBeenCalled();
    pageSpy.mockRestore();
  });

  it("SiteSelector によるサイト切替コールバック（onSelectSite）呼び出し時に、子コンポーネント（RankingPage）へ selectedSite が伝搬すること (AC-RK-09, R1-21)", async () => {
    const pageSpy = vi.spyOn(RankingPageModule, "RankingPage");
    renderWithProviders();

    await waitFor(() => {
      expect(pageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedSite: "kakuyomu",
        }),
        undefined,
      );
    });

    const lastCallProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    act(() => {
      lastCallProps.onSelectSite("narou");
    });

    await waitFor(() => {
      expect(pageSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          selectedSite: "narou",
        }),
        undefined,
      );
    });

    pageSpy.mockRestore();
  });

  it("RankingPage へ作品種別（selectedWorkVariation: 'long'）および変更コールバック（onSelectWorkVariation）が伝搬されること (AC-RK-10, Issue #265)", async () => {
    const pageSpy = vi.spyOn(RankingPageModule, "RankingPage");
    renderWithProviders();

    await waitFor(() => {
      expect(pageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedWorkVariation: "long",
          onSelectWorkVariation: expect.any(Function),
        }),
        undefined,
      );
    });

    pageSpy.mockRestore();
  });
});

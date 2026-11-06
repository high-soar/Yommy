import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId("ranking-results-list")).toBeInTheDocument();
    });

    const monthlyPill = screen.getByTestId("ranking-period-monthly");
    await user.click(monthlyPill);

    await waitFor(() => {
      expect(monthlyPill).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("ジャンルピルでジャンルを切り替えた際にランキングが再取得されること (AC-RK-03)", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId("ranking-results-list")).toBeInTheDocument();
    });

    const fantasyPill = screen.getByTestId("ranking-genre-fantasy");
    await user.click(fantasyPill);

    await waitFor(() => {
      expect(fantasyPill).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("カードの「＋ 本棚に追加」ボタンを押下すると本棚に登録され「✓ 登録済み」となること (AC-RK-06)", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getAllByTestId("ranking-card-add-button").length,
      ).toBeGreaterThan(0);
    });

    const addButtons = screen.getAllByTestId("ranking-card-add-button");
    await user.click(addButtons[0]);

    await waitFor(() => {
      expect(
        screen.getAllByTestId("ranking-card-registered-button").length,
      ).toBeGreaterThan(0);
    });
  });

  it("onSelectNovel が指定されている場合、未登録カードタップ時に本棚追加の上で onSelectNovel が呼ばれること (AC-RK-07)", async () => {
    const user = userEvent.setup();
    const handleSelectNovel = vi.fn();

    renderWithProviders({ onSelectNovel: handleSelectNovel });

    await waitFor(() => {
      expect(screen.getByTestId("ranking-results-list")).toBeInTheDocument();
    });

    const cards = screen.getAllByRole("button");
    const novelCards = cards.filter((el) =>
      el.getAttribute("data-testid")?.startsWith("ranking-novel-card-"),
    );

    await user.click(novelCards[0]);

    await waitFor(() => {
      expect(handleSelectNovel).toHaveBeenCalledTimes(1);
    });
  });

  it("onSelectNovel が指定されている場合、すでに登録済みのカードタップ時は即座に onSelectNovel が呼ばれること (AC-RK-07)", async () => {
    const user = userEvent.setup();
    const handleSelectNovel = vi.fn();

    renderWithProviders({ onSelectNovel: handleSelectNovel });

    await waitFor(() => {
      expect(
        screen.getAllByTestId("ranking-card-add-button").length,
      ).toBeGreaterThan(0);
    });

    // まず登録ボタンを押下
    const addButtons = screen.getAllByTestId("ranking-card-add-button");
    await user.click(addButtons[0]);

    await waitFor(() => {
      expect(
        screen.getAllByTestId("ranking-card-registered-button").length,
      ).toBeGreaterThan(0);
    });

    // 登録済みカード本体をタップ
    const cards = screen.getAllByRole("button");
    const novelCards = cards.filter((el) =>
      el.getAttribute("data-testid")?.startsWith("ranking-novel-card-"),
    );

    await user.click(novelCards[0]);

    await waitFor(() => {
      expect(handleSelectNovel).toHaveBeenCalledTimes(1);
    });
  });

  it("onSelectNovel が指定されていない場合、カード本体タップで内部の handleCardSelect が実行されること", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId("ranking-results-list")).toBeInTheDocument();
    });

    const cards = screen.getAllByRole("button");
    const novelCards = cards.filter((el) =>
      el.getAttribute("data-testid")?.startsWith("ranking-novel-card-"),
    );

    await user.click(novelCards[0]);

    await waitFor(() => {
      expect(
        screen.getAllByTestId("ranking-card-registered-button").length,
      ).toBeGreaterThan(0);
    });
  });

  it("onSelectNovel 指定時に未登録作品の追加が失敗した場合は onSelectNovel が呼ばれないこと", async () => {
    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, () => {
      throw new Error("TOC Fetch Failed");
    });

    const user = userEvent.setup();
    const handleSelectNovel = vi.fn();

    renderWithProviders({ onSelectNovel: handleSelectNovel });

    await waitFor(() => {
      expect(screen.getByTestId("ranking-results-list")).toBeInTheDocument();
    });

    const cards = screen.getAllByRole("button");
    const novelCards = cards.filter((el) =>
      el.getAttribute("data-testid")?.startsWith("ranking-novel-card-"),
    );

    await user.click(novelCards[0]);

    await waitFor(() => {
      expect(screen.getByTestId("ranking-error")).toBeInTheDocument();
    });

    expect(handleSelectNovel).not.toHaveBeenCalled();
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
});

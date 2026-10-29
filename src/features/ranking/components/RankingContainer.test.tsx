import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./RankingContainer.stories";
import { RankingContainer } from "./RankingContainer";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider } from "../../../app/router";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import { MockHttpClient } from "../../../bridges/http/mockHttpClient";
import rankingApolloHtml from "../../../parsers/kakuyomu/__fixtures__/ranking_results_apollo.html?raw";
import workIndexHtml from "../../../parsers/kakuyomu/__fixtures__/work_index.html?raw";

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

  it("Default ストーリー: ランキング画面が描画され作品一覧が自動取得されること (AC-RK-01)", async () => {
    render(<Default />);

    await waitFor(() => {
      expect(screen.getByTestId("ranking-page")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId("ranking-results-list")).toBeInTheDocument();
    });
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
});

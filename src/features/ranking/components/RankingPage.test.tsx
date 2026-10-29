import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./RankingPage.stories";
import { RankingPage } from "./RankingPage";
import { sampleRankingItem1 } from "../types";

const {
  WeeklyOverall,
  GenreFantasy,
  MixedRegistration,
  Loading,
  Empty,
  ErrorState,
} = composeStories(stories);

describe("RankingPage コンポーネント", () => {
  it("WeeklyOverall ストーリー: ランキングヘッダー、フィルタ、作品一覧が描画されること (AC-RK-01)", () => {
    render(<WeeklyOverall />);

    expect(screen.getByTestId("ranking-page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "ランキング",
    );
    expect(screen.getByTestId("site-selector-kakuyomu")).toBeInTheDocument();
    expect(screen.getByTestId("ranking-filter-bar")).toBeInTheDocument();
    expect(screen.getByTestId("ranking-results-list")).toBeInTheDocument();

    expect(
      screen.getByTestId("ranking-novel-card-16817330658027210412"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("ranking-novel-card-1177354054881162325"),
    ).toBeInTheDocument();
  });

  it("GenreFantasy ストーリー: 指定ジャンル選択時の画面が描画されること (AC-RK-03)", () => {
    render(<GenreFantasy />);

    expect(screen.getByTestId("ranking-period-monthly")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("ranking-genre-fantasy")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("MixedRegistration ストーリー: 登録済み・追加中が正しく渡されていること (AC-RK-06)", () => {
    render(<MixedRegistration />);

    // 1位: 追加中
    const card1 = screen.getByTestId("ranking-novel-card-16817330658027210412");
    const addButton1 = within(card1).getByTestId("ranking-card-add-button");
    expect(addButton1).toHaveTextContent("追加中...");
    expect(addButton1).toBeDisabled();

    // 2位: 登録済み
    const card2 = screen.getByTestId("ranking-novel-card-1177354054881162325");
    expect(
      within(card2).getByTestId("ranking-card-registered-button"),
    ).toBeInTheDocument();
  });

  it("Loading ストーリー: ローディングインジケーターが表示されること", () => {
    render(<Loading />);

    expect(screen.getByTestId("ranking-loading")).toBeInTheDocument();
    expect(
      screen.queryByTestId("ranking-results-list"),
    ).not.toBeInTheDocument();
  });

  it("Empty ストーリー: ランキング0件時の空状態が表示されること", () => {
    render(<Empty />);

    expect(screen.getByTestId("ranking-empty-state")).toBeInTheDocument();
    expect(
      screen.getByText("ランキング作品が見つかりませんでした"),
    ).toBeInTheDocument();
  });

  it("ErrorState ストーリー: エラー表示と再試行ボタンが表示され押下時に onRetry が呼ばれること", async () => {
    const user = userEvent.setup();
    const handleRetry = vi.fn();

    render(<ErrorState onRetry={handleRetry} />);

    expect(screen.getByTestId("ranking-error")).toBeInTheDocument();
    const retryBtn = screen.getByTestId("ranking-error-retry-button");
    await user.click(retryBtn);

    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it("ヘッダーおよびフィルタの変更操作コールバックが伝達されること", async () => {
    const user = userEvent.setup();
    const handleSelectSite = vi.fn();
    const handleSelectPeriod = vi.fn();
    const handleSelectGenre = vi.fn();
    const handleAddNovel = vi.fn();
    const handleSelectCard = vi.fn();

    render(
      <RankingPage
        selectedSite="kakuyomu"
        onSelectSite={handleSelectSite}
        selectedPeriod="weekly"
        onSelectPeriod={handleSelectPeriod}
        selectedGenre={undefined}
        onSelectGenre={handleSelectGenre}
        items={[sampleRankingItem1]}
        registeredWorkIds={new Set()}
        addingWorkId={null}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
        onAddNovel={handleAddNovel}
        onSelectCard={handleSelectCard}
      />,
    );

    // 期間変更
    const dailyBtn = screen.getByTestId("ranking-period-daily");
    await user.click(dailyBtn);
    expect(handleSelectPeriod).toHaveBeenCalledWith("daily");

    // ジャンル変更
    const sfBtn = screen.getByTestId("ranking-genre-sf");
    await user.click(sfBtn);
    expect(handleSelectGenre).toHaveBeenCalledWith("sf");

    // カード内「＋ 本棚に追加」押下
    const addBtn = screen.getByTestId("ranking-card-add-button");
    await user.click(addBtn);
    expect(handleAddNovel).toHaveBeenCalledWith(sampleRankingItem1);

    // カードタップ
    const card = screen.getByTestId("ranking-novel-card-16817330658027210412");
    await user.click(card);
    expect(handleSelectCard).toHaveBeenCalledWith(sampleRankingItem1);
  });
});

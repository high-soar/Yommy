import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./RankingPage.stories";
import { RankingPage } from "./RankingPage";
import { sampleRankingItem1 } from "../__fixtures__/rankingFixtures";
import * as siteSelectorModule from "./SiteSelector";
import * as rankingFilterBarModule from "./RankingFilterBar";
import * as rankingNovelCardModule from "./RankingNovelCard";

const {
  WeeklyOverall,
  GenreFantasy,
  ShortStoryRanking,
  MixedRegistration,
  Loading,
  LoadingWithItems,
  Empty,
  ErrorState,
  NarouSelected,
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

  it("ShortStoryRanking ストーリー: 短編作品種別が選択されていること (AC-RK-10, Issue #265)", () => {
    render(<ShortStoryRanking />);

    expect(screen.getByTestId("ranking-variation-short")).toHaveAttribute(
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

  it("LoadingWithItems ストーリー: 既存データが存在してもローディングが最優先で置換表示され、旧一覧が非表示となること (AC-RK-08)", () => {
    render(<LoadingWithItems />);

    expect(screen.getByTestId("ranking-loading")).toBeInTheDocument();
    expect(
      screen.queryByTestId("ranking-results-list"),
    ).not.toBeInTheDocument();

    // フィルタバー・サイトセレクタが操作不能（disabled）になっていること
    expect(screen.getByTestId("site-selector-kakuyomu")).toBeDisabled();
    expect(screen.getByTestId("ranking-period-monthly")).toBeDisabled();
    expect(screen.getByTestId("ranking-genre-all")).toBeDisabled();
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

  it("NarouSelected ストーリー: なろう選択時に小ジャンルピルが表示されること (AC-RK-09)", () => {
    render(<NarouSelected />);

    expect(screen.getByTestId("site-selector-narou")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("ranking-genre-201")).toBeInTheDocument();
  });

  it("エラー発生時は items が存在していてもエラーカードのみが表示され、作品一覧が非表示となること (AC-RK-08)", () => {
    render(
      <RankingPage
        selectedSite="kakuyomu"
        onSelectSite={vi.fn()}
        selectedPeriod="weekly"
        onSelectPeriod={vi.fn()}
        selectedGenre={undefined}
        onSelectGenre={vi.fn()}
        items={[sampleRankingItem1]}
        registeredWorkIds={new Set()}
        addingWorkId={null}
        isLoading={false}
        error="ネットワークエラー"
        onRetry={vi.fn()}
        onAddNovel={vi.fn()}
        onSelectCard={vi.fn()}
      />,
    );

    expect(screen.getByTestId("ranking-error")).toBeInTheDocument();
    expect(
      screen.queryByTestId("ranking-results-list"),
    ).not.toBeInTheDocument();
  });

  it("親子分離: フィルタおよびカードの各操作コールバックが子コンポーネントへ正しく伝達されること", () => {
    const filterBarSpy = vi.spyOn(rankingFilterBarModule, "RankingFilterBar");
    const cardSpy = vi.spyOn(rankingNovelCardModule, "RankingNovelCard");
    const handleSelectPeriod = vi.fn();
    const handleSelectGenre = vi.fn();
    const handleAddNovel = vi.fn();
    const handleSelectCard = vi.fn();

    render(
      <RankingPage
        selectedSite="kakuyomu"
        onSelectSite={vi.fn()}
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

    // フィルタバーへの Props 伝播およびコールバック発火
    expect(filterBarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedPeriod: "weekly",
        onSelectPeriod: handleSelectPeriod,
        onSelectGenre: handleSelectGenre,
      }),
      undefined,
    );
    const filterBarProps = filterBarSpy.mock.calls[0][0];
    filterBarProps.onSelectPeriod("daily");
    expect(handleSelectPeriod).toHaveBeenCalledWith("daily");
    filterBarProps.onSelectGenre("sf");
    expect(handleSelectGenre).toHaveBeenCalledWith("sf");

    // カードへの Props 伝播およびコールバック発火
    expect(cardSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        item: sampleRankingItem1,
        onAdd: expect.any(Function),
        onSelect: expect.any(Function),
      }),
      undefined,
    );
    const cardProps = cardSpy.mock.calls[0][0];
    cardProps.onAdd();
    expect(handleAddNovel).toHaveBeenCalledWith(sampleRankingItem1);
    cardProps.onSelect();
    expect(handleSelectCard).toHaveBeenCalledWith(sampleRankingItem1);

    filterBarSpy.mockRestore();
    cardSpy.mockRestore();
  });

  it("親子分離: selectedSite が SiteSelector および RankingFilterBar へ正しく伝播すること (AC-RK-09)", () => {
    const siteSelectorSpy = vi.spyOn(siteSelectorModule, "SiteSelector");
    const filterBarSpy = vi.spyOn(rankingFilterBarModule, "RankingFilterBar");

    render(
      <RankingPage
        selectedSite="narou"
        onSelectSite={vi.fn()}
        selectedPeriod="weekly"
        onSelectPeriod={vi.fn()}
        selectedGenre={undefined}
        onSelectGenre={vi.fn()}
        items={[]}
        registeredWorkIds={new Set()}
        addingWorkId={null}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
        onAddNovel={vi.fn()}
        onSelectCard={vi.fn()}
      />,
    );

    expect(siteSelectorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ selectedSite: "narou" }),
      undefined,
    );
    expect(filterBarSpy).toHaveBeenCalledWith(
      expect.objectContaining({ selectedSite: "narou" }),
      undefined,
    );

    siteSelectorSpy.mockRestore();
    filterBarSpy.mockRestore();
  });

  it("親子分離: selectedWorkVariation と onSelectWorkVariation が RankingFilterBar へ正しく伝播すること (AC-RK-10, Issue #265)", () => {
    const filterBarSpy = vi.spyOn(rankingFilterBarModule, "RankingFilterBar");
    const handleWorkVariation = vi.fn();

    render(
      <RankingPage
        selectedSite="kakuyomu"
        onSelectSite={vi.fn()}
        selectedPeriod="weekly"
        onSelectPeriod={vi.fn()}
        selectedWorkVariation="short"
        onSelectWorkVariation={handleWorkVariation}
        selectedGenre={undefined}
        onSelectGenre={vi.fn()}
        items={[]}
        registeredWorkIds={new Set()}
        addingWorkId={null}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
        onAddNovel={vi.fn()}
        onSelectCard={vi.fn()}
      />,
    );

    expect(filterBarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedWorkVariation: "short",
        onSelectWorkVariation: handleWorkVariation,
      }),
      undefined,
    );

    filterBarSpy.mockRestore();
  });
});

import { render, screen } from "@testing-library/react";
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
  it("WeeklyOverall ストーリー: ランキングヘッダー、フィルタ、作品一覧の props が子コンポーネントへ伝播されること (AC-RK-01)", () => {
    const siteSelectorSpy = vi
      .spyOn(siteSelectorModule, "SiteSelector")
      .mockImplementation(() => null);
    const filterBarSpy = vi
      .spyOn(rankingFilterBarModule, "RankingFilterBar")
      .mockImplementation(() => null);
    const cardSpy = vi
      .spyOn(rankingNovelCardModule, "RankingNovelCard")
      .mockImplementation(() => null);

    try {
      render(<WeeklyOverall />);

      expect(screen.getByTestId("ranking-page")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "ランキング",
      );
      expect(siteSelectorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedSite: "kakuyomu",
          disabled: false,
        }),
        undefined,
      );
      expect(filterBarSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedSite: "kakuyomu",
          selectedPeriod: "weekly",
          selectedWorkVariation: "long",
          selectedGenre: undefined,
          disabled: false,
        }),
        undefined,
      );
      expect(screen.getByTestId("ranking-results-list")).toBeInTheDocument();
      expect(cardSpy).toHaveBeenCalledTimes(4);
      const renderedWorkIds = cardSpy.mock.calls.map(
        (call) => call[0].item.remoteWorkId,
      );
      expect(renderedWorkIds).toContain("16817330658027210412");
      expect(renderedWorkIds).toContain("1177354054881162325");
    } finally {
      siteSelectorSpy.mockRestore();
      filterBarSpy.mockRestore();
      cardSpy.mockRestore();
    }
  });

  it("GenreFantasy ストーリー: 指定ジャンルの選択状態がフィルタバーへ伝播されること (AC-RK-03)", () => {
    const filterBarSpy = vi
      .spyOn(rankingFilterBarModule, "RankingFilterBar")
      .mockImplementation(() => null);

    try {
      render(<GenreFantasy />);

      expect(filterBarSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedPeriod: "monthly",
          selectedGenre: "fantasy",
        }),
        undefined,
      );
    } finally {
      filterBarSpy.mockRestore();
    }
  });

  it("ShortStoryRanking ストーリー: 短編作品種別がフィルタバーへ伝播されること (AC-RK-10, Issue #265)", () => {
    const filterBarSpy = vi
      .spyOn(rankingFilterBarModule, "RankingFilterBar")
      .mockImplementation(() => null);

    try {
      render(<ShortStoryRanking />);

      expect(filterBarSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedWorkVariation: "short",
        }),
        undefined,
      );
    } finally {
      filterBarSpy.mockRestore();
    }
  });

  it("MixedRegistration ストーリー: 登録済み・追加中の状態が各カードへ正しく渡されていること (AC-RK-06)", () => {
    const cardSpy = vi
      .spyOn(rankingNovelCardModule, "RankingNovelCard")
      .mockImplementation(() => null);

    try {
      render(<MixedRegistration />);

      const addingCardProps = cardSpy.mock.calls.find(
        (call) => call[0].item.remoteWorkId === "16817330658027210412",
      )?.[0];
      expect(addingCardProps?.isAdding).toBe(true);
      expect(addingCardProps?.isRegistered).toBe(false);

      const registeredCardProps = cardSpy.mock.calls.find(
        (call) => call[0].item.remoteWorkId === "1177354054881162325",
      )?.[0];
      expect(registeredCardProps?.isRegistered).toBe(true);
      expect(registeredCardProps?.isAdding).toBe(false);
    } finally {
      cardSpy.mockRestore();
    }
  });

  it("Loading ストーリー: ローディングインジケーターが表示されること", () => {
    render(<Loading />);

    expect(screen.getByTestId("ranking-loading")).toBeInTheDocument();
    expect(
      screen.queryByTestId("ranking-results-list"),
    ).not.toBeInTheDocument();
  });

  it("LoadingWithItems ストーリー: 既存データが存在してもローディングが最優先で置換表示され、旧一覧が非表示かつフィルタ・サイト選択が無効化されること (AC-RK-08)", () => {
    const siteSelectorSpy = vi
      .spyOn(siteSelectorModule, "SiteSelector")
      .mockImplementation(() => null);
    const filterBarSpy = vi
      .spyOn(rankingFilterBarModule, "RankingFilterBar")
      .mockImplementation(() => null);
    const cardSpy = vi
      .spyOn(rankingNovelCardModule, "RankingNovelCard")
      .mockImplementation(() => null);

    try {
      render(<LoadingWithItems />);

      expect(screen.getByTestId("ranking-loading")).toBeInTheDocument();
      expect(
        screen.queryByTestId("ranking-results-list"),
      ).not.toBeInTheDocument();
      expect(cardSpy).not.toHaveBeenCalled();

      // フィルタバー・サイトセレクタへ disabled=true が伝播していること
      expect(siteSelectorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ disabled: true }),
        undefined,
      );
      expect(filterBarSpy).toHaveBeenCalledWith(
        expect.objectContaining({ disabled: true }),
        undefined,
      );
    } finally {
      siteSelectorSpy.mockRestore();
      filterBarSpy.mockRestore();
      cardSpy.mockRestore();
    }
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

  it("NarouSelected ストーリー: なろう選択状態が SiteSelector と RankingFilterBar へ伝播されること (AC-RK-09)", () => {
    const siteSelectorSpy = vi
      .spyOn(siteSelectorModule, "SiteSelector")
      .mockImplementation(() => null);
    const filterBarSpy = vi
      .spyOn(rankingFilterBarModule, "RankingFilterBar")
      .mockImplementation(() => null);

    try {
      render(<NarouSelected />);

      expect(siteSelectorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ selectedSite: "narou" }),
        undefined,
      );
      expect(filterBarSpy).toHaveBeenCalledWith(
        expect.objectContaining({ selectedSite: "narou" }),
        undefined,
      );
    } finally {
      siteSelectorSpy.mockRestore();
      filterBarSpy.mockRestore();
    }
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

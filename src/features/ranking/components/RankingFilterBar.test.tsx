import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./RankingFilterBar.stories";
import { RankingFilterBar } from "./RankingFilterBar";

const { Default, Filtered, Disabled, NarouGenres } = composeStories(stories);

describe("RankingFilterBar コンポーネント", () => {
  it("Default ストーリー: デフォルトの集計期間（週間）とジャンル（総合）が選択されていること (AC-RK-01)", () => {
    render(<Default />);

    expect(screen.getByTestId("ranking-filter-bar")).toBeInTheDocument();

    const periodWeekly = screen.getByTestId("ranking-period-weekly");
    expect(periodWeekly).toHaveAttribute("aria-pressed", "true");

    const genreAll = screen.getByTestId("ranking-genre-all");
    expect(genreAll).toHaveAttribute("aria-pressed", "true");
  });

  it("Filtered ストーリー: 月間および異世界ファンタジーが選択されていること", () => {
    render(<Filtered />);

    const periodMonthly = screen.getByTestId("ranking-period-monthly");
    expect(periodMonthly).toHaveAttribute("aria-pressed", "true");

    const genreFantasy = screen.getByTestId("ranking-genre-fantasy");
    expect(genreFantasy).toHaveAttribute("aria-pressed", "true");
  });

  it("Disabled ストーリー: disabled が真のとき、全期間ボタンおよびジャンルボタンが無効化されていること (AC-RK-08)", () => {
    render(<Disabled />);

    const periodWeekly = screen.getByTestId("ranking-period-weekly");
    expect(periodWeekly).toBeDisabled();

    const genreAll = screen.getByTestId("ranking-genre-all");
    expect(genreAll).toBeDisabled();
  });

  it("NarouGenres ストーリー: 小説家になろうの小ジャンル（ハイファンタジー）が選択表示されること", () => {
    render(<NarouGenres />);

    const highFantasyPill = screen.getByTestId("ranking-genre-201");
    expect(highFantasyPill).toBeInTheDocument();
    expect(highFantasyPill).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByTestId("ranking-genre-fantasy"),
    ).not.toBeInTheDocument();
  });

  it("期間ピル押下時に onSelectPeriod が呼び出されること (AC-RK-02)", async () => {
    const user = userEvent.setup();
    const handlePeriod = vi.fn();

    render(
      <RankingFilterBar
        selectedPeriod="weekly"
        onSelectPeriod={handlePeriod}
        selectedGenre={undefined}
        onSelectGenre={vi.fn()}
      />,
    );

    const dailyPill = screen.getByTestId("ranking-period-daily");
    await user.click(dailyPill);
    expect(handlePeriod).toHaveBeenCalledWith("daily");

    const entirePill = screen.getByTestId("ranking-period-entire");
    await user.click(entirePill);
    expect(handlePeriod).toHaveBeenCalledWith("entire");
  });

  it("ジャンルピル押下時に onSelectGenre が呼び出されること (カクヨムジャンル) (AC-RK-03)", async () => {
    const user = userEvent.setup();
    const handleGenre = vi.fn();

    render(
      <RankingFilterBar
        selectedSite="kakuyomu"
        selectedPeriod="weekly"
        onSelectPeriod={vi.fn()}
        selectedGenre={undefined}
        onSelectGenre={handleGenre}
      />,
    );

    const sfPill = screen.getByTestId("ranking-genre-sf");
    await user.click(sfPill);
    expect(handleGenre).toHaveBeenCalledWith("sf");

    const allPill = screen.getByTestId("ranking-genre-all");
    await user.click(allPill);
    expect(handleGenre).toHaveBeenCalledWith(undefined);
  });

  it("selectedSite='narou' のとき、なろう公式小ジャンルピル（21種）が描画され選択できること (AC-RK-03, AC-RK-09)", async () => {
    const user = userEvent.setup();
    const handleGenre = vi.fn();

    render(
      <RankingFilterBar
        selectedSite="narou"
        selectedPeriod="weekly"
        onSelectPeriod={vi.fn()}
        selectedGenre="201"
        onSelectGenre={handleGenre}
      />,
    );

    // カクヨム固有ジャンルが存在しないこと
    expect(
      screen.queryByTestId("ranking-genre-fantasy"),
    ).not.toBeInTheDocument();

    // なろう小ジャンルピル（201: ハイファンタジー）が存在し選択されていること
    const highFantasyPill = screen.getByTestId("ranking-genre-201");
    expect(highFantasyPill).toBeInTheDocument();
    expect(highFantasyPill).toHaveTextContent("ハイファンタジー");
    expect(highFantasyPill).toHaveAttribute("aria-pressed", "true");

    // なろう小ジャンルピル（101: 異世界〔恋愛〕）をクリック
    const isekaiLovePill = screen.getByTestId("ranking-genre-101");
    expect(isekaiLovePill).toBeInTheDocument();
    expect(isekaiLovePill).toHaveTextContent("異世界〔恋愛〕");
    await user.click(isekaiLovePill);
    expect(handleGenre).toHaveBeenCalledWith("101");

    // 「総合」ピルをクリック
    const allPill = screen.getByTestId("ranking-genre-all");
    expect(allPill).toBeInTheDocument();
    expect(allPill).toHaveTextContent("総合");
    await user.click(allPill);
    expect(handleGenre).toHaveBeenCalledWith(undefined);
  });

  it("disabled が true のとき、期間ピル・ジャンルピルをクリックしてもコールバックが発火しないこと (AC-RK-02, AC-RK-03, AC-RK-08)", async () => {
    const user = userEvent.setup();
    const handlePeriod = vi.fn();
    const handleGenre = vi.fn();

    render(
      <RankingFilterBar
        selectedSite="narou"
        selectedPeriod="weekly"
        onSelectPeriod={handlePeriod}
        selectedGenre={undefined}
        onSelectGenre={handleGenre}
        disabled={true}
      />,
    );

    const dailyPill = screen.getByTestId("ranking-period-daily");
    await user.click(dailyPill);
    expect(handlePeriod).not.toHaveBeenCalled();

    const highFantasyPill = screen.getByTestId("ranking-genre-201");
    await user.click(highFantasyPill);
    expect(handleGenre).not.toHaveBeenCalled();
  });
});

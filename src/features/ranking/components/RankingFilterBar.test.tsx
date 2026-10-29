import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./RankingFilterBar.stories";
import { RankingFilterBar } from "./RankingFilterBar";

const { Default, Filtered } = composeStories(stories);

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

  it("ジャンルピル押下時に onSelectGenre が呼び出されること (AC-RK-03)", async () => {
    const user = userEvent.setup();
    const handleGenre = vi.fn();

    render(
      <RankingFilterBar
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
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SearchFilterBar.stories";
import { SearchFilterBar } from "./SearchFilterBar";

const { Default, Filtered } = composeStories(stories);

describe("SearchFilterBar コンポーネント", () => {
  it("Default ストーリー: デフォルトの並び順・連載状況・ジャンル（すべて）が選択されていること", () => {
    render(<Default />);

    const orderSelect = screen.getByTestId("search-order-select");
    expect(orderSelect).toHaveValue("weekly_ranking");

    const serialAll = screen.getByTestId("search-serial-all");
    expect(serialAll).toHaveAttribute("aria-pressed", "true");

    const genreAll = screen.getByTestId("search-genre-all");
    expect(genreAll).toHaveAttribute("aria-pressed", "true");
  });

  it("Filtered ストーリー: 累計ランキング順・連載中・ファンタジーが選択されていること", () => {
    render(<Filtered />);

    const orderSelect = screen.getByTestId("search-order-select");
    expect(orderSelect).toHaveValue("popular");

    const serialRunning = screen.getByTestId("search-serial-running");
    expect(serialRunning).toHaveAttribute("aria-pressed", "true");

    const genreFantasy = screen.getByTestId("search-genre-fantasy");
    expect(genreFantasy).toHaveAttribute("aria-pressed", "true");
  });

  it("並び順変更時に onSelectOrder が呼び出されること", async () => {
    const user = userEvent.setup();
    const handleOrder = vi.fn();

    render(
      <SearchFilterBar
        selectedOrder="weekly_ranking"
        onSelectOrder={handleOrder}
        selectedSerialStatus="all"
        onSelectSerialStatus={vi.fn()}
        onSelectGenre={vi.fn()}
      />,
    );

    const orderSelect = screen.getByTestId("search-order-select");
    await user.selectOptions(orderSelect, "last_episode_published_at");

    expect(handleOrder).toHaveBeenCalledWith("last_episode_published_at");
  });

  it("連載状況ピル押下時に onSelectSerialStatus が呼び出されること", async () => {
    const user = userEvent.setup();
    const handleSerial = vi.fn();

    render(
      <SearchFilterBar
        selectedOrder="weekly_ranking"
        onSelectOrder={vi.fn()}
        selectedSerialStatus="all"
        onSelectSerialStatus={handleSerial}
        onSelectGenre={vi.fn()}
      />,
    );

    const completedPill = screen.getByTestId("search-serial-completed");
    await user.click(completedPill);

    expect(handleSerial).toHaveBeenCalledWith("completed");
  });

  it("ジャンルピル押下時に onSelectGenre が呼び出されること", async () => {
    const user = userEvent.setup();
    const handleGenre = vi.fn();

    render(
      <SearchFilterBar
        selectedOrder="weekly_ranking"
        onSelectOrder={vi.fn()}
        selectedSerialStatus="all"
        onSelectSerialStatus={vi.fn()}
        onSelectGenre={handleGenre}
      />,
    );

    const sfPill = screen.getByTestId("search-genre-sf");
    await user.click(sfPill);

    expect(handleGenre).toHaveBeenCalledWith("sf");

    const allPill = screen.getByTestId("search-genre-all");
    await user.click(allPill);

    expect(handleGenre).toHaveBeenCalledWith(undefined);
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SearchFilterBar.stories";
import { SearchFilterBar } from "./SearchFilterBar";

const {
  Default,
  Filtered,
  Disabled,
  NarouGenres,
  MultiGenresSelected,
  NarouMultiGenres,
  ShortStorySelected,
} = composeStories(stories);

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

  it("Disabled ストーリー: disabled が真のとき、並び順セレクタ、連載状態ピル、ジャンルピルが無効化されていること (AC-SE-09)", () => {
    render(<Disabled />);

    const orderSelect = screen.getByTestId("search-order-select");
    expect(orderSelect).toBeDisabled();

    const serialAll = screen.getByTestId("search-serial-all");
    expect(serialAll).toBeDisabled();

    const genreAll = screen.getByTestId("search-genre-all");
    expect(genreAll).toBeDisabled();
  });

  it("NarouGenres ストーリー: 小説家になろうの小ジャンル（ハイファンタジー）が選択表示されること", () => {
    render(<NarouGenres />);

    const highFantasyPill = screen.getByTestId("search-genre-201");
    expect(highFantasyPill).toBeInTheDocument();
    expect(highFantasyPill).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByTestId("search-genre-fantasy"),
    ).not.toBeInTheDocument();
  });

  it("ShortStorySelected ストーリー: 短編ピルが選択状態（aria-pressed=true）で描画されること (AC-SE-04, Issue #265)", () => {
    render(<ShortStorySelected />);
    const shortPill = screen.getByTestId("search-serial-short");
    expect(shortPill).toBeInTheDocument();
    expect(shortPill).toHaveAttribute("aria-pressed", "true");
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

  it("短編ピル（search-serial-short）が描画され、押下時に onSelectSerialStatus('short') が呼び出されること (AC-SE-04, Issue #265)", async () => {
    const user = userEvent.setup();
    const handleSerial = vi.fn();

    render(
      <SearchFilterBar
        selectedOrder="weekly_ranking"
        onSelectOrder={vi.fn()}
        selectedSerialStatus="short"
        onSelectSerialStatus={handleSerial}
        onSelectGenre={vi.fn()}
      />,
    );

    const shortPill = screen.getByTestId("search-serial-short");
    expect(shortPill).toBeInTheDocument();
    expect(shortPill).toHaveTextContent("短編");
    expect(shortPill).toHaveAttribute("aria-pressed", "true");

    await user.click(shortPill);
    expect(handleSerial).toHaveBeenCalledWith("short");
  });

  it("ジャンルピル押下時に onSelectGenre が呼び出されること (カクヨムジャンル)", async () => {
    const user = userEvent.setup();
    const handleGenre = vi.fn();

    render(
      <SearchFilterBar
        selectedSite="kakuyomu"
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

  it("selectedSite='narou' のとき、なろう公式小ジャンルピル（21種）が描画され選択できること (AC-SE-04, AC-SE-10)", async () => {
    const user = userEvent.setup();
    const handleGenre = vi.fn();

    render(
      <SearchFilterBar
        selectedSite="narou"
        selectedOrder="weekly_ranking"
        onSelectOrder={vi.fn()}
        selectedSerialStatus="all"
        onSelectSerialStatus={vi.fn()}
        selectedGenre="201"
        onSelectGenre={handleGenre}
      />,
    );

    // カクヨム固有ジャンルが存在しないこと
    expect(
      screen.queryByTestId("search-genre-fantasy"),
    ).not.toBeInTheDocument();

    // なろう小ジャンルピル（201: ハイファンタジー）が存在し、選択状態であること
    const highFantasyPill = screen.getByTestId("search-genre-201");
    expect(highFantasyPill).toBeInTheDocument();
    expect(highFantasyPill).toHaveTextContent("ハイファンタジー");
    expect(highFantasyPill).toHaveAttribute("aria-pressed", "true");

    // なろう小ジャンルピル（101: 異世界〔恋愛〕）をクリック
    const isekaiLovePill = screen.getByTestId("search-genre-101");
    expect(isekaiLovePill).toBeInTheDocument();
    expect(isekaiLovePill).toHaveTextContent("異世界〔恋愛〕");
    await user.click(isekaiLovePill);
    expect(handleGenre).toHaveBeenCalledWith("101");

    // 「すべて」ピルをクリック
    const allPill = screen.getByTestId("search-genre-all");
    expect(allPill).toBeInTheDocument();
    await user.click(allPill);
    expect(handleGenre).toHaveBeenCalledWith(undefined);
  });

  it("disabled が true のとき、並び順セレクタ、連載状態ピル、ジャンルピルを操作してもコールバックが発火しないこと (AC-SE-09)", async () => {
    const user = userEvent.setup();
    const handleOrder = vi.fn();
    const handleSerial = vi.fn();
    const handleGenre = vi.fn();

    render(
      <SearchFilterBar
        selectedSite="narou"
        selectedOrder="weekly_ranking"
        onSelectOrder={handleOrder}
        selectedSerialStatus="all"
        onSelectSerialStatus={handleSerial}
        selectedGenre={undefined}
        onSelectGenre={handleGenre}
        disabled={true}
      />,
    );

    const orderSelect = screen.getByTestId("search-order-select");
    expect(orderSelect).toBeDisabled();

    const completedPill = screen.getByTestId("search-serial-completed");
    await user.click(completedPill);
    expect(handleSerial).not.toHaveBeenCalled();

    const narouPill = screen.getByTestId("search-genre-201");
    await user.click(narouPill);
    expect(handleGenre).not.toHaveBeenCalled();
  });

  it("MultiGenresSelected ストーリー: カクヨムで複数ジャンルが同時アクティブとなり「すべて」が非アクティブとなること (v0.8 Issue #264 / AC-SE-04, AC-SE-11)", () => {
    render(<MultiGenresSelected />);

    const allPill = screen.getByTestId("search-genre-all");
    expect(allPill).toHaveAttribute("aria-pressed", "false");

    const fantasyPill = screen.getByTestId("search-genre-fantasy");
    expect(fantasyPill).toHaveAttribute("aria-pressed", "true");

    const actionPill = screen.getByTestId("search-genre-action");
    expect(actionPill).toHaveAttribute("aria-pressed", "true");

    const sfPill = screen.getByTestId("search-genre-sf");
    expect(sfPill).toHaveAttribute("aria-pressed", "false");
  });

  it("NarouMultiGenres ストーリー: 小説家になろうで複数小ジャンルが同時アクティブとなること (v0.8 Issue #264 / AC-SE-04, AC-SE-11)", () => {
    render(<NarouMultiGenres />);

    const allPill = screen.getByTestId("search-genre-all");
    expect(allPill).toHaveAttribute("aria-pressed", "false");

    const highFantasyPill = screen.getByTestId("search-genre-201");
    expect(highFantasyPill).toHaveAttribute("aria-pressed", "true");

    const lowFantasyPill = screen.getByTestId("search-genre-202");
    expect(lowFantasyPill).toHaveAttribute("aria-pressed", "true");

    const pureRomancePill = screen.getByTestId("search-genre-102");
    expect(pureRomancePill).toHaveAttribute("aria-pressed", "false");
  });

  it("selectedGenres が空配列の場合、「すべて」ピルがアクティブとなり他は非アクティブとなること", () => {
    render(
      <SearchFilterBar
        selectedOrder="weekly_ranking"
        onSelectOrder={vi.fn()}
        selectedSerialStatus="all"
        onSelectSerialStatus={vi.fn()}
        selectedGenres={[]}
        onSelectGenre={vi.fn()}
      />,
    );

    const allPill = screen.getByTestId("search-genre-all");
    expect(allPill).toHaveAttribute("aria-pressed", "true");

    const fantasyPill = screen.getByTestId("search-genre-fantasy");
    expect(fantasyPill).toHaveAttribute("aria-pressed", "false");
  });
});

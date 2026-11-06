import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SiteSelector.stories";
import { SiteSelector } from "./SiteSelector";

const { Default, NarouSelected, Disabled } = composeStories(stories);

describe("SiteSelector コンポーネント (Search)", () => {
  it("Default ストーリー: カクヨムがアクティブで、なろうも有効（isAvailable: true）であること (AC-SE-01, AC-SE-10)", () => {
    render(<Default />);

    const kakuyomuButton = screen.getByTestId("site-selector-kakuyomu");
    expect(kakuyomuButton).toBeInTheDocument();
    expect(kakuyomuButton).toHaveAttribute("aria-pressed", "true");
    expect(kakuyomuButton).toHaveTextContent("カクヨム");
    expect(kakuyomuButton).toBeEnabled();

    const narouButton = screen.getByTestId("site-selector-narou");
    expect(narouButton).toBeInTheDocument();
    expect(narouButton).toHaveAttribute("aria-pressed", "false");
    expect(narouButton).toBeEnabled();
    expect(narouButton).toHaveTextContent("小説家になろう");
    expect(narouButton).not.toHaveTextContent("準備中");
  });

  it("NarouSelected ストーリー: なろうが選択された状態でも適切にレンダリングされること", () => {
    render(<NarouSelected />);

    const kakuyomuButton = screen.getByTestId("site-selector-kakuyomu");
    expect(kakuyomuButton).toHaveAttribute("aria-pressed", "false");

    const narouButton = screen.getByTestId("site-selector-narou");
    expect(narouButton).toHaveAttribute("aria-pressed", "true");
  });

  it("Disabled ストーリー: disabled が真のとき、全ボタンが無効化されていること (AC-SE-09)", () => {
    render(<Disabled />);

    const kakuyomuBtn = screen.getByTestId("site-selector-kakuyomu");
    expect(kakuyomuBtn).toBeDisabled();

    const narouBtn = screen.getByTestId("site-selector-narou");
    expect(narouBtn).toBeDisabled();
  });

  it("カクヨムボタンをクリックしたときに onSelectSite が呼び出されること", async () => {
    const user = userEvent.setup();
    const handleSelectSite = vi.fn();

    render(
      <SiteSelector selectedSite="narou" onSelectSite={handleSelectSite} />,
    );

    const kakuyomuButton = screen.getByTestId("site-selector-kakuyomu");
    await user.click(kakuyomuButton);

    expect(handleSelectSite).toHaveBeenCalledWith("kakuyomu");
  });

  it("なろうボタンをクリックしたときに onSelectSite が呼び出されること (AC-SE-10)", async () => {
    const user = userEvent.setup();
    const handleSelectSite = vi.fn();

    render(
      <SiteSelector selectedSite="kakuyomu" onSelectSite={handleSelectSite} />,
    );

    const narouButton = screen.getByTestId("site-selector-narou");
    await user.click(narouButton);

    expect(handleSelectSite).toHaveBeenCalledWith("narou");
  });

  it("disabled が true のとき、ボタンをクリックしても onSelectSite が呼ばれないこと (AC-SE-09)", async () => {
    const user = userEvent.setup();
    const handleSelectSite = vi.fn();

    render(
      <SiteSelector
        selectedSite="narou"
        onSelectSite={handleSelectSite}
        disabled={true}
      />,
    );

    const kakuyomuBtn = screen.getByTestId("site-selector-kakuyomu");
    await user.click(kakuyomuBtn);

    const narouBtn = screen.getByTestId("site-selector-narou");
    await user.click(narouBtn);

    expect(handleSelectSite).not.toHaveBeenCalled();
  });
});

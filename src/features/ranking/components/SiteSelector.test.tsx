import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SiteSelector.stories";
import { SiteSelector } from "./SiteSelector";

const { Default, NarouSelected } = composeStories(stories);

describe("SiteSelector コンポーネント (Ranking)", () => {
  it("Default ストーリー: カクヨムがアクティブでなろうが非活性（準備中）であること", () => {
    render(<Default />);

    const kakuyomuBtn = screen.getByTestId("site-selector-kakuyomu");
    expect(kakuyomuBtn).toBeInTheDocument();
    expect(kakuyomuBtn).toHaveAttribute("aria-pressed", "true");
    expect(kakuyomuBtn).toBeEnabled();

    const narouBtn = screen.getByTestId("site-selector-narou");
    expect(narouBtn).toBeInTheDocument();
    expect(narouBtn).toHaveAttribute("aria-pressed", "false");
    expect(narouBtn).toBeDisabled();
    expect(narouBtn).toHaveTextContent("小説家になろう (準備中)");
  });

  it("NarouSelected ストーリー: narou 選択中状態のスタイル属性が反映されること", () => {
    render(<NarouSelected />);

    const narouBtn = screen.getByTestId("site-selector-narou");
    expect(narouBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("利用可能なサイトボタンをクリックした際に onSelectSite が呼ばれること", async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(<SiteSelector selectedSite="narou" onSelectSite={handleSelect} />);

    const kakuyomuBtn = screen.getByTestId("site-selector-kakuyomu");
    await user.click(kakuyomuBtn);

    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith("kakuyomu");
  });

  it("非活性（準備中）のサイトボタンをクリックしても onSelectSite が呼ばれないこと", async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(
      <SiteSelector selectedSite="kakuyomu" onSelectSite={handleSelect} />,
    );

    const narouBtn = screen.getByTestId("site-selector-narou");
    await user.click(narouBtn);

    expect(handleSelect).not.toHaveBeenCalled();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SiteSelector.stories";
import { SiteSelector } from "./SiteSelector";

const { Default, NarouSelected } = composeStories(stories);

describe("SiteSelector コンポーネント", () => {
  it("Default ストーリー: カクヨムがアクティブな状態でレンダリングされること", () => {
    render(<Default />);

    const kakuyomuButton = screen.getByTestId("site-selector-kakuyomu");
    expect(kakuyomuButton).toBeInTheDocument();
    expect(kakuyomuButton).toHaveAttribute("aria-pressed", "true");
    expect(kakuyomuButton).toHaveTextContent("カクヨム");

    const narouButton = screen.getByTestId("site-selector-narou");
    expect(narouButton).toBeInTheDocument();
    expect(narouButton).toBeDisabled();
  });

  it("NarouSelected ストーリー: なろうが選択された状態でも適切にレンダリングされること", () => {
    render(<NarouSelected />);

    const kakuyomuButton = screen.getByTestId("site-selector-kakuyomu");
    expect(kakuyomuButton).toHaveAttribute("aria-pressed", "false");
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
});

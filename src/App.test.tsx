import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { composeStories } from "@storybook/react";
import * as stories from "./App.stories";
import { App } from "./App";

const { Default, Vertical } = composeStories(stories);

describe("App コンポーネント", () => {
  it("デフォルト状態で横書き表示とタイトルを描画する", () => {
    render(<Default />);

    expect(screen.getByTestId("app-title")).toHaveTextContent("Yommy");
    const toggleButton = screen.getByTestId("toggle-orientation");
    expect(toggleButton).toHaveTextContent("縦書き表示に切替");

    const preview = screen.getByTestId("novel-preview");
    expect(preview).toHaveClass("writing-horizontal-tb");
  });

  it("表示切替ボタンをクリックすると縦書き表示に切り替わり、再度クリックで横書きに戻る", () => {
    render(<Default />);

    const toggleButton = screen.getByTestId("toggle-orientation");
    const preview = screen.getByTestId("novel-preview");

    // 縦書きへ切り替え
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveTextContent("横書き表示に切替");
    expect(preview).toHaveClass("writing-vertical-rl");

    // 横書きへ戻す
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveTextContent("縦書き表示に切替");
    expect(preview).toHaveClass("writing-horizontal-tb");
  });

  it("縦書きモードの Story で初期縦書き表示を正しく描画する", () => {
    render(<Vertical />);

    expect(screen.getByTestId("app-title")).toHaveTextContent("Yommy - 縦書き");
    const toggleButton = screen.getByTestId("toggle-orientation");
    expect(toggleButton).toHaveTextContent("横書き表示に切替");

    const preview = screen.getByTestId("novel-preview");
    expect(preview).toHaveClass("writing-vertical-rl");
  });

  it("Props 未指定時にデフォルト値で描画される", () => {
    render(<App />);

    expect(screen.getByTestId("app-title")).toHaveTextContent("Yommy");
    expect(screen.getByTestId("toggle-orientation")).toHaveTextContent(
      "縦書き表示に切替",
    );
  });
});

import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { composeStories } from "@storybook/react";
import * as stories from "./App.stories";
import { App } from "./App";

const { Default, CustomTitle } = composeStories(stories);

describe("App コンポーネント", () => {
  it("デフォルト状態で Yommy ヘッダータイトルとリーダーUI（未登録状態）を描画する", async () => {
    render(<Default />);

    expect(screen.getByTestId("app-title")).toHaveTextContent("Yommy");
    await waitFor(() => {
      expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();
      expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
    });
  });

  it("カスタムタイトルが指定された場合にそのタイトルを描画する", async () => {
    render(<CustomTitle />);

    expect(screen.getByTestId("app-title")).toHaveTextContent(
      "Yommy Web Novel Reader",
    );
    await waitFor(() => {
      expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();
    });
  });

  it("Props 未指定時にデフォルト値で描画される", async () => {
    render(<App />);

    expect(screen.getByTestId("app-title")).toHaveTextContent("Yommy");
    await waitFor(() => {
      expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();
    });
  });
});

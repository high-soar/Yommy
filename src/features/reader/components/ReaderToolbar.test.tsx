import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./ReaderToolbar.stories";
import { ReaderToolbar } from "./ReaderToolbar";

const { Default, HorizontalSepia, Loading } = composeStories(stories);

describe("ReaderToolbar", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Default ストーリーで縦書き用ラベルと白テーマ選択状態が表示されること", () => {
      render(<Default />);
      expect(screen.getByTestId("toggle-orientation")).toHaveTextContent(
        "横書き表示に切替",
      );
      expect(screen.getByTestId("theme-light")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByTestId("fetch-novel-button")).not.toBeDisabled();
    });

    it("HorizontalSepia ストーリーで横書き用ラベルとセピアテーマ選択状態が表示されること", () => {
      render(<HorizontalSepia />);
      expect(screen.getByTestId("toggle-orientation")).toHaveTextContent(
        "縦書き表示に切替",
      );
      expect(screen.getByTestId("theme-sepia")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    it("Loading ストーリーで取得ボタンが無効化されローディング表示になること", () => {
      render(<Loading />);
      const fetchButton = screen.getByTestId("fetch-novel-button");
      expect(fetchButton).toBeDisabled();
      expect(fetchButton).toHaveTextContent("取得中...");
    });
  });

  describe("ユーザーインタラクションの検証", () => {
    it("縦横切替ボタンをクリックしたときに onToggleWritingMode が呼び出されること", async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      render(
        <ReaderToolbar
          writingMode="vertical-rl"
          theme="light"
          onToggleWritingMode={onToggle}
          onChangeTheme={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("toggle-orientation"));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("各テーマボタンをクリックしたときに onChangeTheme が対応するテーマで呼び出されること", async () => {
      const user = userEvent.setup();
      const onChangeTheme = vi.fn();
      render(
        <ReaderToolbar
          writingMode="vertical-rl"
          theme="light"
          onToggleWritingMode={vi.fn()}
          onChangeTheme={onChangeTheme}
        />,
      );

      await user.click(screen.getByTestId("theme-sepia"));
      expect(onChangeTheme).toHaveBeenCalledWith("sepia");

      await user.click(screen.getByTestId("theme-dark"));
      expect(onChangeTheme).toHaveBeenCalledWith("dark");

      await user.click(screen.getByTestId("theme-black"));
      expect(onChangeTheme).toHaveBeenCalledWith("black");

      await user.click(screen.getByTestId("theme-light"));
      expect(onChangeTheme).toHaveBeenCalledWith("light");
    });

    it("作品取得ボタンをクリックしたときに onFetchNovel が呼び出されること", async () => {
      const user = userEvent.setup();
      const onFetch = vi.fn();
      render(
        <ReaderToolbar
          writingMode="vertical-rl"
          theme="light"
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onFetchNovel={onFetch}
        />,
      );

      await user.click(screen.getByTestId("fetch-novel-button"));
      expect(onFetch).toHaveBeenCalledTimes(1);
    });
  });
});

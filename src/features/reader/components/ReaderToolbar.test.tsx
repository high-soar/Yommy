import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./ReaderToolbar.stories";
import { ReaderToolbar } from "./ReaderToolbar";

const {
  Default,
  WithNavigation,
  HorizontalSepia,
  MinFontSizeAndLineHeight,
  MaxFontSizeAndLineHeight,
  Loading,
} = composeStories(stories);

describe("ReaderToolbar", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Default ストーリーで縦書き用ラベル、白テーマ選択状態、文字サイズ18px、行間1.8が表示されること", () => {
      render(<Default />);
      expect(screen.getByTestId("reader-toolbar")).toBeInTheDocument();
      expect(screen.getByTestId("toggle-orientation")).toHaveTextContent(
        "横書き表示に切替",
      );
      expect(screen.getByTestId("theme-light")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByTestId("font-size-value")).toHaveTextContent("18px");
      expect(screen.getByTestId("line-height-value")).toHaveTextContent("1.8");
      expect(
        screen.queryByTestId("reader-back-to-detail"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("reader-back-to-bookshelf"),
      ).not.toBeInTheDocument();
    });

    it("WithNavigation ストーリーで戻るボタンが表示されること", () => {
      render(<WithNavigation />);
      expect(screen.getByTestId("reader-back-to-detail")).toBeInTheDocument();
      expect(
        screen.getByTestId("reader-back-to-bookshelf"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("fetch-novel-button")).not.toBeDisabled();
    });

    it("HorizontalSepia ストーリーで横書き用ラベル、セピアテーマ、文字サイズ20px、行間2.0が表示されること", () => {
      render(<HorizontalSepia />);
      expect(screen.getByTestId("toggle-orientation")).toHaveTextContent(
        "縦書き表示に切替",
      );
      expect(screen.getByTestId("theme-sepia")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByTestId("font-size-value")).toHaveTextContent("20px");
      expect(screen.getByTestId("line-height-value")).toHaveTextContent("2.0");
    });

    it("MinFontSizeAndLineHeight ストーリーで下限（12px / 1.4）の縮小ボタンが無効化されること", () => {
      render(<MinFontSizeAndLineHeight />);
      expect(screen.getByTestId("font-size-decrease")).toBeDisabled();
      expect(screen.getByTestId("font-size-increase")).not.toBeDisabled();
      expect(screen.getByTestId("line-height-decrease")).toBeDisabled();
      expect(screen.getByTestId("line-height-increase")).not.toBeDisabled();
    });

    it("MaxFontSizeAndLineHeight ストーリーで上限（32px / 2.4）の拡大ボタンが無効化されること", () => {
      render(<MaxFontSizeAndLineHeight />);
      expect(screen.getByTestId("font-size-decrease")).not.toBeDisabled();
      expect(screen.getByTestId("font-size-increase")).toBeDisabled();
      expect(screen.getByTestId("line-height-decrease")).not.toBeDisabled();
      expect(screen.getByTestId("line-height-increase")).toBeDisabled();
    });

    it("Loading ストーリーで取得ボタンが無効化されローディング表示になること", () => {
      render(<Loading />);
      const fetchButton = screen.getByTestId("fetch-novel-button");
      expect(fetchButton).toBeDisabled();
      expect(fetchButton).toHaveTextContent("取得中...");
    });
  });

  describe("ユーザーインタラクションおよび境界値の検証", () => {
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

    it("文字サイズ変更ボタン（− / ＋）を押下したときに ±2px で onChangeFontSize が呼び出されること", async () => {
      const user = userEvent.setup();
      const onChangeFontSize = vi.fn();
      render(
        <ReaderToolbar
          writingMode="vertical-rl"
          theme="light"
          fontSizePx={18}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={onChangeFontSize}
        />,
      );

      await user.click(screen.getByTestId("font-size-decrease"));
      expect(onChangeFontSize).toHaveBeenCalledWith(16);

      await user.click(screen.getByTestId("font-size-increase"));
      expect(onChangeFontSize).toHaveBeenCalledWith(20);
    });

    it("文字サイズの下限（12px）および上限（32px）でクランプ制御されること", async () => {
      const user = userEvent.setup();
      const onChangeFontSize = vi.fn();
      const { rerender } = render(
        <ReaderToolbar
          writingMode="vertical-rl"
          theme="light"
          fontSizePx={13}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={onChangeFontSize}
        />,
      );

      await user.click(screen.getByTestId("font-size-decrease"));
      expect(onChangeFontSize).toHaveBeenCalledWith(12);

      rerender(
        <ReaderToolbar
          writingMode="vertical-rl"
          theme="light"
          fontSizePx={31}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={onChangeFontSize}
        />,
      );

      await user.click(screen.getByTestId("font-size-increase"));
      expect(onChangeFontSize).toHaveBeenCalledWith(32);
    });

    it("行間変更ボタン（− / ＋）を押下したときに ±0.2 で onChangeLineHeight が呼び出されること", async () => {
      const user = userEvent.setup();
      const onChangeLineHeight = vi.fn();
      render(
        <ReaderToolbar
          writingMode="vertical-rl"
          theme="light"
          lineHeight={1.8}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeLineHeight={onChangeLineHeight}
        />,
      );

      await user.click(screen.getByTestId("line-height-decrease"));
      expect(onChangeLineHeight).toHaveBeenCalledWith(1.6);

      await user.click(screen.getByTestId("line-height-increase"));
      expect(onChangeLineHeight).toHaveBeenCalledWith(2.0);
    });

    it("行間の下限（1.4）および上限（2.4）でクランプ制御されること", async () => {
      const user = userEvent.setup();
      const onChangeLineHeight = vi.fn();
      const { rerender } = render(
        <ReaderToolbar
          writingMode="vertical-rl"
          theme="light"
          lineHeight={1.5}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeLineHeight={onChangeLineHeight}
        />,
      );

      await user.click(screen.getByTestId("line-height-decrease"));
      expect(onChangeLineHeight).toHaveBeenCalledWith(1.4);

      rerender(
        <ReaderToolbar
          writingMode="vertical-rl"
          theme="light"
          lineHeight={2.3}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeLineHeight={onChangeLineHeight}
        />,
      );

      await user.click(screen.getByTestId("line-height-increase"));
      expect(onChangeLineHeight).toHaveBeenCalledWith(2.4);
    });

    it("戻る導線（onBackToDetail / onBackToBookshelf）をクリックしたときにコールバックが呼び出されること", async () => {
      const user = userEvent.setup();
      const onBackToDetail = vi.fn();
      const onBackToBookshelf = vi.fn();
      render(
        <ReaderToolbar
          writingMode="vertical-rl"
          theme="light"
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onBackToDetail={onBackToDetail}
          onBackToBookshelf={onBackToBookshelf}
        />,
      );

      await user.click(screen.getByTestId("reader-back-to-detail"));
      expect(onBackToDetail).toHaveBeenCalledTimes(1);

      await user.click(screen.getByTestId("reader-back-to-bookshelf"));
      expect(onBackToBookshelf).toHaveBeenCalledTimes(1);
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

    it("オプショナルなコールバック（onChangeFontSize / onChangeLineHeight）が未指定でもクリック時にクラッシュしないこと", async () => {
      const user = userEvent.setup();
      render(
        <ReaderToolbar
          writingMode="vertical-rl"
          theme="light"
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("font-size-increase"));
      await user.click(screen.getByTestId("font-size-decrease"));
      await user.click(screen.getByTestId("line-height-increase"));
      await user.click(screen.getByTestId("line-height-decrease"));
    });
  });
});

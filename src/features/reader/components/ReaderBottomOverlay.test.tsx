import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./ReaderBottomOverlay.stories";
import { ReaderBottomOverlay } from "./ReaderBottomOverlay";

const {
  Default,
  Closed,
  FirstChapter,
  LastChapter,
  Loading,
  SearchTabActive,
  RankingTabActive,
  SettingsTabActive,
} = composeStories(stories);

describe("ReaderBottomOverlay", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Default ストーリーでオーバーレイが展開表示され、第2話インジケーターと4タブが表示されること", () => {
      render(<Default />);
      const overlay = screen.getByTestId("reader-bottom-overlay");
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveAttribute("aria-hidden", "false");
      expect(overlay).toHaveClass("translate-y-0");
      expect(overlay).not.toHaveClass("translate-y-full");

      // ReaderChapterNav
      expect(screen.getByTestId("reader-chapter-nav")).toBeInTheDocument();
      expect(screen.getByTestId("reader-chapter-indicator")).toHaveTextContent(
        "第 2 話 / 全 5 話",
      );
      expect(screen.getByTestId("reader-prev-chapter")).not.toBeDisabled();
      expect(screen.getByTestId("reader-next-chapter")).not.toBeDisabled();

      // 下部タブ (4タブ)
      const tabs = screen.getByTestId("reader-bottom-tabs");
      expect(tabs).toHaveClass("grid-cols-4");

      const bookshelfTab = screen.getByTestId("reader-bottom-tab-bookshelf");
      const searchTab = screen.getByTestId("reader-bottom-tab-search");
      const rankingTab = screen.getByTestId("reader-bottom-tab-ranking");
      const settingsTab = screen.getByTestId("reader-bottom-tab-settings");

      expect(bookshelfTab).toBeInTheDocument();
      expect(bookshelfTab).toHaveAttribute("role", "tab");
      expect(bookshelfTab).toHaveAttribute("aria-selected", "true");

      expect(searchTab).toBeInTheDocument();
      expect(searchTab).toHaveAttribute("role", "tab");
      expect(searchTab).toHaveAttribute("aria-selected", "false");

      expect(rankingTab).toBeInTheDocument();
      expect(rankingTab).toHaveAttribute("role", "tab");
      expect(rankingTab).toHaveAttribute("aria-selected", "false");

      expect(settingsTab).toBeInTheDocument();
      expect(settingsTab).toHaveAttribute("role", "tab");
      expect(settingsTab).toHaveAttribute("aria-selected", "false");
    });

    it("Closed ストーリーでオーバーレイが非表示スタイル（translate-y-full pointer-events-none）かつ aria-hidden=true となること", () => {
      render(<Closed />);
      const overlay = screen.getByTestId("reader-bottom-overlay");
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveAttribute("aria-hidden", "true");
      expect(overlay).toHaveClass("translate-y-full");
      expect(overlay).toHaveClass("pointer-events-none");
      expect(overlay).not.toHaveClass("translate-y-0");
    });

    it("FirstChapter ストーリーで第1話では前の話へボタンが無効化されること", () => {
      render(<FirstChapter />);
      expect(screen.getByTestId("reader-chapter-indicator")).toHaveTextContent(
        "第 1 話 / 全 5 話",
      );
      expect(screen.getByTestId("reader-prev-chapter")).toBeDisabled();
      expect(screen.getByTestId("reader-next-chapter")).not.toBeDisabled();
    });

    it("LastChapter ストーリーで最終話では次の話へボタンが無効化されること", () => {
      render(<LastChapter />);
      expect(screen.getByTestId("reader-chapter-indicator")).toHaveTextContent(
        "第 5 話 / 全 5 話",
      );
      expect(screen.getByTestId("reader-prev-chapter")).not.toBeDisabled();
      expect(screen.getByTestId("reader-next-chapter")).toBeDisabled();
    });

    it("Loading ストーリーで通信中は前後話ボタンが両方無効化されること", () => {
      render(<Loading />);
      expect(screen.getByTestId("reader-prev-chapter")).toBeDisabled();
      expect(screen.getByTestId("reader-next-chapter")).toBeDisabled();
    });

    it("SearchTabActive ストーリーで検索タブが aria-selected=true となること", () => {
      render(<SearchTabActive />);
      expect(screen.getByTestId("reader-bottom-tab-search")).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByTestId("reader-bottom-tab-bookshelf")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByTestId("reader-bottom-tab-ranking")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByTestId("reader-bottom-tab-settings")).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });

    it("RankingTabActive ストーリーでランキングタブが aria-selected=true となること", () => {
      render(<RankingTabActive />);
      expect(screen.getByTestId("reader-bottom-tab-ranking")).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByTestId("reader-bottom-tab-bookshelf")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByTestId("reader-bottom-tab-search")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByTestId("reader-bottom-tab-settings")).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });

    it("SettingsTabActive ストーリーで設定タブが aria-selected=true となること", () => {
      render(<SettingsTabActive />);
      const bookshelfTab = screen.getByTestId("reader-bottom-tab-bookshelf");
      const settingsTab = screen.getByTestId("reader-bottom-tab-settings");
      expect(bookshelfTab).toHaveAttribute("aria-selected", "false");
      expect(settingsTab).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("ユーザーインタラクションおよびコールバックの検証", () => {
    it("活性時の「前の話へ」ボタン押下で onPrevChapter が呼び出されること", async () => {
      const user = userEvent.setup();
      const onPrev = vi.fn();
      render(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={2}
          totalChapters={5}
          onPrevChapter={onPrev}
          onNextChapter={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("reader-prev-chapter"));
      expect(onPrev).toHaveBeenCalledTimes(1);
    });

    it("活性時の「次の話へ」ボタン押下で onNextChapter が呼び出されること", async () => {
      const user = userEvent.setup();
      const onNext = vi.fn();
      render(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={2}
          totalChapters={5}
          onPrevChapter={vi.fn()}
          onNextChapter={onNext}
        />,
      );

      await user.click(screen.getByTestId("reader-next-chapter"));
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("「本棚」タブボタン押下で onSelectTab('bookshelf') が呼び出されること", async () => {
      const user = userEvent.setup();
      const onSelectTab = vi.fn();
      render(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={2}
          totalChapters={5}
          activeTab="settings"
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
          onSelectTab={onSelectTab}
        />,
      );

      await user.click(screen.getByTestId("reader-bottom-tab-bookshelf"));
      expect(onSelectTab).toHaveBeenCalledWith("bookshelf");
    });

    it("「検索」タブボタン押下で onSelectTab('search') が呼び出されること", async () => {
      const user = userEvent.setup();
      const onSelectTab = vi.fn();
      render(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={2}
          totalChapters={5}
          activeTab="bookshelf"
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
          onSelectTab={onSelectTab}
        />,
      );

      await user.click(screen.getByTestId("reader-bottom-tab-search"));
      expect(onSelectTab).toHaveBeenCalledWith("search");
    });

    it("「ランキング」タブボタン押下で onSelectTab('ranking') が呼び出されること", async () => {
      const user = userEvent.setup();
      const onSelectTab = vi.fn();
      render(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={2}
          totalChapters={5}
          activeTab="bookshelf"
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
          onSelectTab={onSelectTab}
        />,
      );

      await user.click(screen.getByTestId("reader-bottom-tab-ranking"));
      expect(onSelectTab).toHaveBeenCalledWith("ranking");
    });

    it("「設定」タブボタン押下で onSelectTab('settings') が呼び出されること", async () => {
      const user = userEvent.setup();
      const onSelectTab = vi.fn();
      render(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={2}
          totalChapters={5}
          activeTab="bookshelf"
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
          onSelectTab={onSelectTab}
        />,
      );

      await user.click(screen.getByTestId("reader-bottom-tab-settings"));
      expect(onSelectTab).toHaveBeenCalledWith("settings");
    });

    it("onSelectTab が未指定の場合にタブボタンを押下しても例外が発生しないこと", async () => {
      const user = userEvent.setup();
      render(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={2}
          totalChapters={5}
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
        />,
      );

      await expect(
        user.click(screen.getByTestId("reader-bottom-tab-bookshelf")),
      ).resolves.not.toThrow();
      await expect(
        user.click(screen.getByTestId("reader-bottom-tab-settings")),
      ).resolves.not.toThrow();
    });

    it("onClose が指定されている場合に閉じるボタンが表示され、クリックで呼び出されること", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={2}
          totalChapters={5}
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
          onClose={onClose}
        />,
      );

      const closeButton = screen.getByTestId("reader-bottom-overlay-close");
      expect(closeButton).toBeInTheDocument();
      await user.click(closeButton);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("onClose が未指定の場合に閉じるボタンが表示されないこと", () => {
      render(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={2}
          totalChapters={5}
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
        />,
      );

      expect(
        screen.queryByTestId("reader-bottom-overlay-close"),
      ).not.toBeInTheDocument();
    });
  });
});

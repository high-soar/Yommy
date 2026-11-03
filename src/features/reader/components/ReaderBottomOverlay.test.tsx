import { render, screen, fireEvent } from "@testing-library/react";
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
  PagedWithSeekbar,
  PagedSinglePage,
  PagedLoading,
  ScrollMode,
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

      // 連続スクロール（既定）時はシークバー領域が非表示であること
      expect(
        screen.queryByTestId("reader-page-seekbar-section"),
      ).not.toBeInTheDocument();

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
      expect(screen.getByTestId("reader-bottom-overlay")).toHaveAttribute(
        "data-active-tab",
        "search",
      );
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

    it("PagedWithSeekbar ストーリーでページシークバー領域・RTLスライダー・ページラベルが表示されること (AC-RD-25)", () => {
      render(<PagedWithSeekbar />);
      const seekbarSection = screen.getByTestId("reader-page-seekbar-section");
      expect(seekbarSection).toBeInTheDocument();

      const seekbar = screen.getByTestId("reader-page-seekbar");
      expect(seekbar).toBeInTheDocument();
      expect(seekbar).toHaveAttribute("dir", "rtl");
      expect(seekbar).toHaveAttribute("min", "1");
      expect(seekbar).toHaveAttribute("max", "5");
      expect(seekbar).toHaveValue("2");
      expect(seekbar).not.toBeDisabled();

      const label = screen.getByTestId("reader-page-seekbar-label");
      expect(label).toBeInTheDocument();
      expect(label).toHaveTextContent("2 / 5 ページ");
    });

    it("PagedSinglePage ストーリーで単一ページ（totalPages=1）時にシークバーが無効化されること (AC-RD-25)", () => {
      render(<PagedSinglePage />);
      const seekbarSection = screen.getByTestId("reader-page-seekbar-section");
      expect(seekbarSection).toBeInTheDocument();

      const seekbar = screen.getByTestId("reader-page-seekbar");
      expect(seekbar).toBeInTheDocument();
      expect(seekbar).toBeDisabled();
      expect(seekbar).toHaveAttribute("min", "1");
      expect(seekbar).toHaveAttribute("max", "1");
      expect(seekbar).toHaveValue("1");

      const label = screen.getByTestId("reader-page-seekbar-label");
      expect(label).toBeInTheDocument();
      expect(label).toHaveTextContent("1 / 1 ページ");
    });

    it("PagedLoading ストーリーで通信中にシークバーおよび前後話ボタンが無効化されること (AC-RD-25)", () => {
      render(<PagedLoading />);
      const seekbarSection = screen.getByTestId("reader-page-seekbar-section");
      expect(seekbarSection).toBeInTheDocument();

      const seekbar = screen.getByTestId("reader-page-seekbar");
      expect(seekbar).toBeInTheDocument();
      expect(seekbar).toBeDisabled();

      expect(screen.getByTestId("reader-prev-chapter")).toBeDisabled();
      expect(screen.getByTestId("reader-next-chapter")).toBeDisabled();
    });

    it("ScrollMode ストーリーで連続スクロール時はシークバー領域が描画されないこと (AC-RD-25)", () => {
      render(<ScrollMode />);
      expect(
        screen.queryByTestId("reader-page-seekbar-section"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("reader-page-seekbar"),
      ).not.toBeInTheDocument();
    });
  });

  describe("RTL ページシークバーの検証（AC-RD-25）", () => {
    it("effectivePagingMode === 'paged' かつ totalPages > 1 のときシークバー領域と RTL スライダーが正常描画されること", () => {
      render(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={1}
          totalChapters={3}
          effectivePagingMode="paged"
          currentPage={3}
          totalPages={10}
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
        />,
      );

      const section = screen.getByTestId("reader-page-seekbar-section");
      expect(section).toBeInTheDocument();

      const seekbar = screen.getByTestId("reader-page-seekbar");
      expect(seekbar).toBeInTheDocument();
      expect(seekbar).toHaveAttribute("dir", "rtl");
      expect(seekbar).toHaveAttribute("min", "1");
      expect(seekbar).toHaveAttribute("max", "10");
      expect(seekbar).toHaveValue("3");
      expect(seekbar).not.toBeDisabled();

      const label = screen.getByTestId("reader-page-seekbar-label");
      expect(label).toBeInTheDocument();
      expect(label).toHaveTextContent("3 / 10 ページ");
    });

    it("スライダー操作（change イベント）で onPageChange コールバックへ数値化されたページ番号が通知されること", () => {
      const onPageChange = vi.fn();
      render(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={1}
          totalChapters={3}
          effectivePagingMode="paged"
          currentPage={2}
          totalPages={8}
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
          onPageChange={onPageChange}
        />,
      );

      const seekbar = screen.getByTestId("reader-page-seekbar");
      fireEvent.change(seekbar, { target: { value: "6" } });

      expect(onPageChange).toHaveBeenCalledTimes(1);
      expect(onPageChange).toHaveBeenCalledWith(6);
    });

    it("onPageChange が未指定の場合にスライダーを操作しても例外が発生しないこと", () => {
      render(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={1}
          totalChapters={3}
          effectivePagingMode="paged"
          currentPage={2}
          totalPages={8}
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
        />,
      );

      const seekbar = screen.getByTestId("reader-page-seekbar");
      expect(() => {
        fireEvent.change(seekbar, { target: { value: "4" } });
      }).not.toThrow();
    });

    it("effectivePagingMode === 'scroll' または未指定のときはシークバー領域が描画されないこと", () => {
      const { rerender } = render(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={1}
          totalChapters={3}
          effectivePagingMode="scroll"
          currentPage={2}
          totalPages={8}
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
        />,
      );

      expect(
        screen.queryByTestId("reader-page-seekbar-section"),
      ).not.toBeInTheDocument();

      rerender(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={1}
          totalChapters={3}
          currentPage={2}
          totalPages={8}
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
        />,
      );

      expect(
        screen.queryByTestId("reader-page-seekbar-section"),
      ).not.toBeInTheDocument();
    });

    it("totalPages <= 1 のときはスライダーが無効化（disabled）されること", () => {
      const { rerender } = render(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={1}
          totalChapters={3}
          effectivePagingMode="paged"
          currentPage={1}
          totalPages={1}
          isLoading={false}
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
        />,
      );

      expect(screen.getByTestId("reader-page-seekbar")).toBeDisabled();

      rerender(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={1}
          totalChapters={3}
          effectivePagingMode="paged"
          currentPage={1}
          totalPages={0}
          isLoading={false}
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
        />,
      );

      expect(screen.getByTestId("reader-page-seekbar")).toBeDisabled();
    });

    it("isLoading === true のときは totalPages > 1 であってもスライダーが無効化（disabled）されること", () => {
      render(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={1}
          totalChapters={3}
          effectivePagingMode="paged"
          currentPage={2}
          totalPages={5}
          isLoading={true}
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
        />,
      );

      expect(screen.getByTestId("reader-page-seekbar")).toBeDisabled();
    });

    it("currentPage および totalPages が省略された場合に既定値 1 が適用されること", () => {
      render(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={1}
          totalChapters={3}
          effectivePagingMode="paged"
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
        />,
      );

      const seekbar = screen.getByTestId("reader-page-seekbar");
      expect(seekbar).toHaveAttribute("min", "1");
      expect(seekbar).toHaveAttribute("max", "1");
      expect(seekbar).toHaveValue("1");
      expect(seekbar).toBeDisabled();

      const label = screen.getByTestId("reader-page-seekbar-label");
      expect(label).toHaveTextContent("1 / 1 ページ");
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

    it("閉じるボタン（✕）は描画されず、本文タップ非表示に一本化されていること", () => {
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

    it("下部タブの各ボタンがスマホ幅での改行を防止するスタイル（whitespace-nowrap, flex-col sm:flex-row）を持つこと", () => {
      render(
        <ReaderBottomOverlay
          isOpen={true}
          chapterIndex={2}
          totalChapters={5}
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
        />,
      );

      const tabIds = [
        "reader-bottom-tab-bookshelf",
        "reader-bottom-tab-search",
        "reader-bottom-tab-ranking",
        "reader-bottom-tab-settings",
      ];

      for (const tabId of tabIds) {
        const tab = screen.getByTestId(tabId);
        expect(tab).toHaveClass("whitespace-nowrap");
        expect(tab).toHaveClass("flex-col");
        expect(tab).toHaveClass("sm:flex-row");
      }
    });
  });
});

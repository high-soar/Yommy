import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./ReaderPage.stories";
import { ReaderPage, type ReaderPageProps } from "./ReaderPage";
import type { NovelRecord, ChapterRecord } from "../../../storage/types";

const { Default, HorizontalSepia, Loading, ErrorState, Empty, WithNavigation } =
  composeStories(stories);

const sampleNovel: NovelRecord = {
  id: "kakuyomu:16817330658027210412",
  siteType: "kakuyomu",
  remoteWorkId: "16817330658027210412",
  canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
  title: "境界迷宮と異界の魔術師",
  author: "小野崎",
  synopsis: "異界から迷い込んだ青年が紡ぐファンタジー戦記。",
  totalChapters: 3,
  cachedChapters: 2,
  totalByteSize: 10240,
  bookmarkChapterIndex: 1,
  bookmarkScrollProgress: 0,
  isFavorite: false,
  lastCheckedAt: null,
  lastReadAt: null,
  createdAt: "2026-10-25T10:00:00Z",
  updatedAt: "2026-10-26T07:00:00Z",
};

const sampleChapter: ChapterRecord = {
  id: "kakuyomu:16817330658027210412:1",
  novelId: "kakuyomu:16817330658027210412",
  chapterIndex: 1,
  remoteChapterId: "1",
  partTitle: "第一部 旅立ち",
  title: "第1話 見知らぬ空",
  url: "https://kakuyomu.jp/works/16817330658027210412/episodes/1",
  bodyHtml: "<p>本文テキスト</p>",
  byteSize: 1024,
  isRead: true,
  publishedAt: "2026-01-01T10:00:00Z",
  downloadedAt: "2026-01-01T12:00:00Z",
};

function createDefaultProps(
  overrides: Partial<ReaderPageProps> = {},
): ReaderPageProps {
  return {
    novel: sampleNovel,
    chapter: sampleChapter,
    chapterIndex: 1,
    totalChapters: 3,
    writingMode: "vertical-rl",
    theme: "light",
    fontSizePx: 18,
    lineHeight: 1.8,
    initialScrollProgress: 0,
    isLoading: false,
    error: null,
    onToggleWritingMode: vi.fn(),
    onChangeTheme: vi.fn(),
    onChangeFontSize: vi.fn(),
    onChangeLineHeight: vi.fn(),
    onPrevChapter: vi.fn(),
    onNextChapter: vi.fn(),
    onScrollProgressChange: vi.fn(),
    ...overrides,
  };
}

describe("ReaderPage", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Default ストーリーでツールバー、ナビゲーション、本文（ReaderView）が描画されること", () => {
      render(<Default />);
      const page = screen.getByTestId("reader-page");
      expect(page).toBeInTheDocument();
      const main = page.querySelector("main");
      expect(main).toHaveClass("w-full");
      expect(main).toHaveClass("min-w-0");
      expect(screen.getByTestId("reader-toolbar")).toBeInTheDocument();
      expect(screen.getByTestId("reader-chapter-nav")).toBeInTheDocument();
      expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      expect(screen.queryByTestId("reader-loading")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reader-error")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reader-empty")).not.toBeInTheDocument();
    });

    it("HorizontalSepia ストーリーで横書き・セピアの ReaderView が描画されること", () => {
      render(<HorizontalSepia />);
      const view = screen.getByTestId("reader-view");
      expect(view).toHaveAttribute("data-writing-mode", "horizontal-tb");
      expect(view).toHaveAttribute("data-theme", "sepia");
    });

    it("Loading ストーリーでローディング表示が描画され本文や空状態が非表示となること", () => {
      render(<Loading />);
      expect(screen.getByTestId("reader-toolbar")).toBeInTheDocument();
      expect(screen.getByTestId("reader-loading")).toBeInTheDocument();
      expect(screen.queryByTestId("reader-view")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reader-empty")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reader-error")).not.toBeInTheDocument();
    });

    it("ErrorState ストーリーでエラーアラートが描画され本文やローディングが非表示となること", () => {
      render(<ErrorState />);
      const errorEl = screen.getByTestId("reader-error");
      expect(errorEl).toBeInTheDocument();
      expect(errorEl).toHaveAttribute("role", "alert");
      expect(errorEl).toHaveTextContent("エピソード本文の取得に失敗しました");
      expect(screen.queryByTestId("reader-view")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reader-loading")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reader-empty")).not.toBeInTheDocument();
    });

    it("Empty ストーリーで空状態が描画されること", () => {
      render(<Empty />);
      expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
      expect(screen.queryByTestId("reader-view")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reader-loading")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reader-error")).not.toBeInTheDocument();
    });

    it("WithNavigation ストーリーで戻るボタンや取得ボタンがツールバーに表示されること", () => {
      render(<WithNavigation />);
      expect(screen.getByTestId("reader-back-to-detail")).toBeInTheDocument();
      expect(
        screen.getByTestId("reader-back-to-bookshelf"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();
    });
  });

  describe("状態別排他描画ルールの検証", () => {
    it("error が存在する場合は isLoading が true であってもエラー表示が優先されること", () => {
      const props = createDefaultProps({
        error: "致命的なネットワークエラー",
        isLoading: true,
      });
      render(<ReaderPage {...props} />);

      expect(screen.getByTestId("reader-error")).toBeInTheDocument();
      expect(screen.queryByTestId("reader-loading")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reader-view")).not.toBeInTheDocument();
    });

    it("isLoading が true であっても既に chapter.bodyHtml が存在する場合は ReaderView が維持されること", () => {
      const props = createDefaultProps({
        isLoading: true,
      });
      render(<ReaderPage {...props} />);

      expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      expect(screen.queryByTestId("reader-loading")).not.toBeInTheDocument();
    });

    it("novel === null のとき空状態となり、ReaderChapterNav は描画されないこと", () => {
      const props = createDefaultProps({
        novel: null,
      });
      render(<ReaderPage {...props} />);

      expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
      expect(
        screen.queryByTestId("reader-chapter-nav"),
      ).not.toBeInTheDocument();
    });

    it("totalChapters === 0 のとき ReaderChapterNav は描画されないこと", () => {
      const props = createDefaultProps({
        totalChapters: 0,
      });
      render(<ReaderPage {...props} />);

      expect(
        screen.queryByTestId("reader-chapter-nav"),
      ).not.toBeInTheDocument();
    });

    it("chapter === null または chapter.bodyHtml === null のとき空状態が描画されること", () => {
      const { rerender } = render(
        <ReaderPage {...createDefaultProps({ chapter: null })} />,
      );
      expect(screen.getByTestId("reader-empty")).toBeInTheDocument();

      rerender(
        <ReaderPage
          {...createDefaultProps({
            chapter: { ...sampleChapter, bodyHtml: null },
          })}
        />,
      );
      expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
    });
  });

  describe("子コンポーネントへの Props 渡し・コールバック委譲の検証", () => {
    it("ツールバーおよび前後ナビの各コールバックが正しく呼び出されること", async () => {
      const user = userEvent.setup();
      const onToggleWritingMode = vi.fn();
      const onChangeTheme = vi.fn();
      const onChangeFontSize = vi.fn();
      const onChangeLineHeight = vi.fn();
      const onPrevChapter = vi.fn();
      const onNextChapter = vi.fn();
      const onBackToDetail = vi.fn();
      const onBackToBookshelf = vi.fn();
      const onFetchNovel = vi.fn();

      const props = createDefaultProps({
        chapterIndex: 2,
        totalChapters: 3,
        onToggleWritingMode,
        onChangeTheme,
        onChangeFontSize,
        onChangeLineHeight,
        onPrevChapter,
        onNextChapter,
        onBackToDetail,
        onBackToBookshelf,
        onFetchNovel,
      });

      render(<ReaderPage {...props} />);

      // 組み方向
      await user.click(screen.getByTestId("toggle-orientation"));
      expect(onToggleWritingMode).toHaveBeenCalledTimes(1);

      // テーマ
      await user.click(screen.getByTestId("theme-sepia"));
      expect(onChangeTheme).toHaveBeenCalledWith("sepia");

      // 文字サイズ
      await user.click(screen.getByTestId("font-size-increase"));
      expect(onChangeFontSize).toHaveBeenCalledWith(20);

      // 行間
      await user.click(screen.getByTestId("line-height-increase"));
      expect(onChangeLineHeight).toHaveBeenCalledWith(2.0);

      // 前後話ナビ
      await user.click(screen.getByTestId("reader-prev-chapter"));
      expect(onPrevChapter).toHaveBeenCalledTimes(1);

      await user.click(screen.getByTestId("reader-next-chapter"));
      expect(onNextChapter).toHaveBeenCalledTimes(1);

      // 戻る導線
      await user.click(screen.getByTestId("reader-back-to-detail"));
      expect(onBackToDetail).toHaveBeenCalledTimes(1);

      await user.click(screen.getByTestId("reader-back-to-bookshelf"));
      expect(onBackToBookshelf).toHaveBeenCalledTimes(1);

      // 手動取得
      await user.click(screen.getByTestId("fetch-novel-button"));
      expect(onFetchNovel).toHaveBeenCalledTimes(1);
    });
  });
});

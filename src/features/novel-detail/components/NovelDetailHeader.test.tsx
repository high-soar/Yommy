import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./NovelDetailHeader.stories";
import { NovelDetailHeader } from "./NovelDetailHeader";
import { sampleNovel } from "./NovelDetailHeader.stories";

const {
  Unread,
  WithBookmark,
  Refreshing,
  WithNotice,
  WithError,
  EmptyChapters,
  FallbackAuthorAndSynopsis,
} = composeStories(stories);

describe("NovelDetailHeader", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Unread ストーリーで作品情報・統計・最初から読むボタンが表示され、続きから読むボタンは非表示であること (AC-ND-01, AC-ND-03)", () => {
      render(<Unread />);

      expect(screen.getByTestId("novel-detail-header")).toBeInTheDocument();
      expect(
        screen.getByTestId("back-to-bookshelf-button"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("novel-detail-title")).toHaveTextContent(
        "境界迷宮と異界の魔術師",
      );
      expect(screen.getByTestId("novel-detail-author")).toHaveTextContent(
        "小野崎",
      );
      expect(screen.getByTestId("novel-detail-stats")).toHaveTextContent(
        "全 45 話（取得済み 12 話）",
      );
      expect(screen.getByTestId("novel-detail-synopsis")).toHaveTextContent(
        "異界から迷い込んだ青年が紡ぐファンタジー戦記。",
      );

      const readFirstButton = screen.getByTestId("detail-read-first-button");
      expect(readFirstButton).toBeInTheDocument();
      expect(readFirstButton).toHaveTextContent("最初から読む（第1話）");
      expect(readFirstButton).not.toBeDisabled();

      expect(
        screen.queryByTestId("detail-resume-button"),
      ).not.toBeInTheDocument();

      const refreshButton = screen.getByTestId("refresh-toc-button");
      expect(refreshButton).toHaveTextContent("目次を更新");
      expect(refreshButton).not.toBeDisabled();

      const deleteButton = screen.getByTestId("open-delete-dialog-button");
      expect(deleteButton).toHaveTextContent("作品を削除");
      expect(deleteButton).not.toBeDisabled();

      expect(
        screen.queryByTestId("novel-detail-notice"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("novel-detail-error"),
      ).not.toBeInTheDocument();
    });

    it("WithBookmark ストーリーで「続きから読む」と「最初から読む」の2ボタンが表示されること (AC-ND-03)", () => {
      render(<WithBookmark />);

      const resumeButton = screen.getByTestId("detail-resume-button");
      expect(resumeButton).toBeInTheDocument();
      expect(resumeButton).toHaveTextContent("続きから読む（第5話）");
      expect(resumeButton).not.toBeDisabled();

      const readFirstButton = screen.getByTestId("detail-read-first-button");
      expect(readFirstButton).toBeInTheDocument();
      expect(readFirstButton).toHaveTextContent("最初から読む（第1話）");
      expect(readFirstButton).not.toBeDisabled();
    });

    it("Refreshing ストーリーで更新ボタンが「更新中...」かつdisabledとなり、削除ボタンもdisabledとなること (AC-ND-05)", () => {
      render(<Refreshing />);

      const refreshButton = screen.getByTestId("refresh-toc-button");
      expect(refreshButton).toHaveTextContent("更新中...");
      expect(refreshButton).toBeDisabled();

      const deleteButton = screen.getByTestId("open-delete-dialog-button");
      expect(deleteButton).toBeDisabled();
    });

    it("WithNotice ストーリーで完了通知メッセージが表示されること (AC-ND-05)", () => {
      render(<WithNotice />);

      const notice = screen.getByTestId("novel-detail-notice");
      expect(notice).toBeInTheDocument();
      expect(notice).toHaveTextContent("目次を更新しました（+2話）");
    });

    it("WithError ストーリーでエラーメッセージが表示されること (AC-ND-05)", () => {
      render(<WithError />);

      const error = screen.getByTestId("novel-detail-error");
      expect(error).toBeInTheDocument();
      expect(error).toHaveTextContent(
        "目次の更新に失敗しました。ネットワーク接続を確認してください。",
      );
    });

    it("EmptyChapters ストーリーで0話の場合は読書開始ボタンが無効化されること", () => {
      render(<EmptyChapters />);

      const readFirstButton = screen.getByTestId("detail-read-first-button");
      expect(readFirstButton).toBeDisabled();
    });

    it("FallbackAuthorAndSynopsis ストーリーで著者名・あらすじが空文字の場合にフォールバック文字列が表示されること", () => {
      render(<FallbackAuthorAndSynopsis />);

      expect(screen.getByTestId("novel-detail-author")).toHaveTextContent(
        "著者不明",
      );
      expect(screen.getByTestId("novel-detail-synopsis")).toHaveTextContent(
        "あらすじはありません。",
      );
    });
  });

  describe("ユーザーインタラクションの検証", () => {
    it("「本棚へ戻る」ボタンをクリックしたときに onBackToBookshelf が呼び出されること (AC-ND-07)", async () => {
      const user = userEvent.setup();
      const onBackToBookshelf = vi.fn();

      render(
        <NovelDetailHeader
          novel={sampleNovel}
          isRefreshing={false}
          onBackToBookshelf={onBackToBookshelf}
          onStartFromBeginning={vi.fn()}
          onResumeBookmark={vi.fn()}
          onRefreshToc={vi.fn()}
          onOpenDeleteDialog={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("back-to-bookshelf-button"));
      expect(onBackToBookshelf).toHaveBeenCalledTimes(1);
    });

    it("しおり未設定時に「最初から読む」ボタンをクリックすると onStartFromBeginning が呼び出されること (AC-ND-03)", async () => {
      const user = userEvent.setup();
      const onStartFromBeginning = vi.fn();

      render(
        <NovelDetailHeader
          novel={sampleNovel}
          isRefreshing={false}
          onBackToBookshelf={vi.fn()}
          onStartFromBeginning={onStartFromBeginning}
          onResumeBookmark={vi.fn()}
          onRefreshToc={vi.fn()}
          onOpenDeleteDialog={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("detail-read-first-button"));
      expect(onStartFromBeginning).toHaveBeenCalledTimes(1);
    });

    it("しおり設定時に「続きから読む」ボタンをクリックすると onResumeBookmark(chapterIndex) が呼び出されること (AC-ND-03)", async () => {
      const user = userEvent.setup();
      const onResumeBookmark = vi.fn();

      render(
        <NovelDetailHeader
          novel={{ ...sampleNovel, bookmarkChapterIndex: 8 }}
          isRefreshing={false}
          onBackToBookshelf={vi.fn()}
          onStartFromBeginning={vi.fn()}
          onResumeBookmark={onResumeBookmark}
          onRefreshToc={vi.fn()}
          onOpenDeleteDialog={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("detail-resume-button"));
      expect(onResumeBookmark).toHaveBeenCalledTimes(1);
      expect(onResumeBookmark).toHaveBeenCalledWith(8);
    });

    it("しおり設定時に「最初から読む」ボタンをクリックすると onStartFromBeginning が呼び出されること (AC-ND-03)", async () => {
      const user = userEvent.setup();
      const onStartFromBeginning = vi.fn();

      render(
        <NovelDetailHeader
          novel={{ ...sampleNovel, bookmarkChapterIndex: 8 }}
          isRefreshing={false}
          onBackToBookshelf={vi.fn()}
          onStartFromBeginning={onStartFromBeginning}
          onResumeBookmark={vi.fn()}
          onRefreshToc={vi.fn()}
          onOpenDeleteDialog={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("detail-read-first-button"));
      expect(onStartFromBeginning).toHaveBeenCalledTimes(1);
    });

    it("目次更新ボタンをクリックすると onRefreshToc が呼び出されること (AC-ND-05)", async () => {
      const user = userEvent.setup();
      const onRefreshToc = vi.fn();

      render(
        <NovelDetailHeader
          novel={sampleNovel}
          isRefreshing={false}
          onBackToBookshelf={vi.fn()}
          onStartFromBeginning={vi.fn()}
          onResumeBookmark={vi.fn()}
          onRefreshToc={onRefreshToc}
          onOpenDeleteDialog={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("refresh-toc-button"));
      expect(onRefreshToc).toHaveBeenCalledTimes(1);
    });

    it("作品削除ボタンをクリックすると onOpenDeleteDialog が呼び出されること", async () => {
      const user = userEvent.setup();
      const onOpenDeleteDialog = vi.fn();

      render(
        <NovelDetailHeader
          novel={sampleNovel}
          isRefreshing={false}
          onBackToBookshelf={vi.fn()}
          onStartFromBeginning={vi.fn()}
          onResumeBookmark={vi.fn()}
          onRefreshToc={vi.fn()}
          onOpenDeleteDialog={onOpenDeleteDialog}
        />,
      );

      await user.click(screen.getByTestId("open-delete-dialog-button"));
      expect(onOpenDeleteDialog).toHaveBeenCalledTimes(1);
    });

    it("全0話かつしおり設定時の境界値で、続きから読むボタンも disabled となること", () => {
      render(
        <NovelDetailHeader
          novel={{
            ...sampleNovel,
            totalChapters: 0,
            cachedChapters: 0,
            bookmarkChapterIndex: 1,
          }}
          isRefreshing={false}
          onBackToBookshelf={vi.fn()}
          onStartFromBeginning={vi.fn()}
          onResumeBookmark={vi.fn()}
          onRefreshToc={vi.fn()}
          onOpenDeleteDialog={vi.fn()}
        />,
      );

      expect(screen.getByTestId("detail-resume-button")).toBeDisabled();
      expect(screen.getByTestId("detail-read-first-button")).toBeDisabled();
    });
  });
});

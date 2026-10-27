import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./NovelDetailPage.stories";
import { NovelDetailPage } from "./NovelDetailPage";
import type { NovelRecord, ChapterSummary } from "../../../storage/types";

const {
  Default,
  WithBookmark,
  Loading,
  NotFound,
  WithDeleteDialog,
  Refreshing,
  WithError,
} = composeStories(stories);

const sampleNovel: NovelRecord = {
  id: "kakuyomu:16817330658027210412",
  siteType: "kakuyomu",
  remoteWorkId: "16817330658027210412",
  canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
  title: "境界迷宮と異界の魔術師",
  author: "小野崎",
  synopsis: "異界から迷い込んだ青年が紡ぐファンタジー戦記。",
  totalChapters: 3,
  cachedChapters: 1,
  totalByteSize: 10240,
  bookmarkChapterIndex: null,
  bookmarkScrollProgress: 0,
  isFavorite: false,
  lastCheckedAt: null,
  lastReadAt: null,
  createdAt: "2026-10-25T10:00:00Z",
  updatedAt: "2026-10-26T07:00:00Z",
};

const sampleChapters: ChapterSummary[] = [
  {
    id: "kakuyomu:16817330658027210412:1",
    novelId: "kakuyomu:16817330658027210412",
    chapterIndex: 1,
    remoteChapterId: "1",
    partTitle: "第一部 旅立ち",
    title: "第1話 出会い",
    url: "https://kakuyomu.jp/works/16817330658027210412/episodes/1",
    byteSize: 1024,
    isRead: true,
    publishedAt: "2026-01-01T10:00:00Z",
    downloadedAt: "2026-01-01T12:00:00Z",
  },
  {
    id: "kakuyomu:16817330658027210412:2",
    novelId: "kakuyomu:16817330658027210412",
    chapterIndex: 2,
    remoteChapterId: "2",
    partTitle: "第一部 旅立ち",
    title: "第2話 覚醒",
    url: "https://kakuyomu.jp/works/16817330658027210412/episodes/2",
    byteSize: 0,
    isRead: false,
    publishedAt: "2026-01-02T10:00:00Z",
    downloadedAt: null,
  },
];

describe("NovelDetailPage", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Default ストーリーで作品ヘッダーと目次一覧が表示され、ローディング・Not Found・削除ダイアログは表示されないこと", () => {
      render(<Default />);

      expect(screen.getByTestId("novel-detail-page")).toBeInTheDocument();
      expect(screen.getByTestId("novel-detail-header")).toBeInTheDocument();
      expect(screen.getByTestId("episode-list")).toBeInTheDocument();
      expect(
        screen.queryByTestId("novel-detail-loading"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("novel-detail-not-found"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("delete-confirm-dialog"),
      ).not.toBeInTheDocument();
    });

    it("WithBookmark ストーリーで作品情報・しおり情報がヘッダーと目次に反映されること", () => {
      render(<WithBookmark />);

      expect(screen.getByTestId("detail-resume-button")).toBeInTheDocument();
    });

    it("Loading ストーリーでローディング表示になり、ヘッダー・目次・Not Found が非表示であること", () => {
      render(<Loading />);

      expect(screen.getByTestId("novel-detail-page")).toBeInTheDocument();
      expect(screen.getByTestId("novel-detail-loading")).toBeInTheDocument();
      expect(
        screen.queryByTestId("novel-detail-header"),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("episode-list")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("novel-detail-not-found"),
      ).not.toBeInTheDocument();
    });

    it("NotFound ストーリーで未検出表示と「本棚へ戻る」ボタンが表示され、ヘッダー・目次は非表示であること (AC-ND-07)", () => {
      render(<NotFound />);

      expect(screen.getByTestId("novel-detail-page")).toBeInTheDocument();
      const notFoundElement = screen.getByTestId("novel-detail-not-found");
      expect(notFoundElement).toBeInTheDocument();
      expect(notFoundElement).toHaveTextContent(
        "指定された作品が見つかりません。",
      );
      expect(
        screen.getByTestId("back-to-bookshelf-button"),
      ).toBeInTheDocument();

      expect(
        screen.queryByTestId("novel-detail-loading"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("novel-detail-header"),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("episode-list")).not.toBeInTheDocument();
    });

    it("WithDeleteDialog ストーリーで削除確認ダイアログが表示されること", () => {
      render(<WithDeleteDialog />);

      expect(screen.getByTestId("delete-confirm-dialog")).toBeInTheDocument();
    });

    it("Refreshing ストーリーで更新中フラグがヘッダーに反映されること", () => {
      render(<Refreshing />);

      expect(screen.getByTestId("refresh-toc-button")).toBeDisabled();
      expect(screen.getByTestId("refresh-toc-button")).toHaveTextContent(
        "更新中...",
      );
    });

    it("WithError ストーリーでエラーメッセージがヘッダーに反映されること", () => {
      render(<WithError />);

      expect(screen.getByTestId("novel-detail-error")).toHaveTextContent(
        "通信エラーが発生しました",
      );
    });
  });

  describe("親子結合およびProps伝達・ユーザーインタラクションの検証（親子分離原則）", () => {
    it("NotFound 時にカスタム error が指定されている場合、そのエラー文字列が表示されること", () => {
      render(
        <NovelDetailPage
          novel={null}
          chapters={[]}
          isLoading={false}
          isRefreshing={false}
          isDeleteDialogOpen={false}
          isDeleting={false}
          error="作品データの読み込みに失敗しました。"
          onBackToBookshelf={vi.fn()}
          onStartFromBeginning={vi.fn()}
          onResumeBookmark={vi.fn()}
          onSelectEpisode={vi.fn()}
          onRefreshToc={vi.fn()}
          onOpenDeleteDialog={vi.fn()}
          onCloseDeleteDialog={vi.fn()}
          onConfirmDelete={vi.fn()}
        />,
      );

      const notFound = screen.getByTestId("novel-detail-not-found");
      expect(notFound).toHaveTextContent(
        "作品データの読み込みに失敗しました。",
      );
    });

    it("NotFound 時に「本棚へ戻る」ボタンをクリックすると onBackToBookshelf が呼び出されること (AC-ND-07)", async () => {
      const user = userEvent.setup();
      const onBackToBookshelf = vi.fn();

      render(
        <NovelDetailPage
          novel={null}
          chapters={[]}
          isLoading={false}
          isRefreshing={false}
          isDeleteDialogOpen={false}
          isDeleting={false}
          onBackToBookshelf={onBackToBookshelf}
          onStartFromBeginning={vi.fn()}
          onResumeBookmark={vi.fn()}
          onSelectEpisode={vi.fn()}
          onRefreshToc={vi.fn()}
          onOpenDeleteDialog={vi.fn()}
          onCloseDeleteDialog={vi.fn()}
          onConfirmDelete={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("back-to-bookshelf-button"));
      expect(onBackToBookshelf).toHaveBeenCalledTimes(1);
    });

    it("通常表示時にヘッダーの各アクションが正しく各コールバックに伝達されること", async () => {
      const user = userEvent.setup();
      const onStartFromBeginning = vi.fn();
      const onResumeBookmark = vi.fn();
      const onRefreshToc = vi.fn();
      const onOpenDeleteDialog = vi.fn();

      render(
        <NovelDetailPage
          novel={{ ...sampleNovel, bookmarkChapterIndex: 2 }}
          chapters={sampleChapters}
          isLoading={false}
          isRefreshing={false}
          isDeleteDialogOpen={false}
          isDeleting={false}
          onBackToBookshelf={vi.fn()}
          onStartFromBeginning={onStartFromBeginning}
          onResumeBookmark={onResumeBookmark}
          onSelectEpisode={vi.fn()}
          onRefreshToc={onRefreshToc}
          onOpenDeleteDialog={onOpenDeleteDialog}
          onCloseDeleteDialog={vi.fn()}
          onConfirmDelete={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("detail-resume-button"));
      expect(onResumeBookmark).toHaveBeenCalledWith(2);

      await user.click(screen.getByTestId("detail-read-first-button"));
      expect(onStartFromBeginning).toHaveBeenCalledTimes(1);

      await user.click(screen.getByTestId("refresh-toc-button"));
      expect(onRefreshToc).toHaveBeenCalledTimes(1);

      await user.click(screen.getByTestId("open-delete-dialog-button"));
      expect(onOpenDeleteDialog).toHaveBeenCalledTimes(1);
    });

    it("目次一覧のエピソード行をクリックしたときに onSelectEpisode が呼び出されること", async () => {
      const user = userEvent.setup();
      const onSelectEpisode = vi.fn();

      render(
        <NovelDetailPage
          novel={sampleNovel}
          chapters={sampleChapters}
          isLoading={false}
          isRefreshing={false}
          isDeleteDialogOpen={false}
          isDeleting={false}
          onBackToBookshelf={vi.fn()}
          onStartFromBeginning={vi.fn()}
          onResumeBookmark={vi.fn()}
          onSelectEpisode={onSelectEpisode}
          onRefreshToc={vi.fn()}
          onOpenDeleteDialog={vi.fn()}
          onCloseDeleteDialog={vi.fn()}
          onConfirmDelete={vi.fn()}
        />,
      );

      const items = screen.getAllByTestId("episode-item");
      await user.click(items[0]);
      expect(onSelectEpisode).toHaveBeenCalledWith(1);
    });

    it("削除ダイアログのキャンセルボタンをクリックすると onCloseDeleteDialog が呼び出されること", async () => {
      const user = userEvent.setup();
      const onCloseDeleteDialog = vi.fn();

      render(
        <NovelDetailPage
          novel={sampleNovel}
          chapters={sampleChapters}
          isLoading={false}
          isRefreshing={false}
          isDeleteDialogOpen={true}
          isDeleting={false}
          onBackToBookshelf={vi.fn()}
          onStartFromBeginning={vi.fn()}
          onResumeBookmark={vi.fn()}
          onSelectEpisode={vi.fn()}
          onRefreshToc={vi.fn()}
          onOpenDeleteDialog={vi.fn()}
          onCloseDeleteDialog={onCloseDeleteDialog}
          onConfirmDelete={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("cancel-delete-button"));
      expect(onCloseDeleteDialog).toHaveBeenCalledTimes(1);
    });

    it("削除ダイアログの確定ボタンをクリックすると onConfirmDelete が呼び出されること", async () => {
      const user = userEvent.setup();
      const onConfirmDelete = vi.fn();

      render(
        <NovelDetailPage
          novel={sampleNovel}
          chapters={sampleChapters}
          isLoading={false}
          isRefreshing={false}
          isDeleteDialogOpen={true}
          isDeleting={false}
          onBackToBookshelf={vi.fn()}
          onStartFromBeginning={vi.fn()}
          onResumeBookmark={vi.fn()}
          onSelectEpisode={vi.fn()}
          onRefreshToc={vi.fn()}
          onOpenDeleteDialog={vi.fn()}
          onCloseDeleteDialog={vi.fn()}
          onConfirmDelete={onConfirmDelete}
        />,
      );

      await user.click(screen.getByTestId("confirm-delete-button"));
      expect(onConfirmDelete).toHaveBeenCalledTimes(1);
    });
  });
});

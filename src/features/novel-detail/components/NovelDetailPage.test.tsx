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
  BatchCaching,
  AllCached,
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

    it("Default ストーリーで画面ルートおよび各話リストコンテナのスクロールクラス構成が適用されていること (AC-ND-02, AC-ND-09)", () => {
      render(<Default />);

      const page = screen.getByTestId("novel-detail-page");
      expect(page.className).toContain("h-full");
      expect(page.className).toContain("flex");
      expect(page.className).toContain("flex-col");
      expect(page.className).toContain("overflow-hidden");

      const episodeContainer = screen.getByTestId("episode-list-container");
      expect(episodeContainer.className).toContain("flex-1");
      expect(episodeContainer.className).toContain("min-h-0");
      expect(episodeContainer.className).toContain("overflow-y-auto");
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
    const defaultPageProps = {
      novel: sampleNovel,
      chapters: sampleChapters,
      isLoading: false,
      isRefreshing: false,
      isBatchCaching: false,
      batchCacheProgress: null,
      isAllCached: false,
      isDeleteDialogOpen: false,
      isDeleting: false,
      onBackToBookshelf: vi.fn(),
      onStartFromBeginning: vi.fn(),
      onResumeBookmark: vi.fn(),
      onSelectEpisode: vi.fn(),
      onRefreshToc: vi.fn(),
      onStartBatchCache: vi.fn(),
      onCancelBatchCache: vi.fn(),
      onOpenDeleteDialog: vi.fn(),
      onCloseDeleteDialog: vi.fn(),
      onConfirmDelete: vi.fn(),
    };

    it("NotFound 時にカスタム error が指定されている場合、そのエラー文字列が表示されること", () => {
      render(
        <NovelDetailPage
          {...defaultPageProps}
          novel={null}
          chapters={[]}
          error="作品データの読み込みに失敗しました。"
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
          {...defaultPageProps}
          novel={null}
          chapters={[]}
          onBackToBookshelf={onBackToBookshelf}
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
          {...defaultPageProps}
          novel={{ ...sampleNovel, bookmarkChapterIndex: 2 }}
          onStartFromBeginning={onStartFromBeginning}
          onResumeBookmark={onResumeBookmark}
          onRefreshToc={onRefreshToc}
          onOpenDeleteDialog={onOpenDeleteDialog}
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
          {...defaultPageProps}
          onSelectEpisode={onSelectEpisode}
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
          {...defaultPageProps}
          isDeleteDialogOpen={true}
          onCloseDeleteDialog={onCloseDeleteDialog}
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
          {...defaultPageProps}
          isDeleteDialogOpen={true}
          onConfirmDelete={onConfirmDelete}
        />,
      );

      await user.click(screen.getByTestId("confirm-delete-button"));
      expect(onConfirmDelete).toHaveBeenCalledTimes(1);
    });

    it("初回ロード完了時、しおり話数（bookmarkChapterIndex）の要素へ初期スクロール調整が実行されること (AC-ND-08)", () => {
      const scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      const { rerender } = render(
        <NovelDetailPage
          {...defaultPageProps}
          novel={null}
          chapters={[]}
          isLoading={true}
        />,
      );

      expect(scrollIntoViewMock).not.toHaveBeenCalled();

      // 初回ロード完了（しおりが第2話）
      rerender(
        <NovelDetailPage
          {...defaultPageProps}
          novel={{ ...sampleNovel, bookmarkChapterIndex: 2 }}
        />,
      );

      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        block: "start",
        behavior: "instant",
      });
    });

    it("しおり未設定（bookmarkChapterIndex: null）の場合、初期スクロール調整が実行されないこと (AC-ND-08)", () => {
      const scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      render(
        <NovelDetailPage
          {...defaultPageProps}
          novel={{ ...sampleNovel, bookmarkChapterIndex: null }}
        />,
      );

      expect(scrollIntoViewMock).not.toHaveBeenCalled();
    });

    it("同一画面内での目次更新（isRefreshing トグル）時、初期スクロールが再発火しないこと (AC-ND-08)", () => {
      const scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      const { rerender } = render(
        <NovelDetailPage
          {...defaultPageProps}
          novel={{ ...sampleNovel, bookmarkChapterIndex: 2 }}
        />,
      );

      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);

      // 目次更新開始
      rerender(
        <NovelDetailPage
          {...defaultPageProps}
          novel={{ ...sampleNovel, bookmarkChapterIndex: 2 }}
          isRefreshing={true}
        />,
      );

      // 目次更新完了
      rerender(
        <NovelDetailPage
          {...defaultPageProps}
          novel={{ ...sampleNovel, bookmarkChapterIndex: 2 }}
          refreshMessage="最新の状態です"
        />,
      );

      // 呼び出し回数は初回ロード時の1回のみで増えていないこと
      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    });

    it("別作品へ遷移した（novelId が変化した）場合、フラグがリセットされて新作品のしおりスクロールが実行されること (AC-ND-08)", () => {
      const scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      const { rerender } = render(
        <NovelDetailPage
          {...defaultPageProps}
          novel={{ ...sampleNovel, id: "kakuyomu:1", bookmarkChapterIndex: 2 }}
        />,
      );

      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);

      // 別作品（id: kakuyomu:2）へ遷移
      rerender(
        <NovelDetailPage
          {...defaultPageProps}
          novel={{ ...sampleNovel, id: "kakuyomu:2", bookmarkChapterIndex: 1 }}
        />,
      );

      expect(scrollIntoViewMock).toHaveBeenCalledTimes(2);
    });

    describe("未取得話一括キャッシュ関連の連携・操作ロック制御 (AC-ND-11, AC-ND-12, AC-ND-13)", () => {
      it("BatchCaching ストーリーで一括キャッシュヘッダーが表示され、各話リストタップが無効化されること (AC-ND-12)", () => {
        render(<BatchCaching />);

        expect(screen.getByTestId("batch-cache-progress")).toBeInTheDocument();
        const container = screen.getByTestId("episode-list-container");
        expect(container.className).toContain("pointer-events-none");
      });

      it("AllCached ストーリーでヘッダーに全話キャッシュ済みが表示されること (AC-ND-13)", () => {
        render(<AllCached />);

        const batchButton = screen.getByTestId("batch-cache-button");
        expect(batchButton).toBeInTheDocument();
        expect(batchButton).toHaveTextContent("全話キャッシュ済み");
        expect(batchButton).toBeDisabled();
      });

      it("isBatchCaching === true のとき、エピソード行をクリックしても onSelectEpisode が呼び出されないこと（no-op制御）(AC-ND-12)", async () => {
        const user = userEvent.setup();
        const onSelectEpisode = vi.fn();

        render(
          <NovelDetailPage
            novel={sampleNovel}
            chapters={sampleChapters}
            isLoading={false}
            isRefreshing={false}
            isBatchCaching={true}
            batchCacheProgress={{ current: 1, total: 3 }}
            isAllCached={false}
            isDeleteDialogOpen={false}
            isDeleting={false}
            onBackToBookshelf={vi.fn()}
            onStartFromBeginning={vi.fn()}
            onResumeBookmark={vi.fn()}
            onSelectEpisode={onSelectEpisode}
            onRefreshToc={vi.fn()}
            onStartBatchCache={vi.fn()}
            onCancelBatchCache={vi.fn()}
            onOpenDeleteDialog={vi.fn()}
            onCloseDeleteDialog={vi.fn()}
            onConfirmDelete={vi.fn()}
          />,
        );

        const episodeItems = screen.getAllByTestId("episode-item");
        await user.click(episodeItems[0]);
        expect(onSelectEpisode).not.toHaveBeenCalled();
      });
    });
  });
});

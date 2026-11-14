import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./NovelDetailPage.stories";
import { NovelDetailPage } from "./NovelDetailPage";
import * as NovelDetailHeaderModule from "./NovelDetailHeader";
import * as EpisodeListModule from "./EpisodeList";
import * as DeleteConfirmDialogModule from "./DeleteConfirmDialog";
import * as ClearCacheConfirmDialogModule from "./ClearCacheConfirmDialog";
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
  BatchCachingWithFailures,
  ResumePending,
  RetryFailed,
  AllCached,
  WithClearCacheDialog,
  WithClearCacheNotice,
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Default ストーリーで作品ヘッダーと目次一覧が表示され、ローディング・Not Found・削除ダイアログは表示されないこと", () => {
      const headerSpy = vi.spyOn(NovelDetailHeaderModule, "NovelDetailHeader");
      const episodeListSpy = vi.spyOn(EpisodeListModule, "EpisodeList");
      const deleteDialogSpy = vi.spyOn(
        DeleteConfirmDialogModule,
        "DeleteConfirmDialog",
      );
      const clearCacheDialogSpy = vi.spyOn(
        ClearCacheConfirmDialogModule,
        "ClearCacheConfirmDialog",
      );

      render(<Default />);

      expect(screen.getByTestId("novel-detail-page")).toBeInTheDocument();
      expect(headerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          novel: expect.objectContaining({
            title: expect.any(String),
          }),
        }),
        undefined,
      );
      expect(episodeListSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          chapters: expect.any(Array),
        }),
        undefined,
      );
      expect(deleteDialogSpy).toHaveBeenCalledWith(
        expect.objectContaining({ isOpen: false }),
        undefined,
      );
      expect(clearCacheDialogSpy).toHaveBeenCalledWith(
        expect.objectContaining({ isOpen: false }),
        undefined,
      );
      expect(
        screen.queryByTestId("novel-detail-loading"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("novel-detail-not-found"),
      ).not.toBeInTheDocument();

      headerSpy.mockRestore();
      episodeListSpy.mockRestore();
      deleteDialogSpy.mockRestore();
      clearCacheDialogSpy.mockRestore();
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
      const headerSpy = vi.spyOn(NovelDetailHeaderModule, "NovelDetailHeader");
      const episodeListSpy = vi.spyOn(EpisodeListModule, "EpisodeList");

      render(<WithBookmark />);

      expect(headerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          novel: expect.objectContaining({ bookmarkChapterIndex: 2 }),
        }),
        undefined,
      );
      expect(episodeListSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          bookmarkChapterIndex: 2,
        }),
        undefined,
      );

      headerSpy.mockRestore();
      episodeListSpy.mockRestore();
    });

    it("Loading ストーリーでローディング表示になり、ヘッダー・目次・Not Found が非表示であること", () => {
      const headerSpy = vi.spyOn(NovelDetailHeaderModule, "NovelDetailHeader");
      const episodeListSpy = vi.spyOn(EpisodeListModule, "EpisodeList");
      const deleteDialogSpy = vi.spyOn(
        DeleteConfirmDialogModule,
        "DeleteConfirmDialog",
      );
      const clearCacheDialogSpy = vi.spyOn(
        ClearCacheConfirmDialogModule,
        "ClearCacheConfirmDialog",
      );

      render(<Loading />);

      expect(screen.getByTestId("novel-detail-page")).toBeInTheDocument();
      expect(screen.getByTestId("novel-detail-loading")).toBeInTheDocument();
      expect(
        screen.queryByTestId("novel-detail-not-found"),
      ).not.toBeInTheDocument();
      expect(headerSpy).not.toHaveBeenCalled();
      expect(episodeListSpy).not.toHaveBeenCalled();
      expect(deleteDialogSpy).not.toHaveBeenCalled();
      expect(clearCacheDialogSpy).not.toHaveBeenCalled();

      headerSpy.mockRestore();
      episodeListSpy.mockRestore();
      deleteDialogSpy.mockRestore();
      clearCacheDialogSpy.mockRestore();
    });

    it("NotFound ストーリーで未検出表示と「本棚へ戻る」ボタンが表示され、ヘッダー・目次は非表示であること (AC-ND-07)", () => {
      const headerSpy = vi.spyOn(NovelDetailHeaderModule, "NovelDetailHeader");
      const episodeListSpy = vi.spyOn(EpisodeListModule, "EpisodeList");

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
      expect(headerSpy).not.toHaveBeenCalled();
      expect(episodeListSpy).not.toHaveBeenCalled();

      headerSpy.mockRestore();
      episodeListSpy.mockRestore();
    });

    it("WithDeleteDialog ストーリーで削除確認ダイアログが表示されること", () => {
      const deleteDialogSpy = vi.spyOn(
        DeleteConfirmDialogModule,
        "DeleteConfirmDialog",
      );

      render(<WithDeleteDialog />);

      expect(deleteDialogSpy).toHaveBeenCalledWith(
        expect.objectContaining({ isOpen: true }),
        undefined,
      );

      deleteDialogSpy.mockRestore();
    });

    it("Refreshing ストーリーで更新中フラグが NovelDetailHeader へ伝達されること", () => {
      const headerSpy = vi.spyOn(NovelDetailHeaderModule, "NovelDetailHeader");
      render(<Refreshing />);

      expect(headerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ isRefreshing: true }),
        undefined,
      );
      headerSpy.mockRestore();
    });

    it("WithError ストーリーでエラーメッセージがヘッダーに反映されること", () => {
      const headerSpy = vi.spyOn(NovelDetailHeaderModule, "NovelDetailHeader");

      render(<WithError />);

      expect(headerSpy).toHaveBeenCalledWith(
        expect.objectContaining({ error: "通信エラーが発生しました" }),
        undefined,
      );

      headerSpy.mockRestore();
    });

    it("WithClearCacheDialog ストーリーでキャッシュ整理確認ダイアログが表示されること (AC-ND-21)", () => {
      const clearCacheDialogSpy = vi.spyOn(
        ClearCacheConfirmDialogModule,
        "ClearCacheConfirmDialog",
      );

      render(<WithClearCacheDialog />);

      expect(clearCacheDialogSpy).toHaveBeenCalledWith(
        expect.objectContaining({ isOpen: true }),
        undefined,
      );

      clearCacheDialogSpy.mockRestore();
    });

    it("WithClearCacheNotice ストーリーでキャッシュ削除完了通知メッセージがヘッダーへ伝達されること (AC-ND-22)", () => {
      const headerSpy = vi.spyOn(NovelDetailHeaderModule, "NovelDetailHeader");

      render(<WithClearCacheNotice />);

      expect(headerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshMessage: "本文キャッシュを削除しました（2話）",
        }),
        undefined,
      );

      headerSpy.mockRestore();
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

    it("親子分離: 通常表示時にヘッダーの各アクションが NovelDetailHeader へ正しく伝達されること", () => {
      const headerSpy = vi.spyOn(NovelDetailHeaderModule, "NovelDetailHeader");
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

      expect(headerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          onStartFromBeginning,
          onResumeBookmark,
          onRefreshToc,
          onOpenDeleteDialog,
        }),
        undefined,
      );

      const passedProps = headerSpy.mock.calls[0][0];
      passedProps.onResumeBookmark?.(2);
      expect(onResumeBookmark).toHaveBeenCalledWith(2);

      passedProps.onStartFromBeginning?.();
      expect(onStartFromBeginning).toHaveBeenCalledTimes(1);

      passedProps.onRefreshToc?.();
      expect(onRefreshToc).toHaveBeenCalledTimes(1);

      passedProps.onOpenDeleteDialog?.();
      expect(onOpenDeleteDialog).toHaveBeenCalledTimes(1);

      headerSpy.mockRestore();
    });

    it("親子分離: 目次一覧の onSelectEpisode が EpisodeList へ正しく伝達されること", () => {
      const episodeListSpy = vi.spyOn(EpisodeListModule, "EpisodeList");
      const onSelectEpisode = vi.fn();

      render(
        <NovelDetailPage
          {...defaultPageProps}
          onSelectEpisode={onSelectEpisode}
        />,
      );

      expect(episodeListSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          onSelectEpisode: expect.any(Function),
        }),
        undefined,
      );

      const passedProps = episodeListSpy.mock.calls[0][0];
      passedProps.onSelectEpisode(1);
      expect(onSelectEpisode).toHaveBeenCalledWith(1);

      episodeListSpy.mockRestore();
    });

    it("親子分離: 削除ダイアログの isOpen, onClose, onConfirm が DeleteConfirmDialog へ正しく伝達されること", () => {
      const dialogSpy = vi.spyOn(
        DeleteConfirmDialogModule,
        "DeleteConfirmDialog",
      );
      const onCloseDeleteDialog = vi.fn();
      const onConfirmDelete = vi.fn();

      render(
        <NovelDetailPage
          {...defaultPageProps}
          isDeleteDialogOpen={true}
          onCloseDeleteDialog={onCloseDeleteDialog}
          onConfirmDelete={onConfirmDelete}
        />,
      );

      expect(dialogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          isOpen: true,
          onClose: onCloseDeleteDialog,
          onConfirm: onConfirmDelete,
        }),
        undefined,
      );

      const passedProps = dialogSpy.mock.calls[0][0];
      passedProps.onClose();
      expect(onCloseDeleteDialog).toHaveBeenCalledTimes(1);

      passedProps.onConfirm();
      expect(onConfirmDelete).toHaveBeenCalledTimes(1);

      dialogSpy.mockRestore();
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

    describe("未取得話一括キャッシュ関連の連携・非ブロッキング操作制御 (AC-ND-11, AC-ND-13, Issue #344)", () => {
      it("BatchCaching ストーリーで一括キャッシュ状態が NovelDetailHeader へ伝達され、各話リストコンテナは操作ブロック（pointer-events-none / opacity-80）されないこと (Issue #344)", () => {
        const headerSpy = vi.spyOn(
          NovelDetailHeaderModule,
          "NovelDetailHeader",
        );

        render(<BatchCaching />);

        expect(headerSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            isBatchCaching: true,
            batchCacheProgress: { current: 1, total: 2 },
          }),
          undefined,
        );
        const container = screen.getByTestId("episode-list-container");
        expect(container.className).not.toContain("pointer-events-none");
        expect(container.className).not.toContain("opacity-80");

        headerSpy.mockRestore();
      });

      it("BatchCachingWithFailures ストーリーで一括キャッシュ失敗件数が NovelDetailHeader へ伝達されること (AC-ND-25)", () => {
        const headerSpy = vi.spyOn(
          NovelDetailHeaderModule,
          "NovelDetailHeader",
        );

        render(<BatchCachingWithFailures />);

        expect(headerSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            isBatchCaching: true,
            batchCacheProgress: { current: 1, total: 2 },
            failedCacheCount: 1,
          }),
          undefined,
        );

        headerSpy.mockRestore();
      });

      it("ResumePending ストーリーで pendingCacheCount=2 が NovelDetailHeader へ伝達されること (AC-ND-24)", () => {
        const headerSpy = vi.spyOn(
          NovelDetailHeaderModule,
          "NovelDetailHeader",
        );
        render(<ResumePending />);

        expect(headerSpy).toHaveBeenCalledWith(
          expect.objectContaining({ pendingCacheCount: 2 }),
          undefined,
        );
        headerSpy.mockRestore();
      });

      it("RetryFailed ストーリーで failedCacheCount=1 が NovelDetailHeader へ、failedChapterIndexes=[2] が EpisodeList へ伝達されること (AC-ND-25)", () => {
        const headerSpy = vi.spyOn(
          NovelDetailHeaderModule,
          "NovelDetailHeader",
        );
        const episodeListSpy = vi.spyOn(EpisodeListModule, "EpisodeList");
        render(<RetryFailed />);

        expect(headerSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            pendingCacheCount: 0,
            failedCacheCount: 1,
          }),
          undefined,
        );
        expect(episodeListSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            failedChapterIndexes: [2],
          }),
          undefined,
        );
        headerSpy.mockRestore();
        episodeListSpy.mockRestore();
      });

      it("AllCached ストーリーで isAllCached=true が NovelDetailHeader へ伝達されること (AC-ND-13)", () => {
        const headerSpy = vi.spyOn(
          NovelDetailHeaderModule,
          "NovelDetailHeader",
        );
        render(<AllCached />);

        expect(headerSpy).toHaveBeenCalledWith(
          expect.objectContaining({ isAllCached: true }),
          undefined,
        );
        headerSpy.mockRestore();
      });

      it("親子分離: isBatchCaching === true のときでも EpisodeList の onSelectEpisode 呼び出しが親コールバックへ透過伝達されること (Issue #344)", () => {
        const episodeListSpy = vi.spyOn(EpisodeListModule, "EpisodeList");
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

        expect(episodeListSpy).toHaveBeenCalled();
        const passedProps = episodeListSpy.mock.calls[0][0];
        passedProps.onSelectEpisode(1);
        expect(onSelectEpisode).toHaveBeenCalledWith(1);

        episodeListSpy.mockRestore();
      });
    });

    describe("本文キャッシュ整理ダイアログ連携 (AC-ND-21, AC-ND-22, TR-19)", () => {
      it("isClearCacheDialogOpen === true のとき ClearCacheConfirmDialog へ isOpen=true が伝達されること (AC-ND-21)", () => {
        const dialogSpy = vi.spyOn(
          ClearCacheConfirmDialogModule,
          "ClearCacheConfirmDialog",
        );

        render(
          <NovelDetailPage
            {...defaultPageProps}
            isClearCacheDialogOpen={true}
          />,
        );

        expect(dialogSpy).toHaveBeenCalledWith(
          expect.objectContaining({ isOpen: true }),
          undefined,
        );

        dialogSpy.mockRestore();
      });

      it("isClearCacheDialogOpen が false または未定義のとき ClearCacheConfirmDialog へ isOpen=false が伝達されること", () => {
        const dialogSpy = vi.spyOn(
          ClearCacheConfirmDialogModule,
          "ClearCacheConfirmDialog",
        );

        render(
          <NovelDetailPage
            {...defaultPageProps}
            isClearCacheDialogOpen={false}
          />,
        );

        expect(dialogSpy).toHaveBeenCalledWith(
          expect.objectContaining({ isOpen: false }),
          undefined,
        );

        dialogSpy.mockRestore();
      });

      it("親子分離: NovelDetailHeader の onOpenClearCacheDialog が正しく伝達されること", () => {
        const headerSpy = vi.spyOn(
          NovelDetailHeaderModule,
          "NovelDetailHeader",
        );
        const onOpenClearCacheDialog = vi.fn();

        render(
          <NovelDetailPage
            {...defaultPageProps}
            onOpenClearCacheDialog={onOpenClearCacheDialog}
          />,
        );

        expect(headerSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            onOpenClearCacheDialog,
          }),
          undefined,
        );

        const passedProps = headerSpy.mock.calls[0][0];
        passedProps.onOpenClearCacheDialog?.();
        expect(onOpenClearCacheDialog).toHaveBeenCalledTimes(1);

        headerSpy.mockRestore();
      });

      it("親子分離: ClearCacheConfirmDialog の onConfirm が正しく伝達されること (AC-ND-21)", () => {
        const dialogSpy = vi.spyOn(
          ClearCacheConfirmDialogModule,
          "ClearCacheConfirmDialog",
        );
        const onConfirmClearCache = vi.fn();

        render(
          <NovelDetailPage
            {...defaultPageProps}
            isClearCacheDialogOpen={true}
            onConfirmClearCache={onConfirmClearCache}
          />,
        );

        expect(dialogSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            isOpen: true,
            onConfirm: onConfirmClearCache,
          }),
          undefined,
        );

        const passedProps = dialogSpy.mock.calls[0][0];
        passedProps.onConfirm({ onlyRead: true });
        expect(onConfirmClearCache).toHaveBeenCalledWith({ onlyRead: true });

        passedProps.onConfirm({ onlyRead: false });
        expect(onConfirmClearCache).toHaveBeenCalledWith({ onlyRead: false });

        dialogSpy.mockRestore();
      });

      it("親子分離: ClearCacheConfirmDialog の onClose が正しく伝達されること", () => {
        const dialogSpy = vi.spyOn(
          ClearCacheConfirmDialogModule,
          "ClearCacheConfirmDialog",
        );
        const onCloseClearCacheDialog = vi.fn();

        render(
          <NovelDetailPage
            {...defaultPageProps}
            isClearCacheDialogOpen={true}
            onCloseClearCacheDialog={onCloseClearCacheDialog}
          />,
        );

        expect(dialogSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            isOpen: true,
            onClose: onCloseClearCacheDialog,
          }),
          undefined,
        );

        const passedProps = dialogSpy.mock.calls[0][0];
        passedProps.onClose();
        expect(onCloseClearCacheDialog).toHaveBeenCalledTimes(1);

        dialogSpy.mockRestore();
      });

      it("親子分離: onCloseClearCacheDialog が省略された場合でも安全に no-op 処理されること", () => {
        const dialogSpy = vi.spyOn(
          ClearCacheConfirmDialogModule,
          "ClearCacheConfirmDialog",
        );

        render(
          <NovelDetailPage
            {...defaultPageProps}
            isClearCacheDialogOpen={true}
          />,
        );

        const passedProps = dialogSpy.mock.calls[0][0];
        expect(() => passedProps.onClose()).not.toThrow();

        dialogSpy.mockRestore();
      });

      it("親子分離: onConfirmClearCache が省略された場合でも安全に no-op 処理されること", () => {
        const dialogSpy = vi.spyOn(
          ClearCacheConfirmDialogModule,
          "ClearCacheConfirmDialog",
        );

        render(
          <NovelDetailPage
            {...defaultPageProps}
            isClearCacheDialogOpen={true}
          />,
        );

        const passedProps = dialogSpy.mock.calls[0][0];
        expect(() => passedProps.onConfirm({ onlyRead: false })).not.toThrow();

        dialogSpy.mockRestore();
      });

      it("refreshMessage にキャッシュ削除完了メッセージが設定された場合、NovelDetailHeader へ伝達されること (AC-ND-22)", () => {
        const headerSpy = vi.spyOn(
          NovelDetailHeaderModule,
          "NovelDetailHeader",
        );

        render(
          <NovelDetailPage
            {...defaultPageProps}
            refreshMessage="本文キャッシュを削除しました（2話）"
          />,
        );

        expect(headerSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            refreshMessage: "本文キャッシュを削除しました（2話）",
          }),
          undefined,
        );

        headerSpy.mockRestore();
      });

      it("onToggleFavorite が指定された場合、NovelDetailHeader へコールバックが正しく伝搬されること (Issue #266, R1-04)", () => {
        const headerSpy = vi.spyOn(
          NovelDetailHeaderModule,
          "NovelDetailHeader",
        );
        const onToggleFavorite = vi.fn();

        render(
          <NovelDetailPage
            {...defaultPageProps}
            onToggleFavorite={onToggleFavorite}
          />,
        );

        expect(headerSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            onToggleFavorite,
          }),
          undefined,
        );

        const passedProps = headerSpy.mock.calls[0][0];
        passedProps.onToggleFavorite?.();
        expect(onToggleFavorite).toHaveBeenCalledTimes(1);

        headerSpy.mockRestore();
      });

      it("pendingCacheCount, failedCacheCount が NovelDetailHeader へ、failedChapterIndexes が EpisodeList へ正しく伝搬されること (AC-ND-24, AC-ND-25)", () => {
        const headerSpy = vi.spyOn(
          NovelDetailHeaderModule,
          "NovelDetailHeader",
        );
        const episodeListSpy = vi.spyOn(EpisodeListModule, "EpisodeList");

        render(
          <NovelDetailPage
            {...defaultPageProps}
            pendingCacheCount={3}
            failedCacheCount={1}
            failedChapterIndexes={[2]}
          />,
        );

        expect(headerSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            pendingCacheCount: 3,
            failedCacheCount: 1,
          }),
          undefined,
        );

        expect(episodeListSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            failedChapterIndexes: [2],
          }),
          undefined,
        );

        headerSpy.mockRestore();
        episodeListSpy.mockRestore();
      });

      it("onOpenWebView が指定された場合、NovelDetailHeader へコールバックが渡され canonicalUrl で呼び出されること (Issue #269, TR-09, AC-ND-26)", () => {
        const headerSpy = vi.spyOn(
          NovelDetailHeaderModule,
          "NovelDetailHeader",
        );
        const onOpenWebView = vi.fn();

        render(
          <NovelDetailPage
            {...defaultPageProps}
            onOpenWebView={onOpenWebView}
          />,
        );

        expect(headerSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            onOpenWebView: expect.any(Function),
          }),
          undefined,
        );

        const passedProps = headerSpy.mock.calls[0][0];
        passedProps.onOpenWebView?.();
        expect(onOpenWebView).toHaveBeenCalledWith(sampleNovel.canonicalUrl);

        headerSpy.mockRestore();
      });
    });
  });
});

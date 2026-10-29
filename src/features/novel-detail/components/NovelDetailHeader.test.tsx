import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./NovelDetailHeader.stories";
import { NovelDetailHeader } from "./NovelDetailHeader";
import type { NovelRecord } from "../../../storage/types";

const sampleNovel: NovelRecord = {
  id: "kakuyomu:16817330658027210412",
  siteType: "kakuyomu",
  remoteWorkId: "16817330658027210412",
  canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
  title: "境界迷宮と異界の魔術師",
  author: "小野崎",
  synopsis: "異界から迷い込んだ青年が紡ぐファンタジー戦記。",
  totalChapters: 45,
  cachedChapters: 12,
  totalByteSize: 102400,
  bookmarkChapterIndex: null,
  bookmarkScrollProgress: 0,
  isFavorite: false,
  lastCheckedAt: null,
  lastReadAt: null,
  createdAt: "2026-10-25T10:00:00Z",
  updatedAt: "2026-10-26T07:00:00Z",
};

const {
  Unread,
  WithBookmark,
  Refreshing,
  WithNotice,
  WithError,
  EmptyChapters,
  FallbackAuthorAndSynopsis,
  ExpandedSynopsis,
  BatchCaching,
  AllCached,
} = composeStories(stories);

describe("NovelDetailHeader", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Unread ストーリーで作品情報・統計・最初から読むボタンが表示され、「本棚へ戻る」ボタンは非表示であること (AC-ND-01, AC-ND-03, AC-ND-07)", () => {
      render(<Unread />);

      expect(screen.getByTestId("novel-detail-header")).toBeInTheDocument();
      expect(
        screen.queryByTestId("back-to-bookshelf-button"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("novel-detail-title")).toHaveTextContent(
        "境界迷宮と異界の魔術師",
      );
      expect(screen.getByTestId("novel-detail-author")).toHaveTextContent(
        "小野崎",
      );
      expect(screen.getByTestId("novel-detail-stats")).toHaveTextContent(
        "全 45 話（取得済み 12 話）",
      );

      const synopsis = screen.getByTestId("novel-detail-synopsis");
      expect(synopsis).toHaveTextContent(
        "異界から迷い込んだ青年が紡ぐファンタジー戦記。",
      );
      expect(synopsis).toHaveClass("line-clamp-2");

      const toggleButton = screen.getByTestId("synopsis-toggle-button");
      expect(toggleButton).toHaveTextContent("あらすじを展開");
      expect(toggleButton).toHaveAttribute("aria-expanded", "false");
      expect(toggleButton).toHaveAttribute(
        "aria-controls",
        "novel-detail-synopsis",
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

    it("FallbackAuthorAndSynopsis ストーリーで著者名・あらすじが空文字の場合にフォールバック文字列が表示されトグルボタンは非表示であること (AC-ND-01)", () => {
      render(<FallbackAuthorAndSynopsis />);

      expect(screen.getByTestId("novel-detail-author")).toHaveTextContent(
        "著者不明",
      );
      expect(screen.getByTestId("novel-detail-synopsis")).toHaveTextContent(
        "あらすじはありません。",
      );
      expect(
        screen.queryByTestId("synopsis-toggle-button"),
      ).not.toBeInTheDocument();
    });

    it("ExpandedSynopsis ストーリーで play 関数実行後にあらすじが展開され、スクロールスタイルが付与されること (AC-ND-01)", async () => {
      const { container } = render(<ExpandedSynopsis />);
      await act(async () => {
        await ExpandedSynopsis.play?.({ canvasElement: container });
      });

      const toggleButton = screen.getByTestId("synopsis-toggle-button");
      expect(toggleButton).toHaveTextContent("あらすじを折りたたむ");
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");

      const synopsis = screen.getByTestId("novel-detail-synopsis");
      expect(synopsis).not.toHaveClass("line-clamp-2");
      expect(synopsis).toHaveClass("max-h-40");
      expect(synopsis).toHaveClass("overflow-y-auto");
    });
  });

  describe("ユーザーインタラクションの検証", () => {
    const defaultProps = {
      novel: sampleNovel,
      isRefreshing: false,
      isBatchCaching: false,
      batchCacheProgress: null,
      isAllCached: false,
      onStartFromBeginning: vi.fn(),
      onResumeBookmark: vi.fn(),
      onRefreshToc: vi.fn(),
      onStartBatchCache: vi.fn(),
      onCancelBatchCache: vi.fn(),
      onOpenDeleteDialog: vi.fn(),
    };

    it("「本棚へ戻る」ボタンはヘッダー内に描画されないこと (AC-ND-07)", () => {
      render(<NovelDetailHeader {...defaultProps} />);

      expect(
        screen.queryByTestId("back-to-bookshelf-button"),
      ).not.toBeInTheDocument();
    });

    it("あらすじの折りたたみ・展開トグルボタンをクリックすると表示状態が切り替わること (AC-ND-01)", async () => {
      const user = userEvent.setup();

      render(<NovelDetailHeader {...defaultProps} />);

      const synopsis = screen.getByTestId("novel-detail-synopsis");
      const toggleButton = screen.getByTestId("synopsis-toggle-button");

      // 初期状態: 折りたたみ（line-clamp-2）
      expect(synopsis).toHaveClass("line-clamp-2");
      expect(synopsis).not.toHaveClass("max-h-40");
      expect(toggleButton).toHaveTextContent("あらすじを展開");
      expect(toggleButton).toHaveAttribute("aria-expanded", "false");

      // 1回目のクリック: 展開
      await user.click(toggleButton);
      expect(synopsis).not.toHaveClass("line-clamp-2");
      expect(synopsis).toHaveClass("max-h-40");
      expect(synopsis).toHaveClass("overflow-y-auto");
      expect(toggleButton).toHaveTextContent("あらすじを折りたたむ");
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");

      // 2回目のクリック: 折りたたみに戻る
      await user.click(toggleButton);
      expect(synopsis).toHaveClass("line-clamp-2");
      expect(synopsis).not.toHaveClass("max-h-40");
      expect(synopsis).not.toHaveClass("overflow-y-auto");
      expect(toggleButton).toHaveTextContent("あらすじを展開");
      expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    });

    it("あらすじが未設定または空白のみの場合、フォールバックが表示されトグルボタンは非表示であること (AC-ND-01)", () => {
      render(
        <NovelDetailHeader
          {...defaultProps}
          novel={{ ...sampleNovel, synopsis: "   \n  " }}
        />,
      );

      expect(screen.getByTestId("novel-detail-synopsis")).toHaveTextContent(
        "あらすじはありません。",
      );
      expect(
        screen.queryByTestId("synopsis-toggle-button"),
      ).not.toBeInTheDocument();
    });

    it("しおり未設定時に「最初から読む」ボタンをクリックすると onStartFromBeginning が呼び出されること (AC-ND-03)", async () => {
      const user = userEvent.setup();
      const onStartFromBeginning = vi.fn();

      render(
        <NovelDetailHeader
          {...defaultProps}
          onStartFromBeginning={onStartFromBeginning}
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
          {...defaultProps}
          novel={{ ...sampleNovel, bookmarkChapterIndex: 8 }}
          onResumeBookmark={onResumeBookmark}
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
          {...defaultProps}
          novel={{ ...sampleNovel, bookmarkChapterIndex: 8 }}
          onStartFromBeginning={onStartFromBeginning}
        />,
      );

      await user.click(screen.getByTestId("detail-read-first-button"));
      expect(onStartFromBeginning).toHaveBeenCalledTimes(1);
    });

    it("目次更新ボタンをクリックすると onRefreshToc が呼び出されること (AC-ND-05)", async () => {
      const user = userEvent.setup();
      const onRefreshToc = vi.fn();

      render(
        <NovelDetailHeader {...defaultProps} onRefreshToc={onRefreshToc} />,
      );

      await user.click(screen.getByTestId("refresh-toc-button"));
      expect(onRefreshToc).toHaveBeenCalledTimes(1);
    });

    it("作品削除ボタンをクリックすると onOpenDeleteDialog が呼び出されること", async () => {
      const user = userEvent.setup();
      const onOpenDeleteDialog = vi.fn();

      render(
        <NovelDetailHeader
          {...defaultProps}
          onOpenDeleteDialog={onOpenDeleteDialog}
        />,
      );

      await user.click(screen.getByTestId("open-delete-dialog-button"));
      expect(onOpenDeleteDialog).toHaveBeenCalledTimes(1);
    });

    it("全0話かつしおり設定時の境界値で、続きから読むボタンも disabled となること", () => {
      render(
        <NovelDetailHeader
          {...defaultProps}
          novel={{
            ...sampleNovel,
            totalChapters: 0,
            cachedChapters: 0,
            bookmarkChapterIndex: 1,
          }}
        />,
      );

      expect(screen.getByTestId("detail-resume-button")).toBeDisabled();
      expect(screen.getByTestId("detail-read-first-button")).toBeDisabled();
    });

    describe("未取得話一括キャッシュ関連の表示・活性制御 (AC-ND-11, AC-ND-12, AC-ND-13)", () => {
      it("BatchCaching ストーリーで進行状況（3/15）と中断ボタンが表示され、読書・更新・削除ボタンが disabled であること (AC-ND-11, AC-ND-12)", () => {
        render(<BatchCaching />);

        expect(screen.getByTestId("batch-cache-progress")).toHaveTextContent(
          "キャッシュ中 (3/15)...",
        );
        expect(
          screen.getByTestId("batch-cache-cancel-button"),
        ).toHaveTextContent("中断");
        expect(
          screen.queryByTestId("batch-cache-button"),
        ).not.toBeInTheDocument();

        expect(screen.getByTestId("detail-read-first-button")).toBeDisabled();
        expect(screen.getByTestId("refresh-toc-button")).toBeDisabled();
        expect(screen.getByTestId("open-delete-dialog-button")).toBeDisabled();
      });

      it("AllCached ストーリーで「全話キャッシュ済み」ボタンが disabled 表示されること (AC-ND-13)", () => {
        render(<AllCached />);

        const batchButton = screen.getByTestId("batch-cache-button");
        expect(batchButton).toBeInTheDocument();
        expect(batchButton).toHaveTextContent("全話キャッシュ済み");
        expect(batchButton).toBeDisabled();
      });

      it("未取得話がある場合に「未取得話を一括キャッシュ」ボタンが有効表示され、クリック時に onStartBatchCache が呼ばれること (AC-ND-11)", async () => {
        const user = userEvent.setup();
        const onStartBatchCache = vi.fn();

        render(
          <NovelDetailHeader
            novel={sampleNovel}
            isRefreshing={false}
            isBatchCaching={false}
            batchCacheProgress={null}
            isAllCached={false}
            onStartFromBeginning={vi.fn()}
            onResumeBookmark={vi.fn()}
            onRefreshToc={vi.fn()}
            onStartBatchCache={onStartBatchCache}
            onCancelBatchCache={vi.fn()}
            onOpenDeleteDialog={vi.fn()}
          />,
        );

        const batchButton = screen.getByTestId("batch-cache-button");
        expect(batchButton).toHaveTextContent("未取得話を一括キャッシュ");
        expect(batchButton).not.toBeDisabled();

        await user.click(batchButton);
        expect(onStartBatchCache).toHaveBeenCalledTimes(1);
      });

      it("目次更新中（isRefreshing === true）は一括キャッシュボタンも disabled であること (AC-ND-11)", () => {
        render(
          <NovelDetailHeader
            novel={sampleNovel}
            isRefreshing={true}
            isBatchCaching={false}
            batchCacheProgress={null}
            isAllCached={false}
            onStartFromBeginning={vi.fn()}
            onResumeBookmark={vi.fn()}
            onRefreshToc={vi.fn()}
            onStartBatchCache={vi.fn()}
            onCancelBatchCache={vi.fn()}
            onOpenDeleteDialog={vi.fn()}
          />,
        );

        expect(screen.getByTestId("batch-cache-button")).toBeDisabled();
      });

      it("総話数 0 の場合は一括キャッシュボタンが disabled となること (AC-ND-13)", () => {
        render(
          <NovelDetailHeader
            novel={{ ...sampleNovel, totalChapters: 0, cachedChapters: 0 }}
            isRefreshing={false}
            isBatchCaching={false}
            batchCacheProgress={null}
            isAllCached={false}
            onStartFromBeginning={vi.fn()}
            onResumeBookmark={vi.fn()}
            onRefreshToc={vi.fn()}
            onStartBatchCache={vi.fn()}
            onCancelBatchCache={vi.fn()}
            onOpenDeleteDialog={vi.fn()}
          />,
        );

        const batchButton = screen.getByTestId("batch-cache-button");
        expect(batchButton).toHaveTextContent("未取得話を一括キャッシュ");
        expect(batchButton).toBeDisabled();
      });

      it("一括キャッシュ実行中に中断ボタンをクリックすると onCancelBatchCache が呼ばれること (AC-ND-12)", async () => {
        const user = userEvent.setup();
        const onCancelBatchCache = vi.fn();

        render(
          <NovelDetailHeader
            novel={{ ...sampleNovel, bookmarkChapterIndex: 2 }}
            isRefreshing={false}
            isBatchCaching={true}
            batchCacheProgress={{ current: 1, total: 5 }}
            isAllCached={false}
            onStartFromBeginning={vi.fn()}
            onResumeBookmark={vi.fn()}
            onRefreshToc={vi.fn()}
            onStartBatchCache={vi.fn()}
            onCancelBatchCache={onCancelBatchCache}
            onOpenDeleteDialog={vi.fn()}
          />,
        );

        const cancelButton = screen.getByTestId("batch-cache-cancel-button");
        await user.click(cancelButton);
        expect(onCancelBatchCache).toHaveBeenCalledTimes(1);

        expect(screen.getByTestId("detail-resume-button")).toBeDisabled();
        expect(screen.getByTestId("detail-read-first-button")).toBeDisabled();
      });
    });
  });
});

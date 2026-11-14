import { render, screen, act, fireEvent } from "@testing-library/react";
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
  BatchCachingWithFailures,
  ResumePending,
  RetryFailed,
  AllCached,
  Favorite,
  NotFavorite,
  MenuOpen,
  MenuOpenAllCached,
  MenuOpenRetryFailed,
  MenuOpenBatchCaching,
} = composeStories(stories);

describe("NovelDetailHeader", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Unread ストーリーで作品情報・統計・最初から読むボタン・1行アイコンバーが表示され、初期状態で3点メニューは閉じていること (AC-ND-01, AC-ND-03, AC-ND-07, AC-ND-27)", () => {
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
        "全 45 話（取得済み 12 話 / 100.0 KB）",
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

      const favButton = screen.getByTestId("detail-favorite-toggle-button");
      expect(favButton).toHaveAttribute("aria-label", "お気に入り");
      expect(favButton).toHaveTextContent("☆");
      expect(favButton).not.toHaveTextContent("お気に入り");
      expect(favButton).not.toBeDisabled();

      const refreshButton = screen.getByTestId("refresh-toc-button");
      expect(refreshButton).toHaveAttribute("aria-label", "目次を更新");
      expect(refreshButton).toHaveTextContent("🔄");
      expect(refreshButton).not.toHaveTextContent("目次を更新");
      expect(refreshButton).not.toBeDisabled();

      const menuButton = screen.getByTestId("novel-detail-menu-button");
      expect(menuButton).toHaveAttribute("aria-label", "作品メニュー");
      expect(menuButton).toHaveAttribute("aria-haspopup", "menu");
      expect(menuButton).toHaveAttribute("aria-expanded", "false");
      expect(menuButton).not.toHaveAttribute("aria-controls");
      expect(menuButton).toHaveTextContent("⋮");
      expect(menuButton).not.toBeDisabled();

      expect(screen.queryByTestId("novel-detail-menu")).not.toBeInTheDocument();
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

    it("Refreshing ストーリーで更新アイコンに animate-spin が付与され、3アイコンボタンすべてが disabled となること (AC-ND-05, AC-ND-27)", () => {
      render(<Refreshing />);

      const refreshButton = screen.getByTestId("refresh-toc-button");
      expect(refreshButton).toHaveAttribute("aria-label", "目次を更新");
      expect(refreshButton).toBeDisabled();
      expect(refreshButton.querySelector(".animate-spin")).not.toBeNull();

      expect(
        screen.getByTestId("detail-favorite-toggle-button"),
      ).toBeDisabled();
      expect(screen.getByTestId("novel-detail-menu-button")).toBeDisabled();
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

    it("BatchCachingWithFailures ストーリーで一括キャッシュ進行中に失敗件数（[失敗 2話]）と警告色が表示されること (AC-ND-25)", () => {
      render(<BatchCachingWithFailures />);
      const progressEl = screen.getByTestId("batch-cache-progress");
      expect(progressEl).toHaveTextContent("キャッシュ中 (5/15) [失敗 2話]...");
      expect(progressEl.className).toContain("text-amber-600");
    });

    it("Favorite ストーリーでお気に入り登録済み（★）アイコンのみボタンが描画され、aria-pressed が true であること (Issue #266, AC-ND-27)", () => {
      render(<Favorite />);
      const favButton = screen.getByTestId("detail-favorite-toggle-button");
      expect(favButton).toBeInTheDocument();
      expect(favButton).toHaveAttribute("aria-pressed", "true");
      expect(favButton).toHaveAttribute("aria-label", "お気に入り");
      expect(favButton).toHaveTextContent("★");
      expect(favButton).not.toHaveTextContent("お気に入り");
      expect(favButton).toHaveClass("border", "border-amber-300");
    });

    it("NotFavorite ストーリーでお気に入り未登録（☆）アイコンのみボタンが描画され、aria-pressed が false かつ常時 1px border を維持すること (Issue #266, AC-ND-27)", () => {
      render(<NotFavorite />);
      const favButton = screen.getByTestId("detail-favorite-toggle-button");
      expect(favButton).toBeInTheDocument();
      expect(favButton).toHaveAttribute("aria-pressed", "false");
      expect(favButton).toHaveAttribute("aria-label", "お気に入り");
      expect(favButton).toHaveTextContent("☆");
      expect(favButton).not.toHaveTextContent("お気に入り");
      expect(favButton).toHaveClass("border", "border-slate-200");
    });

    it("MenuOpen ストーリーで play 関数実行後に3点メニューが開き、4つの操作項目と区切り線が表示されること (AC-ND-27)", async () => {
      const { container } = render(<MenuOpen />);
      await act(async () => {
        await MenuOpen.play?.({ canvasElement: container });
      });

      const menuButton = screen.getByTestId("novel-detail-menu-button");
      const menu = screen.getByTestId("novel-detail-menu");
      expect(menuButton).toHaveAttribute("aria-expanded", "true");
      expect(menuButton).toHaveAttribute("aria-controls", menu.id);
      expect(menu).toHaveAttribute("role", "menu");
      expect(menu).toHaveAttribute("aria-label", "作品操作メニュー");

      expect(screen.getByTestId("batch-cache-button")).toHaveTextContent(
        "未取得話を一括キャッシュ",
      );
      expect(
        screen.getByTestId("open-clear-cache-dialog-button"),
      ).toHaveTextContent("本文キャッシュ整理");
      expect(screen.getByTestId("open-webview-button")).toHaveTextContent(
        "内蔵ブラウザで開く",
      );
      expect(screen.getByTestId("open-delete-dialog-button")).toHaveTextContent(
        "作品を削除",
      );
      expect(screen.getByRole("separator")).toBeInTheDocument();
    });

    it("MenuOpenAllCached ストーリーで「全話キャッシュ済み」項目が disabled で表示されること (AC-ND-13, AC-ND-27)", async () => {
      const { container } = render(<MenuOpenAllCached />);
      await act(async () => {
        await MenuOpenAllCached.play?.({ canvasElement: container });
      });

      const batchButton = screen.getByTestId("batch-cache-button");
      expect(batchButton).toHaveTextContent("全話キャッシュ済み");
      expect(batchButton).toBeDisabled();
    });

    it("MenuOpenRetryFailed ストーリーで「失敗した話を再試行（3話）」項目およびエラーメッセージが表示されること (AC-ND-25, AC-ND-27)", async () => {
      const { container } = render(<MenuOpenRetryFailed />);
      await act(async () => {
        await MenuOpenRetryFailed.play?.({ canvasElement: container });
      });

      const batchButton = screen.getByTestId("batch-cache-button");
      expect(batchButton).toHaveTextContent("失敗した話を再試行（3話）");
      expect(batchButton).not.toBeDisabled();

      expect(screen.getByTestId("novel-detail-error")).toHaveTextContent(
        "3話の取得に失敗しました（再試行可能）",
      );
    });

    it("MenuOpenBatchCaching ストーリーで3点メニューが開き、一括キャッシュ項目が「一括キャッシュ実行中...」かつ disabled であり他操作は活性であること (Issue #344)", async () => {
      const { container } = render(<MenuOpenBatchCaching />);
      await act(async () => {
        await MenuOpenBatchCaching.play?.({ canvasElement: container });
      });

      const batchButton = screen.getByTestId("batch-cache-button");
      expect(batchButton).toHaveTextContent("一括キャッシュ実行中...");
      expect(batchButton).toBeDisabled();
      expect(
        screen.getByTestId("open-clear-cache-dialog-button"),
      ).toBeEnabled();
      expect(screen.getByTestId("open-webview-button")).toBeEnabled();
      expect(screen.getByTestId("open-delete-dialog-button")).toBeEnabled();
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

    const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByTestId("novel-detail-menu-button"));
      return screen.getByTestId("novel-detail-menu");
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

      expect(synopsis).toHaveClass("line-clamp-2");
      expect(synopsis).not.toHaveClass("max-h-40");
      expect(toggleButton).toHaveTextContent("あらすじを展開");
      expect(toggleButton).toHaveAttribute("aria-expanded", "false");

      await user.click(toggleButton);
      expect(synopsis).not.toHaveClass("line-clamp-2");
      expect(synopsis).toHaveClass("max-h-40");
      expect(synopsis).toHaveClass("overflow-y-auto");
      expect(toggleButton).toHaveTextContent("あらすじを折りたたむ");
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");

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
          novel={{ ...sampleNovel, bookmarkChapterIndex: 3 }}
          onResumeBookmark={onResumeBookmark}
        />,
      );

      await user.click(screen.getByTestId("detail-resume-button"));
      expect(onResumeBookmark).toHaveBeenCalledTimes(1);
      expect(onResumeBookmark).toHaveBeenCalledWith(3);
    });

    it("しおり設定時に「最初から読む」ボタンをクリックすると onStartFromBeginning が呼び出されること (AC-ND-03)", async () => {
      const user = userEvent.setup();
      const onStartFromBeginning = vi.fn();

      render(
        <NovelDetailHeader
          {...defaultProps}
          novel={{ ...sampleNovel, bookmarkChapterIndex: 3 }}
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

    describe("3点メニューの開閉・アクセシビリティ・自動クローズ制御 (AC-ND-27)", () => {
      it("3点メニューボタンをクリックするとメニューが開閉トグルされ、aria-expanded / aria-controls が切り替わること", async () => {
        const user = userEvent.setup();
        render(<NovelDetailHeader {...defaultProps} />);

        const menuButton = screen.getByTestId("novel-detail-menu-button");
        expect(menuButton).toHaveAttribute("aria-expanded", "false");
        expect(menuButton).not.toHaveAttribute("aria-controls");
        expect(
          screen.queryByTestId("novel-detail-menu"),
        ).not.toBeInTheDocument();

        // 1回目クリック: 開く
        await user.click(menuButton);
        const menu = screen.getByTestId("novel-detail-menu");
        expect(menu).toBeInTheDocument();
        expect(menu.id).not.toBe("");
        expect(menuButton).toHaveAttribute("aria-expanded", "true");
        expect(menuButton).toHaveAttribute("aria-controls", menu.id);

        // 2回目クリック: 閉じる
        await user.click(menuButton);
        expect(
          screen.queryByTestId("novel-detail-menu"),
        ).not.toBeInTheDocument();
        expect(menuButton).toHaveAttribute("aria-expanded", "false");
        expect(menuButton).not.toHaveAttribute("aria-controls");
      });

      it("メニュー展開中にメニュー外をクリックするとメニューが閉じ、メニュー内のクリックでは閉じないこと", async () => {
        const user = userEvent.setup();
        render(<NovelDetailHeader {...defaultProps} />);

        const menu = await openMenu(user);

        // メニュー内部（非クリック要素・メニューコンテナ自体）での pointerdown は閉じない
        fireEvent.pointerDown(menu);
        expect(screen.getByTestId("novel-detail-menu")).toBeInTheDocument();

        // メニュー外部のクリックで自動クローズ
        await user.click(screen.getByTestId("novel-detail-title"));
        expect(
          screen.queryByTestId("novel-detail-menu"),
        ).not.toBeInTheDocument();
        expect(screen.getByTestId("novel-detail-menu-button")).toHaveAttribute(
          "aria-expanded",
          "false",
        );
      });

      it("メニュー展開中に Escape キーを押下するとメニューが閉じてトリガーボタンへフォーカスが戻り、他キーでは閉じないこと", async () => {
        const user = userEvent.setup();
        render(<NovelDetailHeader {...defaultProps} />);

        await openMenu(user);

        // Escape・矢印以外のキー（例: Tab や文字キー）では閉じない
        await user.keyboard("a");
        expect(screen.getByTestId("novel-detail-menu")).toBeInTheDocument();

        // Escape 以外の矢印キーでも閉じない
        await user.keyboard("{ArrowDown}");
        expect(screen.getByTestId("novel-detail-menu")).toBeInTheDocument();

        // Escape で閉じてトリガーボタンにフォーカスが戻る
        await user.keyboard("{Escape}");
        expect(
          screen.queryByTestId("novel-detail-menu"),
        ).not.toBeInTheDocument();
        const menuButton = screen.getByTestId("novel-detail-menu-button");
        expect(menuButton).toHaveAttribute("aria-expanded", "false");
        expect(menuButton).toHaveFocus();
      });

      it("メニュー展開中に ArrowDown / ArrowUp キーで活性な menuitem 要素間を循環してフォーカス移動できること (AC-ND-27)", async () => {
        const user = userEvent.setup();
        render(<NovelDetailHeader {...defaultProps} />);

        await openMenu(user);

        const batchItem = screen.getByTestId("batch-cache-button");
        const clearItem = screen.getByTestId("open-clear-cache-dialog-button");
        const webViewItem = screen.getByTestId("open-webview-button");
        const deleteItem = screen.getByTestId("open-delete-dialog-button");

        await user.keyboard("{ArrowDown}");
        expect(batchItem).toHaveFocus();

        await user.keyboard("{ArrowDown}");
        expect(clearItem).toHaveFocus();

        await user.keyboard("{ArrowDown}");
        expect(webViewItem).toHaveFocus();

        await user.keyboard("{ArrowDown}");
        expect(deleteItem).toHaveFocus();

        // 末尾から ArrowDown で先頭に循環する
        await user.keyboard("{ArrowDown}");
        expect(batchItem).toHaveFocus();

        // 先頭から ArrowUp で末尾に循環する
        await user.keyboard("{ArrowUp}");
        expect(deleteItem).toHaveFocus();

        await user.keyboard("{ArrowUp}");
        expect(webViewItem).toHaveFocus();
      });

      it("disabled なメニュー項目がある場合は ArrowDown / ArrowUp で無効項目をスキップして循環すること (AC-ND-27)", async () => {
        const user = userEvent.setup();
        render(
          <NovelDetailHeader
            {...defaultProps}
            isAllCached={true}
            novel={{ ...sampleNovel, cachedChapters: 0 }}
          />,
        );

        await openMenu(user);

        expect(screen.getByTestId("batch-cache-button")).toBeDisabled();
        expect(
          screen.getByTestId("open-clear-cache-dialog-button"),
        ).toBeDisabled();
        const webViewItem = screen.getByTestId("open-webview-button");
        const deleteItem = screen.getByTestId("open-delete-dialog-button");

        // メニューボタンにフォーカスがある状態で ArrowUp すると末尾の活性項目へ移動する
        await user.keyboard("{ArrowUp}");
        expect(deleteItem).toHaveFocus();

        await user.keyboard("{ArrowUp}");
        expect(webViewItem).toHaveFocus();

        await user.keyboard("{ArrowDown}");
        expect(deleteItem).toHaveFocus();

        await user.keyboard("{ArrowDown}");
        expect(webViewItem).toHaveFocus();
      });

      it("活性なメニュー項目が0件の状態で ArrowDown / ArrowUp を押下してもエラーにならないこと (AC-ND-27)", async () => {
        const user = userEvent.setup();
        render(<NovelDetailHeader {...defaultProps} />);

        const menu = await openMenu(user);
        menu.querySelectorAll('[role="menuitem"]').forEach((item) => {
          item.setAttribute("disabled", "true");
        });

        await user.keyboard("{ArrowDown}");
        expect(screen.getByTestId("novel-detail-menu-button")).toHaveFocus();
      });

      it("メニュー展開中に isRefreshing が true に遷移した場合はメニューが自動クローズし false 復帰後も閉じたまま維持される一方、isBatchCaching === true 遷移時は非ブロッキングでメニュー操作可能であること", async () => {
        const user = userEvent.setup();
        const { rerender } = render(<NovelDetailHeader {...defaultProps} />);

        // isRefreshing 遷移による自動クローズ
        await openMenu(user);
        expect(screen.getByTestId("novel-detail-menu")).toBeInTheDocument();

        rerender(<NovelDetailHeader {...defaultProps} isRefreshing={true} />);
        expect(
          screen.queryByTestId("novel-detail-menu"),
        ).not.toBeInTheDocument();
        expect(screen.getByTestId("novel-detail-menu-button")).toBeDisabled();

        // false に戻っても閉じたまま
        rerender(<NovelDetailHeader {...defaultProps} isRefreshing={false} />);
        expect(
          screen.queryByTestId("novel-detail-menu"),
        ).not.toBeInTheDocument();

        // isBatchCaching === true に遷移してもメニューボタンは活性であり展開可能
        await openMenu(user);
        expect(screen.getByTestId("novel-detail-menu")).toBeInTheDocument();

        rerender(<NovelDetailHeader {...defaultProps} isBatchCaching={true} />);
        expect(screen.getByTestId("novel-detail-menu")).toBeInTheDocument();
        expect(screen.getByTestId("novel-detail-menu-button")).toBeEnabled();
        expect(screen.getByTestId("batch-cache-button")).toHaveTextContent(
          "一括キャッシュ実行中...",
        );
        expect(screen.getByTestId("batch-cache-button")).toBeDisabled();
      });

      it("作品削除メニュー項目（open-delete-dialog-button）をクリックするとメニューが閉じて onOpenDeleteDialog が呼び出されること", async () => {
        const user = userEvent.setup();
        const onOpenDeleteDialog = vi.fn();

        render(
          <NovelDetailHeader
            {...defaultProps}
            onOpenDeleteDialog={onOpenDeleteDialog}
          />,
        );

        await openMenu(user);
        const deleteItem = screen.getByTestId("open-delete-dialog-button");
        expect(deleteItem).toHaveAttribute("role", "menuitem");

        await user.click(deleteItem);
        expect(onOpenDeleteDialog).toHaveBeenCalledTimes(1);
        expect(
          screen.queryByTestId("novel-detail-menu"),
        ).not.toBeInTheDocument();
      });
    });

    describe("未取得話一括キャッシュ関連の表示・活性制御 (AC-ND-11, AC-ND-12, AC-ND-13)", () => {
      it("BatchCaching ストーリーで進行状況（3/15）と中断ボタンが表示され、読書ボタンと3アイコンボタンは非ブロッキングで活性であること (Issue #344)", () => {
        render(<BatchCaching />);

        expect(screen.getByTestId("batch-cache-progress")).toHaveTextContent(
          "キャッシュ中 (3/15)...",
        );
        expect(
          screen.getByTestId("batch-cache-cancel-button"),
        ).toHaveTextContent("中断");
        expect(
          screen.queryByTestId("novel-detail-menu"),
        ).not.toBeInTheDocument();

        expect(screen.getByTestId("detail-read-first-button")).toBeEnabled();
        expect(
          screen.getByTestId("detail-favorite-toggle-button"),
        ).toBeEnabled();
        expect(screen.getByTestId("refresh-toc-button")).toBeEnabled();
        expect(screen.getByTestId("novel-detail-menu-button")).toBeEnabled();
      });

      it("isBatchCaching === true かつ failedCacheCount > 0 のとき、進行表示に「[失敗 N話]」が含まれ警告色クラスが付与されること (AC-ND-25)", () => {
        render(
          <NovelDetailHeader
            {...defaultProps}
            isBatchCaching={true}
            batchCacheProgress={{ current: 5, total: 15 }}
            failedCacheCount={2}
          />,
        );

        const progressEl = screen.getByTestId("batch-cache-progress");
        expect(progressEl).toHaveTextContent(
          "キャッシュ中 (5/15) [失敗 2話]...",
        );
        expect(progressEl.className).toContain("text-amber-600");
      });

      it("ResumePending ストーリーで3点メニュー内の「キャッシュを再開（残り7話）」項目が表示されること (AC-ND-24)", async () => {
        const user = userEvent.setup();
        render(<ResumePending />);

        await openMenu(user);
        const batchButton = screen.getByTestId("batch-cache-button");
        expect(batchButton).toBeInTheDocument();
        expect(batchButton).toHaveTextContent("キャッシュを再開（残り7話）");
        expect(batchButton).not.toBeDisabled();
      });

      it("RetryFailed ストーリーで3点メニュー内の「失敗した話を再試行（3話）」項目およびエラーメッセージが表示されること (AC-ND-25)", async () => {
        const user = userEvent.setup();
        render(<RetryFailed />);

        await openMenu(user);
        const batchButton = screen.getByTestId("batch-cache-button");
        expect(batchButton).toBeInTheDocument();
        expect(batchButton).toHaveTextContent("失敗した話を再試行（3話）");
        expect(batchButton).not.toBeDisabled();

        const errorEl = screen.getByTestId("novel-detail-error");
        expect(errorEl).toHaveTextContent(
          "3話の取得に失敗しました（再試行可能）",
        );
      });

      it("AllCached ストーリーで3点メニュー内の「全話キャッシュ済み」項目が disabled 表示されること (AC-ND-13)", async () => {
        const user = userEvent.setup();
        render(<AllCached />);

        await openMenu(user);
        const batchButton = screen.getByTestId("batch-cache-button");
        expect(batchButton).toBeInTheDocument();
        expect(batchButton).toHaveTextContent("全話キャッシュ済み");
        expect(batchButton).toBeDisabled();
      });

      it("未取得話がある場合に3点メニュー内の「未取得話を一括キャッシュ」項目が有効表示され、クリック時にメニューが閉じて onStartBatchCache が呼ばれること (AC-ND-11)", async () => {
        const user = userEvent.setup();
        const onStartBatchCache = vi.fn();

        render(
          <NovelDetailHeader
            {...defaultProps}
            onStartBatchCache={onStartBatchCache}
          />,
        );

        await openMenu(user);
        const batchButton = screen.getByTestId("batch-cache-button");
        expect(batchButton).toHaveAttribute("role", "menuitem");
        expect(batchButton).toHaveTextContent("未取得話を一括キャッシュ");
        expect(batchButton).not.toBeDisabled();

        await user.click(batchButton);
        expect(onStartBatchCache).toHaveBeenCalledTimes(1);
        expect(
          screen.queryByTestId("novel-detail-menu"),
        ).not.toBeInTheDocument();
      });

      it("総話数 0 の場合は3点メニュー内の「未取得話を一括キャッシュ」項目が disabled となること (AC-ND-13)", async () => {
        const user = userEvent.setup();
        render(
          <NovelDetailHeader
            {...defaultProps}
            novel={{ ...sampleNovel, totalChapters: 0, cachedChapters: 0 }}
          />,
        );

        await openMenu(user);
        const batchButton = screen.getByTestId("batch-cache-button");
        expect(batchButton).toHaveTextContent("未取得話を一括キャッシュ");
        expect(batchButton).toBeDisabled();
      });

      it("pendingCacheCount > 0 のとき「キャッシュを再開（残りN話）」と表示され、failedCacheCount 未指定時は pendingCacheCount のみで計算されること (AC-ND-24)", async () => {
        const user = userEvent.setup();
        const onStartBatchCache = vi.fn();

        render(
          <NovelDetailHeader
            {...defaultProps}
            pendingCacheCount={4}
            onStartBatchCache={onStartBatchCache}
          />,
        );

        await openMenu(user);
        const batchButton = screen.getByTestId("batch-cache-button");
        expect(batchButton).toHaveTextContent("キャッシュを再開（残り4話）");
        expect(batchButton).not.toBeDisabled();

        await user.click(batchButton);
        expect(onStartBatchCache).toHaveBeenCalledTimes(1);
      });

      it("pendingCacheCount === 0 かつ failedCacheCount > 0 のとき「失敗した話を再試行（N話）」と表示され、クリック時に onStartBatchCache が呼ばれること (AC-ND-25)", async () => {
        const user = userEvent.setup();
        const onStartBatchCache = vi.fn();

        render(
          <NovelDetailHeader
            {...defaultProps}
            pendingCacheCount={0}
            failedCacheCount={2}
            onStartBatchCache={onStartBatchCache}
          />,
        );

        await openMenu(user);
        const batchButton = screen.getByTestId("batch-cache-button");
        expect(batchButton).toHaveTextContent("失敗した話を再試行（2話）");
        expect(batchButton).not.toBeDisabled();

        await user.click(batchButton);
        expect(onStartBatchCache).toHaveBeenCalledTimes(1);
      });

      it("一括キャッシュ実行中に中断ボタンをクリックすると onCancelBatchCache が呼ばれ、読書ボタンも引き続きクリック可能であること (Issue #344)", async () => {
        const user = userEvent.setup();
        const onCancelBatchCache = vi.fn();
        const onResumeBookmark = vi.fn();
        const onStartFromBeginning = vi.fn();

        render(
          <NovelDetailHeader
            {...defaultProps}
            novel={{ ...sampleNovel, bookmarkChapterIndex: 2 }}
            isBatchCaching={true}
            batchCacheProgress={{ current: 1, total: 5 }}
            onCancelBatchCache={onCancelBatchCache}
            onResumeBookmark={onResumeBookmark}
            onStartFromBeginning={onStartFromBeginning}
          />,
        );

        const cancelButton = screen.getByTestId("batch-cache-cancel-button");
        await user.click(cancelButton);
        expect(onCancelBatchCache).toHaveBeenCalledTimes(1);

        const resumeButton = screen.getByTestId("detail-resume-button");
        const readFirstButton = screen.getByTestId("detail-read-first-button");
        expect(resumeButton).toBeEnabled();
        expect(readFirstButton).toBeEnabled();

        await user.click(resumeButton);
        await user.click(readFirstButton);
        expect(onResumeBookmark).toHaveBeenCalledTimes(1);
        expect(onStartFromBeginning).toHaveBeenCalledTimes(1);
      });

      it("一括キャッシュ実行中で batchCacheProgress が null の場合、「キャッシュ中...」と表示されること", () => {
        render(
          <NovelDetailHeader
            {...defaultProps}
            isBatchCaching={true}
            batchCacheProgress={null}
          />,
        );

        expect(screen.getByTestId("batch-cache-progress")).toHaveTextContent(
          "キャッシュ中...",
        );
      });
    });

    describe("キャッシュ容量表示と本文キャッシュ整理メニュー項目制御 (AC-ND-20, AC-ND-21, TR-19)", () => {
      it("キャッシュ容量が formatByteSize により正しくフォーマット表示されること (AC-ND-20)", () => {
        const { rerender } = render(
          <NovelDetailHeader
            {...defaultProps}
            novel={{
              ...sampleNovel,
              totalChapters: 10,
              cachedChapters: 3,
              totalByteSize: 1048576, // 1.0 MB
            }}
          />,
        );

        expect(screen.getByTestId("novel-detail-stats")).toHaveTextContent(
          "全 10 話（取得済み 3 話 / 1.0 MB）",
        );

        rerender(
          <NovelDetailHeader
            {...defaultProps}
            novel={{
              ...sampleNovel,
              totalChapters: 5,
              cachedChapters: 0,
              totalByteSize: 0,
            }}
          />,
        );

        expect(screen.getByTestId("novel-detail-stats")).toHaveTextContent(
          "全 5 話（取得済み 0 話 / 0 B）",
        );
      });

      it("キャッシュ取得済み（cachedChapters > 0）かつ非実行中のとき、本文キャッシュ整理メニュー項目が活性化し、クリックでメニューが閉じて onOpenClearCacheDialog が呼ばれること (AC-ND-21, TR-19)", async () => {
        const user = userEvent.setup();
        const onOpenClearCacheDialog = vi.fn();

        render(
          <NovelDetailHeader
            {...defaultProps}
            novel={{
              ...sampleNovel,
              cachedChapters: 5,
            }}
            onOpenClearCacheDialog={onOpenClearCacheDialog}
          />,
        );

        await openMenu(user);
        const clearCacheButton = screen.getByTestId(
          "open-clear-cache-dialog-button",
        );
        expect(clearCacheButton).toHaveAttribute("role", "menuitem");
        expect(clearCacheButton).not.toBeDisabled();
        expect(clearCacheButton).toHaveTextContent("本文キャッシュ整理");

        await user.click(clearCacheButton);
        expect(onOpenClearCacheDialog).toHaveBeenCalledTimes(1);
        expect(
          screen.queryByTestId("novel-detail-menu"),
        ).not.toBeInTheDocument();
      });

      it("cachedChapters === 0 のとき本文キャッシュ整理メニュー項目が disabled であること (AC-ND-21)", async () => {
        const user = userEvent.setup();
        render(
          <NovelDetailHeader
            {...defaultProps}
            novel={{
              ...sampleNovel,
              cachedChapters: 0,
            }}
          />,
        );

        await openMenu(user);
        const clearCacheButton = screen.getByTestId(
          "open-clear-cache-dialog-button",
        );
        expect(clearCacheButton).toBeDisabled();
      });

      it("onOpenClearCacheDialog が省略された場合でもクリック時にエラーにならないこと", async () => {
        const user = userEvent.setup();
        render(<NovelDetailHeader {...defaultProps} />);

        await openMenu(user);
        const clearCacheButton = screen.getByTestId(
          "open-clear-cache-dialog-button",
        );
        await expect(user.click(clearCacheButton)).resolves.not.toThrow();
        expect(
          screen.queryByTestId("novel-detail-menu"),
        ).not.toBeInTheDocument();
      });
    });

    describe("お気に入り（★）アイコンボタンの検証 (Issue #266, AC-ND-27)", () => {
      it("お気に入りボタンをクリックしたときに onToggleFavorite が呼び出されること (Issue #266)", async () => {
        const user = userEvent.setup();
        const onToggleFavorite = vi.fn();

        render(
          <NovelDetailHeader
            {...defaultProps}
            onToggleFavorite={onToggleFavorite}
          />,
        );

        const favButton = screen.getByTestId("detail-favorite-toggle-button");
        await user.click(favButton);

        expect(onToggleFavorite).toHaveBeenCalledTimes(1);
      });

      it("目次更新中（isRefreshing === true）のときお気に入りボタンが disabled であること (Issue #266)", () => {
        render(<NovelDetailHeader {...defaultProps} isRefreshing={true} />);

        const favButton = screen.getByTestId("detail-favorite-toggle-button");
        expect(favButton).toBeDisabled();
      });

      it("一括キャッシュ中（isBatchCaching === true）でもお気に入りボタンが活性でありクリックできること (Issue #344)", async () => {
        const user = userEvent.setup();
        const onToggleFavorite = vi.fn();

        render(
          <NovelDetailHeader
            {...defaultProps}
            isBatchCaching={true}
            onToggleFavorite={onToggleFavorite}
          />,
        );

        const favButton = screen.getByTestId("detail-favorite-toggle-button");
        expect(favButton).toBeEnabled();
        await user.click(favButton);
        expect(onToggleFavorite).toHaveBeenCalledTimes(1);
      });

      it("onToggleFavorite が省略された場合でもボタンクリックでエラーにならないこと (Issue #266)", async () => {
        const user = userEvent.setup();

        render(<NovelDetailHeader {...defaultProps} />);

        const favButton = screen.getByTestId("detail-favorite-toggle-button");
        await expect(user.click(favButton)).resolves.not.toThrow();
      });
    });

    describe("「内蔵ブラウザで開く」メニュー項目の検証 (Issue #269 / AC-ND-26, AC-ND-27, TR-09)", () => {
      it("「内蔵ブラウザで開く」メニュー項目が表示され、クリック時にメニューが閉じて onOpenWebView が呼び出されること", async () => {
        const user = userEvent.setup();
        const onOpenWebView = vi.fn();

        render(
          <NovelDetailHeader {...defaultProps} onOpenWebView={onOpenWebView} />,
        );

        await openMenu(user);
        const openBrowserButton = screen.getByTestId("open-webview-button");
        expect(openBrowserButton).toHaveAttribute("role", "menuitem");
        expect(openBrowserButton).toHaveTextContent("内蔵ブラウザで開く");
        expect(openBrowserButton).not.toBeDisabled();

        await user.click(openBrowserButton);
        expect(onOpenWebView).toHaveBeenCalledTimes(1);
        expect(
          screen.queryByTestId("novel-detail-menu"),
        ).not.toBeInTheDocument();
      });

      it("onOpenWebView が省略された場合でもクリック時にエラーにならないこと", async () => {
        const user = userEvent.setup();

        render(<NovelDetailHeader {...defaultProps} />);

        await openMenu(user);
        const openBrowserButton = screen.getByTestId("open-webview-button");
        await expect(user.click(openBrowserButton)).resolves.not.toThrow();
        expect(
          screen.queryByTestId("novel-detail-menu"),
        ).not.toBeInTheDocument();
      });
    });
  });
});

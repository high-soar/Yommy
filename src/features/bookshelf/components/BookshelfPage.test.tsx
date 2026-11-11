import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./BookshelfPage.stories";
import { BookshelfPage } from "./BookshelfPage";
import * as BookshelfEmptyStateModule from "./BookshelfEmptyState";
import * as NovelCardModule from "./NovelCard";
import type { NovelSummary } from "../../../storage/types";

const {
  WithNovels,
  Empty,
  Loading,
  CheckingUpdates,
  SortedByLatestPublished,
  FavoriteFilterActive,
  FavoriteFilterEmpty,
} = composeStories(stories);

const sampleNovels: NovelSummary[] = [
  {
    id: "kakuyomu:16817330658027210412",
    siteType: "kakuyomu",
    remoteWorkId: "16817330658027210412",
    canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
    title: "境界迷宮と異界の魔術師",
    author: "小野崎",
    totalChapters: 45,
    cachedChapters: 12,
    totalByteSize: 102400,
    bookmarkChapterIndex: 5,
    bookmarkScrollProgress: 0.42,
    isFavorite: false,
    lastCheckedAt: null,
    lastReadAt: "2026-10-26T07:00:00Z",
    createdAt: "2026-10-25T10:00:00Z",
    updatedAt: "2026-10-26T07:00:00Z",
  },
  {
    id: "kakuyomu:1177354054881162325",
    siteType: "kakuyomu",
    remoteWorkId: "1177354054881162325",
    canonicalUrl: "https://kakuyomu.jp/works/1177354054881162325",
    title: "魔王軍の最強魔術師は人間だった",
    author: "羽田遼亮",
    totalChapters: 10,
    cachedChapters: 0,
    totalByteSize: 0,
    bookmarkChapterIndex: null,
    bookmarkScrollProgress: 0,
    isFavorite: false,
    lastCheckedAt: null,
    lastReadAt: null,
    createdAt: "2026-10-25T12:00:00Z",
    updatedAt: "2026-10-25T12:00:00Z",
  },
];

describe("BookshelfPage", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("WithNovels ストーリーでヘッダー・作品一覧が表示され、URL追加ボタンや空状態・ローディングが表示されないこと (AC-BS-04, AC-BS-07)", () => {
      render(<WithNovels />);
      expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      expect(screen.getByTestId("novel-list")).toBeInTheDocument();
      expect(screen.getAllByTestId("novel-card")).toHaveLength(2);
      expect(screen.queryByTestId("bookshelf-loading")).not.toBeInTheDocument();
      expect(screen.queryByTestId("bookshelf-empty")).not.toBeInTheDocument();

      // URL追加ボタンおよび AddNovelDialog は廃止されていること (AC-BS-02, AC-BS-03)
      expect(
        screen.queryByTestId("open-add-novel-button"),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("add-novel-dialog")).not.toBeInTheDocument();
    });

    it("Empty ストーリーで空状態コンポーネントが表示され、検索・ランキング誘導ボタンが含まれること (AC-BS-01, TR-15)", () => {
      render(<Empty />);
      expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      expect(screen.getByTestId("bookshelf-empty")).toBeInTheDocument();
      expect(screen.getByTestId("empty-search-button")).toBeInTheDocument();
      expect(screen.getByTestId("empty-ranking-button")).toBeInTheDocument();
      expect(screen.queryByTestId("novel-list")).not.toBeInTheDocument();
      expect(screen.queryByTestId("bookshelf-loading")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("open-add-novel-button"),
      ).not.toBeInTheDocument();
    });

    it("Loading ストーリーでローディング表示になり、作品一覧や空状態が表示されないこと", () => {
      render(<Loading />);
      expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      expect(screen.getByTestId("bookshelf-loading")).toBeInTheDocument();
      expect(screen.queryByTestId("novel-list")).not.toBeInTheDocument();
      expect(screen.queryByTestId("bookshelf-empty")).not.toBeInTheDocument();
    });

    it("CheckingUpdates ストーリーで更新中進捗表示および更新ボタンのdisabled状態が反映されること (AC-BS-10)", () => {
      render(<CheckingUpdates />);
      expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      expect(screen.getByTestId("bookshelf-refresh-button")).toBeDisabled();
      expect(
        screen.getByTestId("bookshelf-refresh-progress"),
      ).toHaveTextContent("更新中 (1/2)...");
    });

    it("SortedByLatestPublished ストーリーでソートセレクターの値が「作品更新日順」となっていること (AC-BS-11)", () => {
      render(<SortedByLatestPublished />);
      expect(screen.getByTestId("bookshelf-sort-select")).toHaveValue(
        "latest_published",
      );
    });

    it("FavoriteFilterActive ストーリーでお気に入りフィルタボタンが aria-pressed=true かつ ★ アイコンのみで強調表示され、絞り込まれた作品のみ描画されること (Issue #266, R2-20)", () => {
      render(<FavoriteFilterActive />);
      const filterButton = screen.getByTestId(
        "bookshelf-favorite-filter-button",
      );
      expect(filterButton).toBeInTheDocument();
      expect(filterButton).toHaveAttribute("aria-pressed", "true");
      expect(filterButton).toHaveAttribute("aria-label", "お気に入りのみ表示");
      expect(filterButton.textContent?.trim()).toBe("★");
      expect(filterButton).toHaveClass(
        "shrink-0",
        "whitespace-nowrap",
        "border-amber-300",
      );
      expect(screen.getByTestId("novel-list")).toBeInTheDocument();
      expect(screen.getAllByTestId("novel-card")).toHaveLength(1);
    });

    it("FavoriteFilterEmpty ストーリーでお気に入りフィルタ0件時の BookshelfEmptyState が描画されること (Issue #266)", () => {
      render(<FavoriteFilterEmpty />);
      expect(
        screen.getByTestId("bookshelf-favorite-empty"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("empty-clear-favorite-filter-button"),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("bookshelf-empty")).not.toBeInTheDocument();
      expect(screen.queryByTestId("novel-list")).not.toBeInTheDocument();
    });
  });

  describe("ユーザーインタラクションおよびProps結合の検証（親子分離原則）", () => {
    it("空状態で「小説を検索する」ボタンをクリックしたときに onNavigateSearch が呼び出されること (TR-15)", () => {
      const emptyStateSpy = vi.spyOn(
        BookshelfEmptyStateModule,
        "BookshelfEmptyState",
      );
      const onNavigateSearch = vi.fn();
      const onNavigateRanking = vi.fn();

      render(
        <BookshelfPage
          novels={[]}
          isLoading={false}
          onNavigateSearch={onNavigateSearch}
          onNavigateRanking={onNavigateRanking}
          onSelectNovel={vi.fn()}
          onResumeNovel={vi.fn()}
        />,
      );

      expect(emptyStateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          onNavigateSearch,
          onNavigateRanking,
        }),
        undefined,
      );

      const passedProps =
        emptyStateSpy.mock.calls[emptyStateSpy.mock.calls.length - 1][0];
      passedProps.onNavigateSearch?.();

      expect(onNavigateSearch).toHaveBeenCalledTimes(1);
      expect(onNavigateRanking).not.toHaveBeenCalled();
      emptyStateSpy.mockRestore();
    });

    it("空状態で「ランキングを見る」ボタンをクリックしたときに onNavigateRanking が呼び出されること (TR-15)", () => {
      const emptyStateSpy = vi.spyOn(
        BookshelfEmptyStateModule,
        "BookshelfEmptyState",
      );
      const onNavigateSearch = vi.fn();
      const onNavigateRanking = vi.fn();

      render(
        <BookshelfPage
          novels={[]}
          isLoading={false}
          onNavigateSearch={onNavigateSearch}
          onNavigateRanking={onNavigateRanking}
          onSelectNovel={vi.fn()}
          onResumeNovel={vi.fn()}
        />,
      );

      expect(emptyStateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          onNavigateSearch,
          onNavigateRanking,
        }),
        undefined,
      );

      const passedProps =
        emptyStateSpy.mock.calls[emptyStateSpy.mock.calls.length - 1][0];
      passedProps.onNavigateRanking?.();

      expect(onNavigateRanking).toHaveBeenCalledTimes(1);
      expect(onNavigateSearch).not.toHaveBeenCalled();
      emptyStateSpy.mockRestore();
    });

    it("作品カードの選択時に onSelectNovel が正しい novelId で呼び出されること (AC-BS-05, TR-02)", () => {
      const novelCardSpy = vi.spyOn(NovelCardModule, "NovelCard");
      const onSelectNovel = vi.fn();

      render(
        <BookshelfPage
          novels={sampleNovels}
          isLoading={false}
          onNavigateSearch={vi.fn()}
          onNavigateRanking={vi.fn()}
          onSelectNovel={onSelectNovel}
          onResumeNovel={vi.fn()}
        />,
      );

      expect(novelCardSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          novel: sampleNovels[0],
          onSelect: onSelectNovel,
        }),
        undefined,
      );

      const passedProps = novelCardSpy.mock.calls[0][0];
      passedProps.onSelect(sampleNovels[0].id);

      expect(onSelectNovel).toHaveBeenCalledWith(sampleNovels[0].id);
      novelCardSpy.mockRestore();
    });

    it("作品カードの「続きから読む」クリック時に onResumeNovel が正しい引数で呼び出されること (AC-BS-06, TR-03)", () => {
      const novelCardSpy = vi.spyOn(NovelCardModule, "NovelCard");
      const onResumeNovel = vi.fn();

      render(
        <BookshelfPage
          novels={sampleNovels}
          isLoading={false}
          onNavigateSearch={vi.fn()}
          onNavigateRanking={vi.fn()}
          onSelectNovel={vi.fn()}
          onResumeNovel={onResumeNovel}
        />,
      );

      expect(novelCardSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          novel: sampleNovels[0],
          onResume: onResumeNovel,
        }),
        undefined,
      );

      const passedProps = novelCardSpy.mock.calls[0][0];
      passedProps.onResume?.(
        sampleNovels[0].id,
        sampleNovels[0].bookmarkChapterIndex!,
      );

      expect(onResumeNovel).toHaveBeenCalledWith(
        sampleNovels[0].id,
        sampleNovels[0].bookmarkChapterIndex,
      );
      novelCardSpy.mockRestore();
    });

    it("ソートセレクターを変更したときに onSortChange が選択されたソート順で呼び出されること (AC-BS-11, TR-16)", async () => {
      const user = userEvent.setup();
      const onSortChange = vi.fn();

      render(
        <BookshelfPage
          novels={sampleNovels}
          isLoading={false}
          sortOrder="unread_first"
          onSortChange={onSortChange}
          onSelectNovel={vi.fn()}
          onResumeNovel={vi.fn()}
        />,
      );

      const sortSelect = screen.getByTestId("bookshelf-sort-select");
      expect(sortSelect).toHaveValue("unread_first");

      // 5つの選択肢が存在すること
      expect(
        screen.getByRole("option", { name: "更新あり優先" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "最近読んだ順" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "作品更新日順" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "登録日順" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "タイトル順" }),
      ).toBeInTheDocument();

      await user.selectOptions(sortSelect, "title");
      expect(onSortChange).toHaveBeenCalledWith("title");
    });

    it("更新ボタンをクリックしたときに onCheckUpdates が呼び出されること (AC-BS-10, TR-17)", async () => {
      const user = userEvent.setup();
      const onCheckUpdates = vi.fn();

      render(
        <BookshelfPage
          novels={sampleNovels}
          isLoading={false}
          isCheckingUpdates={false}
          onCheckUpdates={onCheckUpdates}
          onSelectNovel={vi.fn()}
          onResumeNovel={vi.fn()}
        />,
      );

      const refreshBtn = screen.getByTestId("bookshelf-refresh-button");
      expect(refreshBtn).not.toBeDisabled();
      expect(
        screen.queryByTestId("bookshelf-refresh-progress"),
      ).not.toBeInTheDocument();

      await user.click(refreshBtn);
      expect(onCheckUpdates).toHaveBeenCalledTimes(1);
    });

    it("更新チェック実行中（isCheckingUpdates === true）のときはボタンが disabled になり進捗が表示されること (AC-BS-10)", () => {
      render(
        <BookshelfPage
          novels={sampleNovels}
          isLoading={false}
          isCheckingUpdates={true}
          updateCheckProgress={{ current: 2, total: 5 }}
          onSelectNovel={vi.fn()}
          onResumeNovel={vi.fn()}
        />,
      );

      const refreshBtn = screen.getByTestId("bookshelf-refresh-button");
      expect(refreshBtn).toBeDisabled();

      const progress = screen.getByTestId("bookshelf-refresh-progress");
      expect(progress).toHaveTextContent("更新中 (2/5)...");
    });

    it("表示対象作品が0件（novels.length === 0）のときは手動更新ボタンが disabled になること (Issue #266)", () => {
      render(
        <BookshelfPage
          novels={[]}
          isLoading={false}
          isCheckingUpdates={false}
          onSelectNovel={vi.fn()}
          onResumeNovel={vi.fn()}
        />,
      );

      const refreshBtn = screen.getByTestId("bookshelf-refresh-button");
      expect(refreshBtn).toBeDisabled();
    });

    it("ヘッダーのお気に入りフィルタボタンをクリックしたときに onToggleFavoriteFilter が呼び出されること (Issue #266)", async () => {
      const user = userEvent.setup();
      const onToggleFavoriteFilter = vi.fn();

      render(
        <BookshelfPage
          novels={sampleNovels}
          isLoading={false}
          favoriteOnly={false}
          onToggleFavoriteFilter={onToggleFavoriteFilter}
          onSelectNovel={vi.fn()}
          onResumeNovel={vi.fn()}
        />,
      );

      const filterBtn = screen.getByTestId("bookshelf-favorite-filter-button");
      expect(filterBtn).toHaveAttribute("aria-pressed", "false");
      expect(filterBtn).toHaveAttribute("aria-label", "お気に入りのみ表示");
      expect(filterBtn.textContent?.trim()).toBe("☆");
      expect(filterBtn).toHaveClass(
        "shrink-0",
        "whitespace-nowrap",
        "border-slate-200",
      );

      await user.click(filterBtn);
      expect(onToggleFavoriteFilter).toHaveBeenCalledTimes(1);
    });

    it("favoriteOnly === true かつ totalNovelsCount > 0 かつ novels.length === 0 のとき、BookshelfEmptyState に isFavoriteFilterActive=true と解除コールバックが正しく伝搬されること (Issue #266, R1-04)", () => {
      const emptyStateSpy = vi.spyOn(
        BookshelfEmptyStateModule,
        "BookshelfEmptyState",
      );
      const onToggleFavoriteFilter = vi.fn();

      render(
        <BookshelfPage
          novels={[]}
          totalNovelsCount={3}
          favoriteOnly={true}
          isLoading={false}
          onToggleFavoriteFilter={onToggleFavoriteFilter}
          onSelectNovel={vi.fn()}
          onResumeNovel={vi.fn()}
        />,
      );

      expect(emptyStateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          isFavoriteFilterActive: true,
          onClearFavoriteFilter: onToggleFavoriteFilter,
        }),
        undefined,
      );

      const passedProps =
        emptyStateSpy.mock.calls[emptyStateSpy.mock.calls.length - 1][0];
      passedProps.onClearFavoriteFilter?.();
      expect(onToggleFavoriteFilter).toHaveBeenCalledTimes(1);

      emptyStateSpy.mockRestore();
    });

    it("favoriteOnly === true でも totalNovelsCount === 0 のときは通常空状態（isFavoriteFilterActive なし）が BookshelfEmptyState へ伝搬すること (Issue #266, R1-04)", () => {
      const emptyStateSpy = vi.spyOn(
        BookshelfEmptyStateModule,
        "BookshelfEmptyState",
      );

      render(
        <BookshelfPage
          novels={[]}
          totalNovelsCount={0}
          favoriteOnly={true}
          isLoading={false}
          onSelectNovel={vi.fn()}
          onResumeNovel={vi.fn()}
        />,
      );

      expect(emptyStateSpy).toHaveBeenCalledWith(
        expect.not.objectContaining({
          isFavoriteFilterActive: true,
        }),
        undefined,
      );

      emptyStateSpy.mockRestore();
    });

    it("onToggleFavoriteNovel が指定された場合、各 NovelCard にコールバックが正しく伝搬されること (Issue #266, R1-04)", () => {
      const novelCardSpy = vi.spyOn(NovelCardModule, "NovelCard");
      const onToggleFavoriteNovel = vi.fn();

      render(
        <BookshelfPage
          novels={sampleNovels}
          isLoading={false}
          onToggleFavoriteNovel={onToggleFavoriteNovel}
          onSelectNovel={vi.fn()}
          onResumeNovel={vi.fn()}
        />,
      );

      expect(novelCardSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          novel: sampleNovels[0],
          onToggleFavorite: onToggleFavoriteNovel,
        }),
        undefined,
      );

      const passedProps = novelCardSpy.mock.calls[0][0];
      passedProps.onToggleFavorite?.(sampleNovels[0].id, true);
      expect(onToggleFavoriteNovel).toHaveBeenCalledWith(
        sampleNovels[0].id,
        true,
      );

      novelCardSpy.mockRestore();
    });
  });
});

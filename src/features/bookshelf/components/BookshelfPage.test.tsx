import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./BookshelfPage.stories";
import { BookshelfPage } from "./BookshelfPage";
import type { NovelSummary } from "../../../storage/types";

const { WithNovels, Empty, Loading } = composeStories(stories);

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
  });

  describe("ユーザーインタラクションおよびProps結合の検証（親子分離原則）", () => {
    it("空状態で「小説を検索する」ボタンをクリックしたときに onNavigateSearch が呼び出されること (TR-15)", async () => {
      const user = userEvent.setup();
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

      const searchBtn = screen.getByTestId("empty-search-button");
      await user.click(searchBtn);

      expect(onNavigateSearch).toHaveBeenCalledTimes(1);
      expect(onNavigateRanking).not.toHaveBeenCalled();
    });

    it("空状態で「ランキングを見る」ボタンをクリックしたときに onNavigateRanking が呼び出されること (TR-15)", async () => {
      const user = userEvent.setup();
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

      const rankingBtn = screen.getByTestId("empty-ranking-button");
      await user.click(rankingBtn);

      expect(onNavigateRanking).toHaveBeenCalledTimes(1);
      expect(onNavigateSearch).not.toHaveBeenCalled();
    });

    it("作品カードの選択時に onSelectNovel が正しい novelId で呼び出されること (AC-BS-05, TR-02)", async () => {
      const user = userEvent.setup();
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

      const selectButtons = screen.getAllByTestId("novel-card-select");
      await user.click(selectButtons[0]);

      expect(onSelectNovel).toHaveBeenCalledWith(sampleNovels[0].id);
    });

    it("作品カードの「続きから読む」クリック時に onResumeNovel が正しい引数で呼び出されること (AC-BS-06, TR-03)", async () => {
      const user = userEvent.setup();
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

      const resumeButtons = screen.getAllByTestId("novel-card-resume");
      await user.click(resumeButtons[0]);

      expect(onResumeNovel).toHaveBeenCalledWith(
        sampleNovels[0].id,
        sampleNovels[0].bookmarkChapterIndex,
      );
    });
  });
});

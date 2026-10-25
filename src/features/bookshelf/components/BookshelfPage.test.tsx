import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./BookshelfPage.stories";
import { BookshelfPage } from "./BookshelfPage";
import type { NovelSummary } from "../../../storage/types";

const { WithNovels, Empty, Loading, WithAddDialog } = composeStories(stories);

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
    it("WithNovels ストーリーでヘッダー・作品一覧が表示され、空状態やローディングが表示されないこと (AC-BS-04)", () => {
      render(<WithNovels />);
      expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      expect(screen.getByTestId("open-add-novel-button")).toBeInTheDocument();
      expect(screen.getByTestId("novel-list")).toBeInTheDocument();
      expect(screen.getAllByTestId("novel-card")).toHaveLength(2);
      expect(screen.queryByTestId("bookshelf-loading")).not.toBeInTheDocument();
      expect(screen.queryByTestId("bookshelf-empty")).not.toBeInTheDocument();
      expect(screen.queryByTestId("add-novel-dialog")).not.toBeInTheDocument();
    });

    it("Empty ストーリーで空状態コンポーネントが表示され、作品一覧が表示されないこと (AC-BS-01)", () => {
      render(<Empty />);
      expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      expect(screen.getByTestId("bookshelf-empty")).toBeInTheDocument();
      expect(screen.getByTestId("empty-add-novel-button")).toBeInTheDocument();
      expect(screen.queryByTestId("novel-list")).not.toBeInTheDocument();
      expect(screen.queryByTestId("bookshelf-loading")).not.toBeInTheDocument();
    });

    it("Loading ストーリーでローディング表示になり、作品一覧や空状態が表示されないこと", () => {
      render(<Loading />);
      expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      expect(screen.getByTestId("bookshelf-loading")).toBeInTheDocument();
      expect(screen.queryByTestId("novel-list")).not.toBeInTheDocument();
      expect(screen.queryByTestId("bookshelf-empty")).not.toBeInTheDocument();
    });

    it("WithAddDialog ストーリーで作品追加ダイアログが表示されること", () => {
      render(<WithAddDialog />);
      expect(screen.getByTestId("add-novel-dialog")).toBeInTheDocument();
    });
  });

  describe("ユーザーインタラクションおよびProps結合の検証（親子分離原則）", () => {
    it("ヘッダーの追加ボタンをクリックしたときに onOpenDialog が呼び出されること", async () => {
      const user = userEvent.setup();
      const onOpenDialog = vi.fn();

      render(
        <BookshelfPage
          novels={sampleNovels}
          isLoading={false}
          isDialogOpen={false}
          isSubmitting={false}
          onOpenDialog={onOpenDialog}
          onCloseDialog={vi.fn()}
          onAddNovel={vi.fn()}
          onSelectNovel={vi.fn()}
          onResumeNovel={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("open-add-novel-button"));
      expect(onOpenDialog).toHaveBeenCalledTimes(1);
    });

    it("空状態表示内の追加ボタンをクリックしたときに onOpenDialog が呼び出されること (AC-BS-01)", async () => {
      const user = userEvent.setup();
      const onOpenDialog = vi.fn();

      render(
        <BookshelfPage
          novels={[]}
          isLoading={false}
          isDialogOpen={false}
          isSubmitting={false}
          onOpenDialog={onOpenDialog}
          onCloseDialog={vi.fn()}
          onAddNovel={vi.fn()}
          onSelectNovel={vi.fn()}
          onResumeNovel={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("empty-add-novel-button"));
      expect(onOpenDialog).toHaveBeenCalledTimes(1);
    });

    it("作品カードの選択および再開アクションが親のコールバックに伝播すること (AC-BS-05, AC-BS-06)", async () => {
      const user = userEvent.setup();
      const onSelectNovel = vi.fn();
      const onResumeNovel = vi.fn();

      render(
        <BookshelfPage
          novels={sampleNovels}
          isLoading={false}
          isDialogOpen={false}
          isSubmitting={false}
          onOpenDialog={vi.fn()}
          onCloseDialog={vi.fn()}
          onAddNovel={vi.fn()}
          onSelectNovel={onSelectNovel}
          onResumeNovel={onResumeNovel}
        />,
      );

      const cards = screen.getAllByTestId("novel-card");
      expect(cards).toHaveLength(2);

      // 1件目のカード本体タップ -> onSelectNovel
      const selectButtons = screen.getAllByTestId("novel-card-select");
      await user.click(selectButtons[0]);
      expect(onSelectNovel).toHaveBeenCalledWith(sampleNovels[0].id);

      // 1件目の再開ボタンタップ -> onResumeNovel
      const resumeButtons = screen.getAllByTestId("novel-card-resume");
      await user.click(resumeButtons[0]);
      expect(onResumeNovel).toHaveBeenCalledWith(sampleNovels[0].id, 5);
    });

    it("開いているダイアログのキャンセルおよび追加操作が親のコールバックに伝播すること", async () => {
      const user = userEvent.setup();
      const onCloseDialog = vi.fn();
      const onAddNovel = vi.fn();

      render(
        <BookshelfPage
          novels={[]}
          isLoading={false}
          isDialogOpen={true}
          isSubmitting={false}
          onOpenDialog={vi.fn()}
          onCloseDialog={onCloseDialog}
          onAddNovel={onAddNovel}
          onSelectNovel={vi.fn()}
          onResumeNovel={vi.fn()}
        />,
      );

      expect(screen.getByTestId("add-novel-dialog")).toBeInTheDocument();

      // サンプルURLを入力して送信
      await user.click(screen.getByTestId("fill-sample-url-button"));
      await user.click(screen.getByTestId("add-novel-submit-button"));
      expect(onAddNovel).toHaveBeenCalledWith(
        "https://kakuyomu.jp/works/16817330658027210412",
      );

      // キャンセル
      await user.click(screen.getByTestId("add-novel-cancel-button"));
      expect(onCloseDialog).toHaveBeenCalledTimes(1);
    });
  });
});

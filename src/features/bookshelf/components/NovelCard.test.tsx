import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./NovelCard.stories";
import { NovelCard } from "./NovelCard";
import type { NovelSummary } from "../../../storage/types";

const {
  WithBookmark,
  Unread,
  UnknownAuthor,
  WithNewBadge,
  Favorite,
  Unfavorite,
} = composeStories(stories);

const dummyNovelWithBookmark: NovelSummary = {
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
};

const dummyNovelUnread: NovelSummary = {
  ...dummyNovelWithBookmark,
  id: "kakuyomu:1177354054881162325",
  title: "魔王軍の最強魔術師は人間だった",
  author: "羽田遼亮",
  totalChapters: 10,
  cachedChapters: 0,
  bookmarkChapterIndex: null,
  bookmarkScrollProgress: 0,
  lastReadAt: null,
};

describe("NovelCard", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("WithBookmark ストーリーでタイトル・著者・話数・しおりバッジ・再開ボタンが表示されること (AC-BS-04)", () => {
      render(<WithBookmark />);
      expect(screen.getByTestId("novel-card")).toHaveAttribute(
        "data-novel-id",
        dummyNovelWithBookmark.id,
      );
      expect(screen.getByTestId("novel-card-title")).toHaveTextContent(
        "境界迷宮と異界の魔術師",
      );
      expect(screen.getByTestId("novel-card-author")).toHaveTextContent(
        "小野崎",
      );
      expect(screen.getByTestId("novel-card-chapters")).toHaveTextContent(
        "全 45 話（取得済み 12 話）",
      );
      expect(screen.getByTestId("novel-card-bookmark")).toHaveTextContent(
        "しおり: 第5話",
      );
      expect(screen.getByTestId("novel-card-resume")).toHaveTextContent(
        "第5話から読む",
      );
    });

    it("Unread ストーリーで未読バッジおよび第1話から読むボタンが表示されること (AC-BS-04)", () => {
      render(<Unread />);
      expect(screen.getByTestId("novel-card-bookmark")).toHaveTextContent(
        "未読",
      );
      expect(screen.getByTestId("novel-card-resume")).toHaveTextContent(
        "第1話から読む",
      );
    });

    it("UnknownAuthor ストーリーで著者名が空文字のときに「著者不明」が表示されること (AC-BS-04)", () => {
      render(<UnknownAuthor />);
      expect(screen.getByTestId("novel-card-author")).toHaveTextContent(
        "著者不明",
      );
    });

    it("WithNewBadge ストーリーで「NEW」バッジが表示されること (AC-BS-08)", () => {
      render(<WithNewBadge />);
      expect(screen.getByTestId("novel-card-new-badge")).toHaveTextContent(
        "NEW",
      );
    });

    it("Favorite ストーリーでお気に入り登録済み（★）ボタンが描画され、aria-pressed が true であること (Issue #266)", () => {
      render(<Favorite />);
      const favButton = screen.getByTestId("novel-card-favorite-button");
      expect(favButton).toBeInTheDocument();
      expect(favButton).toHaveAttribute("aria-pressed", "true");
      expect(favButton).toHaveAttribute(
        "aria-label",
        `${dummyNovelWithBookmark.title}のお気に入りを解除`,
      );
      expect(favButton).toHaveTextContent("★");
    });

    it("Unfavorite ストーリーでお気に入り未登録（☆）ボタンが描画され、aria-pressed が false であること (Issue #266)", () => {
      render(<Unfavorite />);
      const favButton = screen.getByTestId("novel-card-favorite-button");
      expect(favButton).toBeInTheDocument();
      expect(favButton).toHaveAttribute("aria-pressed", "false");
      expect(favButton).toHaveAttribute(
        "aria-label",
        `${dummyNovelWithBookmark.title}をお気に入りに登録`,
      );
      expect(favButton).toHaveTextContent("☆");
    });
  });

  describe("ユーザーインタラクションの検証", () => {
    it("カード選択領域をクリックしたときに onSelect が呼び出されること (AC-BS-05)", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onResume = vi.fn();

      render(
        <NovelCard
          novel={dummyNovelWithBookmark}
          onSelect={onSelect}
          onResume={onResume}
        />,
      );

      await user.click(screen.getByTestId("novel-card-select"));
      expect(onSelect).toHaveBeenCalledWith(dummyNovelWithBookmark.id);
      expect(onResume).not.toHaveBeenCalled();
    });

    it("しおりあり作品の「続きから読む」ボタンをクリックしたときに onResume がしおり話数で呼び出され onSelect が呼ばれないこと (AC-BS-06)", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onResume = vi.fn();

      render(
        <NovelCard
          novel={dummyNovelWithBookmark}
          onSelect={onSelect}
          onResume={onResume}
        />,
      );

      await user.click(screen.getByTestId("novel-card-resume"));
      expect(onResume).toHaveBeenCalledWith(dummyNovelWithBookmark.id, 5);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("未読作品の「第1話から読む」ボタンをクリックしたときに onResume が第1話で呼び出されること (AC-BS-06)", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onResume = vi.fn();

      render(
        <NovelCard
          novel={dummyNovelUnread}
          onSelect={onSelect}
          onResume={onResume}
        />,
      );

      await user.click(screen.getByTestId("novel-card-resume"));
      expect(onResume).toHaveBeenCalledWith(dummyNovelUnread.id, 1);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("novel.hasNewUpdate === true のとき NEW バッジが表示され、false / undefined のときは表示されないこと (AC-BS-08)", () => {
      const { rerender } = render(
        <NovelCard
          novel={{ ...dummyNovelWithBookmark, hasNewUpdate: true }}
          onSelect={vi.fn()}
          onResume={vi.fn()}
        />,
      );
      expect(screen.getByTestId("novel-card-new-badge")).toBeInTheDocument();
      expect(screen.getByTestId("novel-card-new-badge")).toHaveTextContent(
        "NEW",
      );

      rerender(
        <NovelCard
          novel={{ ...dummyNovelWithBookmark, hasNewUpdate: false }}
          onSelect={vi.fn()}
          onResume={vi.fn()}
        />,
      );
      expect(
        screen.queryByTestId("novel-card-new-badge"),
      ).not.toBeInTheDocument();

      rerender(
        <NovelCard
          novel={{ ...dummyNovelWithBookmark, hasNewUpdate: undefined }}
          onSelect={vi.fn()}
          onResume={vi.fn()}
        />,
      );
      expect(
        screen.queryByTestId("novel-card-new-badge"),
      ).not.toBeInTheDocument();
    });

    it("お気に入りボタンをクリックしたときに onToggleFavorite が反転後の値で呼び出され、onSelect が呼ばれないこと (Issue #266)", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onResume = vi.fn();
      const onToggleFavorite = vi.fn();

      render(
        <NovelCard
          novel={{ ...dummyNovelWithBookmark, isFavorite: false }}
          onSelect={onSelect}
          onResume={onResume}
          onToggleFavorite={onToggleFavorite}
        />,
      );

      const favButton = screen.getByTestId("novel-card-favorite-button");
      await user.click(favButton);

      expect(onToggleFavorite).toHaveBeenCalledWith(
        dummyNovelWithBookmark.id,
        true,
      );
      expect(onSelect).not.toHaveBeenCalled();
      expect(onResume).not.toHaveBeenCalled();
    });

    it("お気に入り済み作品でお気に入りボタンをクリックしたときに false を引数に onToggleFavorite が呼び出されること (Issue #266)", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onResume = vi.fn();
      const onToggleFavorite = vi.fn();

      render(
        <NovelCard
          novel={{ ...dummyNovelWithBookmark, isFavorite: true }}
          onSelect={onSelect}
          onResume={onResume}
          onToggleFavorite={onToggleFavorite}
        />,
      );

      const favButton = screen.getByTestId("novel-card-favorite-button");
      await user.click(favButton);

      expect(onToggleFavorite).toHaveBeenCalledWith(
        dummyNovelWithBookmark.id,
        false,
      );
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("onToggleFavorite が未指定の場合でもお気に入りボタンクリックでエラーにならないこと (Issue #266)", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onResume = vi.fn();

      render(
        <NovelCard
          novel={dummyNovelWithBookmark}
          onSelect={onSelect}
          onResume={onResume}
        />,
      );

      const favButton = screen.getByTestId("novel-card-favorite-button");
      await expect(user.click(favButton)).resolves.not.toThrow();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });
});

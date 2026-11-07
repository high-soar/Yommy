import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./BookshelfEmptyState.stories";
import { BookshelfEmptyState } from "./BookshelfEmptyState";

const { Default, FavoriteFilterEmpty } = composeStories(stories);

describe("BookshelfEmptyState", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Default ストーリーで空状態の案内文と検索・ランキング誘導ボタンが表示されること (AC-BS-01, TR-15)", () => {
      render(<Default />);
      expect(screen.getByTestId("bookshelf-empty")).toBeInTheDocument();
      expect(
        screen.getByText("本棚に作品が登録されていません"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /作品を検索したりランキングから探して、本棚に追加しましょう/,
        ),
      ).toBeInTheDocument();

      // 検索誘導ボタン
      const searchButton = screen.getByTestId("empty-search-button");
      expect(searchButton).toBeInTheDocument();
      expect(searchButton).toHaveTextContent("🔍 小説を検索する");

      // ランキング誘導ボタン
      const rankingButton = screen.getByTestId("empty-ranking-button");
      expect(rankingButton).toBeInTheDocument();
      expect(rankingButton).toHaveTextContent("🏆 ランキングを見る");

      // 旧 URL 登録ボタンが存在しないこと (AC-BS-02)
      expect(
        screen.queryByTestId("empty-add-novel-button"),
      ).not.toBeInTheDocument();
    });

    it("FavoriteFilterEmpty ストーリーでお気に入り0件時の専用案内文とフィルタ解除ボタンが表示されること (Issue #266)", () => {
      render(<FavoriteFilterEmpty />);
      expect(
        screen.getByTestId("bookshelf-favorite-empty"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("お気に入り登録された作品がありません"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /作品カードの ☆ ボタンや作品詳細画面から、お気に入り（★）に登録できます/,
        ),
      ).toBeInTheDocument();

      const clearButton = screen.getByTestId(
        "empty-clear-favorite-filter-button",
      );
      expect(clearButton).toBeInTheDocument();
      expect(clearButton).toHaveTextContent("すべての作品を表示");

      // 通常空状態の要素は表示されないこと
      expect(screen.queryByTestId("bookshelf-empty")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("empty-search-button"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("empty-ranking-button"),
      ).not.toBeInTheDocument();
    });
  });

  describe("ユーザーインタラクションの検証", () => {
    it("「小説を検索する」ボタンをクリックしたときに onNavigateSearch が呼び出されること (AC-BS-01, TR-15)", async () => {
      const user = userEvent.setup();
      const onNavigateSearch = vi.fn();
      const onNavigateRanking = vi.fn();
      render(
        <BookshelfEmptyState
          onNavigateSearch={onNavigateSearch}
          onNavigateRanking={onNavigateRanking}
        />,
      );

      const button = screen.getByTestId("empty-search-button");
      await user.click(button);

      expect(onNavigateSearch).toHaveBeenCalledTimes(1);
      expect(onNavigateRanking).not.toHaveBeenCalled();
    });

    it("「ランキングを見る」ボタンをクリックしたときに onNavigateRanking が呼び出されること (AC-BS-01, TR-15)", async () => {
      const user = userEvent.setup();
      const onNavigateSearch = vi.fn();
      const onNavigateRanking = vi.fn();
      render(
        <BookshelfEmptyState
          onNavigateSearch={onNavigateSearch}
          onNavigateRanking={onNavigateRanking}
        />,
      );

      const button = screen.getByTestId("empty-ranking-button");
      await user.click(button);

      expect(onNavigateRanking).toHaveBeenCalledTimes(1);
      expect(onNavigateSearch).not.toHaveBeenCalled();
    });

    it("「すべての作品を表示」ボタンをクリックしたときに onClearFavoriteFilter が呼び出されること (Issue #266)", async () => {
      const user = userEvent.setup();
      const onClearFavoriteFilter = vi.fn();
      render(
        <BookshelfEmptyState
          isFavoriteFilterActive={true}
          onClearFavoriteFilter={onClearFavoriteFilter}
        />,
      );

      const button = screen.getByTestId("empty-clear-favorite-filter-button");
      await user.click(button);

      expect(onClearFavoriteFilter).toHaveBeenCalledTimes(1);
    });

    it("onClearFavoriteFilter が未指定の場合でもボタンクリックでエラーにならないこと (Issue #266)", async () => {
      const user = userEvent.setup();
      render(<BookshelfEmptyState isFavoriteFilterActive={true} />);

      const button = screen.getByTestId("empty-clear-favorite-filter-button");
      await expect(user.click(button)).resolves.not.toThrow();
    });
  });
});

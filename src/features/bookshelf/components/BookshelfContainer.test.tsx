import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./BookshelfContainer.stories";
import { BookshelfContainer } from "./BookshelfContainer";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider, useRouter } from "../../../app/router";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import type { NovelRepository, NovelSummary } from "../../../storage/types";

const { Default, Empty, WithCustomCallbacks } = composeStories(stories);

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
];

function createMockNovelRepo(
  initialList: NovelSummary[] = [],
): NovelRepository {
  let list = [...initialList];
  return {
    listNovels: async () => list,
    getNovelById: async (id: string) => {
      const found = list.find((n) => n.id === id);
      if (!found) return null;
      return { ...found, synopsis: "あらすじ" };
    },
    upsertNovelWithToc: async () => {
      const novel = sampleNovels[0];
      list = [novel, ...list];
      return { ...novel, synopsis: "あらすじ" };
    },
    updateBookmark: async () => {},
    deleteNovel: async (id: string) => {
      list = list.filter((n) => n.id !== id);
    },
    clearNewUpdate: async () => {},
    updateLastCheckedAt: async () => {},
  };
}

/**
 * ルーターパスとコンテナを同時に観測するためのテストヘルパー
 */
const RouteObserverWrapper: React.FC<{
  onSelectNovel?: (novelId: string) => void;
  onResumeNovel?: (novelId: string, chapterIndex: number) => void;
}> = ({ onSelectNovel, onResumeNovel }) => {
  const router = useRouter();

  return (
    <div>
      <div data-testid="observed-current-path">{router.currentPath}</div>
      <BookshelfContainer
        onSelectNovel={onSelectNovel}
        onResumeNovel={onResumeNovel}
      />
    </div>
  );
};

describe("BookshelfContainer", () => {
  beforeEach(async () => {
    await resetTestDb();
    window.history.pushState(null, "", "/");
  });

  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Default ストーリーで登録済み作品一覧が表示されること (AC-BS-04)", async () => {
      render(<Default />);
      await waitFor(() => {
        expect(screen.getByTestId("novel-list")).toBeInTheDocument();
      });
      expect(screen.getAllByTestId("novel-card")).toHaveLength(2);
    });

    it("Empty ストーリーで空状態コンポーネントが表示され、検索・ランキング誘導ボタンが含まれること (AC-BS-01, TR-15)", async () => {
      render(<Empty />);
      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-empty")).toBeInTheDocument();
      });
      expect(screen.getByTestId("empty-search-button")).toBeInTheDocument();
      expect(screen.getByTestId("empty-ranking-button")).toBeInTheDocument();
      expect(
        screen.queryByTestId("open-add-novel-button"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("empty-add-novel-button"),
      ).not.toBeInTheDocument();
    });

    it("WithCustomCallbacks ストーリーで作品カードが表示されること", async () => {
      render(<WithCustomCallbacks />);
      await waitFor(() => {
        expect(screen.getByTestId("novel-list")).toBeInTheDocument();
      });
    });
  });

  describe("ルーティング連携とコールバックの検証（TR-02, TR-03）", () => {
    it("onSelectNovel 省略時はカード選択で router.navigateToNovelDetail が実行されること (TR-02, AC-BS-05)", async () => {
      const user = userEvent.setup();
      const novelRepo = createMockNovelRepo(sampleNovels);

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider initialPath="/">
            <RouteObserverWrapper />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("novel-list")).toBeInTheDocument();
      });

      const selectButton = screen.getByTestId("novel-card-select");
      await user.click(selectButton);

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/novels/kakuyomu%3A16817330658027210412",
        );
      });
    });

    it("onSelectNovel 注入時はカード選択で注入されたコールバックが呼び出され、ルーター遷移しないこと (AC-BS-05)", async () => {
      const user = userEvent.setup();
      const novelRepo = createMockNovelRepo(sampleNovels);
      const customSelect = vi.fn();

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider initialPath="/">
            <RouteObserverWrapper onSelectNovel={customSelect} />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("novel-list")).toBeInTheDocument();
      });

      const selectButton = screen.getByTestId("novel-card-select");
      await user.click(selectButton);

      expect(customSelect).toHaveBeenCalledWith(sampleNovels[0].id);
      expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
        "/",
      );
    });

    it("onResumeNovel 省略時は「続きから読む」で router.navigateToReader が実行されること (TR-03, AC-BS-06)", async () => {
      const user = userEvent.setup();
      const novelRepo = createMockNovelRepo(sampleNovels);

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider initialPath="/">
            <RouteObserverWrapper />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("novel-list")).toBeInTheDocument();
      });

      const resumeButton = screen.getByTestId("novel-card-resume");
      await user.click(resumeButton);

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/novels/kakuyomu%3A16817330658027210412/chapters/5",
        );
      });
    });

    it("onResumeNovel 注入時は「続きから読む」で注入されたコールバックが呼び出され、ルーター遷移しないこと (AC-BS-06)", async () => {
      const user = userEvent.setup();
      const novelRepo = createMockNovelRepo(sampleNovels);
      const customResume = vi.fn();

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider initialPath="/">
            <RouteObserverWrapper onResumeNovel={customResume} />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("novel-list")).toBeInTheDocument();
      });

      const resumeButton = screen.getByTestId("novel-card-resume");
      await user.click(resumeButton);

      expect(customResume).toHaveBeenCalledWith(sampleNovels[0].id, 5);
      expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
        "/",
      );
    });
  });

  describe("空状態からの検索・ランキング誘導ナビゲーション検証（TR-15, AC-BS-01）", () => {
    it("空状態で「小説を検索する」ボタン押下時に router.navigateToSearch が実行され /search へ遷移すること (TR-15)", async () => {
      const user = userEvent.setup();
      const novelRepo = createMockNovelRepo([]);

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider initialPath="/">
            <RouteObserverWrapper />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-empty")).toBeInTheDocument();
      });

      const searchBtn = screen.getByTestId("empty-search-button");
      await user.click(searchBtn);

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/search",
        );
      });
    });

    it("空状態で「ランキングを見る」ボタン押下時に router.navigateToRanking が実行され /ranking へ遷移すること (TR-15)", async () => {
      const user = userEvent.setup();
      const novelRepo = createMockNovelRepo([]);

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider initialPath="/">
            <RouteObserverWrapper />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-empty")).toBeInTheDocument();
      });

      const rankingBtn = screen.getByTestId("empty-ranking-button");
      await user.click(rankingBtn);

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/ranking",
        );
      });
    });
  });
});

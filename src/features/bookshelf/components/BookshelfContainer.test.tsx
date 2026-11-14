import { render, screen, waitFor, act } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./BookshelfContainer.stories";
import { BookshelfContainer } from "./BookshelfContainer";
import * as BookshelfPageModule from "./BookshelfPage";
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
      const existingIndex = list.findIndex((n) => n.id === novel.id);
      if (existingIndex >= 0) {
        list[existingIndex] = novel;
      } else {
        list = [novel, ...list];
      }
      return { ...novel, synopsis: "あらすじ" };
    },
    updateBookmark: async () => {},
    setFavorite: async (id: string, isFav: boolean) => {
      const target = list.find((n) => n.id === id);
      if (target) {
        target.isFavorite = isFav;
      }
    },
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
  onNavigateSearch?: () => void;
  onNavigateRanking?: () => void;
}> = ({
  onSelectNovel,
  onResumeNovel,
  onNavigateSearch,
  onNavigateRanking,
}) => {
  const router = useRouter();

  return (
    <div>
      <div data-testid="observed-current-path">{router.currentPath}</div>
      <BookshelfContainer
        onSelectNovel={onSelectNovel}
        onResumeNovel={onResumeNovel}
        onNavigateSearch={onNavigateSearch}
        onNavigateRanking={onNavigateRanking}
      />
    </div>
  );
};

describe("BookshelfContainer", () => {
  beforeEach(async () => {
    localStorage.clear();
    await resetTestDb();
    window.history.pushState(null, "", "/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Default ストーリーで登録済み作品一覧 Props が BookshelfPage へ渡されること (AC-BS-04)", async () => {
      const pageSpy = vi
        .spyOn(BookshelfPageModule, "BookshelfPage")
        .mockImplementation(() => null);
      try {
        render(<Default />);
        await waitFor(() => {
          expect(pageSpy).toHaveBeenLastCalledWith(
            expect.objectContaining({
              isLoading: false,
              totalNovelsCount: 2,
              novels: [
                expect.objectContaining({
                  id: "kakuyomu:16817330658027210412",
                  title: "境界迷宮と異界の魔術師",
                }),
                expect.objectContaining({
                  id: "kakuyomu:1177354054881162325",
                  title: "魔王軍の最強魔術師は人間だった",
                }),
              ],
            }),
            undefined,
          );
        });
      } finally {
        pageSpy.mockRestore();
      }
    });

    it("Empty ストーリーで空配列と検索・ランキング誘導コールバックが BookshelfPage へ渡されること (AC-BS-01, TR-15)", async () => {
      const pageSpy = vi
        .spyOn(BookshelfPageModule, "BookshelfPage")
        .mockImplementation(() => null);
      try {
        render(<Empty />);
        await waitFor(() => {
          expect(pageSpy).toHaveBeenLastCalledWith(
            expect.objectContaining({
              isLoading: false,
              totalNovelsCount: 0,
              novels: [],
              onNavigateSearch: expect.any(Function),
              onNavigateRanking: expect.any(Function),
            }),
            undefined,
          );
        });
      } finally {
        pageSpy.mockRestore();
      }
    });

    it("WithCustomCallbacks ストーリーで登録済み作品一覧と各種コールバックが BookshelfPage へ渡されること", async () => {
      const pageSpy = vi
        .spyOn(BookshelfPageModule, "BookshelfPage")
        .mockImplementation(() => null);
      try {
        render(<WithCustomCallbacks />);
        await waitFor(() => {
          expect(pageSpy).toHaveBeenLastCalledWith(
            expect.objectContaining({
              isLoading: false,
              totalNovelsCount: 2,
              onSelectNovel: expect.any(Function),
              onResumeNovel: expect.any(Function),
            }),
            undefined,
          );
        });
      } finally {
        pageSpy.mockRestore();
      }
    });
  });

  describe("ルーティング連携とコールバックの検証（TR-02, TR-03）", () => {
    it("onSelectNovel 省略時はカード選択で router.navigateToNovelDetail が実行されること (TR-02, AC-BS-05)", async () => {
      const pageSpy = vi
        .spyOn(BookshelfPageModule, "BookshelfPage")
        .mockImplementation(() => null);
      const novelRepo = createMockNovelRepo(sampleNovels);

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider initialPath="/">
            <RouteObserverWrapper />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(pageSpy).toHaveBeenCalled();
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      act(() => {
        lastProps.onSelectNovel(sampleNovels[0].id);
      });

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/novels/kakuyomu%3A16817330658027210412",
        );
      });
      pageSpy.mockRestore();
    });

    it("onSelectNovel 注入時はカード選択で注入されたコールバックが呼び出され、ルーター遷移しないこと (AC-BS-05)", async () => {
      const pageSpy = vi
        .spyOn(BookshelfPageModule, "BookshelfPage")
        .mockImplementation(() => null);
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
        expect(pageSpy).toHaveBeenCalled();
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      act(() => {
        lastProps.onSelectNovel(sampleNovels[0].id);
      });

      expect(customSelect).toHaveBeenCalledWith(sampleNovels[0].id);
      expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
        "/",
      );
      pageSpy.mockRestore();
    });

    it("onResumeNovel 省略時は「続きから読む」で router.navigateToReader が実行されること (TR-03, AC-BS-06)", async () => {
      const pageSpy = vi
        .spyOn(BookshelfPageModule, "BookshelfPage")
        .mockImplementation(() => null);
      const novelRepo = createMockNovelRepo(sampleNovels);

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider initialPath="/">
            <RouteObserverWrapper />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(pageSpy).toHaveBeenCalled();
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      act(() => {
        lastProps.onResumeNovel(sampleNovels[0].id, 5);
      });

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/novels/kakuyomu%3A16817330658027210412/chapters/5",
        );
      });
      pageSpy.mockRestore();
    });

    it("onResumeNovel 注入時は「続きから読む」で注入されたコールバックが呼び出され、ルーター遷移しないこと (AC-BS-06)", async () => {
      const pageSpy = vi
        .spyOn(BookshelfPageModule, "BookshelfPage")
        .mockImplementation(() => null);
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
        expect(pageSpy).toHaveBeenCalled();
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      act(() => {
        lastProps.onResumeNovel(sampleNovels[0].id, 5);
      });

      expect(customResume).toHaveBeenCalledWith(sampleNovels[0].id, 5);
      expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
        "/",
      );
      pageSpy.mockRestore();
    });
  });

  describe("空状態からの検索・ランキング誘導ナビゲーション検証（TR-15, AC-BS-01）", () => {
    it("空状態で「小説を検索する」ボタン押下時に router.navigateToSearch が実行され /search へ遷移すること (TR-15)", async () => {
      const pageSpy = vi
        .spyOn(BookshelfPageModule, "BookshelfPage")
        .mockImplementation(() => null);
      const novelRepo = createMockNovelRepo([]);

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider initialPath="/">
            <RouteObserverWrapper />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(pageSpy).toHaveBeenCalled();
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      act(() => {
        lastProps.onNavigateSearch?.();
      });

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/search",
        );
      });
      pageSpy.mockRestore();
    });

    it("空状態で「ランキングを見る」ボタン押下時に router.navigateToRanking が実行され /ranking へ遷移すること (TR-15)", async () => {
      const pageSpy = vi
        .spyOn(BookshelfPageModule, "BookshelfPage")
        .mockImplementation(() => null);
      const novelRepo = createMockNovelRepo([]);

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider initialPath="/">
            <RouteObserverWrapper />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(pageSpy).toHaveBeenCalled();
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      act(() => {
        lastProps.onNavigateRanking?.();
      });

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/ranking",
        );
      });
      pageSpy.mockRestore();
    });

    it("onNavigateSearch 注入時は「小説を検索する」ボタン押下で注入されたコールバックが呼び出され、ルーター遷移しないこと", async () => {
      const pageSpy = vi
        .spyOn(BookshelfPageModule, "BookshelfPage")
        .mockImplementation(() => null);
      const novelRepo = createMockNovelRepo([]);
      const customSearch = vi.fn();

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider initialPath="/">
            <RouteObserverWrapper onNavigateSearch={customSearch} />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(pageSpy).toHaveBeenCalled();
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      act(() => {
        lastProps.onNavigateSearch?.();
      });

      expect(customSearch).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
        "/",
      );
      pageSpy.mockRestore();
    });

    it("onNavigateRanking 注入時は「ランキングを見る」ボタン押下で注入されたコールバックが呼び出され、ルーター遷移しないこと", async () => {
      const pageSpy = vi
        .spyOn(BookshelfPageModule, "BookshelfPage")
        .mockImplementation(() => null);
      const novelRepo = createMockNovelRepo([]);
      const customRanking = vi.fn();

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider initialPath="/">
            <RouteObserverWrapper onNavigateRanking={customRanking} />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(pageSpy).toHaveBeenCalled();
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      act(() => {
        lastProps.onNavigateRanking?.();
      });

      expect(customRanking).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
        "/",
      );
      pageSpy.mockRestore();
    });
  });

  describe("作品閲覧時のNEW自動解除連携（AC-BS-09, TR-02, TR-03）", () => {
    it("hasNewUpdate === true の作品カードクリック時に clearNovelUpdate が呼ばれて作品詳細へ遷移すること (AC-BS-09, TR-02)", async () => {
      const pageSpy = vi
        .spyOn(BookshelfPageModule, "BookshelfPage")
        .mockImplementation(() => null);
      const clearNewUpdateSpy = vi.fn().mockResolvedValue(undefined);
      const sampleWithNew: NovelSummary = {
        ...sampleNovels[0],
        id: "kakuyomu:new-update-work",
        hasNewUpdate: true,
        lastCheckedAt: new Date().toISOString(),
      };
      const novelRepo = {
        ...createMockNovelRepo([sampleWithNew]),
        clearNewUpdate: clearNewUpdateSpy,
      };

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider initialPath="/">
            <RouteObserverWrapper />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        const currentProps =
          pageSpy.mock.calls[pageSpy.mock.calls.length - 1]?.[0];
        expect(currentProps?.novels?.length).toBeGreaterThan(0);
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      await act(async () => {
        await lastProps.onSelectNovel("kakuyomu:new-update-work");
      });

      expect(clearNewUpdateSpy).toHaveBeenCalledWith(
        "kakuyomu:new-update-work",
      );
      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/novels/kakuyomu%3Anew-update-work",
        );
      });
      pageSpy.mockRestore();
    });

    it("hasNewUpdate === true の作品の「続きから読む」クリック時に clearNovelUpdate が呼ばれてリーダーへ遷移すること (AC-BS-09, TR-03)", async () => {
      const pageSpy = vi
        .spyOn(BookshelfPageModule, "BookshelfPage")
        .mockImplementation(() => null);
      const clearNewUpdateSpy = vi.fn().mockResolvedValue(undefined);
      const sampleWithNew: NovelSummary = {
        ...sampleNovels[0],
        id: "kakuyomu:new-update-work-2",
        bookmarkChapterIndex: 3,
        hasNewUpdate: true,
        lastCheckedAt: new Date().toISOString(),
      };
      const novelRepo = {
        ...createMockNovelRepo([sampleWithNew]),
        clearNewUpdate: clearNewUpdateSpy,
      };

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider initialPath="/">
            <RouteObserverWrapper />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        const currentProps =
          pageSpy.mock.calls[pageSpy.mock.calls.length - 1]?.[0];
        expect(currentProps?.novels?.length).toBeGreaterThan(0);
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      await act(async () => {
        await lastProps.onResumeNovel("kakuyomu:new-update-work-2", 3);
      });

      expect(clearNewUpdateSpy).toHaveBeenCalledWith(
        "kakuyomu:new-update-work-2",
      );
      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/novels/kakuyomu%3Anew-update-work-2/chapters/3",
        );
      });
      pageSpy.mockRestore();
    });

    it("子コンポーネント（BookshelfPage）の onToggleFavoriteFilter コールバック呼び出し時にお気に入りフィルタが切り替わり、BookshelfPage の favoriteOnly プロパティが更新されること (Issue #266, R1-04)", async () => {
      const pageSpy = vi
        .spyOn(BookshelfPageModule, "BookshelfPage")
        .mockImplementation(() => null);
      const now = new Date().toISOString();
      const favNovel: NovelSummary = {
        ...sampleNovels[0],
        id: "kakuyomu:fav-1",
        title: "お気に入り作品",
        isFavorite: true,
        lastCheckedAt: now,
      };
      const normalNovel: NovelSummary = {
        ...sampleNovels[0],
        id: "kakuyomu:norm-1",
        title: "通常作品",
        isFavorite: false,
        lastCheckedAt: now,
      };

      const novelRepo = createMockNovelRepo([favNovel, normalNovel]);

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider initialPath="/">
            <RouteObserverWrapper />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(pageSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            favoriteOnly: false,
            novels: expect.arrayContaining([
              expect.objectContaining({ id: "kakuyomu:fav-1" }),
              expect.objectContaining({ id: "kakuyomu:norm-1" }),
            ]),
          }),
          undefined,
        );
      });

      // BookshelfPage に渡された onToggleFavoriteFilter を直接実行（孫 DOM 操作を排除）
      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      act(() => {
        lastProps.onToggleFavoriteFilter?.();
      });

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            favoriteOnly: true,
            novels: [expect.objectContaining({ id: "kakuyomu:fav-1" })],
          }),
          undefined,
        );
      });

      pageSpy.mockRestore();
    });

    it("子コンポーネント（BookshelfPage）の onToggleFavoriteNovel コールバック呼び出し時にお気に入り状態がトグルされること (Issue #266, R1-04)", async () => {
      const pageSpy = vi
        .spyOn(BookshelfPageModule, "BookshelfPage")
        .mockImplementation(() => null);
      const normalNovel: NovelSummary = {
        ...sampleNovels[0],
        id: "kakuyomu:16817330658027210412",
        isFavorite: false,
        lastCheckedAt: new Date().toISOString(),
      };

      const setFavoriteSpy = vi.fn().mockResolvedValue(undefined);
      const novelRepo = {
        ...createMockNovelRepo([normalNovel]),
        setFavorite: setFavoriteSpy,
      };

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider initialPath="/">
            <RouteObserverWrapper />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(pageSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            novels: [
              expect.objectContaining({ id: "kakuyomu:16817330658027210412" }),
            ],
          }),
          undefined,
        );
      });

      // BookshelfPage に渡された onToggleFavoriteNovel を直接実行（孫 DOM 操作を排除）
      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      await act(async () => {
        await lastProps.onToggleFavoriteNovel?.(
          "kakuyomu:16817330658027210412",
          true,
        );
      });

      expect(setFavoriteSpy).toHaveBeenCalledWith(
        "kakuyomu:16817330658027210412",
        true,
      );

      pageSpy.mockRestore();
    });
  });
});

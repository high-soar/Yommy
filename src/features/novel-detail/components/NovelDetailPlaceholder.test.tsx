import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./NovelDetailPlaceholder.stories";
import { NovelDetailPlaceholder } from "./NovelDetailPlaceholder";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider, useRouter } from "../../../app/router";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import type { NovelRecord, NovelRepository } from "../../../storage/types";

const { WithBookmark, Unread, NotFound, WithCustomCallbacks } =
  composeStories(stories);

const sampleNovel: NovelRecord = {
  id: "kakuyomu:16817330658027210412",
  siteType: "kakuyomu",
  remoteWorkId: "16817330658027210412",
  canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
  title: "境界迷宮と異界の魔術師",
  author: "小野崎",
  synopsis: "迷宮の底で少年は未知の魔術と出会う。",
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

function createMockNovelRepo(novel: NovelRecord | null): NovelRepository {
  return {
    listNovels: async () => (novel ? [novel] : []),
    getNovelById: async (id: string) =>
      novel && novel.id === id ? novel : null,
    upsertNovelWithToc: async () =>
      novel ?? ({} as unknown as import("../../../storage/types").NovelRecord),
    updateBookmark: async () => {},
    deleteNovel: async () => {},
  };
}

/**
 * ルーターパスとプレースホルダ画面を同時に観測するためのテストヘルパー
 */
const RouteObserverWrapper: React.FC<{
  novelId: string;
  onBackToBookshelf?: () => void;
  onRead?: (novelId: string, chapterIndex: number) => void;
}> = ({ novelId, onBackToBookshelf, onRead }) => {
  const router = useRouter();

  return (
    <div>
      <div data-testid="observed-current-path">{router.currentPath}</div>
      <NovelDetailPlaceholder
        novelId={novelId}
        onBackToBookshelf={onBackToBookshelf}
        onRead={onRead}
      />
    </div>
  );
};

describe("NovelDetailPlaceholder", () => {
  beforeEach(async () => {
    await resetTestDb();
    window.history.pushState(
      null,
      "",
      `/novels/${encodeURIComponent(sampleNovel.id)}`,
    );
  });

  describe("Storybook Stories 検証 (composeStories)", () => {
    it("WithBookmark ストーリーで作品情報としおり位置からの読書ボタンが表示されること", async () => {
      render(<WithBookmark />);
      await waitFor(() => {
        expect(screen.getByTestId("novel-detail-title")).toHaveTextContent(
          "境界迷宮と異界の魔術師",
        );
      });
      expect(
        screen.getByTestId("novel-detail-placeholder"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("novel-detail-author")).toHaveTextContent(
        "小野崎",
      );
      expect(screen.getByTestId("novel-detail-synopsis")).toBeInTheDocument();
      expect(screen.getByTestId("detail-read-button")).toHaveTextContent(
        "第5話から読む",
      );
      expect(
        screen.getByTestId("back-to-bookshelf-button"),
      ).toBeInTheDocument();
    });

    it("Unread ストーリーで第1話から読むボタンが表示されること", async () => {
      render(<Unread />);
      await waitFor(() => {
        expect(screen.getByTestId("detail-read-button")).toHaveTextContent(
          "第1話から読む",
        );
      });
    });

    it("NotFound ストーリーで未検出メッセージと本棚へ戻るボタンが表示されること", async () => {
      render(<NotFound />);
      await waitFor(() => {
        expect(
          screen.getByTestId("novel-detail-not-found"),
        ).toBeInTheDocument();
      });
      expect(
        screen.getByTestId("back-to-bookshelf-button"),
      ).toBeInTheDocument();
    });

    it("WithCustomCallbacks ストーリーで詳細画面が表示されること", async () => {
      render(<WithCustomCallbacks />);
      await waitFor(() => {
        expect(screen.getByTestId("novel-detail-title")).toBeInTheDocument();
      });
      expect(
        screen.getByTestId("novel-detail-placeholder"),
      ).toBeInTheDocument();
    });
  });

  describe("ルーティング連携とコールバックの検証（TR-04, TR-07）", () => {
    it("onRead 省略時はしおり位置をもとに router.navigateToReader が実行されること (TR-04)", async () => {
      const user = userEvent.setup();
      const novelRepo = createMockNovelRepo(sampleNovel);

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider
            initialPath={`/novels/${encodeURIComponent(sampleNovel.id)}`}
          >
            <RouteObserverWrapper novelId={sampleNovel.id} />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("detail-read-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("detail-read-button"));

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/novels/kakuyomu%3A16817330658027210412/chapters/5",
        );
      });
    });

    it("未読作品で onRead 省略時は第1話のリーダーへ router.navigateToReader が実行されること", async () => {
      const user = userEvent.setup();
      const unreadNovel: NovelRecord = {
        ...sampleNovel,
        bookmarkChapterIndex: null,
      };
      const novelRepo = createMockNovelRepo(unreadNovel);

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider
            initialPath={`/novels/${encodeURIComponent(unreadNovel.id)}`}
          >
            <RouteObserverWrapper novelId={unreadNovel.id} />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("detail-read-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("detail-read-button"));

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/novels/kakuyomu%3A16817330658027210412/chapters/1",
        );
      });
    });

    it("onRead 注入時は注入されたコールバックが呼び出され、ルーター遷移しないこと", async () => {
      const user = userEvent.setup();
      const novelRepo = createMockNovelRepo(sampleNovel);
      const customRead = vi.fn();

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider
            initialPath={`/novels/${encodeURIComponent(sampleNovel.id)}`}
          >
            <RouteObserverWrapper
              novelId={sampleNovel.id}
              onRead={customRead}
            />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("detail-read-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("detail-read-button"));

      expect(customRead).toHaveBeenCalledWith(sampleNovel.id, 5);
      expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
        `/novels/${encodeURIComponent(sampleNovel.id)}`,
      );
    });

    it("onBackToBookshelf 省略時は「本棚へ戻る」で router.navigateToBookshelf が実行されること (TR-07)", async () => {
      const user = userEvent.setup();
      const novelRepo = createMockNovelRepo(sampleNovel);

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider
            initialPath={`/novels/${encodeURIComponent(sampleNovel.id)}`}
          >
            <RouteObserverWrapper novelId={sampleNovel.id} />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("back-to-bookshelf-button"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("back-to-bookshelf-button"));

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/",
        );
      });
    });

    it("onBackToBookshelf 注入時は注入されたコールバックが呼び出され、ルーター遷移しないこと", async () => {
      const user = userEvent.setup();
      const novelRepo = createMockNovelRepo(sampleNovel);
      const customBack = vi.fn();

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider
            initialPath={`/novels/${encodeURIComponent(sampleNovel.id)}`}
          >
            <RouteObserverWrapper
              novelId={sampleNovel.id}
              onBackToBookshelf={customBack}
            />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("back-to-bookshelf-button"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("back-to-bookshelf-button"));

      expect(customBack).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
        `/novels/${encodeURIComponent(sampleNovel.id)}`,
      );
    });

    it("未検出（404）表示から「本棚へ戻る」をクリックすると本棚へ遷移すること", async () => {
      const user = userEvent.setup();
      const novelRepo = createMockNovelRepo(null);

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider initialPath="/novels/non-existent">
            <RouteObserverWrapper novelId="non-existent" />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("novel-detail-not-found"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("back-to-bookshelf-button"));

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/",
        );
      });
    });
  });

  describe("ローディング、エラー、境界値表示の検証", () => {
    it("リポジトリ取得エラー（Errorインスタンス）発生時にエラー表示されること", async () => {
      const failingRepo = {
        listNovels: vi.fn().mockResolvedValue([]),
        getNovelById: vi
          .fn()
          .mockRejectedValue(new Error("作品詳細取得DBエラー")),
        upsertNovelWithToc: vi.fn(),
        updateBookmark: vi.fn(),
        deleteNovel: vi.fn(),
      };

      render(
        <ServiceProvider services={{ novelRepository: failingRepo }}>
          <RouterProvider
            initialPath={`/novels/${encodeURIComponent(sampleNovel.id)}`}
          >
            <NovelDetailPlaceholder novelId={sampleNovel.id} />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("novel-detail-error")).toHaveTextContent(
          "作品詳細取得DBエラー",
        );
      });
      expect(
        screen.getByTestId("back-to-bookshelf-button"),
      ).toBeInTheDocument();
    });

    it("リポジトリ取得エラー（非Error文字列）発生時にエラー表示されること", async () => {
      const failingRepo = {
        listNovels: vi.fn().mockResolvedValue([]),
        getNovelById: vi.fn().mockRejectedValue("文字列エラー"),
        upsertNovelWithToc: vi.fn(),
        updateBookmark: vi.fn(),
        deleteNovel: vi.fn(),
      };

      render(
        <ServiceProvider services={{ novelRepository: failingRepo }}>
          <RouterProvider
            initialPath={`/novels/${encodeURIComponent(sampleNovel.id)}`}
          >
            <NovelDetailPlaceholder novelId={sampleNovel.id} />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("novel-detail-error")).toHaveTextContent(
          "文字列エラー",
        );
      });
    });

    it("著者名やあらすじが空文字または未定義の場合はフォールバック文字列が表示されること", async () => {
      const emptyFieldsNovel: NovelRecord = {
        ...sampleNovel,
        author: "",
        synopsis: "",
      };
      const novelRepo = createMockNovelRepo(emptyFieldsNovel);

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <RouterProvider
            initialPath={`/novels/${encodeURIComponent(emptyFieldsNovel.id)}`}
          >
            <NovelDetailPlaceholder novelId={emptyFieldsNovel.id} />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("novel-detail-author")).toHaveTextContent(
          "著者不明",
        );
      });
      expect(screen.getByTestId("novel-detail-synopsis")).toHaveTextContent(
        "あらすじはありません。",
      );
    });

    it("アンマウント時に非同期ステート更新が行われないこと", async () => {
      let resolveFetch!: (novel: NovelRecord | null) => void;
      const pendingPromise = new Promise<NovelRecord | null>((resolve) => {
        resolveFetch = resolve;
      });

      const delayedRepo = {
        listNovels: vi.fn().mockResolvedValue([]),
        getNovelById: vi.fn().mockReturnValue(pendingPromise),
        upsertNovelWithToc: vi.fn(),
        updateBookmark: vi.fn(),
        deleteNovel: vi.fn(),
      };

      const { unmount } = render(
        <ServiceProvider services={{ novelRepository: delayedRepo }}>
          <RouterProvider
            initialPath={`/novels/${encodeURIComponent(sampleNovel.id)}`}
          >
            <NovelDetailPlaceholder novelId={sampleNovel.id} />
          </RouterProvider>
        </ServiceProvider>,
      );

      expect(screen.getByTestId("novel-detail-loading")).toBeInTheDocument();

      // アンマウント
      unmount();

      // 非同期解決
      resolveFetch(sampleNovel);
    });
  });
});

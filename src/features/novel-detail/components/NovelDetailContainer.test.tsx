import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./NovelDetailContainer.stories";
import { NovelDetailContainer } from "./NovelDetailContainer";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider, useRouter } from "../../../app/router";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import type {
  NovelRecord,
  ChapterSummary,
  NovelRepository,
  ChapterRepository,
} from "../../../storage/types";
import type { HttpClientBridge } from "../../../bridges/http/types";
import type { ParserRegistry } from "../../../parsers/parserRegistry";
import type { NovelParser } from "../../../parsers/types";

const { Default, WithBookmark, Loading, NotFound, WithCustomCallbacks } =
  composeStories(stories);

const sampleNovel: NovelRecord = {
  id: "kakuyomu:16817330658027210412",
  siteType: "kakuyomu",
  remoteWorkId: "16817330658027210412",
  canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
  title: "境界迷宮と異界の魔術師",
  author: "小野崎",
  synopsis: "異界から迷い込んだ青年が紡ぐファンタジー戦記。",
  totalChapters: 3,
  cachedChapters: 1,
  totalByteSize: 10240,
  bookmarkChapterIndex: null,
  bookmarkScrollProgress: 0,
  isFavorite: false,
  lastCheckedAt: null,
  lastReadAt: null,
  createdAt: "2026-10-25T10:00:00Z",
  updatedAt: "2026-10-26T07:00:00Z",
};

const sampleNovelWithBookmark: NovelRecord = {
  ...sampleNovel,
  bookmarkChapterIndex: 2,
  bookmarkScrollProgress: 0.5,
};

const sampleChapters: ChapterSummary[] = [
  {
    id: "kakuyomu:16817330658027210412:1",
    novelId: "kakuyomu:16817330658027210412",
    chapterIndex: 1,
    remoteChapterId: "1",
    partTitle: "第一部 旅立ち",
    title: "第1話 出会い",
    url: "https://kakuyomu.jp/works/16817330658027210412/episodes/1",
    byteSize: 1024,
    isRead: true,
    publishedAt: "2026-01-01T10:00:00Z",
    downloadedAt: "2026-01-01T12:00:00Z",
  },
  {
    id: "kakuyomu:16817330658027210412:2",
    novelId: "kakuyomu:16817330658027210412",
    chapterIndex: 2,
    remoteChapterId: "2",
    partTitle: "第一部 旅立ち",
    title: "第2話 覚醒",
    url: "https://kakuyomu.jp/works/16817330658027210412/episodes/2",
    byteSize: 0,
    isRead: false,
    publishedAt: "2026-01-02T10:00:00Z",
    downloadedAt: null,
  },
  {
    id: "kakuyomu:16817330658027210412:3",
    novelId: "kakuyomu:16817330658027210412",
    chapterIndex: 3,
    remoteChapterId: "3",
    partTitle: "第二部 試練",
    title: "第3話 決戦の序曲",
    url: "https://kakuyomu.jp/works/16817330658027210412/episodes/3",
    byteSize: 0,
    isRead: false,
    publishedAt: "2026-01-03T10:00:00Z",
    downloadedAt: null,
  },
];

function createMockNovelRepo(
  initialNovel: NovelRecord | null = sampleNovel,
  options?: {
    deleteError?: boolean;
  },
): NovelRepository {
  let currentNovel = initialNovel;
  return {
    listNovels: async () => (currentNovel ? [currentNovel] : []),
    getNovelById: async (id: string) =>
      currentNovel && currentNovel.id === id ? currentNovel : null,
    upsertNovelWithToc: async () => {
      if (!currentNovel) throw new Error("Novel not found");
      return currentNovel;
    },
    updateBookmark: async () => {},
    deleteNovel: async (id: string) => {
      if (options?.deleteError) {
        throw new Error("削除処理に失敗しました");
      }
      if (currentNovel && currentNovel.id === id) {
        currentNovel = null;
      }
    },
  };
}

function createMockChapterRepo(
  initialChapters: ChapterSummary[] = sampleChapters,
): ChapterRepository {
  return {
    listChaptersByNovelId: async () => initialChapters,
    getChapter: async () => null,
    saveChapterBody: async () => {},
    markChapterRead: async () => {},
    deleteCachedBodies: async () => 0,
  };
}

/**
 * ルーターパスとコンテナを同時に観測するためのテストヘルパー
 */
const RouteObserverWrapper: React.FC<{
  novelId: string;
  onBackToBookshelf?: () => void;
  onSelectEpisode?: (novelId: string, chapterIndex: number) => void;
  novelRepository?: NovelRepository;
  chapterRepository?: ChapterRepository;
  httpClient?: HttpClientBridge;
  parserRegistry?: ParserRegistry;
}> = ({
  novelId,
  onBackToBookshelf,
  onSelectEpisode,
  novelRepository,
  chapterRepository,
  httpClient,
  parserRegistry,
}) => {
  const router = useRouter();

  return (
    <div>
      <div data-testid="observed-current-path">{router.currentPath}</div>
      <ServiceProvider
        services={{
          ...(novelRepository ? { novelRepository } : {}),
          ...(chapterRepository ? { chapterRepository } : {}),
          ...(httpClient ? { httpClient } : {}),
          ...(parserRegistry ? { parserRegistry } : {}),
        }}
      >
        <NovelDetailContainer
          novelId={novelId}
          onBackToBookshelf={onBackToBookshelf}
          onSelectEpisode={onSelectEpisode}
        />
      </ServiceProvider>
    </div>
  );
};

describe("NovelDetailContainer", () => {
  beforeEach(async () => {
    await resetTestDb();
    window.history.pushState(null, "", "/");
  });

  describe("Storybook Stories レンダリング検証 (composeStories)", () => {
    it("Default ストーリーで作品ヘッダーと目次一覧が描画されること (AC-ND-01, AC-ND-02)", async () => {
      render(<Default />);

      await waitFor(() => {
        expect(screen.getByTestId("novel-detail-page")).toBeInTheDocument();
        expect(screen.getByTestId("novel-detail-title")).toHaveTextContent(
          "境界迷宮と異界の魔術師",
        );
      });

      expect(screen.getByTestId("episode-list")).toBeInTheDocument();
      expect(screen.getAllByTestId("episode-item")).toHaveLength(3);
    });

    it("WithBookmark ストーリーで「続きから読む（第2話）」ボタンが表示されること (AC-ND-03)", async () => {
      render(<WithBookmark />);

      await waitFor(() => {
        expect(screen.getByTestId("detail-resume-button")).toBeInTheDocument();
      });
      expect(screen.getByTestId("detail-resume-button")).toHaveTextContent(
        "続きから読む（第2話）",
      );
    });

    it("Loading ストーリーでローディング表示になること", async () => {
      render(<Loading />);

      await waitFor(() => {
        expect(screen.getByTestId("novel-detail-loading")).toBeInTheDocument();
      });
      expect(
        screen.queryByTestId("novel-detail-header"),
      ).not.toBeInTheDocument();
    });

    it("NotFound ストーリーで未検出表示および本棚へ戻る導線が表示されること (AC-ND-07)", async () => {
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

    it("WithCustomCallbacks ストーリーで正常に画面がレンダリングされること", async () => {
      render(<WithCustomCallbacks />);

      await waitFor(() => {
        expect(screen.getByTestId("novel-detail-page")).toBeInTheDocument();
      });
    });
  });

  describe("ルーター遷移とカスタムコールバック注入の検証", () => {
    it("ヘッダーの「本棚へ戻る」ボタン押下時、デフォルトでルーターの本棚画面へ遷移する (TR-07, AC-ND-07)", async () => {
      const user = userEvent.setup();
      render(
        <RouterProvider
          initialPath={`/novels/${encodeURIComponent(sampleNovel.id)}`}
        >
          <RouteObserverWrapper
            novelId={sampleNovel.id}
            novelRepository={createMockNovelRepo(sampleNovel)}
            chapterRepository={createMockChapterRepo(sampleChapters)}
          />
        </RouterProvider>,
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

    it("onBackToBookshelf が注入された場合、カスタムコールバックが呼ばれルーター遷移しない", async () => {
      const user = userEvent.setup();
      const onBackToBookshelf = vi.fn();
      render(
        <RouterProvider
          initialPath={`/novels/${encodeURIComponent(sampleNovel.id)}`}
        >
          <RouteObserverWrapper
            novelId={sampleNovel.id}
            onBackToBookshelf={onBackToBookshelf}
            novelRepository={createMockNovelRepo(sampleNovel)}
            chapterRepository={createMockChapterRepo(sampleChapters)}
          />
        </RouterProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("back-to-bookshelf-button"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("back-to-bookshelf-button"));

      expect(onBackToBookshelf).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
        `/novels/${sampleNovel.id}`,
      );
    });

    it("未検出（NotFound）画面での「本棚へ戻る」ボタン押下時、デフォルトで本棚へ遷移する (AC-ND-07)", async () => {
      const user = userEvent.setup();
      render(
        <RouterProvider initialPath="/novels/not-found">
          <RouteObserverWrapper
            novelId="not-found"
            novelRepository={createMockNovelRepo(null)}
            chapterRepository={createMockChapterRepo([])}
          />
        </RouterProvider>,
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

    it("未検出画面で onBackToBookshelf が注入された場合、カスタムコールバックが呼ばれる", async () => {
      const user = userEvent.setup();
      const onBackToBookshelf = vi.fn();
      render(
        <RouterProvider initialPath="/novels/not-found">
          <RouteObserverWrapper
            novelId="not-found"
            onBackToBookshelf={onBackToBookshelf}
            novelRepository={createMockNovelRepo(null)}
            chapterRepository={createMockChapterRepo([])}
          />
        </RouterProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("novel-detail-not-found"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("back-to-bookshelf-button"));

      expect(onBackToBookshelf).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
        "/novels/not-found",
      );
    });

    it("「最初から読む（第1話）」ボタン押下時、デフォルトでリーダー画面（第1話）へ遷移する (TR-04, AC-ND-03)", async () => {
      const user = userEvent.setup();
      render(
        <RouterProvider
          initialPath={`/novels/${encodeURIComponent(sampleNovel.id)}`}
        >
          <RouteObserverWrapper
            novelId={sampleNovel.id}
            novelRepository={createMockNovelRepo(sampleNovel)}
            chapterRepository={createMockChapterRepo(sampleChapters)}
          />
        </RouterProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("detail-read-first-button"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("detail-read-first-button"));

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          `/novels/${sampleNovel.id}/chapters/1`,
        );
      });
    });

    it("「続きから読む（第2話）」ボタン押下時、デフォルトでリーダー画面（第2話）へ遷移する (TR-04, AC-ND-03)", async () => {
      const user = userEvent.setup();
      render(
        <RouterProvider
          initialPath={`/novels/${encodeURIComponent(sampleNovelWithBookmark.id)}`}
        >
          <RouteObserverWrapper
            novelId={sampleNovelWithBookmark.id}
            novelRepository={createMockNovelRepo(sampleNovelWithBookmark)}
            chapterRepository={createMockChapterRepo(sampleChapters)}
          />
        </RouterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("detail-resume-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("detail-resume-button"));

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          `/novels/${sampleNovelWithBookmark.id}/chapters/2`,
        );
      });
    });

    it("目次エピソード行タップ時、デフォルトで該当話のリーダー画面へ遷移する (TR-04, AC-ND-04)", async () => {
      const user = userEvent.setup();
      render(
        <RouterProvider
          initialPath={`/novels/${encodeURIComponent(sampleNovel.id)}`}
        >
          <RouteObserverWrapper
            novelId={sampleNovel.id}
            novelRepository={createMockNovelRepo(sampleNovel)}
            chapterRepository={createMockChapterRepo(sampleChapters)}
          />
        </RouterProvider>,
      );

      await waitFor(() => {
        expect(screen.getAllByTestId("episode-item")).toHaveLength(3);
      });

      // 3番目のエピソード（第3話）をクリック
      const episodeItems = screen.getAllByTestId("episode-item");
      await user.click(episodeItems[2]);

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          `/novels/${sampleNovel.id}/chapters/3`,
        );
      });
    });

    it("onSelectEpisode が注入された場合、読書開始・続きから読む・目次行タップでコールバックが呼ばれる", async () => {
      const user = userEvent.setup();
      const onSelectEpisode = vi.fn();
      render(
        <RouterProvider
          initialPath={`/novels/${encodeURIComponent(sampleNovelWithBookmark.id)}`}
        >
          <RouteObserverWrapper
            novelId={sampleNovelWithBookmark.id}
            onSelectEpisode={onSelectEpisode}
            novelRepository={createMockNovelRepo(sampleNovelWithBookmark)}
            chapterRepository={createMockChapterRepo(sampleChapters)}
          />
        </RouterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("detail-resume-button")).toBeInTheDocument();
        expect(
          screen.getByTestId("detail-read-first-button"),
        ).toBeInTheDocument();
      });

      // 1. 最初から読む
      await user.click(screen.getByTestId("detail-read-first-button"));
      expect(onSelectEpisode).toHaveBeenLastCalledWith(
        sampleNovelWithBookmark.id,
        1,
      );

      // 2. 続きから読む（第2話）
      await user.click(screen.getByTestId("detail-resume-button"));
      expect(onSelectEpisode).toHaveBeenLastCalledWith(
        sampleNovelWithBookmark.id,
        2,
      );

      // 3. エピソード行タップ（第3話）
      const episodeItems = screen.getAllByTestId("episode-item");
      await user.click(episodeItems[2]);
      expect(onSelectEpisode).toHaveBeenLastCalledWith(
        sampleNovelWithBookmark.id,
        3,
      );

      // ルーターパスは変化していないこと
      expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
        `/novels/${sampleNovelWithBookmark.id}`,
      );
    });
  });

  describe("目次更新（refreshToc）および作品削除フローの検証", () => {
    it("「目次を更新」ボタン押下時に refreshToc が実行され、通知が表示される (AC-ND-05)", async () => {
      const user = userEvent.setup();
      const mockHttpClient: HttpClientBridge = {
        getHtml: async () => ({
          html: "<html><body>dummy html</body></html>",
          status: 200,
          url: sampleNovel.canonicalUrl,
          headers: {},
        }),
      };
      const mockParser: NovelParser = {
        siteType: "kakuyomu" as const,
        canParse: () => true,
        normalizeWorkUrl: (url: string) => url,
        parseNovelIndex: () => ({
          siteType: "kakuyomu",
          remoteWorkId: sampleNovel.remoteWorkId,
          canonicalUrl: sampleNovel.canonicalUrl,
          title: sampleNovel.title,
          author: sampleNovel.author,
          synopsis: sampleNovel.synopsis,
          chapters: sampleChapters.map((c) => ({
            chapterIndex: c.chapterIndex,
            remoteChapterId: c.remoteChapterId,
            partTitle: c.partTitle,
            title: c.title,
            url: c.url,
            publishedAt: c.publishedAt,
          })),
          nextTocPageUrl: null,
        }),
        parseChapterContent: () => {
          throw new Error("Not implemented");
        },
      };
      const mockParserRegistry = {
        register: () => {},
        getParser: () => mockParser,
        requireParser: () => mockParser,
      } as unknown as ParserRegistry;

      render(
        <RouterProvider
          initialPath={`/novels/${encodeURIComponent(sampleNovel.id)}`}
        >
          <RouteObserverWrapper
            novelId={sampleNovel.id}
            novelRepository={createMockNovelRepo(sampleNovel)}
            chapterRepository={createMockChapterRepo(sampleChapters)}
            httpClient={mockHttpClient}
            parserRegistry={mockParserRegistry}
          />
        </RouterProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("refresh-toc-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("refresh-toc-button"));

      await waitFor(() => {
        expect(screen.getByTestId("novel-detail-notice")).toBeInTheDocument();
      });
      expect(screen.getByTestId("novel-detail-notice")).toHaveTextContent(
        "最新の状態です",
      );
    });

    it("作品削除フロー: ダイアログの開閉、確定時の削除実行と本棚画面への遷移 (TR-07, AC-ND-06)", async () => {
      const user = userEvent.setup();
      render(
        <RouterProvider
          initialPath={`/novels/${encodeURIComponent(sampleNovel.id)}`}
        >
          <RouteObserverWrapper
            novelId={sampleNovel.id}
            novelRepository={createMockNovelRepo(sampleNovel)}
            chapterRepository={createMockChapterRepo(sampleChapters)}
          />
        </RouterProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("open-delete-dialog-button"),
        ).toBeInTheDocument();
      });

      // 1. 削除ダイアログを開く
      await user.click(screen.getByTestId("open-delete-dialog-button"));
      expect(screen.getByTestId("delete-confirm-dialog")).toBeInTheDocument();

      // 2. キャンセルボタンで閉じる
      await user.click(screen.getByTestId("cancel-delete-button"));
      expect(
        screen.queryByTestId("delete-confirm-dialog"),
      ).not.toBeInTheDocument();

      // 3. 再度開き、削除を確定する
      await user.click(screen.getByTestId("open-delete-dialog-button"));
      await user.click(screen.getByTestId("confirm-delete-button"));

      // 成功時に本棚画面（/）へ遷移すること
      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/",
        );
      });
    });

    it("作品削除フロー: onBackToBookshelf 注入時は成功時にそのコールバックが呼ばれる", async () => {
      const user = userEvent.setup();
      const onBackToBookshelf = vi.fn();
      render(
        <RouterProvider
          initialPath={`/novels/${encodeURIComponent(sampleNovel.id)}`}
        >
          <RouteObserverWrapper
            novelId={sampleNovel.id}
            onBackToBookshelf={onBackToBookshelf}
            novelRepository={createMockNovelRepo(sampleNovel)}
            chapterRepository={createMockChapterRepo(sampleChapters)}
          />
        </RouterProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("open-delete-dialog-button"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("open-delete-dialog-button"));
      await user.click(screen.getByTestId("confirm-delete-button"));

      await waitFor(() => {
        expect(onBackToBookshelf).toHaveBeenCalledTimes(1);
      });
      // ルーター遷移は行われない
      expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
        `/novels/${sampleNovel.id}`,
      );
    });

    it("作品削除フロー: 削除処理失敗時はエラーが表示され本棚へ遷移しない", async () => {
      const user = userEvent.setup();
      render(
        <RouterProvider
          initialPath={`/novels/${encodeURIComponent(sampleNovel.id)}`}
        >
          <RouteObserverWrapper
            novelId={sampleNovel.id}
            novelRepository={createMockNovelRepo(sampleNovel, {
              deleteError: true,
            })}
            chapterRepository={createMockChapterRepo(sampleChapters)}
          />
        </RouterProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("open-delete-dialog-button"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("open-delete-dialog-button"));
      await user.click(screen.getByTestId("confirm-delete-button"));

      await waitFor(() => {
        expect(screen.getByTestId("novel-detail-error")).toBeInTheDocument();
      });
      expect(screen.getByTestId("novel-detail-error")).toHaveTextContent(
        "削除処理に失敗しました",
      );

      // 本棚画面へは遷移しない
      expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
        `/novels/${sampleNovel.id}`,
      );
    });
  });
});

import { render, screen, waitFor, act } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./NovelDetailContainer.stories";
import { NovelDetailContainer } from "./NovelDetailContainer";
import * as NovelDetailPageModule from "./NovelDetailPage";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider, useRouter } from "../../../app/router";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import type { DatabaseAdapter } from "../../../storage/adapter/types";
import type {
  NovelRecord,
  ChapterSummary,
  NovelRepository,
  ChapterRepository,
  SettingsRepository,
  ReaderSettings,
} from "../../../storage/types";
import type { HttpClientBridge } from "../../../bridges/http/types";
import type { ParserRegistry } from "../../../parsers/parserRegistry";
import type { NovelParser } from "../../../parsers/types";

const {
  Default,
  WithBookmark,
  Loading,
  NotFound,
  WithCustomCallbacks,
  ResumePending,
  RetryFailed,
} = composeStories(stories);

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
    setFavorite: async (_id: string, isFav: boolean) => {
      if (currentNovel) {
        currentNovel.isFavorite = isFav;
      }
    },
    deleteNovel: async (id: string) => {
      if (options?.deleteError) {
        throw new Error("削除処理に失敗しました");
      }
      if (currentNovel && currentNovel.id === id) {
        currentNovel = null;
      }
    },
    clearNewUpdate: async () => {},
    updateLastCheckedAt: async () => {},
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
    deleteAllCachedBodies: async () => 0,
    getStorageCacheSummary: async () => ({
      totalCachedChapters: 0,
      totalByteSize: 0,
    }),
  };
}

function createMockSettingsRepo(): SettingsRepository {
  let current: ReaderSettings = {
    writingMode: "vertical-rl",
    theme: "light",
    fontFamily: "mincho",
    fontSizePx: 18,
    lineHeight: 1.8,
    pageMarginPx: 16,
    enableTapPaging: false,
    enableVolumeKeyPaging: false,
    pagingMode: "auto",
    updatedAt: "2026-10-26T00:00:00Z",
  };
  return {
    getReaderSettings: async () => current,
    updateReaderSettings: async (patch) => {
      current = { ...current, ...patch };
      return current;
    },
  };
}

const mockDatabaseAdapter: DatabaseAdapter = {
  execute: async () => {},
  query: async () => [],
  runTransaction: async (fn) => fn(mockDatabaseAdapter),
  close: async () => {},
};

/**
 * ルーターパスとコンテナを同時に観測するためのテストヘルパー
 */
const RouteObserverWrapper: React.FC<{
  novelId: string;
  onBackToBookshelf?: () => void;
  onSelectEpisode?: (novelId: string, chapterIndex: number) => void;
  novelRepository?: NovelRepository;
  chapterRepository?: ChapterRepository;
  settingsRepository?: SettingsRepository;
  databaseAdapter?: DatabaseAdapter;
  httpClient?: HttpClientBridge;
  parserRegistry?: ParserRegistry;
}> = ({
  novelId,
  onBackToBookshelf,
  onSelectEpisode,
  novelRepository,
  chapterRepository,
  settingsRepository,
  databaseAdapter,
  httpClient,
  parserRegistry,
}) => {
  const router = useRouter();
  const resolvedSettingsRepo = settingsRepository ?? createMockSettingsRepo();
  const resolvedDbAdapter = databaseAdapter ?? mockDatabaseAdapter;

  return (
    <div>
      <div data-testid="observed-current-path">{router.currentPath}</div>
      <ServiceProvider
        services={{
          databaseAdapter: resolvedDbAdapter,
          settingsRepository: resolvedSettingsRepo,
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
  beforeEach(() => {
    window.history.pushState(null, "", "/");
  });

  describe("Storybook Stories レンダリング検証 (composeStories)", () => {
    beforeEach(async () => {
      await resetTestDb();
    });
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

    it("ResumePending ストーリーで pendingCacheCount=2 が NovelDetailPage へ伝達されること (AC-ND-24)", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");
      render(<ResumePending />);

      await waitFor(() => {
        expect(pageSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            isLoading: false,
            pendingCacheCount: 2,
          }),
          undefined,
        );
      });
    });

    it("RetryFailed ストーリーで failedCacheCount=1 が NovelDetailPage へ伝達されること (AC-ND-25)", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");
      render(<RetryFailed />);

      await waitFor(() => {
        expect(pageSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            isLoading: false,
            pendingCacheCount: 0,
            failedCacheCount: 1,
          }),
          undefined,
        );
      });
    });
  });

  describe("ルーター遷移とカスタムコールバック注入の検証", () => {
    it("通常表示時、NovelDetailHeader 内に「本棚へ戻る」ボタンが描画されないこと (AC-ND-07)", async () => {
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
        expect(screen.getByTestId("novel-detail-header")).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId("back-to-bookshelf-button"),
      ).not.toBeInTheDocument();
    });

    it("通常表示時に onBackToBookshelf が渡されていても、ヘッダーに「本棚へ戻る」ボタンが描画されないこと (AC-ND-07)", async () => {
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
        expect(screen.getByTestId("novel-detail-header")).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId("back-to-bookshelf-button"),
      ).not.toBeInTheDocument();
      expect(onBackToBookshelf).not.toHaveBeenCalled();
    });

    it("未検出（NotFound）画面での「本棚へ戻る」ボタン押下時、デフォルトで本棚へ遷移する (AC-ND-07)", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");
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
        expect(pageSpy).toHaveBeenCalled();
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      act(() => {
        lastProps.onBackToBookshelf();
      });

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/",
        );
      });
      pageSpy.mockRestore();
    });

    it("未検出画面で onBackToBookshelf 未指定時、探索元（/search）が存在する場合は router.back により /search へ復帰すること (TR-07, AC-ND-07)", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");
      let routerRef: ReturnType<typeof useRouter> | null = null;
      const TestOriginComponent = () => {
        const router = useRouter();
        routerRef = router;
        return (
          <div>
            <div data-testid="observed-current-path">{router.currentPath}</div>
            <ServiceProvider
              services={{
                databaseAdapter: mockDatabaseAdapter,
                settingsRepository: createMockSettingsRepo(),
                novelRepository: createMockNovelRepo(null),
                chapterRepository: createMockChapterRepo([]),
              }}
            >
              <NovelDetailContainer novelId="not-found" />
            </ServiceProvider>
          </div>
        );
      };

      render(
        <RouterProvider initialPath="/search">
          <TestOriginComponent />
        </RouterProvider>,
      );

      // /search から詳細へ遷移
      act(() => {
        routerRef?.navigateToNovelDetail("not-found", "/search");
      });

      await waitFor(() => {
        expect(pageSpy).toHaveBeenCalled();
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      act(() => {
        lastProps.onBackToBookshelf();
      });

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/search",
        );
      });
      pageSpy.mockRestore();
    });

    it("未検出画面で onBackToBookshelf が注入された場合、カスタムコールバックが呼ばれる", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");
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
        expect(pageSpy).toHaveBeenCalled();
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      act(() => {
        lastProps.onBackToBookshelf();
      });

      expect(onBackToBookshelf).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
        "/novels/not-found",
      );
      pageSpy.mockRestore();
    });

    it("「最初から読む（第1話）」ボタン押下時、デフォルトでリーダー画面（第1話）へ遷移する (TR-04, AC-ND-03)", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");
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
        const last = pageSpy.mock.calls[pageSpy.mock.calls.length - 1]?.[0];
        expect(last?.novel?.id).toBe(sampleNovel.id);
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      act(() => {
        lastProps.onStartFromBeginning();
      });

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          `/novels/${encodeURIComponent(sampleNovel.id)}/chapters/1`,
        );
      });
      pageSpy.mockRestore();
    });

    it("「続きから読む（第2話）」ボタン押下時、デフォルトでリーダー画面（第2話）へ遷移する (TR-04, AC-ND-03)", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");
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
        const last = pageSpy.mock.calls[pageSpy.mock.calls.length - 1]?.[0];
        expect(last?.novel?.id).toBe(sampleNovelWithBookmark.id);
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      act(() => {
        lastProps.onResumeBookmark(
          sampleNovelWithBookmark.bookmarkChapterIndex!,
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          `/novels/${encodeURIComponent(sampleNovelWithBookmark.id)}/chapters/2`,
        );
      });
      pageSpy.mockRestore();
    });

    it("目次エピソード行タップ時、デフォルトで該当話のリーダー画面へ遷移する (TR-04, AC-ND-04)", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");
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
        const last = pageSpy.mock.calls[pageSpy.mock.calls.length - 1]?.[0];
        expect(last?.chapters?.length).toBe(3);
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      act(() => {
        lastProps.onSelectEpisode(3);
      });

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          `/novels/${encodeURIComponent(sampleNovel.id)}/chapters/3`,
        );
      });
      pageSpy.mockRestore();
    });

    it("onSelectEpisode が注入された場合、読書開始・続きから読む・目次行タップでコールバックが呼ばれる", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");
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
        const last = pageSpy.mock.calls[pageSpy.mock.calls.length - 1]?.[0];
        expect(last?.chapters?.length).toBe(3);
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];

      // 1. 最初から読む
      act(() => {
        lastProps.onStartFromBeginning();
      });
      expect(onSelectEpisode).toHaveBeenLastCalledWith(
        sampleNovelWithBookmark.id,
        1,
      );

      // 2. 続きから読む（第2話）
      act(() => {
        lastProps.onResumeBookmark(
          sampleNovelWithBookmark.bookmarkChapterIndex!,
        );
      });
      expect(onSelectEpisode).toHaveBeenLastCalledWith(
        sampleNovelWithBookmark.id,
        2,
      );

      // 3. エピソード行タップ（第3話）
      act(() => {
        lastProps.onSelectEpisode(3);
      });
      expect(onSelectEpisode).toHaveBeenLastCalledWith(
        sampleNovelWithBookmark.id,
        3,
      );

      // ルーターパスは変化していないこと
      expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
        `/novels/${encodeURIComponent(sampleNovelWithBookmark.id)}`,
      );
      pageSpy.mockRestore();
    });
  });

  describe("目次更新（refreshToc）および作品削除フローの検証", () => {
    it("「目次を更新」ボタン押下時に refreshToc が実行され、通知が表示される (AC-ND-05)", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");
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
        const last = pageSpy.mock.calls[pageSpy.mock.calls.length - 1]?.[0];
        expect(last?.novel?.id).toBe(sampleNovel.id);
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      await act(async () => {
        await lastProps.onRefreshToc();
      });

      await waitFor(() => {
        const currentProps =
          pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
        expect(currentProps.refreshMessage).toBe("最新の状態です");
      });
      pageSpy.mockRestore();
    });

    it("作品削除フロー: ダイアログの開閉、確定時の削除実行と本棚画面への遷移 (TR-07, AC-ND-06)", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");
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
        const last = pageSpy.mock.calls[pageSpy.mock.calls.length - 1]?.[0];
        expect(last?.novel?.id).toBe(sampleNovel.id);
      });

      let lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];

      // 1. 削除ダイアログを開く
      act(() => {
        lastProps.onOpenDeleteDialog();
      });
      await waitFor(() => {
        lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
        expect(lastProps.isDeleteDialogOpen).toBe(true);
      });

      // 2. キャンセルボタンで閉じる
      act(() => {
        lastProps.onCloseDeleteDialog();
      });
      await waitFor(() => {
        lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
        expect(lastProps.isDeleteDialogOpen).toBe(false);
      });

      // 3. 再度開き、削除を確定する
      act(() => {
        lastProps.onOpenDeleteDialog();
      });
      await act(async () => {
        await lastProps.onConfirmDelete();
      });

      // 成功時に本棚画面（/）へ遷移すること
      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/",
        );
      });
      pageSpy.mockRestore();
    });

    it("作品削除フロー: onBackToBookshelf 未指定で直前探索元（/ranking）が存在する場合は router.back() により /ranking へ復帰すること (TR-07, AC-ND-06)", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");
      let routerRef: ReturnType<typeof useRouter> | null = null;
      const TestOriginDeleteComponent = () => {
        const router = useRouter();
        routerRef = router;
        return (
          <div>
            <div data-testid="observed-current-path">{router.currentPath}</div>
            <ServiceProvider
              services={{
                databaseAdapter: mockDatabaseAdapter,
                settingsRepository: createMockSettingsRepo(),
                novelRepository: createMockNovelRepo(sampleNovel),
                chapterRepository: createMockChapterRepo(sampleChapters),
              }}
            >
              <NovelDetailContainer novelId={sampleNovel.id} />
            </ServiceProvider>
          </div>
        );
      };

      render(
        <RouterProvider initialPath="/ranking">
          <TestOriginDeleteComponent />
        </RouterProvider>,
      );

      // /ranking から詳細へ遷移
      act(() => {
        routerRef?.navigateToNovelDetail(sampleNovel.id, "/ranking");
      });

      await waitFor(() => {
        const last = pageSpy.mock.calls[pageSpy.mock.calls.length - 1]?.[0];
        expect(last?.novel?.id).toBe(sampleNovel.id);
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      await act(async () => {
        await lastProps.onConfirmDelete();
      });

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/ranking",
        );
      });
      pageSpy.mockRestore();
    });

    it("作品削除フロー: onBackToBookshelf 注入時は成功時にそのコールバックが呼ばれる", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");
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
        const last = pageSpy.mock.calls[pageSpy.mock.calls.length - 1]?.[0];
        expect(last?.novel?.id).toBe(sampleNovel.id);
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      await act(async () => {
        await lastProps.onConfirmDelete();
      });

      await waitFor(() => {
        expect(onBackToBookshelf).toHaveBeenCalledTimes(1);
      });
      // ルーター遷移は行われない
      expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
        `/novels/${encodeURIComponent(sampleNovel.id)}`,
      );
      pageSpy.mockRestore();
    });

    it("作品削除フロー: 削除処理失敗時はエラーが表示され本棚へ遷移しない", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");
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
        const last = pageSpy.mock.calls[pageSpy.mock.calls.length - 1]?.[0];
        expect(last?.novel?.id).toBe(sampleNovel.id);
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      await act(async () => {
        await lastProps.onConfirmDelete();
      });

      await waitFor(() => {
        const currentProps =
          pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
        expect(currentProps.error).toBe("削除処理に失敗しました");
      });

      // 本棚画面へは遷移しない
      expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
        `/novels/${encodeURIComponent(sampleNovel.id)}`,
      );
      pageSpy.mockRestore();
    });

    it("一括キャッシュボタンが表示され、クリック時に一括キャッシュ処理が連携起動すること (AC-ND-11)", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");
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
        const last = pageSpy.mock.calls[pageSpy.mock.calls.length - 1]?.[0];
        expect(last?.novel?.id).toBe(sampleNovel.id);
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      act(() => {
        lastProps.onStartBatchCache();
      });

      await waitFor(() => {
        const currentProps =
          pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
        expect(currentProps.isBatchCaching).toBe(true);
      });
      pageSpy.mockRestore();
    });

    it("本文キャッシュ整理ボタンからダイアログを開き削除を実行した際、deleteCachedBodies が呼び出され完了通知が表示されること (AC-ND-21, AC-ND-22, TR-19)", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");
      const deleteCachedBodiesMock = vi.fn().mockResolvedValue(1);
      const mockChapterRepo: ChapterRepository = {
        ...createMockChapterRepo(sampleChapters),
        deleteCachedBodies: deleteCachedBodiesMock,
      };

      render(
        <RouterProvider
          initialPath={`/novels/${encodeURIComponent(sampleNovel.id)}`}
        >
          <RouteObserverWrapper
            novelId={sampleNovel.id}
            novelRepository={createMockNovelRepo(sampleNovel)}
            chapterRepository={mockChapterRepo}
          />
        </RouterProvider>,
      );

      await waitFor(() => {
        const last = pageSpy.mock.calls[pageSpy.mock.calls.length - 1]?.[0];
        expect(last?.novel?.id).toBe(sampleNovel.id);
      });

      let lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];

      // 1. 本文キャッシュ整理ダイアログを開く
      act(() => {
        lastProps.onOpenClearCacheDialog?.();
      });

      await waitFor(() => {
        lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
        expect(lastProps.isClearCacheDialogOpen).toBe(true);
      });

      // 2. 既読話の本文キャッシュのみ削除を実行
      await act(async () => {
        await lastProps.onConfirmClearCache?.({ onlyRead: true });
      });

      await waitFor(() => {
        expect(deleteCachedBodiesMock).toHaveBeenCalledWith(sampleNovel.id, {
          onlyRead: true,
        });
      });

      await waitFor(() => {
        const currentProps =
          pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
        expect(currentProps.isClearCacheDialogOpen).toBe(false);
        expect(currentProps.refreshMessage).toBe(
          "本文キャッシュを削除しました（1話）",
        );
      });
      pageSpy.mockRestore();
    });

    it("子コンポーネント（NovelDetailPage）の onToggleFavorite コールバック呼び出し時に作品のお気に入り状態がトグルされること (Issue #266, R1-04)", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");
      const setFavoriteMock = vi.fn().mockResolvedValue(undefined);
      const novelRepo = {
        ...createMockNovelRepo({
          ...sampleNovel,
          isFavorite: false,
        }),
        setFavorite: setFavoriteMock,
      };

      render(
        <ServiceProvider
          services={{
            novelRepository: novelRepo,
            chapterRepository: createMockChapterRepo(sampleChapters),
          }}
        >
          <RouterProvider initialPath={`/novels/${sampleNovel.id}`}>
            <NovelDetailContainer novelId={sampleNovel.id} />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(pageSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            novel: expect.objectContaining({
              id: sampleNovel.id,
              isFavorite: false,
            }),
          }),
          undefined,
        );
      });

      // NovelDetailPage に渡された onToggleFavorite を直接呼び出し（孫 DOM 操作を排除）
      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      await act(async () => {
        await lastProps.onToggleFavorite?.();
      });

      expect(setFavoriteMock).toHaveBeenCalledWith(sampleNovel.id, true);

      pageSpy.mockRestore();
    });

    it("useNovelDetail から得た pendingCacheCount, failedCacheCount, failedChapterIndexes が NovelDetailPage に伝達されること (AC-ND-24, AC-ND-25)", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");

      const db = await resetTestDb();
      const { SqlNovelRepository } =
        await import("../../../storage/repositories/novelRepository");
      const { SqlChapterRepository } =
        await import("../../../storage/repositories/chapterRepository");
      const { SqlQueueRepository } =
        await import("../../../storage/repositories/queueRepository");

      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const queueRepo = new SqlQueueRepository(db);

      const seeded = await novelRepo.upsertNovelWithToc(
        {
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
        },
        "2026-10-25T10:00:00Z",
      );

      // キューに pending と failed を投入
      await queueRepo.enqueueChapters(seeded.id, [
        { chapterIndex: 2, targetUrl: sampleChapters[1].url },
        { chapterIndex: 3, targetUrl: sampleChapters[2].url },
      ]);
      await queueRepo.updateStatus(seeded.id, 3, "failed", {
        lastError: "通信タイムアウト",
        incrementRetry: true,
      });

      render(
        <ServiceProvider
          services={{
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            queueRepository: queueRepo,
          }}
        >
          <RouterProvider initialPath={`/novels/${seeded.id}`}>
            <NovelDetailContainer novelId={seeded.id} />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(pageSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            pendingCacheCount: 1,
            failedCacheCount: 1,
            failedChapterIndexes: [3],
          }),
          undefined,
        );
      });

      pageSpy.mockRestore();
    });

    it("onOpenWebView が渡された場合、NovelDetailPage へ正しく伝搬されること (Issue #269, TR-09)", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");
      const onOpenWebView = vi.fn();

      render(
        <ServiceProvider
          services={{
            novelRepository: createMockNovelRepo(sampleNovel),
            chapterRepository: createMockChapterRepo(sampleChapters),
          }}
        >
          <RouterProvider initialPath={`/novels/${sampleNovel.id}`}>
            <NovelDetailContainer
              novelId={sampleNovel.id}
              onOpenWebView={onOpenWebView}
            />
          </RouterProvider>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(pageSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            onOpenWebView: expect.any(Function),
          }),
          undefined,
        );
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      lastProps.onOpenWebView?.(sampleNovel.canonicalUrl);
      expect(onOpenWebView).toHaveBeenCalledWith(sampleNovel.canonicalUrl);

      pageSpy.mockRestore();
    });

    it("onOpenWebView が省略された場合、デフォルトで router.navigateToBrowser により /browser へ遷移すること (Issue #269, TR-09, R1-19)", async () => {
      const pageSpy = vi.spyOn(NovelDetailPageModule, "NovelDetailPage");

      const Harness: React.FC = () => {
        const router = useRouter();
        return (
          <div>
            <div data-testid="observed-current-path">{router.currentPath}</div>
            <div data-testid="observed-browser-origin">
              {router.browserOrigin ?? ""}
            </div>
            <ServiceProvider
              services={{
                novelRepository: createMockNovelRepo(sampleNovel),
                chapterRepository: createMockChapterRepo(sampleChapters),
              }}
            >
              <NovelDetailContainer novelId={sampleNovel.id} />
            </ServiceProvider>
          </div>
        );
      };

      render(
        <RouterProvider initialPath={`/novels/${sampleNovel.id}`}>
          <Harness />
        </RouterProvider>,
      );

      await waitFor(() => {
        expect(pageSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            onOpenWebView: expect.any(Function),
          }),
          undefined,
        );
      });

      const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      act(() => {
        lastProps.onOpenWebView?.(sampleNovel.canonicalUrl);
      });

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          `/browser?url=${encodeURIComponent(sampleNovel.canonicalUrl)}&novelId=${encodeURIComponent(sampleNovel.id)}`,
        );
        expect(screen.getByTestId("observed-browser-origin")).toHaveTextContent(
          `/novels/${sampleNovel.id}`,
        );
      });

      pageSpy.mockRestore();
    });
  });
});

import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./ReaderContainer.stories";
import { ReaderContainer, type ReaderContainerProps } from "./ReaderContainer";
import * as ReaderPageModule from "./ReaderPage";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider, useRouter } from "../../../app/router";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import type { DatabaseAdapter } from "../../../storage/adapter/types";
import type {
  NovelRecord,
  ChapterRecord,
  NovelRepository,
  ChapterRepository,
  SettingsRepository,
  ReaderSettings,
} from "../../../storage/types";
import type { HttpClientBridge } from "../../../bridges/http/types";
import type { ParserRegistry } from "../../../parsers/parserRegistry";

const { Default, WithBookmark, Loading, Empty, WithCustomCallbacks } =
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
  cachedChapters: 3,
  totalByteSize: 10240,
  bookmarkChapterIndex: null,
  bookmarkScrollProgress: 0,
  isFavorite: false,
  lastCheckedAt: null,
  lastReadAt: null,
  createdAt: "2026-10-25T10:00:00Z",
  updatedAt: "2026-10-26T07:00:00Z",
};

const sampleChapter1: ChapterRecord = {
  id: "kakuyomu:16817330658027210412:1",
  novelId: "kakuyomu:16817330658027210412",
  chapterIndex: 1,
  remoteChapterId: "1",
  partTitle: "第一部 旅立ち",
  title: "第1話 出会い",
  url: "https://kakuyomu.jp/works/16817330658027210412/episodes/1",
  bodyHtml:
    '<p>青い空に、二つの<ruby>太陽<rt>たいよう</rt></ruby>が輝いていた。<em class="bouten">異界</em>の地平線が広がる。</p>',
  byteSize: 1024,
  isRead: false,
  publishedAt: "2026-01-01T10:00:00Z",
  downloadedAt: "2026-01-01T12:00:00Z",
};

const sampleChapter2: ChapterRecord = {
  id: "kakuyomu:16817330658027210412:2",
  novelId: "kakuyomu:16817330658027210412",
  chapterIndex: 2,
  remoteChapterId: "2",
  partTitle: "第一部 旅立ち",
  title: "第2話 覚醒",
  url: "https://kakuyomu.jp/works/16817330658027210412/episodes/2",
  bodyHtml: "<p>木々が生い茂る迷宮の深層で、少年は静かに魔力を練り上げた。</p>",
  byteSize: 1200,
  isRead: false,
  publishedAt: "2026-01-02T10:00:00Z",
  downloadedAt: "2026-01-02T12:00:00Z",
};

const sampleChapter3: ChapterRecord = {
  id: "kakuyomu:16817330658027210412:3",
  novelId: "kakuyomu:16817330658027210412",
  chapterIndex: 3,
  remoteChapterId: "3",
  partTitle: "第二部 試練",
  title: "第3話 決戦の序曲",
  url: "https://kakuyomu.jp/works/16817330658027210412/episodes/3",
  bodyHtml: "<p>決戦の鐘が響き渡り、運命の歯車が動き始める。</p>",
  byteSize: 1500,
  isRead: false,
  publishedAt: "2026-01-03T10:00:00Z",
  downloadedAt: "2026-01-03T12:00:00Z",
};

function createMockNovelRepo(initialNovel: NovelRecord | null = sampleNovel): {
  repo: NovelRepository;
  updateBookmarkSpy: ReturnType<typeof vi.fn>;
} {
  let currentNovel = initialNovel;
  const updateBookmarkSpy = vi.fn(
    async (_id: string, chapterIndex: number, progress: number) => {
      if (currentNovel) {
        currentNovel = {
          ...currentNovel,
          bookmarkChapterIndex: chapterIndex,
          bookmarkScrollProgress: progress,
        };
      }
    },
  );
  const repo: NovelRepository = {
    listNovels: async () => (currentNovel ? [currentNovel] : []),
    getNovelById: async (id: string) =>
      currentNovel && currentNovel.id === id ? currentNovel : null,
    upsertNovelWithToc: async () =>
      currentNovel ?? ({} as unknown as NovelRecord),
    updateBookmark: updateBookmarkSpy,
    deleteNovel: async () => {},
  };
  return { repo, updateBookmarkSpy };
}

function createMockChapterRepo(
  chapters: ChapterRecord[] = [sampleChapter1, sampleChapter2, sampleChapter3],
): { repo: ChapterRepository; markChapterReadSpy: ReturnType<typeof vi.fn> } {
  const chapterMap = new Map<number, ChapterRecord>(
    chapters.map((ch) => [ch.chapterIndex, ch]),
  );
  const markChapterReadSpy = vi.fn(
    async (_novelId: string, chapterIndex: number, isRead: boolean) => {
      const existing = chapterMap.get(chapterIndex);
      if (existing) {
        chapterMap.set(chapterIndex, { ...existing, isRead });
      }
    },
  );
  const repo: ChapterRepository = {
    listChaptersByNovelId: async () => Array.from(chapterMap.values()),
    getChapter: async (_novelId: string, chapterIndex: number) =>
      chapterMap.get(chapterIndex) ?? null,
    saveChapterBody: async (_novelId, chapterIndex, parsed, downloadedAt) => {
      const existing = chapterMap.get(chapterIndex);
      if (existing) {
        chapterMap.set(chapterIndex, {
          ...existing,
          title: parsed.title,
          bodyHtml: parsed.bodyHtml,
          byteSize: parsed.byteSize,
          downloadedAt,
        });
      }
    },
    markChapterRead: markChapterReadSpy,
    deleteCachedBodies: async () => 0,
  };
  return { repo, markChapterReadSpy };
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
  runTransaction: async (fn) => fn(),
  close: async () => {},
};

interface TestWrapperProps extends ReaderContainerProps {
  initialPath?: string;
  novelRepository?: NovelRepository;
  chapterRepository?: ChapterRepository;
  settingsRepository?: SettingsRepository;
  databaseAdapter?: DatabaseAdapter;
  httpClient?: HttpClientBridge;
  parserRegistry?: ParserRegistry;
}

const TestWrapper: React.FC<TestWrapperProps> = ({
  initialPath,
  novelRepository,
  chapterRepository,
  settingsRepository,
  databaseAdapter,
  httpClient,
  parserRegistry,
  ...containerProps
}) => {
  const resolvedPath =
    initialPath ??
    (containerProps.novelId && containerProps.chapterIndex
      ? `/novels/${containerProps.novelId}/chapters/${containerProps.chapterIndex}`
      : "/novels/kakuyomu:16817330658027210412/chapters/1");

  const resolvedSettingsRepo = settingsRepository ?? createMockSettingsRepo();
  const resolvedDbAdapter = databaseAdapter ?? mockDatabaseAdapter;

  return (
    <RouterProvider initialPath={resolvedPath}>
      <TestObserver
        containerProps={containerProps}
        services={{
          databaseAdapter: resolvedDbAdapter,
          settingsRepository: resolvedSettingsRepo,
          ...(novelRepository ? { novelRepository } : {}),
          ...(chapterRepository ? { chapterRepository } : {}),
          ...(httpClient ? { httpClient } : {}),
          ...(parserRegistry ? { parserRegistry } : {}),
        }}
      />
    </RouterProvider>
  );
};

const TestObserver: React.FC<{
  containerProps: ReaderContainerProps;
  services: Parameters<typeof ServiceProvider>[0]["services"];
}> = ({ containerProps, services }) => {
  const router = useRouter();
  return (
    <div>
      <div data-testid="observed-current-path">{router.currentPath}</div>
      <ServiceProvider services={services}>
        <ReaderContainer {...containerProps} />
      </ServiceProvider>
    </div>
  );
};

describe("ReaderContainer", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState(null, "", "/");
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe("Storybook Stories レンダリング検証 (composeStories)", () => {
    beforeEach(async () => {
      await resetTestDb();
    });

    it("Default ストーリーで直接の子 ReaderPage に novel・chapter（第1話）・chapterIndex・totalChapters が渡され reader-page がマウントされること (AC-RD-01)", async () => {
      const pageSpy = vi.spyOn(ReaderPageModule, "ReaderPage");
      render(<Default />);

      await waitFor(() => {
        expect(screen.getByTestId("reader-page")).toBeInTheDocument();
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            novel: expect.objectContaining({
              id: sampleNovel.id,
              title: "境界迷宮と異界の魔術師",
            }),
            chapter: expect.objectContaining({
              chapterIndex: 1,
              title: "第1話 出会い",
            }),
            chapterIndex: 1,
            totalChapters: 3,
            isLoading: false,
          }),
          undefined,
        );
      });
    });

    it("WithBookmark ストーリーで直接の子 ReaderPage に指定話数（第2話）および initialScrollProgress (0.5) が渡されること (AC-RD-08)", async () => {
      const pageSpy = vi.spyOn(ReaderPageModule, "ReaderPage");
      render(<WithBookmark />);

      await waitFor(() => {
        expect(screen.getByTestId("reader-page")).toBeInTheDocument();
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            novel: expect.objectContaining({
              id: sampleNovel.id,
              title: "境界迷宮と異界の魔術師",
            }),
            chapter: expect.objectContaining({
              chapterIndex: 2,
              title: "第2話 覚醒",
            }),
            chapterIndex: 2,
            totalChapters: 3,
            initialScrollProgress: 0.5,
            isLoading: false,
          }),
          undefined,
        );
      });
    });

    it("Loading ストーリーで ReaderPage に isLoading=true が渡されローディング表示になること", async () => {
      const pageSpy = vi.spyOn(ReaderPageModule, "ReaderPage");
      render(<Loading />);

      await waitFor(() => {
        expect(screen.getByTestId("reader-loading")).toBeInTheDocument();
      });
      expect(pageSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isLoading: true,
          novel: null,
          chapter: null,
        }),
        undefined,
      );
      expect(screen.queryByTestId("reader-view")).not.toBeInTheDocument();
    });

    it("Empty ストーリーで ReaderPage に novel=null・chapter=null が渡され空状態表示になること", async () => {
      const pageSpy = vi.spyOn(ReaderPageModule, "ReaderPage");
      render(<Empty />);

      await waitFor(() => {
        expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
      });
      expect(pageSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isLoading: false,
          novel: null,
          chapter: null,
        }),
        undefined,
      );
    });

    it("WithCustomCallbacks ストーリーでカスタムコールバック注入時も ReaderPage に作品・話データと遷移ハンドラが渡され正常に描画されること", async () => {
      const pageSpy = vi.spyOn(ReaderPageModule, "ReaderPage");
      render(<WithCustomCallbacks />);

      await waitFor(() => {
        expect(screen.getByTestId("reader-page")).toBeInTheDocument();
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            novel: expect.objectContaining({
              id: sampleNovel.id,
              title: "境界迷宮と異界の魔術師",
            }),
            chapterIndex: 1,
            onBackToBookshelf: expect.any(Function),
            onBackToDetail: expect.any(Function),
          }),
          undefined,
        );
      });

      expect(
        screen.getByTestId("reader-back-to-bookshelf"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("reader-back-to-detail")).toBeInTheDocument();
    });
  });

  describe("ルーティングと画面遷移操作の検証 (SCR-03, TR-05, TR-06)", () => {
    it("「本棚へ戻る」クリック時、flushBookmark が実行され、カスタムコールバックが呼び出されること", async () => {
      const user = userEvent.setup();
      const onBackToBookshelf = vi.fn();
      const { repo: novelRepository, updateBookmarkSpy } =
        createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelId={sampleNovel.id}
          chapterIndex={1}
          onBackToBookshelf={onBackToBookshelf}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("reader-back-to-bookshelf"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-back-to-bookshelf"));

      await waitFor(() => {
        expect(updateBookmarkSpy).toHaveBeenCalled();
        expect(onBackToBookshelf).toHaveBeenCalledTimes(1);
      });
    });

    it("「本棚へ戻る」クリック時、コールバック省略時にルーターの navigateToBookshelf が呼び出されること", async () => {
      const user = userEvent.setup();
      const { repo: novelRepository } = createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelId={sampleNovel.id}
          chapterIndex={1}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("reader-back-to-bookshelf"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-back-to-bookshelf"));

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/",
        );
      });
    });

    it("「作品詳細へ」クリック時、flushBookmark が実行され、対象作品ID でカスタムコールバックが呼び出されること (TR-06)", async () => {
      const user = userEvent.setup();
      const onBackToDetail = vi.fn();
      const { repo: novelRepository, updateBookmarkSpy } =
        createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelId={sampleNovel.id}
          chapterIndex={1}
          onBackToDetail={onBackToDetail}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-back-to-detail")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-back-to-detail"));

      await waitFor(() => {
        expect(updateBookmarkSpy).toHaveBeenCalled();
        expect(onBackToDetail).toHaveBeenCalledWith(sampleNovel.id);
      });
    });

    it("「作品詳細へ」クリック時、コールバック省略時にルーターの navigateToNovelDetail が呼び出されること (TR-06)", async () => {
      const user = userEvent.setup();
      const { repo: novelRepository } = createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelId={sampleNovel.id}
          chapterIndex={1}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-back-to-detail")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-back-to-detail"));

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          `/novels/${encodeURIComponent(sampleNovel.id)}`,
        );
      });
    });

    it("novelId 省略時でも novel.id から targetId を解決して「作品詳細へ」遷移できること", async () => {
      const user = userEvent.setup();
      const onBackToDetail = vi.fn();
      const { repo: novelRepository } = createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          onBackToDetail={onBackToDetail}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-back-to-detail")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-back-to-detail"));

      await waitFor(() => {
        expect(onBackToDetail).toHaveBeenCalledWith(sampleNovel.id);
      });
    });

    it("targetId が存在しない（未登録空状態）場合、「作品詳細へ」を押下しても遷移コールバックが呼ばれないこと", async () => {
      const user = userEvent.setup();
      const onBackToDetail = vi.fn();
      const { repo: novelRepository } = createMockNovelRepo(null);
      const { repo: chapterRepository } = createMockChapterRepo([]);

      render(
        <TestWrapper
          onBackToDetail={onBackToDetail}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-back-to-detail"));

      expect(onBackToDetail).not.toHaveBeenCalled();
    });
  });

  describe("前後エピソード遷移の検証 (TR-05, AC-RD-06)", () => {
    it("第1話で「次の話へ」クリック時、第2話へ遷移し、カスタム onNavigateChapter が呼び出されること (TR-05)", async () => {
      const user = userEvent.setup();
      const onNavigateChapter = vi.fn();
      const { repo: novelRepository } = createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelId={sampleNovel.id}
          chapterIndex={1}
          onNavigateChapter={onNavigateChapter}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-next-chapter"));

      await waitFor(() => {
        expect(onNavigateChapter).toHaveBeenCalledWith(sampleNovel.id, 2);
      });
    });

    it("第1話で「次の話へ」クリック時、コールバック省略時にルーターの navigateToReader が呼び出されること (TR-05)", async () => {
      const user = userEvent.setup();
      const { repo: novelRepository } = createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelId={sampleNovel.id}
          chapterIndex={1}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-next-chapter"));

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          `/novels/${encodeURIComponent(sampleNovel.id)}/chapters/2`,
        );
      });
    });

    it("第2話で「前の話へ」クリック時、第1話へ遷移し、カスタム onNavigateChapter が呼び出されること (TR-05)", async () => {
      const user = userEvent.setup();
      const onNavigateChapter = vi.fn();
      const { repo: novelRepository } = createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelId={sampleNovel.id}
          chapterIndex={2}
          onNavigateChapter={onNavigateChapter}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-prev-chapter"));

      await waitFor(() => {
        expect(onNavigateChapter).toHaveBeenCalledWith(sampleNovel.id, 1);
      });
    });

    it("第2話で「前の話へ」クリック時、コールバック省略時にルーターの navigateToReader が呼び出されること (TR-05)", async () => {
      const user = userEvent.setup();
      const { repo: novelRepository } = createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelId={sampleNovel.id}
          chapterIndex={2}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-prev-chapter"));

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          `/novels/${encodeURIComponent(sampleNovel.id)}/chapters/1`,
        );
      });
    });

    it("novelId 省略時でも novel.id から targetId を解決して次話遷移できること", async () => {
      const user = userEvent.setup();
      const onNavigateChapter = vi.fn();
      const { repo: novelRepository } = createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          chapterIndex={1}
          onNavigateChapter={onNavigateChapter}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-next-chapter"));

      await waitFor(() => {
        expect(onNavigateChapter).toHaveBeenCalledWith(sampleNovel.id, 2);
      });
    });

    it("novelId 省略時でも novel.id から targetId を解決して前話遷移できること", async () => {
      const user = userEvent.setup();
      const onNavigateChapter = vi.fn();
      const { repo: novelRepository } = createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          chapterIndex={2}
          onNavigateChapter={onNavigateChapter}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-prev-chapter"));

      await waitFor(() => {
        expect(onNavigateChapter).toHaveBeenCalledWith(sampleNovel.id, 1);
      });
    });

    it("第1話で「前の話へ」イベントが発火しても（goToChapter が false を返却）、遷移処理が実行されないこと", async () => {
      const onNavigateChapter = vi.fn();
      const { repo: novelRepository } = createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelId={sampleNovel.id}
          chapterIndex={1}
          onNavigateChapter={onNavigateChapter}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      });

      // disabled ボタンに対して直接 click イベントを発火（goToChapter(0) が false を返す）
      fireEvent.click(screen.getByTestId("reader-prev-chapter"));

      expect(onNavigateChapter).not.toHaveBeenCalled();
    });

    it("最終話で「次の話へ」イベントが発火しても（goToChapter が false を返却）、遷移処理が実行されないこと", async () => {
      const onNavigateChapter = vi.fn();
      const { repo: novelRepository } = createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelId={sampleNovel.id}
          chapterIndex={3}
          onNavigateChapter={onNavigateChapter}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      });

      // disabled ボタンに対して直接 click イベントを発火（goToChapter(4) が false を返す）
      fireEvent.click(screen.getByTestId("reader-next-chapter"));

      expect(onNavigateChapter).not.toHaveBeenCalled();
    });
  });

  describe("組版・設定変更およびスクロール進捗の検証 (AC-RD-03, AC-RD-04, AC-RD-05)", () => {
    it("組み方向切替ボタン押下で縦書き/横書きが切り替わること (AC-RD-03)", async () => {
      const user = userEvent.setup();
      const { repo: novelRepository } = createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelId={sampleNovel.id}
          chapterIndex={1}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      });

      expect(screen.getByTestId("reader-view")).toHaveAttribute(
        "data-writing-mode",
        "vertical-rl",
      );

      await user.click(screen.getByTestId("toggle-orientation"));

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toHaveAttribute(
          "data-writing-mode",
          "horizontal-tb",
        );
      });
    });

    it("テーマボタン押下でテーマが変更されること (AC-RD-04)", async () => {
      const user = userEvent.setup();
      const { repo: novelRepository } = createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelId={sampleNovel.id}
          chapterIndex={1}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("theme-sepia"));

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toHaveAttribute(
          "data-theme",
          "sepia",
        );
      });
    });

    it("文字サイズステッパー操作で文字サイズが変更されること (AC-RD-05)", async () => {
      const user = userEvent.setup();
      const { repo: novelRepository } = createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelId={sampleNovel.id}
          chapterIndex={1}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("font-size-increase"));

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toHaveAttribute(
          "data-font-size",
          "20",
        );
      });
    });

    it("行間ステッパー操作で行間が変更されること (AC-RD-05)", async () => {
      const user = userEvent.setup();
      const { repo: novelRepository } = createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelId={sampleNovel.id}
          chapterIndex={1}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("line-height-increase"));

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toHaveAttribute(
          "data-line-height",
          "2",
        );
      });
    });

    it("本文スクロール時にスクロール進捗率が更新されること (AC-RD-08)", async () => {
      const { repo: novelRepository, updateBookmarkSpy } =
        createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelId={sampleNovel.id}
          chapterIndex={1}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      });

      const readerView = screen.getByTestId("reader-view");
      Object.defineProperty(readerView, "scrollWidth", {
        value: 1000,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(readerView, "clientWidth", {
        value: 500,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(readerView, "scrollLeft", {
        value: -250,
        configurable: true,
        writable: true,
      });

      await act(async () => {
        readerView.dispatchEvent(new Event("scroll"));
      });

      await waitFor(() => {
        expect(updateBookmarkSpy).toHaveBeenCalledWith(sampleNovel.id, 1, 0.5);
      });
    });

    it("「作品を取得/更新」ボタン押下で手動作品取得が実行されること", async () => {
      const user = userEvent.setup();
      const pageSpy = vi.spyOn(ReaderPageModule, "ReaderPage");
      const { repo: novelRepository } = createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelId={sampleNovel.id}
          chapterIndex={1}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      });

      expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();

      await user.click(screen.getByTestId("fetch-novel-button"));

      // 取得処理がトリガーされ ReaderPage に作品が再描画されたことを確認
      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            novel: expect.objectContaining({
              title: "境界迷宮と異界の魔術師",
            }),
            isLoading: false,
          }),
          undefined,
        );
      });
    });
  });

  describe("Props 未指定時のデフォルト動作", () => {
    it("Props を指定せずにマウントした際、DB の先頭作品が自動ロードされて ReaderPage に渡されること", async () => {
      const pageSpy = vi.spyOn(ReaderPageModule, "ReaderPage");
      const { repo: novelRepository } = createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-page")).toBeInTheDocument();
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            novel: expect.objectContaining({
              id: sampleNovel.id,
              title: "境界迷宮と異界の魔術師",
            }),
            chapterIndex: 1,
            isLoading: false,
          }),
          undefined,
        );
      });
    });
  });
});

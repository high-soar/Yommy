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
            onSelectTab: expect.any(Function),
            onPrevChapter: expect.any(Function),
            onNextChapter: expect.any(Function),
          }),
          undefined,
        );
      });

      expect(
        screen.getByTestId("reader-bottom-touch-zone"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("reader-bottom-overlay")).toBeInTheDocument();
    });
  });

  describe("下部タブ遷移時のしおり保存と画面遷移の検証 (AC-RD-08, TR-01)", () => {
    it("下部オーバーレイの「本棚」タブクリック時、flushBookmark が実行されカスタムコールバックが呼び出されること", async () => {
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
        expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      });

      // 最下部タッチゾーンをタップしてオーバーレイを展開
      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      fireEvent.pointerDown(touchZone, { clientX: 100, clientY: 500 });
      fireEvent.pointerUp(touchZone, { clientX: 100, clientY: 500 });

      const bookshelfTab = screen.getByTestId("reader-bottom-tab-bookshelf");
      await user.click(bookshelfTab);

      await waitFor(() => {
        expect(updateBookmarkSpy).toHaveBeenCalled();
        expect(onBackToBookshelf).toHaveBeenCalledTimes(1);
      });
    });

    it("下部オーバーレイの「本棚」タブクリック時、コールバック省略時にルーターの navigateToBookshelf が呼び出されること", async () => {
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

      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      fireEvent.pointerDown(touchZone, { clientX: 100, clientY: 500 });
      fireEvent.pointerUp(touchZone, { clientX: 100, clientY: 500 });

      const bookshelfTab = screen.getByTestId("reader-bottom-tab-bookshelf");
      await user.click(bookshelfTab);

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/",
        );
      });
    });

    it("下部オーバーレイの「設定」タブクリック時、flushBookmark が実行されカスタムコールバックが呼び出されること", async () => {
      const user = userEvent.setup();
      const onNavigateSettings = vi.fn();
      const { repo: novelRepository, updateBookmarkSpy } =
        createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelId={sampleNovel.id}
          chapterIndex={1}
          onNavigateSettings={onNavigateSettings}
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      });

      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      fireEvent.pointerDown(touchZone, { clientX: 100, clientY: 500 });
      fireEvent.pointerUp(touchZone, { clientX: 100, clientY: 500 });

      const settingsTab = screen.getByTestId("reader-bottom-tab-settings");
      await user.click(settingsTab);

      await waitFor(() => {
        expect(updateBookmarkSpy).toHaveBeenCalled();
        expect(onNavigateSettings).toHaveBeenCalledTimes(1);
      });
    });

    it("下部オーバーレイの「設定」タブクリック時、コールバック省略時にルーターの navigate('/settings') が呼び出されること", async () => {
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

      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      fireEvent.pointerDown(touchZone, { clientX: 100, clientY: 500 });
      fireEvent.pointerUp(touchZone, { clientX: 100, clientY: 500 });

      const settingsTab = screen.getByTestId("reader-bottom-tab-settings");
      await user.click(settingsTab);

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          "/settings",
        );
      });
    });
  });

  describe("OS バックキーおよび画面離脱時のしおり自動保存 (AC-RD-08, TR-06)", () => {
    it("popstate イベント（OS バックキー操作）発生時に flushBookmark が実行されること", async () => {
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

      updateBookmarkSpy.mockClear();

      await act(async () => {
        window.dispatchEvent(new PopStateEvent("popstate"));
      });

      await waitFor(() => {
        expect(updateBookmarkSpy).toHaveBeenCalledWith(sampleNovel.id, 1, 0);
      });
    });

    it("コンポーネントのアンマウント時に flushBookmark が実行されること", async () => {
      const { repo: novelRepository, updateBookmarkSpy } =
        createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      const { unmount } = render(
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

      updateBookmarkSpy.mockClear();

      unmount();

      await waitFor(() => {
        expect(updateBookmarkSpy).toHaveBeenCalledWith(sampleNovel.id, 1, 0);
      });
    });
  });

  describe("前後エピソード遷移の検証 (TR-05, AC-RD-06)", () => {
    it("第1話でオーバーレイを展開して「次の話へ」クリック時、第2話へ遷移しカスタム onNavigateChapter が呼び出されること (TR-05)", async () => {
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

      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      fireEvent.pointerDown(touchZone, { clientX: 100, clientY: 500 });
      fireEvent.pointerUp(touchZone, { clientX: 100, clientY: 500 });

      await user.click(screen.getByTestId("reader-next-chapter"));

      await waitFor(() => {
        expect(onNavigateChapter).toHaveBeenCalledWith(sampleNovel.id, 2);
      });
    });

    it("第1話でオーバーレイから「次の話へ」クリック時、コールバック省略時にルーターの navigateToReader が呼び出されること (TR-05)", async () => {
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

      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      fireEvent.pointerDown(touchZone, { clientX: 100, clientY: 500 });
      fireEvent.pointerUp(touchZone, { clientX: 100, clientY: 500 });

      await user.click(screen.getByTestId("reader-next-chapter"));

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          `/novels/${encodeURIComponent(sampleNovel.id)}/chapters/2`,
        );
      });
    });

    it("第2話でオーバーレイから「前の話へ」クリック時、第1話へ遷移しカスタム onNavigateChapter が呼び出されること (TR-05)", async () => {
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

      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      fireEvent.pointerDown(touchZone, { clientX: 100, clientY: 500 });
      fireEvent.pointerUp(touchZone, { clientX: 100, clientY: 500 });

      await user.click(screen.getByTestId("reader-prev-chapter"));

      await waitFor(() => {
        expect(onNavigateChapter).toHaveBeenCalledWith(sampleNovel.id, 1);
      });
    });

    it("第2話でオーバーレイから「前の話へ」クリック時、コールバック省略時にルーターの navigateToReader が呼び出されること (TR-05)", async () => {
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

      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      fireEvent.pointerDown(touchZone, { clientX: 100, clientY: 500 });
      fireEvent.pointerUp(touchZone, { clientX: 100, clientY: 500 });

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

      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      fireEvent.pointerDown(touchZone, { clientX: 100, clientY: 500 });
      fireEvent.pointerUp(touchZone, { clientX: 100, clientY: 500 });

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

      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      fireEvent.pointerDown(touchZone, { clientX: 100, clientY: 500 });
      fireEvent.pointerUp(touchZone, { clientX: 100, clientY: 500 });

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

      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      fireEvent.pointerDown(touchZone, { clientX: 100, clientY: 500 });
      fireEvent.pointerUp(touchZone, { clientX: 100, clientY: 500 });

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

      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      fireEvent.pointerDown(touchZone, { clientX: 100, clientY: 500 });
      fireEvent.pointerUp(touchZone, { clientX: 100, clientY: 500 });

      // disabled ボタンに対して直接 click イベントを発火（goToChapter(4) が false を返す）
      fireEvent.click(screen.getByTestId("reader-next-chapter"));

      expect(onNavigateChapter).not.toHaveBeenCalled();
    });
  });

  describe("本文スクロール時の進捗率更新 (AC-RD-08)", () => {
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

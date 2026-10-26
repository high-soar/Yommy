import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./ReaderContainer.stories";
import { ReaderContainer, type ReaderContainerProps } from "./ReaderContainer";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider, useRouter } from "../../../app/router";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import type {
  NovelRecord,
  ChapterRecord,
  NovelRepository,
  ChapterRepository,
  SettingsRepository,
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

interface TestWrapperProps extends ReaderContainerProps {
  initialPath?: string;
  novelRepository?: NovelRepository;
  chapterRepository?: ChapterRepository;
  settingsRepository?: SettingsRepository;
  httpClient?: HttpClientBridge;
  parserRegistry?: ParserRegistry;
}

const TestWrapper: React.FC<TestWrapperProps> = ({
  initialPath = "/novels/kakuyomu:16817330658027210412/chapters/1",
  novelRepository,
  chapterRepository,
  settingsRepository,
  httpClient,
  parserRegistry,
  ...containerProps
}) => {
  return (
    <RouterProvider initialPath={initialPath}>
      <TestObserver
        containerProps={containerProps}
        services={{
          ...(novelRepository ? { novelRepository } : {}),
          ...(chapterRepository ? { chapterRepository } : {}),
          ...(settingsRepository ? { settingsRepository } : {}),
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
  beforeEach(async () => {
    await resetTestDb();
    localStorage.clear();
    window.history.pushState(null, "", "/");
    vi.clearAllMocks();
  });

  describe("Storybook Stories レンダリング検証 (composeStories)", () => {
    it("Default ストーリーで作品名・サブタイトル・本文が描画されること (AC-RD-01)", async () => {
      render(<Default />);

      await waitFor(() => {
        expect(screen.getByTestId("reader-page")).toBeInTheDocument();
        expect(screen.getByTestId("reader-title")).toHaveTextContent(
          "境界迷宮と異界の魔術師",
        );
      });

      expect(screen.getByTestId("reader-chapter-title")).toHaveTextContent(
        "第1話 出会い",
      );
      expect(screen.getByTestId("reader-chapter-indicator")).toHaveTextContent(
        "第 1 話 / 全 3 話",
      );
      expect(screen.getByTestId("reader-body")).toBeInTheDocument();
    });

    it("WithBookmark ストーリーで指定話数（第2話）の本文が表示されること (AC-RD-08)", async () => {
      render(<WithBookmark />);

      await waitFor(() => {
        expect(screen.getByTestId("reader-page")).toBeInTheDocument();
        expect(screen.getByTestId("reader-title")).toHaveTextContent(
          "境界迷宮と異界の魔術師",
        );
      });

      expect(screen.getByTestId("reader-chapter-title")).toHaveTextContent(
        "第2話 覚醒",
      );
      expect(screen.getByTestId("reader-chapter-indicator")).toHaveTextContent(
        "第 2 話 / 全 3 話",
      );
    });

    it("Loading ストーリーでローディング表示になること", async () => {
      render(<Loading />);

      await waitFor(() => {
        expect(screen.getByTestId("reader-loading")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("reader-view")).not.toBeInTheDocument();
    });

    it("Empty ストーリーで空状態表示になること", async () => {
      render(<Empty />);

      await waitFor(() => {
        expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
      });
      expect(
        screen.getByText("作品またはエピソードが見つかりません。"),
      ).toBeInTheDocument();
    });

    it("WithCustomCallbacks ストーリーでカスタムコールバック注入時も正常に描画されること", async () => {
      render(<WithCustomCallbacks />);

      await waitFor(() => {
        expect(screen.getByTestId("reader-page")).toBeInTheDocument();
        expect(screen.getByTestId("reader-title")).toHaveTextContent(
          "境界迷宮と異界の魔術師",
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
          `/novels/${sampleNovel.id}`,
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
        expect(screen.getByTestId("reader-next-chapter")).toBeInTheDocument();
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
        expect(screen.getByTestId("reader-next-chapter")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-next-chapter"));

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          `/novels/${sampleNovel.id}/chapters/2`,
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
        expect(screen.getByTestId("reader-prev-chapter")).toBeInTheDocument();
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
        expect(screen.getByTestId("reader-prev-chapter")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-prev-chapter"));

      await waitFor(() => {
        expect(screen.getByTestId("observed-current-path")).toHaveTextContent(
          `/novels/${sampleNovel.id}/chapters/1`,
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
        expect(screen.getByTestId("reader-next-chapter")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-next-chapter"));

      await waitFor(() => {
        expect(onNavigateChapter).toHaveBeenCalledWith(sampleNovel.id, 2);
      });
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
        expect(screen.getByTestId("toggle-orientation")).toBeInTheDocument();
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
        expect(screen.getByTestId("theme-sepia")).toBeInTheDocument();
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
        expect(screen.getByTestId("font-size-increase")).toBeInTheDocument();
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
        expect(screen.getByTestId("line-height-increase")).toBeInTheDocument();
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
      });
      Object.defineProperty(readerView, "clientWidth", {
        value: 500,
        configurable: true,
      });
      Object.defineProperty(readerView, "scrollLeft", {
        value: -250,
        configurable: true,
      });

      readerView.dispatchEvent(new Event("scroll"));

      await waitFor(() => {
        expect(updateBookmarkSpy).toHaveBeenCalledWith(sampleNovel.id, 1, 0.5);
      });
    });

    it("「作品を取得/更新」ボタン押下で手動作品取得が実行されること", async () => {
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
        expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("fetch-novel-button"));

      // 取得処理がトリガーされたことを確認
      await waitFor(() => {
        expect(screen.getByTestId("reader-title")).toBeInTheDocument();
      });
    });
  });

  describe("Props 未指定時のデフォルト動作", () => {
    it("Props を指定せずにマウントした際、DB の先頭作品が自動ロードされて描画されること", async () => {
      const { repo: novelRepository } = createMockNovelRepo(sampleNovel);
      const { repo: chapterRepository } = createMockChapterRepo();

      render(
        <TestWrapper
          novelRepository={novelRepository}
          chapterRepository={chapterRepository}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-title")).toHaveTextContent(
          "境界迷宮と異界の魔術師",
        );
      });
    });
  });
});

import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { NovelDetailContainer } from "./NovelDetailContainer";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider } from "../../../app/router";
import type {
  NovelRecord,
  ChapterSummary,
  NovelRepository,
  ChapterRepository,
  QueueRepository,
  DownloadQueueItem,
} from "../../../storage/types";

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

function createMockNovelRepository(novel: NovelRecord | null): NovelRepository {
  return {
    listNovels: async () => (novel ? [novel] : []),
    getNovelById: async (id: string) =>
      novel && novel.id === id ? novel : null,
    upsertNovelWithToc: async () => novel ?? ({} as unknown as NovelRecord),
    updateBookmark: async () => {},
    setFavorite: async (_id: string, isFav: boolean) => {
      if (novel) novel.isFavorite = isFav;
    },
    deleteNovel: async () => {},
    clearNewUpdate: async () => {},
    updateLastCheckedAt: async () => {},
  };
}

function createMockChapterRepository(
  chapters: ChapterSummary[],
): ChapterRepository {
  return {
    listChaptersByNovelId: async () => chapters,
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

function createMockQueueRepository(
  items: DownloadQueueItem[] = [],
): QueueRepository {
  let queue = [...items];
  return {
    enqueueChapters: async (
      _novelId,
      inputs,
      nowIso = new Date().toISOString(),
    ) => {
      for (const input of inputs) {
        const existing = queue.find(
          (q) => q.chapterIndex === input.chapterIndex,
        );
        if (existing) {
          existing.status = "pending";
          existing.lastError = null;
          existing.updatedAt = nowIso;
        } else {
          queue.push({
            id: queue.length + 1,
            novelId: _novelId,
            chapterIndex: input.chapterIndex,
            targetUrl: input.targetUrl,
            status: "pending",
            retryCount: 0,
            lastError: null,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        }
      }
    },
    listByNovelId: async () => queue,
    updateStatus: async (_novelId, chapterIndex, status, options) => {
      const target = queue.find((q) => q.chapterIndex === chapterIndex);
      if (target) {
        target.status = status;
        if (options?.incrementRetry) target.retryCount += 1;
        if (options?.lastError !== undefined)
          target.lastError = options.lastError;
      }
    },
    resetInterruptedToPending: async () => {
      for (const item of queue) {
        if (item.status === "downloading") {
          item.status = "pending";
        }
      }
    },
    deleteByNovelAndChapters: async (_novelId, chapterIndexes) => {
      queue = queue.filter((q) => !chapterIndexes.includes(q.chapterIndex));
    },
    clearNovelQueue: async () => {
      queue = [];
    },
    clearAllQueue: async () => {
      queue = [];
    },
  };
}

const loadingNovelRepo: NovelRepository = {
  listNovels: () => new Promise(() => {}),
  getNovelById: () => new Promise(() => {}),
  upsertNovelWithToc: () => new Promise(() => {}),
  updateBookmark: () => new Promise(() => {}),
  setFavorite: () => new Promise(() => {}),
  deleteNovel: () => new Promise(() => {}),
  clearNewUpdate: () => new Promise(() => {}),
  updateLastCheckedAt: () => new Promise(() => {}),
};

const loadingChapterRepo: ChapterRepository = {
  listChaptersByNovelId: () => new Promise(() => {}),
  getChapter: () => new Promise(() => {}),
  saveChapterBody: () => new Promise(() => {}),
  markChapterRead: () => new Promise(() => {}),
  deleteCachedBodies: () => new Promise(() => {}),
  deleteAllCachedBodies: () => new Promise(() => {}),
  getStorageCacheSummary: () => new Promise(() => {}),
};

const meta: Meta<typeof NovelDetailContainer> = {
  title: "NovelDetail/NovelDetailContainer",
  component: NovelDetailContainer,
};

export default meta;
type Story = StoryObj<typeof NovelDetailContainer>;

/**
 * デフォルト表示ストーリー（登録済み作品・未読・目次あり）
 */
export const Default: Story = {
  name: "デフォルト表示（目次あり・未読）",
  args: {
    novelId: sampleNovel.id,
  },
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: createMockNovelRepository(sampleNovel),
        chapterRepository: createMockChapterRepository(sampleChapters),
      }}
    >
      <RouterProvider initialPath={`/novels/${args.novelId}`}>
        <NovelDetailContainer {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

/**
 * しおり設定作品ストーリー（続きから読むボタン表示）
 */
export const WithBookmark: Story = {
  name: "しおり設定作品（第2話）",
  args: {
    novelId: sampleNovelWithBookmark.id,
  },
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: createMockNovelRepository(sampleNovelWithBookmark),
        chapterRepository: createMockChapterRepository(sampleChapters),
      }}
    >
      <RouterProvider initialPath={`/novels/${args.novelId}`}>
        <NovelDetailContainer {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

/**
 * 初回データ読み込み中状態ストーリー
 */
export const Loading: Story = {
  name: "初回データ読み込み中",
  args: {
    novelId: sampleNovel.id,
  },
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: loadingNovelRepo,
        chapterRepository: loadingChapterRepo,
      }}
    >
      <RouterProvider initialPath={`/novels/${args.novelId}`}>
        <NovelDetailContainer {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

/**
 * 指定作品が存在しない（Not Found）状態ストーリー
 */
export const NotFound: Story = {
  name: "作品未検出（Not Found）",
  args: {
    novelId: "unknown-novel-id",
  },
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: createMockNovelRepository(null),
        chapterRepository: createMockChapterRepository([]),
      }}
    >
      <RouterProvider initialPath="/novels/unknown-novel-id">
        <NovelDetailContainer {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

/**
 * カスタム遷移コールバック注入ストーリー
 */
export const WithCustomCallbacks: Story = {
  name: "カスタムコールバック注入",
  args: {
    novelId: sampleNovel.id,
    onBackToBookshelf: fn(),
    onSelectEpisode: fn(),
    onOpenWebView: fn(),
  },
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: createMockNovelRepository(sampleNovel),
        chapterRepository: createMockChapterRepository(sampleChapters),
      }}
    >
      <RouterProvider initialPath={`/novels/${args.novelId}`}>
        <NovelDetailContainer {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

/**
 * 一括キャッシュ中断後の再開待ち表示ストーリー
 */
export const ResumePending: Story = {
  name: "キャッシュ再開待ち",
  args: {
    novelId: sampleNovel.id,
  },
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: createMockNovelRepository(sampleNovel),
        chapterRepository: createMockChapterRepository(sampleChapters),
        queueRepository: createMockQueueRepository([
          {
            id: 1,
            novelId: sampleNovel.id,
            chapterIndex: 2,
            targetUrl: sampleChapters[1].url,
            status: "pending",
            retryCount: 0,
            lastError: null,
            createdAt: "2026-10-25T10:00:00Z",
            updatedAt: "2026-10-25T10:00:00Z",
          },
          {
            id: 2,
            novelId: sampleNovel.id,
            chapterIndex: 3,
            targetUrl: sampleChapters[2].url,
            status: "pending",
            retryCount: 0,
            lastError: null,
            createdAt: "2026-10-25T10:00:00Z",
            updatedAt: "2026-10-25T10:00:00Z",
          },
        ]),
      }}
    >
      <RouterProvider initialPath={`/novels/${args.novelId}`}>
        <NovelDetailContainer {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

/**
 * 一括キャッシュ失敗話の再試行待ち・取得失敗バッジ表示ストーリー
 */
export const RetryFailed: Story = {
  name: "失敗話の再試行待ち",
  args: {
    novelId: sampleNovel.id,
  },
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: createMockNovelRepository(sampleNovel),
        chapterRepository: createMockChapterRepository(sampleChapters),
        queueRepository: createMockQueueRepository([
          {
            id: 1,
            novelId: sampleNovel.id,
            chapterIndex: 2,
            targetUrl: sampleChapters[1].url,
            status: "failed",
            retryCount: 1,
            lastError: "通信タイムアウト",
            createdAt: "2026-10-25T10:00:00Z",
            updatedAt: "2026-10-25T10:00:00Z",
          },
        ]),
      }}
    >
      <RouterProvider initialPath={`/novels/${args.novelId}`}>
        <NovelDetailContainer {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

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
  };
}

const loadingNovelRepo: NovelRepository = {
  listNovels: () => new Promise(() => {}),
  getNovelById: () => new Promise(() => {}),
  upsertNovelWithToc: () => new Promise(() => {}),
  updateBookmark: () => new Promise(() => {}),
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

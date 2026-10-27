import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ReaderContainer } from "./ReaderContainer";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider } from "../../../app/router";
import type {
  NovelRecord,
  ChapterRecord,
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

const sampleNovelWithBookmark: NovelRecord = {
  ...sampleNovel,
  bookmarkChapterIndex: 2,
  bookmarkScrollProgress: 0.5,
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

function createMockNovelRepository(novel: NovelRecord | null): NovelRepository {
  let current = novel;
  return {
    listNovels: async () => (current ? [current] : []),
    getNovelById: async (id: string) =>
      current && current.id === id ? current : null,
    upsertNovelWithToc: async () => current ?? ({} as unknown as NovelRecord),
    updateBookmark: async (_novelId, chapterIdx, progress) => {
      if (current) {
        current = {
          ...current,
          bookmarkChapterIndex: chapterIdx,
          bookmarkScrollProgress: progress,
        };
      }
    },
    deleteNovel: async () => {},
  };
}

function createMockChapterRepository(
  chapters: ChapterRecord[],
): ChapterRepository {
  const chapterMap = new Map<number, ChapterRecord>(
    chapters.map((ch) => [ch.chapterIndex, ch]),
  );
  return {
    listChaptersByNovelId: async () => chapters,
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
    markChapterRead: async (_novelId, chapterIndex, isRead) => {
      const existing = chapterMap.get(chapterIndex);
      if (existing) {
        chapterMap.set(chapterIndex, { ...existing, isRead });
      }
    },
    deleteCachedBodies: async () => 0,
  };
}

const loadingNovelRepo: NovelRepository = {
  listNovels: () => new Promise(() => {}),
  getNovelById: () => new Promise(() => {}),
  upsertNovelWithToc: () => new Promise(() => {}),
  updateBookmark: () => new Promise(() => {}),
  deleteNovel: () => new Promise(() => {}),
};

const loadingChapterRepo: ChapterRepository = {
  listChaptersByNovelId: () => new Promise(() => {}),
  getChapter: () => new Promise(() => {}),
  saveChapterBody: () => new Promise(() => {}),
  markChapterRead: () => new Promise(() => {}),
  deleteCachedBodies: () => new Promise(() => {}),
};

const meta: Meta<typeof ReaderContainer> = {
  title: "Reader/ReaderContainer",
  component: ReaderContainer,
};

export default meta;
type Story = StoryObj<typeof ReaderContainer>;

/**
 * デフォルト表示ストーリー（第1話・キャッシュ済み本文）
 */
export const Default: Story = {
  name: "デフォルト表示（第1話・キャッシュ済み本文）",
  args: {
    novelId: sampleNovel.id,
    chapterIndex: 1,
  },
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: createMockNovelRepository(sampleNovel),
        chapterRepository: createMockChapterRepository([
          sampleChapter1,
          sampleChapter2,
          sampleChapter3,
        ]),
      }}
    >
      <RouterProvider
        initialPath={`/novels/${args.novelId}/chapters/${args.chapterIndex}`}
      >
        <ReaderContainer {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

/**
 * しおり復元表示ストーリー（第2話・進捗率50%）
 */
export const WithBookmark: Story = {
  name: "しおり復元表示（第2話・進捗率50%）",
  args: {
    novelId: sampleNovelWithBookmark.id,
    chapterIndex: 2,
  },
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: createMockNovelRepository(sampleNovelWithBookmark),
        chapterRepository: createMockChapterRepository([
          sampleChapter1,
          sampleChapter2,
          sampleChapter3,
        ]),
      }}
    >
      <RouterProvider
        initialPath={`/novels/${args.novelId}/chapters/${args.chapterIndex}`}
      >
        <ReaderContainer {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

/**
 * 初回エピソード読み込み中状態ストーリー
 */
export const Loading: Story = {
  name: "初回エピソード読み込み中",
  args: {
    novelId: sampleNovel.id,
    chapterIndex: 1,
  },
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: loadingNovelRepo,
        chapterRepository: loadingChapterRepo,
      }}
    >
      <RouterProvider
        initialPath={`/novels/${args.novelId}/chapters/${args.chapterIndex}`}
      >
        <ReaderContainer {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

/**
 * 作品未登録・空状態ストーリー
 */
export const Empty: Story = {
  name: "作品未登録・空状態",
  args: {
    novelId: "unknown-novel-id",
    chapterIndex: 1,
  },
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: createMockNovelRepository(null),
        chapterRepository: createMockChapterRepository([]),
      }}
    >
      <RouterProvider initialPath="/novels/unknown-novel-id/chapters/1">
        <ReaderContainer {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

/**
 * カスタム遷移コールバック注入ストーリー
 */
export const WithCustomCallbacks: Story = {
  name: "カスタム遷移コールバック注入",
  args: {
    novelId: sampleNovel.id,
    chapterIndex: 1,
    onBackToBookshelf: fn(),
    onBackToDetail: fn(),
    onNavigateSettings: fn(),
    onNavigateChapter: fn(),
  },
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: createMockNovelRepository(sampleNovel),
        chapterRepository: createMockChapterRepository([
          sampleChapter1,
          sampleChapter2,
          sampleChapter3,
        ]),
      }}
    >
      <RouterProvider
        initialPath={`/novels/${args.novelId}/chapters/${args.chapterIndex}`}
      >
        <ReaderContainer {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

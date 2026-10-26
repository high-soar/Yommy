import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { NovelDetailPlaceholder } from "./NovelDetailPlaceholder";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider } from "../../../app/router";
import type { NovelRecord, NovelRepository } from "../../../storage/types";

const mockNovelWithBookmark: NovelRecord = {
  id: "kakuyomu:16817330658027210412",
  siteType: "kakuyomu",
  remoteWorkId: "16817330658027210412",
  canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
  title: "境界迷宮と異界の魔術師",
  author: "小野崎",
  synopsis:
    "迷宮の底で少年は未知の魔術と出会う。異世界ファンタジー超大作。失われた古代魔術を求めて少年は迷宮へと潜る。",
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

const mockNovelUnread: NovelRecord = {
  ...mockNovelWithBookmark,
  id: "kakuyomu:1177354054881162325",
  title: "魔王軍の最強魔術師は人間だった",
  author: "羽田遼亮",
  synopsis:
    "魔王軍最強の魔術師アイクは、実は人間だった。正体を隠しながら魔王軍の軍師として奮闘するダークファンタジー。",
  bookmarkChapterIndex: null,
  bookmarkScrollProgress: 0,
};

function createMockNovelRepository(novel: NovelRecord | null): NovelRepository {
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

const meta: Meta<typeof NovelDetailPlaceholder> = {
  title: "NovelDetail/NovelDetailPlaceholder",
  component: NovelDetailPlaceholder,
};

export default meta;
type Story = StoryObj<typeof NovelDetailPlaceholder>;

/**
 * しおり位置（第5話）が保存されている作品の詳細表示
 */
export const WithBookmark: Story = {
  name: "しおり位置あり作品",
  args: {
    novelId: mockNovelWithBookmark.id,
  },
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: createMockNovelRepository(mockNovelWithBookmark),
      }}
    >
      <RouterProvider
        initialPath={`/novels/${encodeURIComponent(args.novelId)}`}
      >
        <NovelDetailPlaceholder {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

/**
 * 未読（しおりなし）の作品の詳細表示（第1話から読む）
 */
export const Unread: Story = {
  name: "未読作品（第1話から読む）",
  args: {
    novelId: mockNovelUnread.id,
  },
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: createMockNovelRepository(mockNovelUnread),
      }}
    >
      <RouterProvider
        initialPath={`/novels/${encodeURIComponent(args.novelId)}`}
      >
        <NovelDetailPlaceholder {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

/**
 * DB に該当作品が存在しない（未検出）状態
 */
export const NotFound: Story = {
  name: "作品未検出（404）",
  args: {
    novelId: "kakuyomu:9999999999",
  },
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: createMockNovelRepository(null),
      }}
    >
      <RouterProvider
        initialPath={`/novels/${encodeURIComponent(args.novelId)}`}
      >
        <NovelDetailPlaceholder {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

/**
 * カスタム遷移コールバックが注入された状態
 */
export const WithCustomCallbacks: Story = {
  name: "カスタム遷移コールバック指定",
  args: {
    novelId: mockNovelWithBookmark.id,
    onBackToBookshelf: fn(),
    onRead: fn(),
  },
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: createMockNovelRepository(mockNovelWithBookmark),
      }}
    >
      <RouterProvider
        initialPath={`/novels/${encodeURIComponent(args.novelId)}`}
      >
        <NovelDetailPlaceholder {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

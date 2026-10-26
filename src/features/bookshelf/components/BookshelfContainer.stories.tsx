import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { BookshelfContainer } from "./BookshelfContainer";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider } from "../../../app/router";
import type { NovelRepository, NovelSummary } from "../../../storage/types";

const sampleNovels: NovelSummary[] = [
  {
    id: "kakuyomu:16817330658027210412",
    siteType: "kakuyomu",
    remoteWorkId: "16817330658027210412",
    canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
    title: "境界迷宮と異界の魔術師",
    author: "小野崎",
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
  },
  {
    id: "kakuyomu:1177354054881162325",
    siteType: "kakuyomu",
    remoteWorkId: "1177354054881162325",
    canonicalUrl: "https://kakuyomu.jp/works/1177354054881162325",
    title: "魔王軍の最強魔術師は人間だった",
    author: "羽田遼亮",
    totalChapters: 10,
    cachedChapters: 0,
    totalByteSize: 0,
    bookmarkChapterIndex: null,
    bookmarkScrollProgress: 0,
    isFavorite: false,
    lastCheckedAt: null,
    lastReadAt: null,
    createdAt: "2026-10-25T12:00:00Z",
    updatedAt: "2026-10-25T12:00:00Z",
  },
];

function createMockNovelRepository(
  initialNovels: NovelSummary[] = [],
): NovelRepository {
  let novels = [...initialNovels];
  return {
    listNovels: async () => novels,
    getNovelById: async (id: string) => {
      const found = novels.find((n) => n.id === id);
      if (!found) return null;
      return {
        ...found,
        synopsis: "あらすじテキスト",
      };
    },
    upsertNovelWithToc: async () => {
      const newNovel = sampleNovels[0];
      novels = [newNovel, ...novels];
      return {
        ...newNovel,
        synopsis: "あらすじテキスト",
      };
    },
    updateBookmark: async () => {},
    deleteNovel: async (id: string) => {
      novels = novels.filter((n) => n.id !== id);
    },
  };
}

const meta: Meta<typeof BookshelfContainer> = {
  title: "Bookshelf/BookshelfContainer",
  component: BookshelfContainer,
};

export default meta;
type Story = StoryObj<typeof BookshelfContainer>;

/**
 * 登録作品一覧が表示されている状態
 */
export const Default: Story = {
  name: "登録作品一覧表示",
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: createMockNovelRepository(sampleNovels),
      }}
    >
      <RouterProvider initialPath="/">
        <BookshelfContainer {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

/**
 * 登録作品が0件の空状態
 */
export const Empty: Story = {
  name: "空状態（登録作品0件）",
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: createMockNovelRepository([]),
      }}
    >
      <RouterProvider initialPath="/">
        <BookshelfContainer {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

/**
 * 外部コールバックが注入された状態
 */
export const WithCustomCallbacks: Story = {
  name: "カスタム遷移コールバック注入",
  args: {
    onSelectNovel: fn(),
    onResumeNovel: fn(),
  },
  render: (args) => (
    <ServiceProvider
      services={{
        novelRepository: createMockNovelRepository(sampleNovels),
      }}
    >
      <RouterProvider initialPath="/">
        <BookshelfContainer {...args} />
      </RouterProvider>
    </ServiceProvider>
  ),
};

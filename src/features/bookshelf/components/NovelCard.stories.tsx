import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { NovelCard } from "./NovelCard";
import type { NovelSummary } from "../../../storage/types";

const sampleNovelWithBookmark: NovelSummary = {
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
};

const sampleNovelUnread: NovelSummary = {
  ...sampleNovelWithBookmark,
  id: "kakuyomu:1177354054881162325",
  title: "魔王軍の最強魔術師は人間だった",
  author: "羽田遼亮",
  totalChapters: 10,
  cachedChapters: 0,
  bookmarkChapterIndex: null,
  bookmarkScrollProgress: 0,
  lastReadAt: null,
};

const sampleNovelUnknownAuthor: NovelSummary = {
  ...sampleNovelWithBookmark,
  id: "kakuyomu:9999999999999999999",
  title: "作者名未設定の短編小説",
  author: "",
  totalChapters: 1,
  cachedChapters: 1,
  bookmarkChapterIndex: null,
  bookmarkScrollProgress: 0,
  lastReadAt: null,
};

const meta: Meta<typeof NovelCard> = {
  title: "Bookshelf/NovelCard",
  component: NovelCard,
  args: {
    novel: sampleNovelWithBookmark,
    onSelect: fn(),
    onResume: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof NovelCard>;

/**
 * しおり情報を持つ登録済み作品カード
 */
export const WithBookmark: Story = {
  name: "しおりあり（読書中）",
  args: {
    novel: sampleNovelWithBookmark,
  },
};

/**
 * 未読（しおり未設定）状態の作品カード
 */
export const Unread: Story = {
  name: "未読状態（第1話から）",
  args: {
    novel: sampleNovelUnread,
  },
};

/**
 * 著者名未設定時の作品カード
 */
export const UnknownAuthor: Story = {
  name: "著者名未設定（著者不明表示）",
  args: {
    novel: sampleNovelUnknownAuthor,
  },
};

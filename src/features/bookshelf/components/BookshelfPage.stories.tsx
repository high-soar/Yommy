import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { BookshelfPage } from "./BookshelfPage";
import type { NovelSummary } from "../../../storage/types";

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

const meta: Meta<typeof BookshelfPage> = {
  title: "Bookshelf/BookshelfPage",
  component: BookshelfPage,
  args: {
    novels: sampleNovels,
    isLoading: false,
    isDialogOpen: false,
    isSubmitting: false,
    dialogError: null,
    onOpenDialog: fn(),
    onCloseDialog: fn(),
    onAddNovel: fn(),
    onSelectNovel: fn(),
    onResumeNovel: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof BookshelfPage>;

/**
 * 登録済み作品カード一覧表示状態
 */
export const WithNovels: Story = {
  name: "登録作品一覧表示",
  args: {
    novels: sampleNovels,
    isLoading: false,
  },
};

/**
 * 未登録時の空状態案内表示
 */
export const Empty: Story = {
  name: "空状態（作品0件）",
  args: {
    novels: [],
    isLoading: false,
  },
};

/**
 * 初回作品一覧読み込み中状態
 */
export const Loading: Story = {
  name: "ローディング中",
  args: {
    novels: [],
    isLoading: true,
  },
};

/**
 * 作品追加ダイアログが開いている状態
 */
export const WithAddDialog: Story = {
  name: "作品追加ダイアログ表示中",
  args: {
    novels: sampleNovels,
    isLoading: false,
    isDialogOpen: true,
  },
};

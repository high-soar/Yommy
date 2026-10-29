import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { NovelDetailPage } from "./NovelDetailPage";
import type { NovelRecord, ChapterSummary } from "../../../storage/types";

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

const meta: Meta<typeof NovelDetailPage> = {
  title: "NovelDetail/NovelDetailPage",
  component: NovelDetailPage,
  args: {
    novel: sampleNovel,
    chapters: sampleChapters,
    isLoading: false,
    isRefreshing: false,
    isBatchCaching: false,
    batchCacheProgress: null,
    isAllCached: false,
    isDeleteDialogOpen: false,
    isDeleting: false,
    refreshMessage: null,
    error: null,
    onBackToBookshelf: fn(),
    onStartFromBeginning: fn(),
    onResumeBookmark: fn(),
    onSelectEpisode: fn(),
    onRefreshToc: fn(),
    onStartBatchCache: fn(),
    onCancelBatchCache: fn(),
    onOpenDeleteDialog: fn(),
    onCloseDeleteDialog: fn(),
    onConfirmDelete: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof NovelDetailPage>;

/**
 * 通常表示（作品データ・目次データあり）
 */
export const Default: Story = {
  name: "通常表示（目次あり）",
};

/**
 * しおり設定作品
 */
export const WithBookmark: Story = {
  name: "しおり付き作品",
  args: {
    novel: {
      ...sampleNovel,
      bookmarkChapterIndex: 2,
    },
  },
};

/**
 * 初回読み込み中状態
 */
export const Loading: Story = {
  name: "初回読み込み中",
  args: {
    isLoading: true,
  },
};

/**
 * 対象作品が存在しない（Not Found）状態
 */
export const NotFound: Story = {
  name: "作品未検出（Not Found）",
  args: {
    novel: null,
    chapters: [],
    isLoading: false,
  },
};

/**
 * 作品削除確認ダイアログ表示中状態
 */
export const WithDeleteDialog: Story = {
  name: "削除確認ダイアログ表示中",
  args: {
    isDeleteDialogOpen: true,
  },
};

/**
 * 一括キャッシュ実行中表示
 */
export const BatchCaching: Story = {
  name: "一括キャッシュ中",
  args: {
    isBatchCaching: true,
    batchCacheProgress: { current: 1, total: 2 },
  },
};

/**
 * 全話キャッシュ済み表示
 */
export const AllCached: Story = {
  name: "全話キャッシュ済み",
  args: {
    isAllCached: true,
    novel: {
      ...sampleNovel,
      cachedChapters: 3,
    },
    chapters: sampleChapters.map((ch) => ({
      ...ch,
      downloadedAt: "2026-10-25T10:00:00Z",
      byteSize: 1024,
    })),
  },
};

/**
 * 目次再取得（更新）中状態
 */
export const Refreshing: Story = {
  name: "目次更新中",
  args: {
    isRefreshing: true,
  },
};

/**
 * エラー表示状態
 */
export const WithError: Story = {
  name: "エラー表示",
  args: {
    error: "通信エラーが発生しました",
  },
};

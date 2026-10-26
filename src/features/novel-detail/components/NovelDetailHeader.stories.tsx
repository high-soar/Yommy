import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { NovelDetailHeader } from "./NovelDetailHeader";
import type { NovelRecord } from "../../../storage/types";

export const sampleNovel: NovelRecord = {
  id: "kakuyomu:16817330658027210412",
  siteType: "kakuyomu",
  remoteWorkId: "16817330658027210412",
  canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
  title: "境界迷宮と異界の魔術師",
  author: "小野崎",
  synopsis: "異界から迷い込んだ青年が紡ぐファンタジー戦記。",
  totalChapters: 45,
  cachedChapters: 12,
  totalByteSize: 102400,
  bookmarkChapterIndex: null,
  bookmarkScrollProgress: 0,
  isFavorite: false,
  lastCheckedAt: null,
  lastReadAt: null,
  createdAt: "2026-10-25T10:00:00Z",
  updatedAt: "2026-10-26T07:00:00Z",
};

const meta: Meta<typeof NovelDetailHeader> = {
  title: "NovelDetail/NovelDetailHeader",
  component: NovelDetailHeader,
  args: {
    novel: sampleNovel,
    isRefreshing: false,
    refreshMessage: null,
    error: null,
    onBackToBookshelf: fn(),
    onStartFromBeginning: fn(),
    onResumeBookmark: fn(),
    onRefreshToc: fn(),
    onOpenDeleteDialog: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof NovelDetailHeader>;

/**
 * 未読・しおり未設定状態（「最初から読む」ボタンのみ表示）
 */
export const Unread: Story = {
  name: "しおりなし（未読）",
  args: {
    novel: sampleNovel,
  },
};

/**
 * しおり設定状態（「続きから読む」プライマリ ＋ 「最初から読む」セカンダリ表示）
 */
export const WithBookmark: Story = {
  name: "しおりあり",
  args: {
    novel: {
      ...sampleNovel,
      bookmarkChapterIndex: 5,
    },
  },
};

/**
 * 目次再取得（更新）通信中状態（ボタンdisabled・文言変化）
 */
export const Refreshing: Story = {
  name: "目次更新中",
  args: {
    isRefreshing: true,
  },
};

/**
 * 目次更新完了通知メッセージ表示状態
 */
export const WithNotice: Story = {
  name: "通知メッセージ表示",
  args: {
    refreshMessage: "目次を更新しました（+2話）",
  },
};

/**
 * エラーメッセージ表示状態
 */
export const WithError: Story = {
  name: "エラー表示",
  args: {
    error: "目次の更新に失敗しました。ネットワーク接続を確認してください。",
  },
};

/**
 * エピソード0件状態（読書開始ボタンdisabled）
 */
export const EmptyChapters: Story = {
  name: "エピソード0件",
  args: {
    novel: {
      ...sampleNovel,
      totalChapters: 0,
      cachedChapters: 0,
    },
  },
};

/**
 * 著者名およびあらすじが空文字の場合のフォールバック表示
 */
export const FallbackAuthorAndSynopsis: Story = {
  name: "著者・あらすじ空フォールバック",
  args: {
    novel: {
      ...sampleNovel,
      author: "",
      synopsis: "",
    },
  },
};

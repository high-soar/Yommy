import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { StorageCacheSection } from "./StorageCacheSection";

const meta: Meta<typeof StorageCacheSection> = {
  title: "Settings/StorageCacheSection",
  component: StorageCacheSection,
  args: {
    summary: {
      totalCachedChapters: 24,
      totalByteSize: 3355443, // 約 3.2 MB
    },
    isLoading: false,
    isClearing: false,
    notice: null,
    error: null,
    onClearCache: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof StorageCacheSection>;

/**
 * キャッシュ保持状態（デフォルト）
 */
export const Default: Story = {
  name: "キャッシュ保持状態",
  args: {
    summary: {
      totalCachedChapters: 24,
      totalByteSize: 3355443,
    },
    isLoading: false,
    isClearing: false,
    notice: null,
    error: null,
  },
};

/**
 * キャッシュ0件状態（ボタン非活性）
 */
export const Empty: Story = {
  name: "キャッシュ0件状態",
  args: {
    summary: {
      totalCachedChapters: 0,
      totalByteSize: 0,
    },
    isLoading: false,
    isClearing: false,
    notice: null,
    error: null,
  },
};

/**
 * 集計情報読込中状態
 */
export const Loading: Story = {
  name: "集計情報読込中状態",
  args: {
    summary: {
      totalCachedChapters: 0,
      totalByteSize: 0,
    },
    isLoading: true,
    isClearing: false,
    notice: null,
    error: null,
  },
};

/**
 * キャッシュ一括削除処理中状態
 */
export const Clearing: Story = {
  name: "キャッシュ一括削除処理中状態",
  args: {
    summary: {
      totalCachedChapters: 12,
      totalByteSize: 1500000,
    },
    isLoading: false,
    isClearing: true,
    notice: null,
    error: null,
  },
};

/**
 * 削除完了通知表示状態
 */
export const WithNotice: Story = {
  name: "削除完了通知表示状態",
  args: {
    summary: {
      totalCachedChapters: 0,
      totalByteSize: 0,
    },
    isLoading: false,
    isClearing: false,
    notice: "本文キャッシュを一括削除しました（24話）",
    error: null,
  },
};

/**
 * エラー警告表示状態
 */
export const WithError: Story = {
  name: "エラー警告表示状態",
  args: {
    summary: {
      totalCachedChapters: 24,
      totalByteSize: 3355443,
    },
    isLoading: false,
    isClearing: false,
    notice: null,
    error:
      "キャッシュの削除処理に失敗しました。時間をおいて再試行してください。",
  },
};

/**
 * 一括削除確認ダイアログ表示状態
 */
export const DialogOpen: Story = {
  name: "一括削除確認ダイアログ表示状態",
  args: {
    summary: {
      totalCachedChapters: 24,
      totalByteSize: 3355443,
    },
    isLoading: false,
    isClearing: false,
    initialShowDialog: true,
    notice: null,
    error: null,
  },
};

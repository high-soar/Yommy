import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { SettingsPage } from "./SettingsPage";

const meta: Meta<typeof SettingsPage> = {
  title: "Settings/SettingsPage",
  component: SettingsPage,
  args: {
    writingMode: "vertical-rl",
    theme: "light",
    fontFamily: "biz-ud-mincho",
    fontSizePx: 18,
    lineHeight: 1.8,
    pageMarginPx: 20,
    enableVolumeKeyPaging: false,
    pagingMode: "auto",
    isLoading: false,
    onToggleWritingMode: fn(),
    onChangeTheme: fn(),
    onChangeFontSize: fn(),
    onChangeLineHeight: fn(),
    onChangeFontFamily: fn(),
    onChangePageMargin: fn(),
    onChangePagingMode: fn(),
    onToggleVolumeKeyPaging: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof SettingsPage>;

/**
 * デフォルト表示（縦書き・ライトテーマ、文字サイズ 18px、行間 1.8、UD明朝、余白 20px）
 */
export const Default: Story = {
  name: "デフォルト（縦書き・ライト）",
  args: {
    writingMode: "vertical-rl",
    theme: "light",
    fontFamily: "biz-ud-mincho",
    fontSizePx: 18,
    lineHeight: 1.8,
    pageMarginPx: 20,
    isLoading: false,
  },
};

/**
 * 横書き・セピアテーマ表示
 */
export const HorizontalSepia: Story = {
  name: "横書き・セピアテーマ",
  args: {
    writingMode: "horizontal-tb",
    theme: "sepia",
    fontSizePx: 18,
    lineHeight: 1.8,
    isLoading: false,
  },
};

/**
 * 最小境界値表示（文字サイズ 12px、行間 1.4、余白 8px、ダークテーマ）
 * 縮小ステッパーボタンが無効（disabled）になる
 */
export const MinBoundaries: Story = {
  name: "最小境界値（12px / 1.4 / 8px・ダーク）",
  args: {
    writingMode: "vertical-rl",
    theme: "dark",
    fontSizePx: 12,
    lineHeight: 1.4,
    pageMarginPx: 8,
    isLoading: false,
  },
};

/**
 * 最大境界値表示（文字サイズ 32px、行間 2.4、余白 48px、ブラックテーマ）
 * 拡大ステッパーボタンが無効（disabled）になる
 */
export const MaxBoundaries: Story = {
  name: "最大境界値（32px / 2.4 / 48px・ブラック）",
  args: {
    writingMode: "vertical-rl",
    theme: "black",
    fontSizePx: 32,
    lineHeight: 2.4,
    pageMarginPx: 48,
    isLoading: false,
  },
};

/**
 * 設定読み込み中表示（isLoading: true）
 * すべての操作ボタンが無効（disabled）になる
 */
export const Loading: Story = {
  name: "読み込み中（全ボタン無効）",
  args: {
    writingMode: "vertical-rl",
    theme: "light",
    fontSizePx: 18,
    lineHeight: 1.8,
    isLoading: true,
  },
};

/**
 * 設定保存エラー表示（error: "設定の保存に失敗しました。"）
 */
export const WithError: Story = {
  name: "設定保存エラー表示",
  args: {
    writingMode: "vertical-rl",
    theme: "light",
    fontSizePx: 18,
    lineHeight: 1.8,
    isLoading: false,
    error: "設定の保存に失敗しました。時間をおいて再試行してください。",
  },
};

/**
 * クラウド同期連携中表示（cloudSyncAuthState: connected）
 */
export const CloudSyncConnected: Story = {
  name: "クラウド同期連携中",
  args: {
    writingMode: "vertical-rl",
    theme: "light",
    fontSizePx: 18,
    lineHeight: 1.8,
    isLoading: false,
    cloudSyncAuthState: {
      status: "connected",
      email: "user@example.com",
    },
    cloudSyncLastSyncedAt: "2026-10-31T12:00:00.000Z",
    isCloudSyncing: false,
  },
};

/**
 * ページ送りモードセレクター表示（paged: ページめくり選択時）
 */
export const PagingModeSelection: Story = {
  name: "ページ送りモード選択（ページめくり）",
  args: {
    writingMode: "vertical-rl",
    theme: "light",
    fontSizePx: 18,
    lineHeight: 1.8,
    pagingMode: "paged",
    isLoading: false,
  },
};

/**
 * 横書き時ページ送り無効化・注記表示（writingMode: horizontal-tb）
 * セレクターが無効化され、注記「※横書き表示時は連続スクロール固定となります」が表示される
 */
export const HorizontalWithPagingModeDisabled: Story = {
  name: "横書き・ページ送り無効化（スクロール固定注記）",
  args: {
    writingMode: "horizontal-tb",
    theme: "light",
    fontSizePx: 18,
    lineHeight: 1.8,
    pagingMode: "paged",
    isLoading: false,
  },
};

/**
 * フォント種別選択表示（教科書体 Klee 選択時、v0.5 Issue #169）
 */
export const FontSelectionKlee: Story = {
  name: "フォント種別選択（教科書体 Klee）",
  args: {
    writingMode: "vertical-rl",
    theme: "light",
    fontFamily: "klee",
    fontSizePx: 18,
    lineHeight: 1.8,
    pageMarginPx: 20,
    isLoading: false,
  },
};

/**
 * ストレージ・キャッシュ情報表示（v0.5 Issue #170）
 */
export const WithStorageCache: Story = {
  name: "ストレージキャッシュ保持状態",
  args: {
    writingMode: "vertical-rl",
    theme: "light",
    fontSizePx: 18,
    lineHeight: 1.8,
    isLoading: false,
    storageCacheSummary: {
      totalCachedChapters: 12,
      totalByteSize: 1572864, // 1.5 MB
    },
    storageCacheNotice: "本文キャッシュを一括削除しました（4話）",
  },
};

/**
 * ストレージキャッシュ一括削除ダイアログ表示（v0.5 Issue #170）
 */
export const WithStorageCacheDialogOpen: Story = {
  name: "ストレージキャッシュ一括削除ダイアログ表示",
  args: {
    writingMode: "vertical-rl",
    theme: "light",
    fontSizePx: 18,
    lineHeight: 1.8,
    isLoading: false,
    storageCacheSummary: {
      totalCachedChapters: 12,
      totalByteSize: 1572864,
    },
    initialShowStorageCacheDialog: true,
  },
};

/**
 * 音量キーでページ送り有効時表示（enableVolumeKeyPaging: true、v0.6 Issue #203）
 */
export const VolumeKeyPagingEnabled: Story = {
  name: "音量キー送り有効（ON）",
  args: {
    writingMode: "vertical-rl",
    theme: "light",
    fontSizePx: 18,
    lineHeight: 1.8,
    enableVolumeKeyPaging: true,
    isLoading: false,
  },
};

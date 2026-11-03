import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ReaderBottomOverlay } from "./ReaderBottomOverlay";

const meta: Meta<typeof ReaderBottomOverlay> = {
  title: "Reader/ReaderBottomOverlay",
  component: ReaderBottomOverlay,
  decorators: [
    (Story) => (
      <div className="min-h-screen relative bg-slate-100 dark:bg-slate-900">
        <Story />
      </div>
    ),
  ],
  args: {
    isOpen: true,
    chapterIndex: 2,
    totalChapters: 5,
    isLoading: false,
    activeTab: "bookshelf",
    onPrevChapter: fn(),
    onNextChapter: fn(),
    onSelectTab: fn(),
    onPageChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ReaderBottomOverlay>;

/**
 * デフォルト表示（オーバーレイ展開中・第2話/全5話・本棚タブアクティブ）
 */
export const Default: Story = {
  name: "デフォルト（展開中・第2話）",
  args: {
    isOpen: true,
    chapterIndex: 2,
    totalChapters: 5,
  },
};

/**
 * 非表示（画面外へスライド退避中）
 */
export const Closed: Story = {
  name: "非表示（スライド退避中）",
  args: {
    isOpen: false,
    chapterIndex: 2,
    totalChapters: 5,
  },
};

/**
 * 第1話表示時（前の話へボタンが無効化）
 */
export const FirstChapter: Story = {
  name: "第1話（前話無効）",
  args: {
    isOpen: true,
    chapterIndex: 1,
    totalChapters: 5,
  },
};

/**
 * 最終話表示時（次の話へボタンが無効化）
 */
export const LastChapter: Story = {
  name: "最終話（次話無効）",
  args: {
    isOpen: true,
    chapterIndex: 5,
    totalChapters: 5,
  },
};

/**
 * エピソード取得・通信中（ローディング状態、前後話ボタン無効化）
 */
export const Loading: Story = {
  name: "取得中（ローディング）",
  args: {
    isOpen: true,
    chapterIndex: 2,
    totalChapters: 5,
    isLoading: true,
  },
};

/**
 * 検索タブアクティブ状態
 */
export const SearchTabActive: Story = {
  name: "検索タブアクティブ",
  args: {
    isOpen: true,
    chapterIndex: 2,
    totalChapters: 5,
    activeTab: "search",
  },
};

/**
 * ランキングタブアクティブ状態
 */
export const RankingTabActive: Story = {
  name: "ランキングタブアクティブ",
  args: {
    isOpen: true,
    chapterIndex: 2,
    totalChapters: 5,
    activeTab: "ranking",
  },
};

/**
 * 設定タブアクティブ状態
 */
export const SettingsTabActive: Story = {
  name: "設定タブアクティブ",
  args: {
    isOpen: true,
    chapterIndex: 2,
    totalChapters: 5,
    activeTab: "settings",
  },
};

/**
 * 縦書きページめくり表示時（シークバー表示・全5ページ中2ページ目）
 */
export const PagedWithSeekbar: Story = {
  name: "ページめくり（シークバー表示・2/5ページ）",
  args: {
    isOpen: true,
    chapterIndex: 2,
    totalChapters: 5,
    effectivePagingMode: "paged",
    currentPage: 2,
    totalPages: 5,
  },
};

/**
 * 縦書きページめくり表示・単一ページ（シークバー無効化）
 */
export const PagedSinglePage: Story = {
  name: "ページめくり（単一ページ・シークバー無効）",
  args: {
    isOpen: true,
    chapterIndex: 2,
    totalChapters: 5,
    effectivePagingMode: "paged",
    currentPage: 1,
    totalPages: 1,
  },
};

/**
 * 縦書きページめくり表示・通信中（シークバー無効化）
 */
export const PagedLoading: Story = {
  name: "ページめくり（通信中・シークバー無効）",
  args: {
    isOpen: true,
    chapterIndex: 2,
    totalChapters: 5,
    isLoading: true,
    effectivePagingMode: "paged",
    currentPage: 2,
    totalPages: 5,
  },
};

/**
 * 連続スクロールモード（シークバー非表示）
 */
export const ScrollMode: Story = {
  name: "連続スクロール（シークバー非表示）",
  args: {
    isOpen: true,
    chapterIndex: 2,
    totalChapters: 5,
    effectivePagingMode: "scroll",
    currentPage: 1,
    totalPages: 5,
  },
};

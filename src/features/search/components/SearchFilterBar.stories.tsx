import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { SearchFilterBar } from "./SearchFilterBar";

const meta: Meta<typeof SearchFilterBar> = {
  title: "Features/Search/SearchFilterBar",
  component: SearchFilterBar,
  parameters: {
    layout: "padded",
  },
  args: {
    selectedOrder: "weekly_ranking",
    onSelectOrder: fn(),
    selectedSerialStatus: "all",
    onSelectSerialStatus: fn(),
    selectedGenre: undefined,
    onSelectGenre: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof SearchFilterBar>;

/**
 * 検索絞り込みバー（デフォルト初期表示）
 */
export const Default: Story = {
  name: "デフォルト（全件・週間順）",
  args: {
    selectedOrder: "weekly_ranking",
    selectedSerialStatus: "all",
    selectedGenre: undefined,
  },
};

/**
 * 検索絞り込みバー（条件指定・フィルタ適用時）
 */
export const Filtered: Story = {
  name: "絞り込み適用（連載中・ファンタジー・人気順）",
  args: {
    selectedOrder: "popular",
    selectedSerialStatus: "running",
    selectedGenre: "fantasy",
  },
};

/**
 * 検索絞り込みバー（通信中・操作無効化 / v0.7 Issue #238）
 */
export const Disabled: Story = {
  name: "操作無効化（ローディング中）",
  args: {
    selectedOrder: "weekly_ranking",
    selectedSerialStatus: "all",
    selectedGenre: undefined,
    disabled: true,
  },
};

/**
 * 検索絞り込みバー（小説家になろう選択・小ジャンル21種表示 / v0.7 Issue #240）
 */
export const NarouGenres: Story = {
  name: "なろう小ジャンル表示（ハイファンタジー選択）",
  args: {
    selectedSite: "narou",
    selectedOrder: "weekly_ranking",
    selectedSerialStatus: "all",
    selectedGenre: "201",
  },
};

/**
 * 検索絞り込みバー（カクヨム複数ジャンル選択 / v0.8 Issue #264）
 */
export const MultiGenresSelected: Story = {
  name: "カクヨム複数ジャンル選択（ファンタジー・アクション）",
  args: {
    selectedOrder: "weekly_ranking",
    selectedSerialStatus: "all",
    selectedGenres: ["fantasy", "action"],
  },
};

/**
 * 検索絞り込みバー（小説家になろう複数小ジャンル選択 / v0.8 Issue #264）
 */
export const NarouMultiGenres: Story = {
  name: "なろう複数小ジャンル選択（ハイファンタジー・ローファンタジー）",
  args: {
    selectedSite: "narou",
    selectedOrder: "weekly_ranking",
    selectedSerialStatus: "all",
    selectedGenres: ["201", "202"],
  },
};

/**
 * 検索絞り込みバー（短編選択 / v0.8 Issue #265）
 */
export const ShortStorySelected: Story = {
  name: "短編選択（短編・全ジャンル）",
  args: {
    selectedOrder: "weekly_ranking",
    selectedSerialStatus: "short",
    selectedGenre: undefined,
  },
};

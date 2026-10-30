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

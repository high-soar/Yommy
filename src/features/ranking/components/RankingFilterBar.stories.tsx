import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { RankingFilterBar } from "./RankingFilterBar";

const meta: Meta<typeof RankingFilterBar> = {
  title: "Features/Ranking/RankingFilterBar",
  component: RankingFilterBar,
  parameters: {
    layout: "padded",
  },
  args: {
    selectedPeriod: "weekly",
    onSelectPeriod: fn(),
    selectedGenre: undefined,
    onSelectGenre: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof RankingFilterBar>;

/**
 * ランキング絞り込みバー（デフォルト初期表示）
 */
export const Default: Story = {
  name: "デフォルト（総合・週間）",
  args: {
    selectedPeriod: "weekly",
    selectedGenre: undefined,
  },
};

/**
 * ランキング絞り込みバー（条件指定・フィルタ適用時）
 */
export const Filtered: Story = {
  name: "絞り込み適用（ファンタジー・月間）",
  args: {
    selectedPeriod: "monthly",
    selectedGenre: "fantasy",
  },
};

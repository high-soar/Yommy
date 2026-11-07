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
    selectedWorkVariation: "long",
    onSelectWorkVariation: fn(),
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
  name: "デフォルト（総合・週間・長編連載）",
  args: {
    selectedPeriod: "weekly",
    selectedWorkVariation: "long",
    selectedGenre: undefined,
  },
};

/**
 * ランキング絞り込みバー（短編選択時 / v0.8 Issue #265）
 */
export const ShortStoryVariation: Story = {
  name: "短編選択（短編・週間）",
  args: {
    selectedPeriod: "weekly",
    selectedWorkVariation: "short",
    selectedGenre: undefined,
  },
};

/**
 * ランキング絞り込みバー（すべて選択時 / v0.8 Issue #265）
 */
export const AllVariation: Story = {
  name: "すべて選択（全作品種別・日間）",
  args: {
    selectedPeriod: "daily",
    selectedWorkVariation: "all",
    selectedGenre: undefined,
  },
};

/**
 * ランキング絞り込みバー（条件指定・フィルタ適用時）
 */
export const Filtered: Story = {
  name: "絞り込み適用（ファンタジー・月間・長編連載）",
  args: {
    selectedPeriod: "monthly",
    selectedWorkVariation: "long",
    selectedGenre: "fantasy",
  },
};

/**
 * ランキング絞り込みバー（通信中・操作無効化時 / v0.7 Issue #238）
 */
export const Disabled: Story = {
  name: "操作無効化（ローディング中）",
  args: {
    selectedPeriod: "weekly",
    selectedGenre: undefined,
    disabled: true,
  },
};

/**
 * ランキング絞り込みバー（小説家になろう選択・小ジャンル21種表示 / v0.7 Issue #240）
 */
export const NarouGenres: Story = {
  name: "なろう小ジャンル表示（ハイファンタジー選択）",
  args: {
    selectedSite: "narou",
    selectedPeriod: "weekly",
    selectedGenre: "201",
  },
};

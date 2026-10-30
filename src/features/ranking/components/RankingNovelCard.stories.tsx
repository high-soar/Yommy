import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { RankingNovelCard } from "./RankingNovelCard";
import {
  sampleRankingItem1,
  sampleRankingItem2,
  sampleRankingItem3,
  sampleRankingItem4,
} from "../types";

const meta: Meta<typeof RankingNovelCard> = {
  title: "Features/Ranking/RankingNovelCard",
  component: RankingNovelCard,
  parameters: {
    layout: "padded",
  },
  args: {
    item: sampleRankingItem1,
    isRegistered: false,
    isAdding: false,
    onAdd: fn(),
    onSelect: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof RankingNovelCard>;

/**
 * ランキングカード（1位・ゴールドバッジ表示）
 */
export const Rank1Gold: Story = {
  name: "1位（ゴールドバッジ）",
  args: {
    item: sampleRankingItem1,
    isRegistered: false,
    isAdding: false,
  },
};

/**
 * ランキングカード（2位・シルバーバッジ表示）
 */
export const Rank2Silver: Story = {
  name: "2位（シルバーバッジ）",
  args: {
    item: sampleRankingItem2,
    isRegistered: false,
    isAdding: false,
  },
};

/**
 * ランキングカード（3位・ブロンズバッジ表示）
 */
export const Rank3Bronze: Story = {
  name: "3位（ブロンズバッジ）",
  args: {
    item: sampleRankingItem3,
    isRegistered: false,
    isAdding: false,
  },
};

/**
 * ランキングカード（4位以降・通常数字バッジ表示）
 */
export const Rank4Standard: Story = {
  name: "4位以降（通常数字バッジ）",
  args: {
    item: sampleRankingItem4,
    isRegistered: false,
    isAdding: false,
  },
};

/**
 * ランキングカード（本棚追加処理中）
 */
export const Adding: Story = {
  name: "追加処理中状態",
  args: {
    item: sampleRankingItem1,
    isRegistered: false,
    isAdding: true,
  },
};

/**
 * ランキングカード（本棚登録済み状態）
 */
export const Registered: Story = {
  name: "登録済み状態",
  args: {
    item: sampleRankingItem1,
    isRegistered: true,
    isAdding: false,
  },
};

/**
 * ランキングカード（最新話公開日・タグ未設定）
 */
export const WithoutLastPublished: Story = {
  name: "更新日・タグなし",
  args: {
    item: {
      ...sampleRankingItem4,
      tags: [],
      lastEpisodePublishedAt: null,
    },
    isRegistered: false,
    isAdding: false,
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { SearchNovelCard } from "./SearchNovelCard";
import { sampleSearchItem } from "../types";

const meta: Meta<typeof SearchNovelCard> = {
  title: "Features/Search/SearchNovelCard",
  component: SearchNovelCard,
  parameters: {
    layout: "padded",
  },
  args: {
    item: sampleSearchItem,
    isRegistered: false,
    isAdding: false,
    onAdd: fn(),
    onSelect: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof SearchNovelCard>;

/**
 * 検索結果カード（未登録・通常表示）
 */
export const Default: Story = {
  name: "未登録（デフォルト表示）",
  args: {
    item: sampleSearchItem,
    isRegistered: false,
    isAdding: false,
  },
};

/**
 * 検索結果カード（本棚追加処理中）
 */
export const Adding: Story = {
  name: "追加処理中状態",
  args: {
    item: sampleSearchItem,
    isRegistered: false,
    isAdding: true,
  },
};

/**
 * 検索結果カード（本棚登録済み状態）
 */
export const Registered: Story = {
  name: "登録済み状態",
  args: {
    item: sampleSearchItem,
    isRegistered: true,
    isAdding: false,
  },
};

/**
 * 検索結果カード（最新話公開日・タグ未設定）
 */
export const WithoutLastPublished: Story = {
  name: "更新日・タグなし",
  args: {
    item: {
      ...sampleSearchItem,
      lastEpisodePublishedAt: null,
      tags: [],
    },
    isRegistered: false,
    isAdding: false,
  },
};

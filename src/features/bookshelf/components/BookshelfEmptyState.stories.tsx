import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { BookshelfEmptyState } from "./BookshelfEmptyState";

const meta: Meta<typeof BookshelfEmptyState> = {
  title: "Bookshelf/BookshelfEmptyState",
  component: BookshelfEmptyState,
  args: {
    onNavigateSearch: fn(),
    onNavigateRanking: fn(),
    isFavoriteFilterActive: false,
    onClearFavoriteFilter: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof BookshelfEmptyState>;

/**
 * デフォルト空状態表示
 */
export const Default: Story = {
  name: "デフォルト（空状態）",
};

/**
 * お気に入りフィルタ ON 時の 0 件空状態表示
 */
export const FavoriteFilterEmpty: Story = {
  name: "お気に入りフィルタ0件状態",
  args: {
    isFavoriteFilterActive: true,
  },
};

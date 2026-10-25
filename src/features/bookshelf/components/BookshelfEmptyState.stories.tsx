import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { BookshelfEmptyState } from "./BookshelfEmptyState";

const meta: Meta<typeof BookshelfEmptyState> = {
  title: "Bookshelf/BookshelfEmptyState",
  component: BookshelfEmptyState,
  args: {
    onOpenAdd: fn(),
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

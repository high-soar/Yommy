import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { BookmarkConflictDialog } from "./BookmarkConflictDialog";

const meta: Meta<typeof BookmarkConflictDialog> = {
  title: "Reader/BookmarkConflictDialog",
  component: BookmarkConflictDialog,
  decorators: [
    (Story) => (
      <div className="min-h-screen relative bg-slate-100 dark:bg-slate-900">
        <Story />
      </div>
    ),
  ],
  args: {
    isOpen: true,
    currentChapterIndex: 10,
    remoteChapterIndex: 15,
    isResolving: false,
    onMoveToRemote: fn(),
    onKeepCurrent: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof BookmarkConflictDialog>;

/**
 * デフォルト表示（しおり競合確認モーダル）
 */
export const Default: Story = {
  name: "デフォルト（しおり競合確認モーダル）",
};

/**
 * 選択解決処理中（両ボタン非活性）
 */
export const Resolving: Story = {
  name: "解決処理中（ボタン非活性）",
  args: {
    isResolving: true,
  },
};

/**
 * ダイアログ非表示状態（非描画）
 */
export const Closed: Story = {
  name: "非表示（null）",
  tags: ["skip-vrt"],
  args: {
    isOpen: false,
  },
};

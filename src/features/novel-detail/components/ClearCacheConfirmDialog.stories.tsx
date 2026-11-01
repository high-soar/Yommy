import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ClearCacheConfirmDialog } from "./ClearCacheConfirmDialog";

const meta: Meta<typeof ClearCacheConfirmDialog> = {
  title: "NovelDetail/ClearCacheConfirmDialog",
  component: ClearCacheConfirmDialog,
  decorators: [
    (Story) => (
      <div className="min-h-screen relative">
        <Story />
      </div>
    ),
  ],
  args: {
    isOpen: true,
    novelTitle: "テスト対象小説のタイトル",
    isClearing: false,
    onClose: fn(),
    onConfirm: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ClearCacheConfirmDialog>;

/**
 * デフォルト表示（本文キャッシュ整理確認モーダル）
 */
export const Default: Story = {
  name: "デフォルト（キャッシュ整理確認モーダル）",
};

/**
 * 削除処理実行中状態（ボタン非活性・ローディング）
 */
export const Clearing: Story = {
  name: "削除処理中（ローディング）",
  args: {
    isClearing: true,
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

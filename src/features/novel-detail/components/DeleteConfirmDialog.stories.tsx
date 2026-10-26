import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

const meta: Meta<typeof DeleteConfirmDialog> = {
  title: "NovelDetail/DeleteConfirmDialog",
  component: DeleteConfirmDialog,
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
    isDeleting: false,
    onClose: fn(),
    onConfirm: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof DeleteConfirmDialog>;

/**
 * デフォルト表示（作品削除確認モーダル）
 */
export const Default: Story = {
  name: "デフォルト（削除確認モーダル）",
};

/**
 * 削除処理実行中状態（ボタン非活性・「削除中...」表示）
 */
export const Deleting: Story = {
  name: "削除処理中（ローディング）",
  args: {
    isDeleting: true,
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

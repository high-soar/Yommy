import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { AddNovelDialog } from "./AddNovelDialog";

const meta: Meta<typeof AddNovelDialog> = {
  title: "Bookshelf/AddNovelDialog",
  component: AddNovelDialog,
  args: {
    isOpen: true,
    isSubmitting: false,
    error: null,
    onClose: fn(),
    onSubmit: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof AddNovelDialog>;

/**
 * デフォルト表示（入力前モーダル）
 */
export const Default: Story = {
  name: "デフォルト（入力前）",
};

/**
 * エラー表示状態
 */
export const WithError: Story = {
  name: "エラー表示状態",
  args: {
    error: "対応していないURLです。カクヨムの作品URLを入力してください。",
  },
};

/**
 * 作品取得・登録処理中（送信中）
 */
export const Submitting: Story = {
  name: "作品情報取得中（ローディング）",
  args: {
    isSubmitting: true,
  },
};

/**
 * ダイアログ非表示状態（非描画）
 */
export const Closed: Story = {
  name: "非表示（null）",
  args: {
    isOpen: false,
  },
};

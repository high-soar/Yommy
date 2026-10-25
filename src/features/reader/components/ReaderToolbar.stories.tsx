import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ReaderToolbar } from "./ReaderToolbar";

const meta: Meta<typeof ReaderToolbar> = {
  title: "Reader/ReaderToolbar",
  component: ReaderToolbar,
  args: {
    writingMode: "vertical-rl",
    theme: "light",
    isLoading: false,
    onToggleWritingMode: fn(),
    onChangeTheme: fn(),
    onFetchNovel: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ReaderToolbar>;

/**
 * デフォルトツールバー（縦書き・ライトテーマ）
 */
export const Default: Story = {
  name: "デフォルト（縦書き・ライトテーマ）",
};

/**
 * 横書き・セピアテーマ状態
 */
export const HorizontalSepia: Story = {
  name: "横書き・セピアテーマ",
  args: {
    writingMode: "horizontal-tb",
    theme: "sepia",
  },
};

/**
 * 作品取得処理中（ローディング状態）
 */
export const Loading: Story = {
  name: "作品取得中",
  args: {
    isLoading: true,
  },
};

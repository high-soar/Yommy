import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ReaderToolbar } from "./ReaderToolbar";

const meta: Meta<typeof ReaderToolbar> = {
  title: "Reader/ReaderToolbar",
  component: ReaderToolbar,
  args: {
    writingMode: "vertical-rl",
    theme: "light",
    fontSizePx: 18,
    lineHeight: 1.8,
    isLoading: false,
    onToggleWritingMode: fn(),
    onChangeTheme: fn(),
    onChangeFontSize: fn(),
    onChangeLineHeight: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ReaderToolbar>;

/**
 * デフォルトツールバー（縦書き・ライトテーマ・標準文字サイズ/行間）
 */
export const Default: Story = {
  name: "デフォルト（縦書き・ライトテーマ）",
};

/**
 * 戻るナビゲーション（作品詳細へ・本棚へ）付きツールバー
 */
export const WithNavigation: Story = {
  name: "戻るナビゲーション付き",
  args: {
    onBackToDetail: fn(),
    onBackToBookshelf: fn(),
    onFetchNovel: fn(),
  },
};

/**
 * 横書き・セピアテーマ（文字サイズ 20px / 行間 2.0）
 */
export const HorizontalSepia: Story = {
  name: "横書き・セピアテーマ",
  args: {
    writingMode: "horizontal-tb",
    theme: "sepia",
    fontSizePx: 20,
    lineHeight: 2.0,
  },
};

/**
 * 最小文字サイズ（12px）および最小行間（1.4）状態（縮小ボタン disabled）
 */
export const MinFontSizeAndLineHeight: Story = {
  name: "最小文字サイズ・行間（縮小無効）",
  args: {
    fontSizePx: 12,
    lineHeight: 1.4,
  },
};

/**
 * 最大文字サイズ（32px）および最大行間（2.4）状態（拡大ボタン disabled）
 */
export const MaxFontSizeAndLineHeight: Story = {
  name: "最大文字サイズ・行間（拡大無効）",
  args: {
    fontSizePx: 32,
    lineHeight: 2.4,
  },
};

/**
 * 作品取得処理中（ローディング状態）
 */
export const Loading: Story = {
  name: "作品取得中",
  args: {
    isLoading: true,
    onFetchNovel: fn(),
  },
};

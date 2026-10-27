import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { SettingsPage } from "./SettingsPage";

const meta: Meta<typeof SettingsPage> = {
  title: "Settings/SettingsPage",
  component: SettingsPage,
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
type Story = StoryObj<typeof SettingsPage>;

/**
 * デフォルト表示（縦書き・ライトテーマ、文字サイズ 18px、行間 1.8）
 */
export const Default: Story = {
  name: "デフォルト（縦書き・ライト）",
  args: {
    writingMode: "vertical-rl",
    theme: "light",
    fontSizePx: 18,
    lineHeight: 1.8,
    isLoading: false,
  },
};

/**
 * 横書き・セピアテーマ表示
 */
export const HorizontalSepia: Story = {
  name: "横書き・セピアテーマ",
  args: {
    writingMode: "horizontal-tb",
    theme: "sepia",
    fontSizePx: 18,
    lineHeight: 1.8,
    isLoading: false,
  },
};

/**
 * 最小境界値表示（文字サイズ 12px、行間 1.4、ダークテーマ）
 * 縮小ステッパーボタンが無効（disabled）になる
 */
export const MinBoundaries: Story = {
  name: "最小境界値（12px / 1.4・ダーク）",
  args: {
    writingMode: "vertical-rl",
    theme: "dark",
    fontSizePx: 12,
    lineHeight: 1.4,
    isLoading: false,
  },
};

/**
 * 最大境界値表示（文字サイズ 32px、行間 2.4、ブラックテーマ）
 * 拡大ステッパーボタンが無効（disabled）になる
 */
export const MaxBoundaries: Story = {
  name: "最大境界値（32px / 2.4・ブラック）",
  args: {
    writingMode: "vertical-rl",
    theme: "black",
    fontSizePx: 32,
    lineHeight: 2.4,
    isLoading: false,
  },
};

/**
 * 設定読み込み中表示（isLoading: true）
 * すべての操作ボタンが無効（disabled）になる
 */
export const Loading: Story = {
  name: "読み込み中（全ボタン無効）",
  args: {
    writingMode: "vertical-rl",
    theme: "light",
    fontSizePx: 18,
    lineHeight: 1.8,
    isLoading: true,
  },
};

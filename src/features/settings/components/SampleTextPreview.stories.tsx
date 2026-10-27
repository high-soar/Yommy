import type { Meta, StoryObj } from "@storybook/react";
import { SampleTextPreview } from "./SampleTextPreview";

const meta: Meta<typeof SampleTextPreview> = {
  title: "Settings/SampleTextPreview",
  component: SampleTextPreview,
  args: {
    writingMode: "vertical-rl",
    theme: "light",
    fontSizePx: 18,
    lineHeight: 1.8,
  },
};

export default meta;
type Story = StoryObj<typeof SampleTextPreview>;

/**
 * 縦書き・ライトテーマ表示
 */
export const VerticalLight: Story = {
  name: "縦書き・ライトテーマ",
  args: {
    writingMode: "vertical-rl",
    theme: "light",
  },
};

/**
 * 縦書き・セピアテーマ表示
 */
export const VerticalSepia: Story = {
  name: "縦書き・セピアテーマ",
  args: {
    writingMode: "vertical-rl",
    theme: "sepia",
  },
};

/**
 * 縦書き・ダークテーマ表示
 */
export const VerticalDark: Story = {
  name: "縦書き・ダークテーマ",
  args: {
    writingMode: "vertical-rl",
    theme: "dark",
  },
};

/**
 * 縦書き・ブラックテーマ表示（AMOLED黒）
 */
export const VerticalBlack: Story = {
  name: "縦書き・ブラックテーマ",
  args: {
    writingMode: "vertical-rl",
    theme: "black",
  },
};

/**
 * 横書き・ライトテーマ表示
 */
export const HorizontalLight: Story = {
  name: "横書き・ライトテーマ",
  args: {
    writingMode: "horizontal-tb",
    theme: "light",
  },
};

/**
 * カスタム組版（大文字サイズ 24px / 広行間 2.2）
 */
export const CustomTypography: Story = {
  name: "カスタム組版（24px / 2.2）",
  args: {
    writingMode: "vertical-rl",
    theme: "light",
    fontSizePx: 24,
    lineHeight: 2.2,
  },
};

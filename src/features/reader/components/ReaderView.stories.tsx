import type { Meta, StoryObj } from "@storybook/react";
import { ReaderView } from "./ReaderView";

const sampleBodyHtml = `
<p>青い空に、二つの<ruby><rb>太陽</rb><rp>(</rp><rt>たいよう</rt><rp>)</rp></ruby>が輝いていた。</p>
<p class="blank"><br /></p>
<p>少年にとって、それは<em class="bouten">信じがたい光景</em>であった。</p>
<p>「ここはどこなんだ……？」</p>
`;

const meta: Meta<typeof ReaderView> = {
  title: "Reader/ReaderView",
  component: ReaderView,
  args: {
    title: "境界迷宮と異界の魔術師",
    chapterTitle: "第1話 見知らぬ空",
    bodyHtml: sampleBodyHtml,
  },
};

export default meta;
type Story = StoryObj<typeof ReaderView>;

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

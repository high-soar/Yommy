import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ReaderChapterNav } from "./ReaderChapterNav";

const meta: Meta<typeof ReaderChapterNav> = {
  title: "Reader/ReaderChapterNav",
  component: ReaderChapterNav,
  args: {
    chapterIndex: 1,
    totalChapters: 10,
    isLoading: false,
    onPrevChapter: fn(),
    onNextChapter: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ReaderChapterNav>;

/**
 * 第1話表示時（「前の話へ」が無効化）
 */
export const FirstChapter: Story = {
  name: "第1話（前話無効）",
  args: {
    chapterIndex: 1,
    totalChapters: 10,
  },
};

/**
 * 中間話表示時（「前の話へ」「次の話へ」ともに有効）
 */
export const MiddleChapter: Story = {
  name: "中間話（前後有効）",
  args: {
    chapterIndex: 5,
    totalChapters: 10,
  },
};

/**
 * 最終話表示時（「次の話へ」が無効化）
 */
export const LastChapter: Story = {
  name: "最終話（次話無効）",
  args: {
    chapterIndex: 10,
    totalChapters: 10,
  },
};

/**
 * 全1話の短編作品（前後ともに無効化）
 */
export const SingleChapter: Story = {
  name: "短編（前後無効）",
  args: {
    chapterIndex: 1,
    totalChapters: 1,
  },
};

/**
 * エピソード取得中（ローディング状態、前後ともに無効化）
 */
export const Loading: Story = {
  name: "エピソード取得中（ローディング）",
  args: {
    chapterIndex: 5,
    totalChapters: 10,
    isLoading: true,
  },
};

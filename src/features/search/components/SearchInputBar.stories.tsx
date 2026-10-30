import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { SearchInputBar } from "./SearchInputBar";

const meta: Meta<typeof SearchInputBar> = {
  title: "Features/Search/SearchInputBar",
  component: SearchInputBar,
  parameters: {
    layout: "padded",
  },
  args: {
    keyword: "",
    onChangeKeyword: fn(),
    onSubmitSearch: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof SearchInputBar>;

/**
 * 検索キーワード入力バー（未入力・空状態）
 */
export const Empty: Story = {
  name: "未入力（プレースホルダー表示）",
  args: {
    keyword: "",
  },
};

/**
 * 検索キーワード入力バー（キーワード入力中・クリアボタン表示）
 */
export const WithKeyword: Story = {
  name: "キーワード入力中（クリアボタン表示）",
  args: {
    keyword: "異世界 魔法",
  },
};

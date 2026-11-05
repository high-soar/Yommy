import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { SiteSelector } from "./SiteSelector";

const meta: Meta<typeof SiteSelector> = {
  title: "Features/Search/SiteSelector",
  component: SiteSelector,
  parameters: {
    layout: "padded",
  },
  args: {
    selectedSite: "kakuyomu",
    onSelectSite: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof SiteSelector>;

/**
 * サイト切替タブ（カクヨム選択状態）
 */
export const Default: Story = {
  name: "カクヨム選択",
  args: {
    selectedSite: "kakuyomu",
  },
};

/**
 * サイト切替タブ（小説家になろう選択状態）
 */
export const NarouSelected: Story = {
  name: "小説家になろう選択",
  args: {
    selectedSite: "narou",
  },
};

/**
 * サイト切替タブ（通信中・操作無効化 / v0.7 Issue #238）
 */
export const Disabled: Story = {
  name: "操作無効化（ローディング中）",
  args: {
    selectedSite: "kakuyomu",
    disabled: true,
  },
};

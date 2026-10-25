import type { Meta, StoryObj } from "@storybook/react";
import { App } from "./App";

/**
 * Yommy ルートアプリケーションコンポーネント。
 * 横書き・縦書き（組版・ルビ表示）の切り替えに対応します。
 */
const meta: Meta<typeof App> = {
  title: "App",
  component: App,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof App>;

export const Default: Story = {
  name: "デフォルト（横書き表示）",
  args: {
    title: "Yommy",
    initialOrientation: "horizontal",
  },
};

export const Vertical: Story = {
  name: "縦書きモード",
  args: {
    title: "Yommy - 縦書き",
    initialOrientation: "vertical",
  },
};

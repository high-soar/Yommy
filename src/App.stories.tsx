import type { Meta, StoryObj } from "@storybook/react";
import { App } from "./App";

/**
 * Yommy ルートアプリケーションコンポーネント。
 * ServiceProvider と PocReaderContainer を統合したリーダー画面を提供します。
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
  name: "デフォルト（初期表示・未取得状態）",
  args: {
    title: "Yommy",
  },
};

export const CustomTitle: Story = {
  name: "カスタムタイトル指定",
  args: {
    title: "Yommy Web Novel Reader",
  },
};

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

/**
 * デフォルト表示ストーリー。
 * 初期状態（作品未取得・空表示）のリーダー画面を描画します。
 */
export const Default: Story = {
  name: "デフォルト（初期表示・未取得状態）",
  args: {
    title: "Yommy",
  },
};

/**
 * カスタムタイトル指定ストーリー。
 * ヘッダーに任意のアプリケーション名を設定した状態を描画します。
 */
export const CustomTitle: Story = {
  name: "カスタムタイトル指定",
  args: {
    title: "Yommy Web Novel Reader",
  },
};

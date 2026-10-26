import type { Meta, StoryObj } from "@storybook/react";
import { App } from "./App";

/**
 * Yommy ルートアプリケーションコンポーネント。
 * ServiceProvider と RouterProvider を統合し、本棚・作品詳細・リーダーの各画面ルーティングを提供します。
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
 * 初期状態（/ 本棚画面・作品未登録状態）を描画します。
 */
export const Default: Story = {
  name: "デフォルト（本棚画面・初期表示）",
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

/**
 * 作品詳細画面ルートストーリー。
 * /novels/kakuyomu:16817330658027210412 への直接アクセス時（プレースホルダ画面）を描画します。
 */
export const NovelDetailRoute: Story = {
  name: "作品詳細ルート表示",
  args: {
    title: "Yommy",
    initialPath: "/novels/kakuyomu:16817330658027210412",
  },
};

/**
 * リーダー画面ルートストーリー。
 * /novels/kakuyomu:16817330658027210412/chapters/1 への直接アクセス時のリーダー画面を描画します。
 */
export const ReaderRoute: Story = {
  name: "リーダー画面ルート表示",
  args: {
    title: "Yommy",
    initialPath: "/novels/kakuyomu:16817330658027210412/chapters/1",
  },
};

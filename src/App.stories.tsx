import type { Meta, StoryObj } from "@storybook/react";
import { App } from "./App";

/**
 * Yommy ルートアプリケーションコンポーネント。
 * ServiceProvider と RouterProvider を統合し、100dvh 全画面シェル内での画面ルーティング
 * （本棚 SCR-01、作品詳細 SCR-02、リーダー SCR-03、設定 SCR-05）および下部タブバー（BottomTabBar）を提供します。
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
 * 初期状態（/ 本棚画面・作品未登録状態・下部タブバー「本棚」アクティブ）を描画します。
 */
export const Default: Story = {
  name: "デフォルト（本棚画面・初期表示）",
};

/**
 * 設定画面ルートストーリー。
 * /settings へのアクセス時（設定画面・下部タブバー「設定」アクティブ）を描画します。
 */
export const SettingsRoute: Story = {
  name: "設定画面ルート表示",
  args: {
    initialPath: "/settings",
  },
};

/**
 * 作品詳細・目次画面ルートストーリー。
 * /novels/kakuyomu:16817330658027210412 への直接アクセス時（未登録作品時は未検出表示・下部タブバー「本棚」アクティブ）を描画します。
 */
export const NovelDetailRoute: Story = {
  name: "作品詳細ルート表示",
  args: {
    initialPath: "/novels/kakuyomu:16817330658027210412",
  },
};

/**
 * リーダー画面ルートストーリー。
 * /novels/kakuyomu:16817330658027210412/chapters/1 への直接アクセス時（全画面リーダー・下部タブバー非表示）を描画します。
 */
export const ReaderRoute: Story = {
  name: "リーダー画面ルート表示",
  args: {
    initialPath: "/novels/kakuyomu:16817330658027210412/chapters/1",
  },
};

/**
 * 本棚画面終了確認トースト表示ストーリー。
 * 本棚画面（/）でバックボタンを1回押下した際に表示される一時トーストを描画します。
 */
export const ExitToastRoute: Story = {
  name: "本棚画面（終了確認トースト表示中）",
  args: {
    initialPath: "/",
    initialShowExitToast: true,
  },
};

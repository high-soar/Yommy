import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { RouterProvider, useRouter } from "./router";

const RouterStateInspector: React.FC = () => {
  const router = useRouter();

  return (
    <div
      data-testid="router-inspector"
      className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 space-y-3 font-sans max-w-md"
    >
      <h2 className="text-base font-bold text-slate-900">
        ルーター状態インスペクター
      </h2>
      <div className="space-y-1 font-mono text-sm bg-white p-3 rounded border border-slate-200">
        <div data-testid="current-path">Path: {router.currentPath}</div>
        <div data-testid="route-name">Route: {router.route.name}</div>
        {router.route.name === "novel-detail" && (
          <div data-testid="route-novel-id">
            Novel ID: {router.route.novelId}
          </div>
        )}
        {router.route.name === "reader" && (
          <>
            <div data-testid="route-novel-id">
              Novel ID: {router.route.novelId}
            </div>
            <div data-testid="route-chapter-index">
              Chapter: {router.route.chapterIndex}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          data-testid="nav-bookshelf-button"
          onClick={() => router.navigateToBookshelf()}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
        >
          本棚へ
        </button>
        <button
          type="button"
          data-testid="nav-search-button"
          onClick={() => router.navigateToSearch()}
          className="px-3 py-1.5 bg-teal-600 text-white rounded text-xs font-medium hover:bg-teal-700"
        >
          検索へ
        </button>
        <button
          type="button"
          data-testid="nav-ranking-button"
          onClick={() => router.navigateToRanking()}
          className="px-3 py-1.5 bg-yellow-600 text-white rounded text-xs font-medium hover:bg-yellow-700"
        >
          ランキングへ
        </button>
        <button
          type="button"
          data-testid="nav-detail-button"
          onClick={() =>
            router.navigateToNovelDetail("kakuyomu:16817330658027210412")
          }
          className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700"
        >
          作品詳細へ
        </button>
        <button
          type="button"
          data-testid="nav-reader-button"
          onClick={() =>
            router.navigateToReader("kakuyomu:16817330658027210412", 2)
          }
          className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700"
        >
          第2話へ
        </button>
        <button
          type="button"
          data-testid="nav-settings-button"
          onClick={() => router.navigateToSettings()}
          className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700"
        >
          設定へ
        </button>
        <button
          type="button"
          data-testid="nav-back-button"
          onClick={() => router.back()}
          className="px-3 py-1.5 bg-zinc-600 text-white rounded text-xs font-medium hover:bg-zinc-700"
        >
          戻る
        </button>
        <button
          type="button"
          data-testid="nav-unknown-button"
          onClick={() => router.navigate("/unknown/route")}
          className="px-3 py-1.5 bg-slate-600 text-white rounded text-xs font-medium hover:bg-slate-700"
        >
          未知ルートへ
        </button>
      </div>
    </div>
  );
};

const meta: Meta<typeof RouterProvider> = {
  title: "App/Router",
  component: RouterProvider,
};

export default meta;
type Story = StoryObj<typeof RouterProvider>;

/**
 * 本棚画面ルート（/）の初期表示ストーリー
 */
export const BookshelfRoute: Story = {
  name: "本棚画面ルート（/）",
  render: () => (
    <RouterProvider initialPath="/">
      <RouterStateInspector />
    </RouterProvider>
  ),
};

/**
 * 検索画面ルート（/search）の初期表示ストーリー
 */
export const SearchRoute: Story = {
  name: "検索画面ルート（/search）",
  render: () => (
    <RouterProvider initialPath="/search">
      <RouterStateInspector />
    </RouterProvider>
  ),
};

/**
 * ランキング画面ルート（/ranking）の初期表示ストーリー
 */
export const RankingRoute: Story = {
  name: "ランキング画面ルート（/ranking）",
  render: () => (
    <RouterProvider initialPath="/ranking">
      <RouterStateInspector />
    </RouterProvider>
  ),
};

/**
 * 作品詳細・目次画面ルート（/novels/:novelId）の初期表示ストーリー
 */
export const NovelDetailRoute: Story = {
  name: "作品詳細画面ルート（/novels/:novelId）",
  render: () => (
    <RouterProvider initialPath="/novels/kakuyomu%3A16817330658027210412">
      <RouterStateInspector />
    </RouterProvider>
  ),
};

/**
 * 小説リーダー画面ルート（/novels/:novelId/chapters/:chapterIndex）の初期表示ストーリー
 */
export const ReaderRoute: Story = {
  name: "小説リーダー画面ルート（/novels/:novelId/chapters/:chapterIndex）",
  render: () => (
    <RouterProvider initialPath="/novels/kakuyomu%3A16817330658027210412/chapters/1">
      <RouterStateInspector />
    </RouterProvider>
  ),
};

/**
 * 設定画面ルート（/settings）の初期表示ストーリー
 */
export const SettingsRoute: Story = {
  name: "設定画面ルート（/settings）",
  render: () => (
    <RouterProvider initialPath="/settings">
      <RouterStateInspector />
    </RouterProvider>
  ),
};

/**
 * 未知のパスアクセス時の本棚フォールバック表示ストーリー
 */
export const UnknownFallbackRoute: Story = {
  name: "未知パスフォールバックルート",
  render: () => (
    <RouterProvider initialPath="/unknown/non-existent-page">
      <RouterStateInspector />
    </RouterProvider>
  ),
};

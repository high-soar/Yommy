import type { Meta, StoryObj } from "@storybook/react";
import { WebViewImportPage } from "./WebViewImportPage";

const meta: Meta<typeof WebViewImportPage> = {
  title: "Features/WebViewImport/WebViewImportPage",
  component: WebViewImportPage,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    url: "https://kakuyomu.jp/works/16817330658027210412",
    pageTitle: "境界迷宮と異界の魔術師 - カクヨム",
    currentCapturedUrl: "https://kakuyomu.jp/works/16817330658027210412",
    canImport: true,
    isLoading: false,
    isImporting: false,
    notice: null,
    error: null,
    activeTab: "bookshelf",
    onUrlChange: () => {},
    onNavigateUrl: () => {},
    onOpenNativeBrowser: () => {},
    onImportCurrentDom: () => {},
    onBack: () => {},
    onSelectBookshelf: () => {},
    onSelectSearch: () => {},
    onSelectRanking: () => {},
    onSelectSettings: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof WebViewImportPage>;

/** 通常の対応 URL 表示（インポート可能） */
export const Default: Story = {};

/** 非対応 URL（一般サイトや検索等）表示時（警告トースト表示、取り込みボタン disabled） */
export const UnsupportedUrl: Story = {
  args: {
    url: "https://example.com/login",
    pageTitle: "Example Domain",
    currentCapturedUrl: "https://example.com/login",
    canImport: false,
  },
};

/** 読み込み中・インポート処理中状態 */
export const Loading: Story = {
  args: {
    isLoading: true,
    isImporting: true,
  },
};

/** インポート成功・保存完了通知表示状態 */
export const WithNotice: Story = {
  args: {
    notice: "作品目次を取り込みました。作品詳細へ移動します。",
  },
};

/** 不正 URL またはインポート失敗エラー表示状態 */
export const WithError: Story = {
  args: {
    error: "安全でない URL スキームは開けません",
    canImport: false,
  },
};

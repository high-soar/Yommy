import React from "react";
import type { WebViewImportPageProps } from "../types";
import { BottomTabBar } from "../../../shared/ui/BottomTabBar";

export const WebViewImportPage: React.FC<WebViewImportPageProps> = ({
  url,
  pageTitle,
  currentCapturedUrl,
  canImport,
  isLoading,
  isImporting,
  notice,
  error,
  activeTab = "bookshelf",
  onUrlChange,
  onNavigateUrl,
  onOpenNativeBrowser,
  onImportCurrentDom,
  onBack,
  onSelectBookshelf = () => {},
  onSelectSearch = () => {},
  onSelectRanking = () => {},
  onSelectSettings = () => {},
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void onNavigateUrl();
    }
  };

  const isBusy = isLoading || isImporting;

  return (
    <div
      data-testid="webview-import-page"
      role="main"
      className="h-dvh flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 relative"
    >
      {/* 固定ヘッダー（URL バー・戻る・移動） */}
      <header className="shrink-0 flex items-center gap-2 p-2 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs">
        <button
          type="button"
          data-testid="browser-back-button"
          aria-label="戻る"
          onClick={onBack}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <div className="flex-1 relative">
          <input
            type="url"
            data-testid="browser-url-input"
            aria-label="URLを入力"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://..."
            disabled={isBusy}
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <button
          type="button"
          data-testid="browser-navigate-button"
          onClick={() => void onNavigateUrl()}
          disabled={isBusy || !url.trim()}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
        >
          移動
        </button>
      </header>

      {/* 主要アクションバー（直接操作・取り込みボタン） */}
      <section className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/40">
        <button
          type="button"
          data-testid="open-native-browser-button"
          onClick={() => void onOpenNativeBrowser()}
          disabled={isBusy}
          className="flex-1 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed text-center"
        >
          内蔵ブラウザで直接操作
        </button>

        <button
          type="button"
          data-testid="import-dom-button"
          onClick={() => void onImportCurrentDom()}
          disabled={!canImport || isBusy}
          className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-40 disabled:cursor-not-allowed text-center transition-colors"
        >
          {isImporting ? "取り込み中..." : "表示中ページを取り込む"}
        </button>
      </section>

      {/* 中央プレビュー / ステータス表示領域 */}
      <div
        data-testid="browser-preview-area"
        className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4"
      >
        {/* エラーアラート */}
        {error && (
          <div
            role="alert"
            data-testid="browser-error"
            className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm shadow-xs"
          >
            <div className="font-semibold mb-0.5">エラー</div>
            <div>{error}</div>
          </div>
        )}

        {/* 完了通知 */}
        {notice && (
          <div
            role="status"
            data-testid="browser-notice"
            className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm shadow-xs"
          >
            <div className="font-semibold mb-0.5">インポート完了</div>
            <div>{notice}</div>
          </div>
        )}

        {/* 非対応 URL 警告 */}
        {!canImport && currentCapturedUrl && !error && (
          <div
            role="alert"
            data-testid="browser-unsupported-warning"
            className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm shadow-xs"
          >
            <div className="font-semibold mb-0.5">非対応のページ</div>
            <div>
              現在の URL
              は取り込みに対応していません。カクヨムまたは小説家になろうの作品ページへ移動してください。
            </div>
          </div>
        )}

        {/* 読み込み中スピナー */}
        {isBusy && (
          <div
            data-testid="browser-loading"
            role="status"
            className="flex flex-col items-center justify-center p-8 text-slate-500 dark:text-slate-400"
          >
            <div
              aria-hidden="true"
              className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"
            />
            <p className="text-sm font-medium">
              {isImporting ? "ページを取り込み中..." : "読み込み中..."}
            </p>
          </div>
        )}

        {/* ページ情報カード */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
            キャプチャ対象情報
          </div>
          <h2
            data-testid="browser-target-title"
            className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2"
          >
            {pageTitle || (url ? "読み込み中..." : "未読み込み")}
          </h2>
          <div
            data-testid="browser-target-url"
            className="text-xs font-mono text-slate-500 dark:text-slate-400 break-all select-all bg-slate-50 dark:bg-slate-900/60 p-2 rounded-md border border-slate-200/60 dark:border-slate-700/60"
          >
            {currentCapturedUrl || url || "（URL 未指定）"}
          </div>
        </div>
      </div>

      {/* 下部 4 タブバー */}
      <BottomTabBar
        activeTab={activeTab}
        onSelectBookshelf={onSelectBookshelf}
        onSelectSearch={onSelectSearch}
        onSelectRanking={onSelectRanking}
        onSelectSettings={onSelectSettings}
      />
    </div>
  );
};

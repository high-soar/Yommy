import React, { useState } from "react";
import type { NovelDetailHeaderProps } from "../types";

export type { NovelDetailHeaderProps } from "../types";

/**
 * 作品詳細ヘッダーコンポーネント（Presentational）
 *
 * メタ情報（タイトル、著者、あらすじ、話数・キャッシュ統計）、
 * 読書開始ボタン（しおり有無に応じた制御）、目次更新および作品削除アクションを提供する。
 * 画面上部に固定配置（shrink-0）され、あらすじの折りたたみトグルおよび省スペース化を提供する。
 */
export const NovelDetailHeader: React.FC<NovelDetailHeaderProps> = ({
  novel,
  isRefreshing,
  refreshMessage,
  error,
  onStartFromBeginning,
  onResumeBookmark,
  onRefreshToc,
  onOpenDeleteDialog,
}) => {
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);

  // メタ情報のフォールバックおよび空文字判定
  const isStartDisabled = novel.totalChapters === 0;
  const authorText = novel.author?.trim() ? novel.author : "著者不明";
  const hasSynopsis = Boolean(
    novel.synopsis && novel.synopsis.trim().length > 0,
  );
  const synopsisText = hasSynopsis ? novel.synopsis : "あらすじはありません。";

  return (
    <header
      data-testid="novel-detail-header"
      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 md:p-5 shadow-xs mb-4 md:mb-6 flex flex-col gap-3 md:gap-4 shrink-0"
    >
      {/* 管理アクションバー（右寄せ） */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          data-testid="refresh-toc-button"
          onClick={onRefreshToc}
          disabled={isRefreshing}
          className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {isRefreshing ? "更新中..." : "目次を更新"}
        </button>
        <button
          type="button"
          data-testid="open-delete-dialog-button"
          onClick={onOpenDeleteDialog}
          disabled={isRefreshing}
          className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-red-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          作品を削除
        </button>
      </div>

      {/* インライン通知メッセージ（目次更新完了フィードバック） */}
      {refreshMessage && (
        <div
          role="status"
          data-testid="novel-detail-notice"
          className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-xs md:text-sm rounded-xl border border-blue-200 dark:border-blue-900/60"
        >
          {refreshMessage}
        </div>
      )}

      {/* インラインエラーメッセージ */}
      {error && (
        <div
          role="alert"
          data-testid="novel-detail-error"
          className="p-3 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 text-xs md:text-sm rounded-xl border border-red-200 dark:border-red-900/60"
        >
          {error}
        </div>
      )}

      {/* 作品メタ情報 */}
      <div className="flex flex-col gap-1.5">
        <h1
          data-testid="novel-detail-title"
          className="text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-tight"
        >
          {novel.title}
        </h1>
        <p
          data-testid="novel-detail-author"
          className="text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          {authorText}
        </p>
        <div
          data-testid="novel-detail-stats"
          className="text-xs text-slate-500 dark:text-slate-400 mt-0.5"
        >
          全 {novel.totalChapters} 話（取得済み {novel.cachedChapters} 話）
        </div>
      </div>

      {/* あらすじ（折りたたみ／展開） */}
      <div className="flex flex-col gap-1.5">
        <div
          role="region"
          aria-label="作品あらすじ"
          id="novel-detail-synopsis"
          data-testid="novel-detail-synopsis"
          className={`text-xs md:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-3 md:p-4 rounded-xl border border-slate-100 dark:border-slate-800 ${
            isSynopsisExpanded ? "max-h-40 overflow-y-auto" : "line-clamp-2"
          }`}
        >
          {synopsisText}
        </div>
        {hasSynopsis && (
          <button
            type="button"
            data-testid="synopsis-toggle-button"
            aria-expanded={isSynopsisExpanded}
            aria-controls="novel-detail-synopsis"
            onClick={() => setIsSynopsisExpanded((prev) => !prev)}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 self-end transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500 rounded-sm"
          >
            {isSynopsisExpanded ? "あらすじを折りたたむ" : "あらすじを展開"}
          </button>
        )}
      </div>

      {/* 読書開始ボタンエリア（しおり未設定時は1ボタン、しおり設定時は2ボタン並列） */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        {novel.bookmarkChapterIndex !== null ? (
          <>
            <button
              type="button"
              data-testid="detail-resume-button"
              onClick={() => onResumeBookmark(novel.bookmarkChapterIndex!)}
              disabled={isStartDisabled}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-medium rounded-xl shadow-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-blue-400 cursor-pointer disabled:cursor-not-allowed"
            >
              続きから読む（第{novel.bookmarkChapterIndex}話）
            </button>
            <button
              type="button"
              data-testid="detail-read-first-button"
              onClick={onStartFromBeginning}
              disabled={isStartDisabled}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs md:text-sm font-medium rounded-xl transition-colors focus:outline-hidden focus:ring-2 focus:ring-slate-400 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              最初から読む（第1話）
            </button>
          </>
        ) : (
          <button
            type="button"
            data-testid="detail-read-first-button"
            onClick={onStartFromBeginning}
            disabled={isStartDisabled}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-medium rounded-xl shadow-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-blue-400 cursor-pointer disabled:cursor-not-allowed"
          >
            最初から読む（第1話）
          </button>
        )}
      </div>
    </header>
  );
};

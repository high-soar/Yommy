import React, { useEffect, useId, useRef, useState } from "react";
import type { NovelDetailHeaderProps } from "../types";
import { formatByteSize } from "../../../shared/utils/formatByteSize";

export type { NovelDetailHeaderProps } from "../types";

/**
 * 作品詳細ヘッダーコンポーネント（Presentational）
 *
 * メタ情報（タイトル、著者、あらすじ、話数・キャッシュ統計）、
 * 読書開始ボタン（しおり有無に応じた制御）、1行管理アイコンバー（お気に入り・目次更新・3点メニュー）を提供する。
 * 画面上部に固定配置（shrink-0）され、あらすじの折りたたみトグルおよび省スペース化を提供する。
 */
export const NovelDetailHeader: React.FC<NovelDetailHeaderProps> = ({
  novel,
  isRefreshing,
  isBatchCaching,
  batchCacheProgress,
  isAllCached,
  pendingCacheCount = 0,
  failedCacheCount = 0,
  refreshMessage,
  error,
  onStartFromBeginning,
  onResumeBookmark,
  onRefreshToc,
  onStartBatchCache,
  onCancelBatchCache,
  onOpenDeleteDialog,
  onOpenClearCacheDialog,
  onToggleFavorite,
  onOpenWebView,
}) => {
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const isActionDisabled = isRefreshing || isBatchCaching;
  const showMenu = isMenuOpen && !isActionDisabled;

  // 更新中・一括キャッシュ中に遷移した場合はメニューを自動的に閉じ、復帰後も開かないよう同期する
  useEffect(() => {
    if (isActionDisabled) {
      setIsMenuOpen(false);
    }
  }, [isActionDisabled]);

  // メニュー展開中の外クリック（タップ）および Escape キーによる自動クローズとフォーカス復帰
  useEffect(() => {
    if (!showMenu) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuContainerRef.current!.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        menuButtonRef.current!.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showMenu]);

  // メタ情報のフォールバックおよび空文字判定
  const isStartDisabled = novel.totalChapters === 0 || isBatchCaching;
  const authorText = novel.author?.trim() ? novel.author : "著者不明";
  const hasSynopsis = Boolean(
    novel.synopsis && novel.synopsis.trim().length > 0,
  );
  const synopsisText = hasSynopsis ? novel.synopsis : "あらすじはありません。";

  // 一括キャッシュ・再開・再試行メニュー項目の動的ラベルと活性制御 (AC-ND-11, AC-ND-13, AC-ND-24, AC-ND-25)
  const getBatchCacheButtonInfo = (): { label: string; disabled: boolean } => {
    if (novel.totalChapters === 0) {
      return { label: "未取得話を一括キャッシュ", disabled: true };
    }
    if (isAllCached) {
      return { label: "全話キャッシュ済み", disabled: true };
    }
    if (pendingCacheCount > 0) {
      const remainingTotal = pendingCacheCount + failedCacheCount;
      return {
        label: `キャッシュを再開（残り${remainingTotal}話）`,
        disabled: false,
      };
    }
    if (failedCacheCount > 0) {
      return {
        label: `失敗した話を再試行（${failedCacheCount}話）`,
        disabled: false,
      };
    }
    return { label: "未取得話を一括キャッシュ", disabled: false };
  };

  const batchButtonInfo = getBatchCacheButtonInfo();

  const handleMenuAction = (action?: () => void) => {
    setIsMenuOpen(false);
    action?.();
  };

  return (
    <header
      data-testid="novel-detail-header"
      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 md:p-5 shadow-xs mb-4 md:mb-6 flex flex-col gap-3 md:gap-4 shrink-0"
    >
      {/* 管理アクションバー（常時1行・右寄せアイコンバー） */}
      <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-nowrap">
        {isBatchCaching && (
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              data-testid="batch-cache-progress"
              className={`text-xs font-medium animate-pulse min-w-0 truncate ${
                failedCacheCount > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-blue-600 dark:text-blue-400"
              }`}
            >
              {batchCacheProgress
                ? failedCacheCount > 0
                  ? `キャッシュ中 (${batchCacheProgress.current}/${batchCacheProgress.total}) [失敗 ${failedCacheCount}話]...`
                  : `キャッシュ中 (${batchCacheProgress.current}/${batchCacheProgress.total})...`
                : "キャッシュ中..."}
            </span>
            <button
              type="button"
              data-testid="batch-cache-cancel-button"
              onClick={onCancelBatchCache}
              className="shrink-0 px-2.5 py-1.5 text-xs font-medium bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              中断
            </button>
          </div>
        )}
        {/* R2-01/R2-19: ON/OFF切替時のちらつきと横幅伸縮を防ぐため常時1px borderと固定アイコンサイズを維持 */}
        <button
          type="button"
          data-testid="detail-favorite-toggle-button"
          aria-pressed={Boolean(novel.isFavorite)}
          aria-label="お気に入り"
          onClick={onToggleFavorite}
          disabled={isActionDisabled}
          className={`inline-flex items-center justify-center shrink-0 w-8 h-8 text-sm leading-none rounded-lg border transition-colors focus:outline-hidden focus:ring-2 focus:ring-amber-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed ${
            novel.isFavorite
              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400 border-amber-300 dark:border-amber-700/60 hover:bg-amber-100 dark:hover:bg-amber-900/50"
              : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600"
          }`}
        >
          <span aria-hidden="true">{novel.isFavorite ? "★" : "☆"}</span>
        </button>
        <button
          type="button"
          data-testid="refresh-toc-button"
          aria-label="目次を更新"
          onClick={onRefreshToc}
          disabled={isActionDisabled}
          className="inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          <span
            aria-hidden="true"
            className={`text-sm leading-none select-none ${isRefreshing ? "animate-spin" : ""}`}
          >
            🔄
          </span>
        </button>
        <div ref={menuContainerRef} className="relative shrink-0">
          <button
            ref={menuButtonRef}
            type="button"
            data-testid="novel-detail-menu-button"
            aria-label="作品メニュー"
            aria-haspopup="menu"
            aria-expanded={showMenu}
            aria-controls={showMenu ? menuId : undefined}
            onClick={() => setIsMenuOpen((prev) => !prev)}
            disabled={isActionDisabled}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <span
              aria-hidden="true"
              className="text-base leading-none font-bold select-none"
            >
              ⋮
            </span>
          </button>
          {showMenu && (
            <div
              id={menuId}
              role="menu"
              aria-label="作品操作メニュー"
              data-testid="novel-detail-menu"
              className="absolute right-0 top-full mt-1.5 z-20 w-56 py-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                data-testid="batch-cache-button"
                onClick={() => handleMenuAction(onStartBatchCache)}
                disabled={batchButtonInfo.disabled}
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus:outline-hidden focus:bg-slate-100 dark:focus:bg-slate-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {batchButtonInfo.label}
              </button>
              <button
                type="button"
                role="menuitem"
                data-testid="open-clear-cache-dialog-button"
                onClick={() => handleMenuAction(onOpenClearCacheDialog)}
                disabled={novel.cachedChapters === 0}
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors focus:outline-hidden focus:bg-amber-50 dark:focus:bg-amber-950/30 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                本文キャッシュ整理
              </button>
              <button
                type="button"
                role="menuitem"
                data-testid="open-webview-button"
                onClick={() => handleMenuAction(onOpenWebView)}
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors focus:outline-hidden focus:bg-emerald-50 dark:focus:bg-emerald-950/30 cursor-pointer"
              >
                内蔵ブラウザで開く
              </button>
              <div
                role="separator"
                className="my-1 border-t border-slate-200 dark:border-slate-700"
              />
              <button
                type="button"
                role="menuitem"
                data-testid="open-delete-dialog-button"
                onClick={() => handleMenuAction(onOpenDeleteDialog)}
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors focus:outline-hidden focus:bg-red-50 dark:focus:bg-red-950/30 cursor-pointer"
              >
                作品を削除
              </button>
            </div>
          )}
        </div>
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
          全 {novel.totalChapters} 話（取得済み {novel.cachedChapters} 話 /{" "}
          {formatByteSize(novel.totalByteSize)}）
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

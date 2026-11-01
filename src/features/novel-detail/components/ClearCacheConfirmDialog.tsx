import React, { useEffect } from "react";
import type { ClearCacheConfirmDialogProps } from "../types";

export type { ClearCacheConfirmDialogProps } from "../types";

/**
 * 作品本文キャッシュ削除確認モーダルダイアログ
 *
 * 目次構造・既読状態・しおり位置を保持したまま、端末ストレージを解放するために
 * 本文キャッシュのみを削除（既読話のみ／全話）する確認ダイアログ。
 */
export const ClearCacheConfirmDialog: React.FC<
  ClearCacheConfirmDialogProps
> = ({ isOpen, novelTitle, isClearing, onClose, onConfirm }) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isClearing) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isClearing, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      data-testid="clear-cache-confirm-dialog-backdrop"
      onClick={() => {
        if (!isClearing) {
          onClose();
        }
      }}
      className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-cache-dialog-title"
        aria-describedby="clear-cache-confirm-message"
        data-testid="clear-cache-confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-xl w-full max-w-md mx-auto"
      >
        <h2
          id="clear-cache-dialog-title"
          className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2"
        >
          本文キャッシュの整理
        </h2>
        <p
          id="clear-cache-confirm-message"
          data-testid="clear-cache-confirm-message"
          className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed"
        >
          「{novelTitle}
          」の本文キャッシュを削除しますか？目次一覧、既読状態、しおり位置は保持され、再度読む際は再取得できます。
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
          <button
            type="button"
            data-testid="cancel-clear-cache-button"
            onClick={onClose}
            disabled={isClearing}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed text-center"
          >
            キャンセル
          </button>
          <button
            type="button"
            data-testid="confirm-clear-read-cache-button"
            onClick={() => onConfirm({ onlyRead: true })}
            disabled={isClearing}
            className="px-4 py-2 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shadow-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:bg-amber-400 cursor-pointer disabled:cursor-not-allowed text-center"
          >
            既読話の本文キャッシュのみ削除
          </button>
          <button
            type="button"
            data-testid="confirm-clear-all-cache-button"
            onClick={() => onConfirm({ onlyRead: false })}
            disabled={isClearing}
            className="px-4 py-2 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs focus:outline-hidden focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:bg-red-400 cursor-pointer disabled:cursor-not-allowed text-center"
          >
            すべての本文キャッシュを削除
          </button>
        </div>
      </div>
    </div>
  );
};

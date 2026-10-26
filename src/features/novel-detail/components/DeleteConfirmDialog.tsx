import React, { useEffect } from "react";
import type { DeleteConfirmDialogProps } from "../types";

export type { DeleteConfirmDialogProps } from "../types";

/**
 * 作品削除確認モーダルダイアログ
 */
export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  novelTitle,
  isDeleting,
  onClose,
  onConfirm,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      data-testid="delete-confirm-dialog-backdrop"
      onClick={() => {
        if (!isDeleting) {
          onClose();
        }
      }}
      className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-dialog-title"
        aria-describedby="delete-confirm-message"
        data-testid="delete-confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-xl w-full max-w-md mx-auto"
      >
        <h2
          id="delete-confirm-dialog-title"
          className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2"
        >
          作品の削除
        </h2>
        <p
          data-testid="delete-confirm-message"
          className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed"
        >
          「{novelTitle}
          」を本棚から削除しますか？取得済みの本文データもすべて削除されます。
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            data-testid="cancel-delete-button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            キャンセル
          </button>
          <button
            type="button"
            data-testid="confirm-delete-button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs focus:outline-hidden focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:bg-red-400 cursor-pointer disabled:cursor-not-allowed"
          >
            {isDeleting ? "削除中..." : "削除する"}
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from "react";
import { formatByteSize } from "../../../shared/utils/formatByteSize";
import type { StorageCacheSummary } from "../hooks/useStorageCache";

export interface StorageCacheSectionProps {
  /** 全登録作品合計キャッシュ情報 */
  summary: StorageCacheSummary;
  /** キャッシュ集計読込中フラグ */
  isLoading?: boolean;
  /** キャッシュ削除処理中フラグ */
  isClearing?: boolean;
  /** 一括削除完了通知メッセージ */
  notice?: string | null;
  /** キャッシュ操作エラーメッセージ */
  error?: string | null;
  /** 一括削除確認ダイアログの初期表示状態（Storybook / テスト用） */
  initialShowDialog?: boolean;
  /** 一括削除確定時のコールバック */
  onClearCache?: (options: { onlyRead: boolean }) => void | Promise<number>;
  /** カスタムクラス名 */
  className?: string;
}

/**
 * 設定画面（SCR-05）におけるストレージ・キャッシュ管理セクション（AC-ST-14〜16）
 */
export const StorageCacheSection: React.FC<StorageCacheSectionProps> = ({
  summary,
  isLoading = false,
  isClearing = false,
  notice = null,
  error = null,
  initialShowDialog = false,
  onClearCache,
  className,
}) => {
  const [showDialog, setShowDialog] = useState<boolean>(initialShowDialog);

  // ダイアログ表示時の Escape キー制御（キーボードアクセシビリティ対応: R1-21 削除中ガード）
  useEffect(() => {
    if (!showDialog) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isClearing) {
        setShowDialog(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showDialog, isClearing]);

  const handleConfirmClearRead = async () => {
    try {
      await onClearCache?.({ onlyRead: true });
    } catch {
      // エラーは hook/props 側で error state に設定されるため Unhandled Rejection を防止
    } finally {
      setShowDialog(false);
    }
  };

  const handleConfirmClearAll = async () => {
    try {
      await onClearCache?.({ onlyRead: false });
    } catch {
      // 同上
    } finally {
      setShowDialog(false);
    }
  };

  const handleCancelDialog = () => {
    setShowDialog(false);
  };

  const isActionDisabled =
    summary.totalCachedChapters === 0 || isClearing || isLoading;

  return (
    <section
      data-testid="storage-cache-section"
      aria-label="ストレージ・キャッシュ管理"
      className={`space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-4 md:p-5 shadow-xs ${className ?? ""}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <span aria-hidden="true">💾</span>
            ストレージ・キャッシュ管理
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            ダウンロードした本文キャッシュの容量を確認し、安全に整理します。目次・既読・しおりは保持されます。
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          data-testid="storage-cache-error-alert"
          className="rounded-lg border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2"
        >
          <span aria-hidden="true" className="font-bold">
            ⚠️
          </span>
          <div className="flex-1">{error}</div>
        </div>
      )}

      {notice && (
        <div
          data-testid="storage-cache-notice"
          className="rounded-lg border border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2"
        >
          <span aria-hidden="true" className="font-bold">
            ✓
          </span>
          <div className="flex-1">{notice}</div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-700/50">
        <div
          data-testid="storage-cache-summary"
          className="text-xs md:text-sm text-slate-600 dark:text-slate-300 font-medium"
        >
          キャッシュ済み: 全 {summary.totalCachedChapters} 話（合計{" "}
          {formatByteSize(summary.totalByteSize)}）
        </div>

        <button
          type="button"
          data-testid="open-global-clear-cache-dialog-button"
          disabled={isActionDisabled}
          onClick={() => setShowDialog(true)}
          className="px-3.5 py-1.5 text-xs md:text-sm font-medium rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs self-start sm:self-auto"
        >
          本文キャッシュを一括整理
        </button>
      </div>

      {showDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="global-clear-cache-dialog-title"
          data-testid="global-clear-cache-dialog"
          onClick={() => {
            if (!isClearing) {
              setShowDialog(false);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200 dark:border-slate-700 space-y-4"
          >
            <h3
              id="global-clear-cache-dialog-title"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              本文キャッシュの一括整理
            </h3>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              全登録作品の本文キャッシュを整理します。目次・既読状態・しおり位置は保持され、再度読む際は再取得可能です。
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                data-testid="confirm-global-clear-read-cache-button"
                disabled={isClearing}
                onClick={handleConfirmClearRead}
                className="w-full px-3.5 py-2 text-xs md:text-sm font-medium rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center"
              >
                既読話の本文キャッシュのみ削除
              </button>
              <button
                type="button"
                data-testid="confirm-global-clear-all-cache-button"
                disabled={isClearing}
                onClick={handleConfirmClearAll}
                className="w-full px-3.5 py-2 text-xs md:text-sm font-medium rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center shadow-xs"
              >
                すべての本文キャッシュを削除
              </button>
              <button
                type="button"
                data-testid="cancel-global-clear-cache-button"
                disabled={isClearing}
                onClick={handleCancelDialog}
                className="w-full px-3.5 py-2 text-xs md:text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

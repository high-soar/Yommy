import React, { useState } from "react";
import type { CloudSyncAuthState } from "../../../bridges/cloud-sync/types";

export interface CloudSyncSectionProps {
  /** 現在の認証連携状態 */
  authState: CloudSyncAuthState;
  /** 最終同期日時（ISO 8601 文字列、未同期は null） */
  lastSyncedAt: string | null;
  /** 同期通信処理中フラグ */
  isSyncing: boolean;
  /** 同期または認証エラーメッセージ */
  error?: string | null;
  /** 解除確認ダイアログの初期表示状態（Storybook / テスト用） */
  initialShowDisconnectDialog?: boolean;
  /** 「Google アカウントと連携」ボタン押下時のコールバック */
  onSignIn?: () => Promise<void>;
  /** 「連携解除」確認ダイアログ承認時のコールバック */
  onSignOut?: () => Promise<void>;
  /** 「今すぐ同期」ボタン押下時のコールバック */
  onSyncNow?: () => Promise<void>;
  /** カスタムクラス名 */
  className?: string;
}

function formatLastSyncedAt(isoString: string | null): string {
  if (!isoString) return "最終同期: 未同期";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "最終同期: 未同期";

  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `最終同期: ${y}/${m}/${d} ${h}:${min}:${s}`;
}

function resolveStatusText(authState: CloudSyncAuthState): string {
  switch (authState.status) {
    case "unlinked":
      return "未連携（端末内保存のみ）";
    case "authenticating":
      return "Google 認証中...";
    case "connected":
      return authState.email ? `連携中 (${authState.email})` : "連携中";
    case "error":
      return "認証エラー";
  }
}

/**
 * Google Drive クラウド同期セクション（SCR-05: Settings / AC-ST-08〜12）
 */
export const CloudSyncSection: React.FC<CloudSyncSectionProps> = ({
  authState,
  lastSyncedAt,
  isSyncing,
  error = null,
  initialShowDisconnectDialog = false,
  onSignIn,
  onSignOut,
  onSyncNow,
  className,
}) => {
  const [showDisconnectDialog, setShowDisconnectDialog] = useState<boolean>(
    initialShowDisconnectDialog,
  );

  const statusText = resolveStatusText(authState);
  const lastSyncedText = formatLastSyncedAt(lastSyncedAt);
  const isConnected = authState.status === "connected";
  const isAuthenticating = authState.status === "authenticating";

  const handleConfirmDisconnect = async () => {
    setShowDisconnectDialog(false);
    await onSignOut?.();
  };

  const handleCancelDisconnect = () => {
    setShowDisconnectDialog(false);
  };

  return (
    <section
      data-testid="cloud-sync-section"
      aria-label="クラウド同期設定"
      className={`space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-4 md:p-5 shadow-xs ${className ?? ""}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <span aria-hidden="true">☁️</span>
            クラウド同期 (Google Drive)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Google Drive
            のアプリ専用領域に本棚・しおりを自動保存し、複数端末間で共有します。
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          data-testid="cloud-sync-error-alert"
          className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs md:text-sm flex items-center gap-2"
        >
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-1.5 pt-1 text-xs md:text-sm border-t border-slate-100 dark:border-slate-700/60">
        <div
          data-testid="cloud-sync-status"
          className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2"
        >
          <span className="text-slate-500 dark:text-slate-400">状態:</span>
          <span>{statusText}</span>
        </div>
        <div
          data-testid="cloud-sync-last-synced-at"
          className="text-slate-500 dark:text-slate-400 text-xs font-mono"
        >
          {lastSyncedText}
        </div>
      </div>

      <div className="pt-2 flex items-center gap-3">
        {!isConnected ? (
          <button
            type="button"
            data-testid="cloud-sync-auth-button"
            disabled={isSyncing || isAuthenticating}
            onClick={onSignIn}
            className="px-4 py-2 text-xs md:text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs flex items-center gap-2"
          >
            {isAuthenticating ? "Google 認証中..." : "Google アカウントと連携"}
          </button>
        ) : (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              data-testid="cloud-sync-now-button"
              disabled={isSyncing}
              onClick={onSyncNow}
              className="px-3.5 py-1.5 text-xs md:text-sm font-medium rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {isSyncing ? "同期中..." : "今すぐ同期"}
            </button>
            <button
              type="button"
              data-testid="cloud-sync-disconnect-button"
              disabled={isSyncing}
              onClick={() => setShowDisconnectDialog(true)}
              className="px-3.5 py-1.5 text-xs md:text-sm font-medium rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              連携解除
            </button>
          </div>
        )}
      </div>

      {showDisconnectDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="disconnect-dialog-title"
          data-testid="cloud-sync-disconnect-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200 dark:border-slate-700 space-y-4">
            <h3
              id="disconnect-dialog-title"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              Google アカウントの連携解除
            </h3>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              連携を解除しますか？
              <br />
              端末内の本棚・しおりデータは消去されずそのまま保持されます。
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                data-testid="cloud-sync-disconnect-cancel-button"
                onClick={handleCancelDisconnect}
                className="px-3.5 py-1.5 text-xs md:text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                data-testid="cloud-sync-disconnect-confirm-button"
                onClick={handleConfirmDisconnect}
                className="px-3.5 py-1.5 text-xs md:text-sm font-medium rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-xs"
              >
                解除する
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

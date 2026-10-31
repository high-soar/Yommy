import React from "react";
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
  onSignIn: () => Promise<void>;
  /** 「連携解除」確認ダイアログ承認時のコールバック */
  onSignOut: () => Promise<void>;
  /** 「今すぐ同期」ボタン押下時のコールバック */
  onSyncNow: () => Promise<void>;
  /** カスタムクラス名 */
  className?: string;
}

/**
 * Google Drive クラウド同期セクション Presentational コンポーネント（Red スタブ）
 */
export const CloudSyncSection: React.FC<CloudSyncSectionProps> = () => {
  return <section data-testid="cloud-sync-section">{/* Red スタブ */}</section>;
};

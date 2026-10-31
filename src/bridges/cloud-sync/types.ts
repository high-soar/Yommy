/**
 * クラウド同期（Google Drive）の認証状態
 */
export type CloudSyncAuthState =
  | { status: "unlinked" }
  | { status: "authenticating" }
  | { status: "connected"; email?: string }
  | { status: "error"; message: string };

/**
 * クラウド同期 Bridge インターフェース契約
 */
export interface CloudSyncBridge {
  /** 現在の Google 認証状態を取得する */
  getAuthState(): Promise<CloudSyncAuthState>;
  /** Google アカウント連携（認可フロー実行） */
  signIn(): Promise<CloudSyncAuthState>;
  /** 連携解除（OS トークン破棄および Google サーバーへの Revoke 実行） */
  signOut(): Promise<void>;
  /** appDataFolder から yommy-sync-state.json を取得する（存在しない場合は null） */
  pullFile(): Promise<string | null>;
  /** appDataFolder へ yommy-sync-state.json をアップロード・保存する */
  pushFile(content: string): Promise<void>;
}

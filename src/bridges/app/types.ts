/**
 * システム戻るボタンイベント
 */
export interface BackButtonEvent {
  /**
   * ナビゲーション履歴で戻ることが可能かどうか
   */
  canGoBack: boolean;
}

/**
 * システム戻るボタンイベントリスナー
 */
export type BackButtonListener = (
  event: BackButtonEvent,
) => void | Promise<void>;

/**
 * アプリケーションライフサイクルおよびシステムバックキー制御の抽象ブリッジインターフェース
 */
export interface AppBridge {
  /**
   * Android 実機のシステム戻るボタン（またはテストでの疑似バックキー押下）のリスナーを登録する。
   *
   * @param listener バックキー押下時に呼び出されるリスナー関数
   * @returns リスナー解除関数
   */
  addBackButtonListener(listener: BackButtonListener): () => void;

  /**
   * アプリケーションを終了する。
   * Android 実機では @capacitor/app の App.exitApp() を実行し、モック環境では呼出フラグを記録する。
   */
  exitApp(): Promise<void>;
}

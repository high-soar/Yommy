/**
 * 音量キーの押下方向（進む / 戻る）
 */
export type VolumeKeyDirection = "up" | "down";

/**
 * 音量キー押下イベント
 */
export interface VolumeKeyEvent {
  direction: VolumeKeyDirection;
}

/**
 * 音量キーイベントリスナー
 */
export type VolumeKeyListener = (event: VolumeKeyEvent) => void | Promise<void>;

/**
 * ハードウェア音量キー制御の抽象ブリッジインターフェース
 */
export interface VolumeKeyBridge {
  /**
   * 音量キーインターセプトの有効/無効を切り替える。
   * Android 実機では有効時のみ KEYCODE_VOLUME_DOWN / KEYCODE_VOLUME_UP を捕捉し、OS 音量バー表示を抑止する。
   * リーダー離脱時や設定 OFF 時は false にすることで通常の OS 音量調整に戻す。
   */
  setVolumeKeyPagingEnabled(enabled: boolean): Promise<void>;

  /**
   * 音量キー押下イベントリスナーを登録する。
   * @param listener 音量キーイベントリスナー
   * @returns リスナー解除関数
   */
  addVolumeKeyListener(listener: VolumeKeyListener): () => void;
}

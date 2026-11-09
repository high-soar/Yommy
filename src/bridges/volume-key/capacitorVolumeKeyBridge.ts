import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type {
  VolumeKeyBridge,
  VolumeKeyEvent,
  VolumeKeyListener,
} from "./types";

/**
 * Capacitor ネイティブプラグインのインターフェース契約
 */
export interface VolumeKeyNativePlugin {
  setVolumeKeyPagingEnabled(options: { enabled: boolean }): Promise<void>;
  addListener(
    eventName: "volumeKeyEvent",
    listenerFunc: (event: VolumeKeyEvent) => void,
  ): Promise<PluginListenerHandle>;
}

export const VolumeKeyNative =
  registerPlugin<VolumeKeyNativePlugin>("VolumeKey");

/**
 * Android/iOS 実機実行用の Capacitor VolumeKey プラグインラッパー実装
 */
export class CapacitorVolumeKeyBridge implements VolumeKeyBridge {
  /**
   * 音量キーインターセプトの有効/無効を切り替える。
   */
  async setVolumeKeyPagingEnabled(enabled: boolean): Promise<void> {
    await VolumeKeyNative.setVolumeKeyPagingEnabled({ enabled });
  }

  /**
   * 音量キー押下イベントリスナーを登録する。
   *
   * @param listener 音量キーイベントリスナー
   * @returns リスナー解除関数
   */
  addVolumeKeyListener(listener: VolumeKeyListener): () => void {
    let isRemoved = false;
    const handlePromise = VolumeKeyNative.addListener(
      "volumeKeyEvent",
      listener,
    );
    void handlePromise.catch(() => {});

    return () => {
      if (isRemoved) return;
      isRemoved = true;
      void handlePromise
        .then((handle) => {
          void handle.remove().catch(() => {});
        })
        .catch(() => {});
    };
  }
}

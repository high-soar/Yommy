import { App } from "@capacitor/app";
import type { AppBridge, BackButtonListener } from "./types";

/**
 * Android/iOS 実機実行用の Capacitor App プラグインラッパー実装
 */
export class CapacitorAppBridge implements AppBridge {
  /**
   * Android 実機のシステム戻るボタンリスナーを登録する。
   *
   * @param listener バックキー押下リスナー
   * @returns リスナー解除関数
   */
  addBackButtonListener(listener: BackButtonListener): () => void {
    let isRemoved = false;
    const handlePromise = App.addListener("backButton", listener);

    return () => {
      if (isRemoved) return;
      isRemoved = true;
      void handlePromise.then((handle) => {
        handle.remove();
      });
    };
  }

  /**
   * アプリケーションを終了する。
   */
  async exitApp(): Promise<void> {
    await App.exitApp();
  }
}

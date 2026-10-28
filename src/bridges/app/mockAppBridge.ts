import type { AppBridge, BackButtonEvent, BackButtonListener } from "./types";

/**
 * テスト、Storybook、および Web 実行用のモック AppBridge 実装
 */
export class MockAppBridge implements AppBridge {
  private listeners: Set<BackButtonListener> = new Set();
  exitAppCalled = false;

  /**
   * システム戻るボタンのリスナーを登録する。
   *
   * @param listener バックキー押下リスナー
   * @returns リスナー解除関数
   */
  addBackButtonListener(listener: BackButtonListener): () => void {
    this.listeners.add(listener);
    let isRemoved = false;
    return () => {
      if (isRemoved) return;
      isRemoved = true;
      this.listeners.delete(listener);
    };
  }

  /**
   * アプリケーション終了をシミュレートする。
   */
  async exitApp(): Promise<void> {
    this.exitAppCalled = true;
  }

  /**
   * テストから疑似的にバックキー押下イベントを発火させる。
   *
   * @param canGoBack ナビゲーション履歴で戻れるかどうかのフラグ（省略時は false）
   */
  async triggerBackButton(canGoBack = false): Promise<void> {
    const event: BackButtonEvent = { canGoBack };
    for (const listener of Array.from(this.listeners)) {
      await listener(event);
    }
  }

  /**
   * 状態をリセットする。
   */
  reset(): void {
    this.listeners.clear();
    this.exitAppCalled = false;
  }
}

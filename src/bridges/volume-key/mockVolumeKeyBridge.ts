import type {
  VolumeKeyBridge,
  VolumeKeyDirection,
  VolumeKeyEvent,
  VolumeKeyListener,
} from "./types";

/**
 * テスト、Storybook、および Web 実行用のモック VolumeKeyBridge 実装
 */
export class MockVolumeKeyBridge implements VolumeKeyBridge {
  private listeners: Set<VolumeKeyListener> = new Set();
  private volumeKeyPagingEnabled = false;
  private handleKeyDown?: (event: KeyboardEvent) => void;

  constructor() {
    if (typeof window !== "undefined") {
      (
        window as unknown as { __yommyVolumeKeyBridge?: MockVolumeKeyBridge }
      ).__yommyVolumeKeyBridge = this;

      this.handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "AudioVolumeDown" || event.key === "VolumeDown") {
          this.triggerVolumeKey("down");
        } else if (event.key === "AudioVolumeUp" || event.key === "VolumeUp") {
          this.triggerVolumeKey("up");
        }
      };

      window.addEventListener("keydown", this.handleKeyDown);
    }
  }

  /**
   * 音量キーインターセプトの有効状態を取得する。
   */
  isVolumeKeyPagingEnabled(): boolean {
    return this.volumeKeyPagingEnabled;
  }

  /**
   * 音量キーインターセプトの有効/無効を切り替える。
   */
  async setVolumeKeyPagingEnabled(enabled: boolean): Promise<void> {
    this.volumeKeyPagingEnabled = enabled;
  }

  /**
   * 音量キーイベントリスナーを登録する。
   *
   * @param listener 音量キーイベントリスナー
   * @returns リスナー解除関数
   */
  addVolumeKeyListener(listener: VolumeKeyListener): () => void {
    this.listeners.add(listener);
    let isRemoved = false;
    return () => {
      if (isRemoved) return;
      isRemoved = true;
      this.listeners.delete(listener);
    };
  }

  /**
   * テスト・Webから疑似的に音量キー押下イベントを発火させる。
   *
   * @param direction 押下方向 ("up" | "down")
   * @param options force: true の場合は有効状態に関わらず発火
   */
  triggerVolumeKey(
    direction: VolumeKeyDirection,
    options?: { force?: boolean },
  ): void {
    if (!this.volumeKeyPagingEnabled && !options?.force) {
      return;
    }

    const event: VolumeKeyEvent = { direction };
    for (const listener of Array.from(this.listeners)) {
      void listener(event);
    }
  }

  /**
   * リスナーおよび状態をリセットする。
   */
  reset(): void {
    this.listeners.clear();
    this.volumeKeyPagingEnabled = false;
  }

  /**
   * リソースを解放し、window イベントリスナーを解除する。
   */
  destroy(): void {
    if (this.handleKeyDown && typeof window !== "undefined") {
      window.removeEventListener("keydown", this.handleKeyDown);
    }
    this.reset();
  }
}

import type {
  VolumeKeyBridge,
  VolumeKeyDirection,
  VolumeKeyListener,
} from "./types";

export class MockVolumeKeyBridge implements VolumeKeyBridge {
  isVolumeKeyPagingEnabled(): boolean {
    return false;
  }

  async setVolumeKeyPagingEnabled(_enabled: boolean): Promise<void> {}

  addVolumeKeyListener(_listener: VolumeKeyListener): () => void {
    return () => {};
  }

  triggerVolumeKey(
    _direction: VolumeKeyDirection,
    _options?: { force?: boolean },
  ): void {}

  reset(): void {}

  destroy(): void {}
}

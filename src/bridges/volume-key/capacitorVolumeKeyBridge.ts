import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type {
  VolumeKeyBridge,
  VolumeKeyEvent,
  VolumeKeyListener,
} from "./types";

export interface VolumeKeyNativePlugin {
  setVolumeKeyPagingEnabled(options: { enabled: boolean }): Promise<void>;
  addListener(
    eventName: "volumeKeyEvent",
    listenerFunc: (event: VolumeKeyEvent) => void,
  ): Promise<PluginListenerHandle>;
}

export const VolumeKeyNative =
  registerPlugin<VolumeKeyNativePlugin>("VolumeKey");

export class CapacitorVolumeKeyBridge implements VolumeKeyBridge {
  async setVolumeKeyPagingEnabled(_enabled: boolean): Promise<void> {}

  addVolumeKeyListener(_listener: VolumeKeyListener): () => void {
    return () => {};
  }
}

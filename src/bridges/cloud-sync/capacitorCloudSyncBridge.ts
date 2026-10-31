import { registerPlugin } from "@capacitor/core";
import type { CloudSyncAuthState, CloudSyncBridge } from "./types";

/**
 * Capacitor ネイティブプラグインのインターフェース契約
 */
export interface CloudSyncNativePlugin {
  getAuthState(): Promise<{
    status: "unlinked" | "authenticating" | "connected" | "error";
    email?: string;
    message?: string;
  }>;
  signIn(): Promise<{
    status: "unlinked" | "authenticating" | "connected" | "error";
    email?: string;
    message?: string;
  }>;
  signOut(): Promise<void>;
  pullFile(): Promise<{ content: string | null }>;
  pushFile(options: { content: string }): Promise<void>;
}

export const CloudSyncNative =
  registerPlugin<CloudSyncNativePlugin>("CloudSyncPlugin");

/**
 * Android 実機実行用の Capacitor CloudSync プラグインラッパー実装（Red スタブ）
 */
export class CapacitorCloudSyncBridge implements CloudSyncBridge {
  private readonly _plugin: CloudSyncNativePlugin;

  constructor(plugin?: CloudSyncNativePlugin) {
    this._plugin = plugin ?? CloudSyncNative;
    void this._plugin;
  }

  async getAuthState(): Promise<CloudSyncAuthState> {
    throw new Error("getAuthState is not implemented yet");
  }

  async signIn(): Promise<CloudSyncAuthState> {
    throw new Error("signIn is not implemented yet");
  }

  async signOut(): Promise<void> {
    throw new Error("signOut is not implemented yet");
  }

  async pullFile(): Promise<string | null> {
    throw new Error("pullFile is not implemented yet");
  }

  async pushFile(_content: string): Promise<void> {
    throw new Error("pushFile is not implemented yet");
  }
}

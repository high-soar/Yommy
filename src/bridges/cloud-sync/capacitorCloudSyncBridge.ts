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
 * Android 実機実行用の Capacitor CloudSync プラグインラッパー実装
 */
export class CapacitorCloudSyncBridge implements CloudSyncBridge {
  private readonly _plugin: CloudSyncNativePlugin;

  constructor(plugin: CloudSyncNativePlugin = CloudSyncNative) {
    this._plugin = plugin;
  }

  async getAuthState(): Promise<CloudSyncAuthState> {
    try {
      const res = await this._plugin.getAuthState();
      if (res.status === "connected") {
        return { status: "connected", email: res.email };
      }
      if (res.status === "authenticating") {
        return { status: "authenticating" };
      }
      if (res.status === "error") {
        return { status: "error", message: res.message || "Unknown error" };
      }
      return { status: "unlinked" };
    } catch (err) {
      return {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async signIn(): Promise<CloudSyncAuthState> {
    try {
      const res = await this._plugin.signIn();
      if (res.status === "connected") {
        return { status: "connected", email: res.email };
      }
      if (res.status === "authenticating") {
        return { status: "authenticating" };
      }
      if (res.status === "error") {
        return {
          status: "error",
          message: res.message || "Authentication failed",
        };
      }
      return { status: "unlinked" };
    } catch (err) {
      return {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async signOut(): Promise<void> {
    await this._plugin.signOut();
  }

  async pullFile(): Promise<string | null> {
    try {
      const res = await this._plugin.pullFile();
      return res?.content ?? null;
    } catch (err) {
      await this.handleAuthErrorIfNeeded(err);
      throw err;
    }
  }

  async pushFile(content: string): Promise<void> {
    try {
      await this._plugin.pushFile({ content });
    } catch (err) {
      await this.handleAuthErrorIfNeeded(err);
      throw err;
    }
  }

  private async handleAuthErrorIfNeeded(err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("401") ||
      message.toLowerCase().includes("unauthorized")
    ) {
      try {
        await this.signOut();
      } catch {
        // signOut 自体のエラーは握りつぶし、元のエラーをスローさせる
      }
    }
  }
}

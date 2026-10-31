import { registerPlugin } from "@capacitor/core";
import type { CloudSyncAuthState, CloudSyncBridge } from "./types";

/**
 * Capacitor ネイティブプラグインの応答ステータス
 */
export type CloudSyncPluginResponseStatus =
  "unlinked" | "authenticating" | "connected" | "error";

/**
 * Capacitor ネイティブプラグインの認証応答
 */
export interface CloudSyncPluginAuthResponse {
  status: CloudSyncPluginResponseStatus;
  email?: string;
  message?: string;
}

/**
 * Capacitor ネイティブプラグインのインターフェース契約
 */
export interface CloudSyncNativePlugin {
  getAuthState(): Promise<CloudSyncPluginAuthResponse>;
  signIn(): Promise<CloudSyncPluginAuthResponse>;
  signOut(): Promise<void>;
  pullFile(): Promise<{ content: string | null }>;
  pushFile(options: { content: string }): Promise<void>;
}

export const CloudSyncNative =
  registerPlugin<CloudSyncNativePlugin>("CloudSyncPlugin");

function formatAuthStateResponse(
  res: CloudSyncPluginAuthResponse,
  fallbackErrorMessage: string,
): CloudSyncAuthState {
  if (res.status === "connected") {
    return {
      status: "connected",
      email: res.email ? res.email : undefined,
    };
  }
  if (res.status === "authenticating") {
    return { status: "authenticating" };
  }
  if (res.status === "error") {
    return {
      status: "error",
      message: res.message || fallbackErrorMessage,
    };
  }
  return { status: "unlinked" };
}

function toErrorAuthState(err: unknown): CloudSyncAuthState {
  return {
    status: "error",
    message: err instanceof Error ? err.message : String(err),
  };
}

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
      return formatAuthStateResponse(res, "Unknown error");
    } catch (err) {
      return toErrorAuthState(err);
    }
  }

  async signIn(): Promise<CloudSyncAuthState> {
    try {
      const res = await this._plugin.signIn();
      return formatAuthStateResponse(res, "Authentication failed");
    } catch (err) {
      return toErrorAuthState(err);
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
        // signOut 自体の例外は破棄し、呼び出し元の元のエラーをリスローさせる
      }
    }
  }
}

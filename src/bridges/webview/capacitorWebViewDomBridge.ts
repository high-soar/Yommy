import { registerPlugin } from "@capacitor/core";
import type {
  CapturedDomResult,
  OpenWebViewOptions,
  WebViewDomBridge,
} from "./types";
import { createUnsafeSchemeError, isValidHttpUrl } from "./urlUtils";

/**
 * Capacitor ネイティブプラグインのインターフェース契約
 */
export interface WebViewDomNativePlugin {
  open(options: { url: string; title?: string }): Promise<void>;
  close(): Promise<void>;
  captureDom(): Promise<{ html: string; url: string; title: string }>;
}

export const WebViewDomNative =
  registerPlugin<WebViewDomNativePlugin>("WebViewDom");

/**
 * Android/iOS 実機実行用の Capacitor WebViewDom プラグインラッパー実装
 */
export class CapacitorWebViewDomBridge implements WebViewDomBridge {
  /**
   * 指定 URL が http: または https: の安全なスキームか検証する。
   */
  canHandle(url: string): boolean {
    return isValidHttpUrl(url);
  }

  /**
   * ネイティブ WebView ダイアログを開く。
   */
  async open(options: OpenWebViewOptions): Promise<void> {
    if (!this.canHandle(options.url)) {
      throw createUnsafeSchemeError(options.url);
    }
    await WebViewDomNative.open({
      url: options.url.trim(),
      title: options.title,
    });
  }

  /**
   * 開いている WebView ダイアログを閉じる。
   */
  async close(): Promise<void> {
    await WebViewDomNative.close();
  }

  /**
   * 現在表示中のページの DOM (outerHTML), 最終 URL, タイトルをキャプチャする。
   */
  async captureDom(): Promise<CapturedDomResult> {
    const result = await WebViewDomNative.captureDom();
    return {
      html: result?.html ?? "",
      url: result?.url ?? "",
      title: result?.title ?? "",
    };
  }
}

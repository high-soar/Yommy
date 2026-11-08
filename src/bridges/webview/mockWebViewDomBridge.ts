import type {
  CapturedDomResult,
  OpenWebViewOptions,
  WebViewDomBridge,
} from "./types";
import { createUnsafeSchemeError, isValidHttpUrl } from "./urlUtils";

const DEFAULT_MOCK_PAGE: CapturedDomResult = {
  html: "<!DOCTYPE html><html><head><title>カクヨム作品モック</title></head><body><div id='workTitle'>異世界転生モック</div><div class='widget-episodeBody'>モック本文</div></body></html>",
  url: "https://kakuyomu.jp/works/default-mock",
  title: "カクヨム作品モック",
};

/**
 * テスト、Storybook、および Web 実行用のモック WebViewDomBridge 実装
 */
export class MockWebViewDomBridge implements WebViewDomBridge {
  private opened = false;
  private currentOptions: OpenWebViewOptions | null = null;
  private mockPage: CapturedDomResult = { ...DEFAULT_MOCK_PAGE };

  /**
   * WebView が開いているかどうかを取得する（テスト・Storybook 検証用）。
   */
  isOpened(): boolean {
    return this.opened;
  }

  /**
   * 現在開かれているオプションを取得する。
   */
  getCurrentOptions(): OpenWebViewOptions | null {
    return this.currentOptions;
  }

  /**
   * モックキャプチャ時に返却するページ情報を設定する。
   */
  setMockPage(result: CapturedDomResult): void {
    this.mockPage = { ...result };
  }

  /**
   * 状態を初期化し、デフォルトモックページに復帰する。
   */
  reset(): void {
    this.opened = false;
    this.currentOptions = null;
    this.mockPage = { ...DEFAULT_MOCK_PAGE };
  }

  /**
   * 指定 URL が http: または https: の安全なスキームか検証する。
   */
  canHandle(url: string): boolean {
    return isValidHttpUrl(url);
  }

  /**
   * モック内蔵ブラウザを開く。
   */
  async open(options: OpenWebViewOptions): Promise<void> {
    if (!this.canHandle(options.url)) {
      throw createUnsafeSchemeError(options.url);
    }
    this.opened = true;
    this.currentOptions = {
      ...options,
      url: options.url.trim(),
    };
  }

  /**
   * モック内蔵ブラウザを閉じる。
   */
  async close(): Promise<void> {
    this.opened = false;
  }

  /**
   * 現在のモックページ情報をキャプチャとして返却する。
   */
  async captureDom(): Promise<CapturedDomResult> {
    return Promise.resolve({ ...this.mockPage });
  }
}

/**
 * 内蔵 WebView DOM キャプチャ結果
 */
export interface CapturedDomResult {
  html: string;
  url: string;
  title: string;
}

/**
 * 内蔵 WebView 開設オプション
 */
export interface OpenWebViewOptions {
  url: string;
  title?: string;
}

/**
 * 内蔵ブラウザ DOM キャプチャ Bridge インターフェース契約（Issue #269 / AC-WV-03）
 */
export interface WebViewDomBridge {
  /**
   * ネイティブ WebView ダイアログまたは内蔵ブラウザを開く。
   */
  open(options: OpenWebViewOptions): Promise<void>;

  /**
   * 開いている WebView を閉じる。
   */
  close(): Promise<void>;

  /**
   * 現在表示中のページの DOM (outerHTML), 最終 URL, タイトルをキャプチャする。
   */
  captureDom(): Promise<CapturedDomResult>;

  /**
   * 指定 URL が http: または https: の安全なスキームか検証する。
   */
  canHandle(url: string): boolean;
}

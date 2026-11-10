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
   * 指定 URL が https: の安全なスキームか検証する。
   */
  canHandle(url: string): boolean;

  /**
   * ネイティブ内蔵ブラウザダイアログで DOM キャプチャ（「取込」ボタン等）が実行されたときの通知を購読する。
   * 返却値の関数を呼び出すことで購読を解除する。
   */
  addDomCapturedListener?(
    listener: (result: CapturedDomResult) => void,
  ): () => void;
}

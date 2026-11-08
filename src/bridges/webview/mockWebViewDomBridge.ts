import type {
  CapturedDomResult,
  OpenWebViewOptions,
  WebViewDomBridge,
} from "./types";

export class MockWebViewDomBridge implements WebViewDomBridge {
  isOpened(): boolean {
    throw new Error("Not implemented");
  }

  getCurrentOptions(): OpenWebViewOptions | null {
    throw new Error("Not implemented");
  }

  setMockPage(_result: CapturedDomResult): void {
    throw new Error("Not implemented");
  }

  reset(): void {
    throw new Error("Not implemented");
  }

  canHandle(_url: string): boolean {
    throw new Error("Not implemented");
  }

  async open(_options: OpenWebViewOptions): Promise<void> {
    throw new Error("Not implemented");
  }

  async close(): Promise<void> {
    throw new Error("Not implemented");
  }

  async captureDom(): Promise<CapturedDomResult> {
    throw new Error("Not implemented");
  }
}

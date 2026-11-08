import { registerPlugin } from "@capacitor/core";
import type {
  CapturedDomResult,
  OpenWebViewOptions,
  WebViewDomBridge,
} from "./types";

export interface WebViewDomNativePlugin {
  open(options: { url: string; title?: string }): Promise<void>;
  close(): Promise<void>;
  captureDom(): Promise<{ html: string; url: string; title: string }>;
}

export const WebViewDomNative =
  registerPlugin<WebViewDomNativePlugin>("WebViewDom");

export class CapacitorWebViewDomBridge implements WebViewDomBridge {
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

import { describe, it, expect } from "vitest";
import {
  CapacitorWebViewDomBridge,
  MockWebViewDomBridge,
  WebViewDomNative,
  isValidHttpUrl,
  createUnsafeSchemeError,
} from "./index";

describe("bridges/webview/index", () => {
  it("必要なモジュールおよびインスタンスが正常に再エクスポートされていること", () => {
    expect(CapacitorWebViewDomBridge).toBeDefined();
    expect(MockWebViewDomBridge).toBeDefined();
    expect(WebViewDomNative).toBeDefined();
    expect(isValidHttpUrl).toBeDefined();
    expect(createUnsafeSchemeError).toBeDefined();
  });
});

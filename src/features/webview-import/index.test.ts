import { describe, it, expect } from "vitest";
import * as WebviewImportModule from "./index";

describe("webview-import index barrel", () => {
  it("必要なフックおよびコンポーネントがエクスポートされていること", () => {
    expect(WebviewImportModule.useWebViewImport).toBeDefined();
    expect(WebviewImportModule.WebViewImportPage).toBeDefined();
    expect(WebviewImportModule.WebViewImportContainer).toBeDefined();
  });
});

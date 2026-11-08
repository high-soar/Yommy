import { describe, it, expect } from "vitest";
import { isValidHttpUrl, createUnsafeSchemeError } from "./urlUtils";

describe("bridges/webview/urlUtils", () => {
  describe("isValidHttpUrl", () => {
    it("http: および https: の有効なURLで true を返却すること", () => {
      expect(isValidHttpUrl("http://example.com")).toBe(true);
      expect(isValidHttpUrl("https://kakuyomu.jp/works/12345")).toBe(true);
      expect(isValidHttpUrl("https://ncode.syosetu.com/n12345/1/")).toBe(true);
      expect(isValidHttpUrl("  https://kakuyomu.jp/  ")).toBe(true);
    });

    it("危険なスキーム（javascript:, data:, file:, intent: 等）で false を返却すること", () => {
      expect(isValidHttpUrl("javascript:alert('xss')")).toBe(false);
      expect(isValidHttpUrl("data:text/html,test")).toBe(false);
      expect(isValidHttpUrl("file:///etc/hosts")).toBe(false);
      expect(isValidHttpUrl("intent://example.com#Intent;")).toBe(false);
      expect(isValidHttpUrl("about:blank")).toBe(false);
      expect(isValidHttpUrl("chrome://settings")).toBe(false);
    });

    it("空文字、空白のみ、または不正な形式で false を返却すること", () => {
      expect(isValidHttpUrl("")).toBe(false);
      expect(isValidHttpUrl("   ")).toBe(false);
      expect(isValidHttpUrl("not-a-valid-url")).toBe(false);
      expect(isValidHttpUrl(null as unknown as string)).toBe(false);
      expect(isValidHttpUrl(undefined as unknown as string)).toBe(false);
    });
  });

  describe("createUnsafeSchemeError", () => {
    it("指定された URL を含む Error インスタンスを生成すること", () => {
      const err = createUnsafeSchemeError("javascript:void(0)");
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe(
        "Invalid or unsafe URL scheme: javascript:void(0)",
      );
    });
  });
});

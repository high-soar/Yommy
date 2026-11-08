import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CapacitorWebViewDomBridge,
  WebViewDomNative,
} from "./capacitorWebViewDomBridge";

vi.mock("@capacitor/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@capacitor/core")>();
  const mockPlugin = {
    open: vi.fn(),
    close: vi.fn(),
    captureDom: vi.fn(),
  };
  return {
    ...actual,
    registerPlugin: vi.fn(() => mockPlugin),
  };
});

describe("CapacitorWebViewDomBridge", () => {
  let bridge: CapacitorWebViewDomBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    bridge = new CapacitorWebViewDomBridge();
  });

  describe("canHandle", () => {
    it("http: および https: の安全なURLに対して true を返却すること", () => {
      expect(bridge.canHandle("https://kakuyomu.jp/works/123")).toBe(true);
      expect(bridge.canHandle("http://example.com/novel/1")).toBe(true);
      expect(bridge.canHandle("https://ncode.syosetu.com/n12345/")).toBe(true);
    });

    it("危険なスキーム（javascript:, data:, file:, intent: 等）に対して false を返却すること", () => {
      expect(bridge.canHandle("javascript:alert(1)")).toBe(false);
      expect(bridge.canHandle("data:text/html,<h1>hacked</h1>")).toBe(false);
      expect(bridge.canHandle("file:///etc/passwd")).toBe(false);
      expect(bridge.canHandle("intent://example.com#Intent;")).toBe(false);
      expect(bridge.canHandle("about:blank")).toBe(false);
    });

    it("空文字、空白のみ、または不正な形式の文字列に対して false を返却すること", () => {
      expect(bridge.canHandle("")).toBe(false);
      expect(bridge.canHandle("   ")).toBe(false);
      expect(bridge.canHandle("not-a-valid-url")).toBe(false);
      // 型チェック回避で無効値を渡す検証
      expect(bridge.canHandle(null as unknown as string)).toBe(false);
      expect(bridge.canHandle(undefined as unknown as string)).toBe(false);
    });
  });

  describe("open", () => {
    it("安全なURLを渡した場合、WebViewDomNative.open が呼び出されること", async () => {
      vi.mocked(WebViewDomNative.open).mockResolvedValue(undefined);

      await bridge.open({
        url: "https://kakuyomu.jp/works/123",
        title: "テスト小説",
      });

      expect(WebViewDomNative.open).toHaveBeenCalledTimes(1);
      expect(WebViewDomNative.open).toHaveBeenCalledWith({
        url: "https://kakuyomu.jp/works/123",
        title: "テスト小説",
      });
    });

    it("title が省略された場合でも正常に open が呼び出されること", async () => {
      vi.mocked(WebViewDomNative.open).mockResolvedValue(undefined);

      await bridge.open({
        url: "https://kakuyomu.jp/works/123",
      });

      expect(WebViewDomNative.open).toHaveBeenCalledTimes(1);
      expect(WebViewDomNative.open).toHaveBeenCalledWith({
        url: "https://kakuyomu.jp/works/123",
        title: undefined,
      });
    });

    it("危険または不正なURLを渡した場合、エラーをスローしネイティブ呼び出しを行わないこと", async () => {
      await expect(
        bridge.open({
          url: "javascript:alert(1)",
        }),
      ).rejects.toThrow("Invalid or unsafe URL scheme: javascript:alert(1)");

      expect(WebViewDomNative.open).not.toHaveBeenCalled();
    });
  });

  describe("close", () => {
    it("WebViewDomNative.close が呼び出されること", async () => {
      vi.mocked(WebViewDomNative.close).mockResolvedValue(undefined);

      await bridge.close();

      expect(WebViewDomNative.close).toHaveBeenCalledTimes(1);
    });
  });

  describe("captureDom", () => {
    it("WebViewDomNative.captureDom から返却された DOM 情報が正常に返されること", async () => {
      vi.mocked(WebViewDomNative.captureDom).mockResolvedValue({
        html: "<html><body><div id='workTitle'>タイトル</div></body></html>",
        url: "https://kakuyomu.jp/works/123",
        title: "テスト作品",
      });

      const result = await bridge.captureDom();

      expect(WebViewDomNative.captureDom).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        html: "<html><body><div id='workTitle'>タイトル</div></body></html>",
        url: "https://kakuyomu.jp/works/123",
        title: "テスト作品",
      });
    });

    it("ネイティブの返却値にプロパティが欠落している場合でも安全にフォールバックされること", async () => {
      vi.mocked(WebViewDomNative.captureDom).mockResolvedValue({
        html: null as unknown as string,
        url: undefined as unknown as string,
        title: null as unknown as string,
      });

      const result = await bridge.captureDom();

      expect(result).toEqual({
        html: "",
        url: "",
        title: "",
      });
    });
  });
});

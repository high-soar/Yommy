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
    it("https: の安全なURLに対して true を返却し、平文 http: は false を返却すること (R1-23)", () => {
      expect(bridge.canHandle("https://kakuyomu.jp/works/123")).toBe(true);
      expect(bridge.canHandle("https://ncode.syosetu.com/n12345/")).toBe(true);
      expect(bridge.canHandle("http://example.com/novel/1")).toBe(false);
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

  describe("addDomCapturedListener", () => {
    it("WebViewDomNative.addListener が存在する場合、domCaptured を購読し、イベント通知がリスナーに届くこと", async () => {
      const mockRemove = vi.fn().mockResolvedValue(undefined);
      let capturedCallback: ((data: unknown) => void) | undefined;
      const addListenerMock = vi
        .fn()
        .mockImplementation((_event: string, cb: (data: unknown) => void) => {
          capturedCallback = cb;
          return Promise.resolve({ remove: mockRemove });
        });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (WebViewDomNative as any).addListener = addListenerMock;

      const listener = vi.fn();
      const unsubscribe = bridge.addDomCapturedListener(listener);

      expect(addListenerMock).toHaveBeenCalledWith(
        "domCaptured",
        expect.any(Function),
      );

      // イベント発火
      capturedCallback?.({
        html: "<p>本文</p>",
        url: "https://kakuyomu.jp/works/1",
        title: "タイトル",
      });

      expect(listener).toHaveBeenCalledWith({
        html: "<p>本文</p>",
        url: "https://kakuyomu.jp/works/1",
        title: "タイトル",
      });

      // 購読解除
      await Promise.resolve(); // Promise 解決を待つ
      unsubscribe();
      expect(mockRemove).toHaveBeenCalledTimes(1);
    });

    it("Promise 解決前に購読解除された場合でも、解決後に即座に remove が呼ばれること", async () => {
      const mockRemove = vi.fn().mockResolvedValue(undefined);
      let resolvePromise: (handle: { remove: () => Promise<void> }) => void;
      const deferred = new Promise<{ remove: () => Promise<void> }>(
        (resolve) => {
          resolvePromise = resolve;
        },
      );
      const addListenerMock = vi.fn().mockReturnValue(deferred);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (WebViewDomNative as any).addListener = addListenerMock;

      const unsubscribe = bridge.addDomCapturedListener(vi.fn());
      unsubscribe(); // 解決前に解除

      resolvePromise!({ remove: mockRemove });
      await Promise.resolve();
      await Promise.resolve();

      expect(mockRemove).toHaveBeenCalledTimes(1);
    });

    it("WebViewDomNative.addListener が未定義の場合でもエラーにならず解除関数が呼べること", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (WebViewDomNative as any).addListener = undefined;

      const unsubscribe = bridge.addDomCapturedListener(vi.fn());
      expect(() => unsubscribe()).not.toThrow();
    });

    it("addListener や remove が例外を reject した場合でも unhandled rejection にならず安全に catch されること (R1-45)", async () => {
      const mockRemove = vi
        .fn()
        .mockRejectedValue(new Error("Native remove error"));
      const addListenerMock = vi.fn().mockResolvedValue({ remove: mockRemove });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (WebViewDomNative as any).addListener = addListenerMock;

      const unsubscribe = bridge.addDomCapturedListener(vi.fn());
      await Promise.resolve();

      expect(() => unsubscribe()).not.toThrow();
      await Promise.resolve();

      // addListener が reject する場合
      const failingAddListenerMock = vi
        .fn()
        .mockRejectedValue(new Error("Native addListener error"));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (WebViewDomNative as any).addListener = failingAddListenerMock;

      expect(() => bridge.addDomCapturedListener(vi.fn())).not.toThrow();
      await Promise.resolve();
    });
  });
});

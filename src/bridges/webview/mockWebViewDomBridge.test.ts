import { describe, it, expect, beforeEach } from "vitest";
import { MockWebViewDomBridge } from "./mockWebViewDomBridge";
import type { CapturedDomResult, OpenWebViewOptions } from "./types";

describe("MockWebViewDomBridge", () => {
  let bridge: MockWebViewDomBridge;

  beforeEach(() => {
    bridge = new MockWebViewDomBridge();
  });

  describe("canHandle", () => {
    it("http: および https: の安全なURLに対して true を返却すること", () => {
      expect(bridge.canHandle("https://kakuyomu.jp/works/123")).toBe(true);
      expect(bridge.canHandle("http://example.com/page")).toBe(true);
      expect(bridge.canHandle("https://ncode.syosetu.com/n1234/")).toBe(true);
    });

    it("危険なスキーム（javascript:, data:, file:, intent: 等）に対して false を返却すること", () => {
      expect(bridge.canHandle("javascript:alert(1)")).toBe(false);
      expect(bridge.canHandle("data:text/html,test")).toBe(false);
      expect(bridge.canHandle("file:///etc/hosts")).toBe(false);
      expect(bridge.canHandle("intent://scan/#Intent")).toBe(false);
      expect(bridge.canHandle("about:blank")).toBe(false);
    });

    it("空文字、空白のみ、または不正な形式の文字列に対して false を返却すること", () => {
      expect(bridge.canHandle("")).toBe(false);
      expect(bridge.canHandle("   ")).toBe(false);
      expect(bridge.canHandle("invalid-url-string")).toBe(false);
      expect(bridge.canHandle(null as unknown as string)).toBe(false);
      expect(bridge.canHandle(undefined as unknown as string)).toBe(false);
    });
  });

  describe("open, close, isOpened, getCurrentOptions", () => {
    it("初期状態では isOpened が false であり getCurrentOptions が null であること", () => {
      expect(bridge.isOpened()).toBe(false);
      expect(bridge.getCurrentOptions()).toBeNull();
    });

    it("open を呼び出すと isOpened が true となり options が保持されること", async () => {
      const options: OpenWebViewOptions = {
        url: "  https://kakuyomu.jp/works/123  ",
        title: "テスト小説",
      };
      await bridge.open(options);

      expect(bridge.isOpened()).toBe(true);
      expect(bridge.getCurrentOptions()).toEqual({
        url: "https://kakuyomu.jp/works/123",
        title: "テスト小説",
      });
    });

    it("危険なURLで open を呼び出すとエラーをスローし isOpened は false のままであること", async () => {
      await expect(
        bridge.open({
          url: "javascript:void(0)",
        }),
      ).rejects.toThrow("Invalid or unsafe URL scheme: javascript:void(0)");

      expect(bridge.isOpened()).toBe(false);
      expect(bridge.getCurrentOptions()).toBeNull();
    });

    it("close を呼び出すと isOpened が false にリセットされること", async () => {
      await bridge.open({ url: "https://kakuyomu.jp/works/123" });
      expect(bridge.isOpened()).toBe(true);

      await bridge.close();
      expect(bridge.isOpened()).toBe(false);
    });
  });

  describe("captureDom and setMockPage", () => {
    it("setMockPage 未呼び出し時はデフォルトページ情報を返却すること", async () => {
      const result = await bridge.captureDom();

      expect(result.url).toBeTruthy();
      expect(result.html).toBeTruthy();
      expect(result.title).toBeTruthy();
      expect(result.html).toContain("<!DOCTYPE html>");
    });

    it("setMockPage でカスタムページ情報を設定できること", async () => {
      const customPage: CapturedDomResult = {
        html: "<div id='workTitle'>異世界転生記</div>",
        url: "https://kakuyomu.jp/works/99999",
        title: "異世界転生記",
      };

      bridge.setMockPage(customPage);
      const result = await bridge.captureDom();

      expect(result).toEqual(customPage);
    });
  });

  describe("reset", () => {
    it("状態を初期化し、開閉状態および設定済みモックページを初期状態に戻すこと", async () => {
      await bridge.open({ url: "https://kakuyomu.jp/works/123" });
      bridge.setMockPage({
        html: "<div>カスタム</div>",
        url: "https://example.com/custom",
        title: "カスタム",
      });

      expect(bridge.isOpened()).toBe(true);
      expect(bridge.getCurrentOptions()).not.toBeNull();

      bridge.reset();

      expect(bridge.isOpened()).toBe(false);
      expect(bridge.getCurrentOptions()).toBeNull();

      const result = await bridge.captureDom();
      expect(result.url).not.toBe("https://example.com/custom");
      expect(result.html).toContain("<!DOCTYPE html>");
    });
  });

  describe("addDomCapturedListener and emitDomCaptured", () => {
    it("リスナーを登録し、emitDomCaptured で通知を受信できること", () => {
      const received: CapturedDomResult[] = [];
      const unsubscribe = bridge.addDomCapturedListener((data) => {
        received.push(data);
      });

      bridge.emitDomCaptured();
      expect(received).toHaveLength(1);
      expect(received[0].html).toContain("<!DOCTYPE html>");

      const custom: CapturedDomResult = {
        html: "<p>カスタム通知</p>",
        url: "https://kakuyomu.jp/works/1",
        title: "カスタム",
      };
      bridge.emitDomCaptured(custom);
      expect(received).toHaveLength(2);
      expect(received[1]).toEqual(custom);

      unsubscribe();
      bridge.emitDomCaptured();
      expect(received).toHaveLength(2); // 増えないこと
    });

    it("reset() で登録されたリスナーがすべてクリアされること", () => {
      let count = 0;
      bridge.addDomCapturedListener(() => {
        count++;
      });

      bridge.emitDomCaptured();
      expect(count).toBe(1);

      bridge.reset();
      bridge.emitDomCaptured();
      expect(count).toBe(1); // リセット後は発火しない
    });
  });
});

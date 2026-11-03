import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MockVolumeKeyBridge } from "./mockVolumeKeyBridge";

describe("MockVolumeKeyBridge", () => {
  let bridge: MockVolumeKeyBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    bridge = new MockVolumeKeyBridge();
  });

  afterEach(() => {
    bridge.destroy();
  });

  describe("リスナー管理と有効化制御", () => {
    it("初期状態では volumeKeyPagingEnabled が false であること", () => {
      expect(bridge.isVolumeKeyPagingEnabled()).toBe(false);
    });

    it("setVolumeKeyPagingEnabled で有効/無効を切り替えられること", async () => {
      await bridge.setVolumeKeyPagingEnabled(true);
      expect(bridge.isVolumeKeyPagingEnabled()).toBe(true);

      await bridge.setVolumeKeyPagingEnabled(false);
      expect(bridge.isVolumeKeyPagingEnabled()).toBe(false);
    });

    it("無効状態では triggerVolumeKey を呼び出してもリスナーが発火しないこと", () => {
      const listener = vi.fn();
      bridge.addVolumeKeyListener(listener);

      bridge.triggerVolumeKey("down");
      bridge.triggerVolumeKey("up");

      expect(listener).not.toHaveBeenCalled();
    });

    it("有効状態では triggerVolumeKey で direction に応じたイベントが発火すること", async () => {
      await bridge.setVolumeKeyPagingEnabled(true);
      const listener = vi.fn();
      bridge.addVolumeKeyListener(listener);

      bridge.triggerVolumeKey("down");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenLastCalledWith({ direction: "down" });

      bridge.triggerVolumeKey("up");
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith({ direction: "up" });
    });

    it("force: true オプションを指定した場合は無効状態でもリスナーが発火すること", () => {
      expect(bridge.isVolumeKeyPagingEnabled()).toBe(false);
      const listener = vi.fn();
      bridge.addVolumeKeyListener(listener);

      bridge.triggerVolumeKey("down", { force: true });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenLastCalledWith({ direction: "down" });

      bridge.triggerVolumeKey("up", { force: true });
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith({ direction: "up" });
    });

    it("リスナー解除関数を呼び出すと登録が解除され、重複呼び出しも安全であること", async () => {
      await bridge.setVolumeKeyPagingEnabled(true);
      const listener = vi.fn();
      const unsubscribe = bridge.addVolumeKeyListener(listener);

      bridge.triggerVolumeKey("down");
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      bridge.triggerVolumeKey("down");
      expect(listener).toHaveBeenCalledTimes(1);

      // 2回目の解除呼び出しも例外なく安全に no-op となること
      expect(() => unsubscribe()).not.toThrow();
    });

    it("複数のリスナーが登録された場合にすべて順次呼び出されること", async () => {
      await bridge.setVolumeKeyPagingEnabled(true);
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      expect(bridge.getListenerCount()).toBe(0);
      bridge.addVolumeKeyListener(listener1);
      bridge.addVolumeKeyListener(listener2);
      expect(bridge.getListenerCount()).toBe(2);

      bridge.triggerVolumeKey("up");
      expect(listener1).toHaveBeenCalledWith({ direction: "up" });
      expect(listener2).toHaveBeenCalledWith({ direction: "up" });
    });

    it("非同期リスナー（Promise を返すリスナー）が安全に実行されること", async () => {
      await bridge.setVolumeKeyPagingEnabled(true);
      let executed = false;
      const asyncListener = vi.fn(async () => {
        await Promise.resolve();
        executed = true;
      });

      bridge.addVolumeKeyListener(asyncListener);
      bridge.triggerVolumeKey("down");

      expect(asyncListener).toHaveBeenCalledTimes(1);
      await Promise.resolve();
      expect(executed).toBe(true);
    });
  });

  describe("キーボードイベント連携（Web / テスト利便性）", () => {
    it("AudioVolumeDown および VolumeDown キー押下で down イベントが発火すること", async () => {
      await bridge.setVolumeKeyPagingEnabled(true);
      const listener = vi.fn();
      bridge.addVolumeKeyListener(listener);

      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "AudioVolumeDown" }),
      );
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenLastCalledWith({ direction: "down" });

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "VolumeDown" }));
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith({ direction: "down" });
    });

    it("AudioVolumeUp および VolumeUp キー押下で up イベントが発火すること", async () => {
      await bridge.setVolumeKeyPagingEnabled(true);
      const listener = vi.fn();
      bridge.addVolumeKeyListener(listener);

      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "AudioVolumeUp" }),
      );
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenLastCalledWith({ direction: "up" });

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "VolumeUp" }));
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith({ direction: "up" });
    });

    it("無効状態では音量キーイベントが発火しないこと", () => {
      expect(bridge.isVolumeKeyPagingEnabled()).toBe(false);
      const listener = vi.fn();
      bridge.addVolumeKeyListener(listener);

      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "AudioVolumeDown" }),
      );
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "VolumeUp" }));
      expect(listener).not.toHaveBeenCalled();
    });

    it("音量キー以外のキー押下（ArrowDown / Enter 等）ではイベントが発火しないこと", async () => {
      await bridge.setVolumeKeyPagingEnabled(true);
      const listener = vi.fn();
      bridge.addVolumeKeyListener(listener);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
      expect(listener).not.toHaveBeenCalled();
    });

    it("destroy を呼び出すと window のキーリスナーが解除され発火しなくなること", async () => {
      await bridge.setVolumeKeyPagingEnabled(true);
      const listener = vi.fn();
      bridge.addVolumeKeyListener(listener);

      bridge.destroy();

      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "AudioVolumeDown" }),
      );
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("状態リセットとクリーンアップ", () => {
    it("reset でリスナーと有効化状態がリセットされること", async () => {
      await bridge.setVolumeKeyPagingEnabled(true);
      const listener = vi.fn();
      bridge.addVolumeKeyListener(listener);

      bridge.reset();

      expect(bridge.isVolumeKeyPagingEnabled()).toBe(false);
      bridge.triggerVolumeKey("down", { force: true });
      expect(listener).not.toHaveBeenCalled();
    });

    it("window.__yommyVolumeKeyBridge にインスタンスが公開されること", () => {
      expect(
        (window as unknown as { __yommyVolumeKeyBridge?: MockVolumeKeyBridge })
          .__yommyVolumeKeyBridge,
      ).toBe(bridge);
    });

    it("window が存在しない環境（SSR）でも例外なく初期化および destroy できること", () => {
      vi.stubGlobal("window", undefined);
      try {
        const ssrBridge = new MockVolumeKeyBridge();
        expect(ssrBridge.isVolumeKeyPagingEnabled()).toBe(false);
        expect(() => ssrBridge.destroy()).not.toThrow();
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});

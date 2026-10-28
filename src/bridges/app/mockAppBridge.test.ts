import { describe, it, expect, vi } from "vitest";
import { MockAppBridge } from "./mockAppBridge";

describe("MockAppBridge", () => {
  it("リスナーを登録し、triggerBackButton でイベントが配信されること", async () => {
    const bridge = new MockAppBridge();
    const listener = vi.fn();

    bridge.addBackButtonListener(listener);
    await bridge.triggerBackButton(true);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ canGoBack: true });
  });

  it("canGoBack を省略した場合はデフォルトで false が渡されること", async () => {
    const bridge = new MockAppBridge();
    const listener = vi.fn();

    bridge.addBackButtonListener(listener);
    await bridge.triggerBackButton();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ canGoBack: false });
  });

  it("解除関数を呼び出すとリスナーが解除され、以降イベントが配信されないこと", async () => {
    const bridge = new MockAppBridge();
    const listener = vi.fn();

    const unsubscribe = bridge.addBackButtonListener(listener);
    await bridge.triggerBackButton();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await bridge.triggerBackButton();
    expect(listener).toHaveBeenCalledTimes(1);

    // 2回目の解除関数呼び出しが安全に行われること
    unsubscribe();
  });

  it("複数のリスナーが登録された場合、すべてのリスナーが順番に呼び出されること", async () => {
    const bridge = new MockAppBridge();
    const calls: string[] = [];

    const listener1 = vi.fn(() => {
      calls.push("first");
    });
    const listener2 = vi.fn(async () => {
      calls.push("second");
    });

    bridge.addBackButtonListener(listener1);
    bridge.addBackButtonListener(listener2);

    await bridge.triggerBackButton(true);

    expect(calls).toEqual(["first", "second"]);
  });

  it("exitApp を呼び出すと exitAppCalled フラグが true に設定されること", async () => {
    const bridge = new MockAppBridge();
    expect(bridge.exitAppCalled).toBe(false);

    await bridge.exitApp();
    expect(bridge.exitAppCalled).toBe(true);
  });

  it("reset を呼び出すと exitAppCalled フラグと登録リスナーが初期化されること", async () => {
    const bridge = new MockAppBridge();
    const listener = vi.fn();

    bridge.addBackButtonListener(listener);
    await bridge.exitApp();
    expect(bridge.exitAppCalled).toBe(true);

    bridge.reset();
    expect(bridge.exitAppCalled).toBe(false);

    await bridge.triggerBackButton();
    expect(listener).not.toHaveBeenCalled();
  });
});

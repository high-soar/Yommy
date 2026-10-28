import { describe, it, expect, vi, beforeEach } from "vitest";
import { App } from "@capacitor/app";
import { CapacitorAppBridge } from "./capacitorAppBridge";

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(),
    exitApp: vi.fn(),
  },
}));

describe("CapacitorAppBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("addBackButtonListener で App.addListener('backButton', ...) が登録されること", async () => {
    const mockRemove = vi.fn().mockResolvedValue(undefined);
    vi.mocked(App.addListener).mockResolvedValue({
      remove: mockRemove,
    });

    const bridge = new CapacitorAppBridge();
    const listener = vi.fn();

    const unsubscribe = bridge.addBackButtonListener(listener);

    expect(App.addListener).toHaveBeenCalledTimes(1);
    expect(App.addListener).toHaveBeenCalledWith("backButton", listener);

    // 解除関数の呼び出し検証
    unsubscribe();
    // 非同期解除を待つ
    await Promise.resolve();

    expect(mockRemove).toHaveBeenCalledTimes(1);

    // 2回目の解除呼び出しで重複して remove が呼ばれないこと
    unsubscribe();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it("exitApp で App.exitApp() が呼び出されること", async () => {
    vi.mocked(App.exitApp).mockResolvedValue(undefined);

    const bridge = new CapacitorAppBridge();
    await bridge.exitApp();

    expect(App.exitApp).toHaveBeenCalledTimes(1);
  });
});

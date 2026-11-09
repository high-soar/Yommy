import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CapacitorVolumeKeyBridge,
  VolumeKeyNative,
} from "./capacitorVolumeKeyBridge";

vi.mock("@capacitor/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@capacitor/core")>();
  const mockPlugin = {
    setVolumeKeyPagingEnabled: vi.fn(),
    addListener: vi.fn(),
  };
  return {
    ...actual,
    registerPlugin: vi.fn(() => mockPlugin),
  };
});

describe("CapacitorVolumeKeyBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("setVolumeKeyPagingEnabled(true) でネイティブプラグインに { enabled: true } が渡されること", async () => {
    vi.mocked(VolumeKeyNative.setVolumeKeyPagingEnabled).mockResolvedValue(
      undefined,
    );

    const bridge = new CapacitorVolumeKeyBridge();
    await bridge.setVolumeKeyPagingEnabled(true);

    expect(VolumeKeyNative.setVolumeKeyPagingEnabled).toHaveBeenCalledTimes(1);
    expect(VolumeKeyNative.setVolumeKeyPagingEnabled).toHaveBeenCalledWith({
      enabled: true,
    });
  });

  it("setVolumeKeyPagingEnabled(false) でネイティブプラグインに { enabled: false } が渡されること", async () => {
    vi.mocked(VolumeKeyNative.setVolumeKeyPagingEnabled).mockResolvedValue(
      undefined,
    );

    const bridge = new CapacitorVolumeKeyBridge();
    await bridge.setVolumeKeyPagingEnabled(false);

    expect(VolumeKeyNative.setVolumeKeyPagingEnabled).toHaveBeenCalledTimes(1);
    expect(VolumeKeyNative.setVolumeKeyPagingEnabled).toHaveBeenCalledWith({
      enabled: false,
    });
  });

  it("addVolumeKeyListener で VolumeKeyNative.addListener('volumeKeyEvent', ...) が登録され解除できること", async () => {
    const mockRemove = vi.fn().mockResolvedValue(undefined);
    vi.mocked(VolumeKeyNative.addListener).mockResolvedValue({
      remove: mockRemove,
    });

    const bridge = new CapacitorVolumeKeyBridge();
    const listener = vi.fn();

    const unsubscribe = bridge.addVolumeKeyListener(listener);

    expect(VolumeKeyNative.addListener).toHaveBeenCalledTimes(1);
    expect(VolumeKeyNative.addListener).toHaveBeenCalledWith(
      "volumeKeyEvent",
      listener,
    );

    // 解除関数の呼び出し検証
    unsubscribe();
    await Promise.resolve();

    expect(mockRemove).toHaveBeenCalledTimes(1);

    // 2回目の解除呼び出しで重複して remove が呼ばれないこと
    unsubscribe();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it("addListener や remove が例外を reject した場合でも unhandled rejection にならず安全に catch されること (R1-45)", async () => {
    const mockRemove = vi
      .fn()
      .mockRejectedValue(new Error("Native remove error"));
    vi.mocked(VolumeKeyNative.addListener).mockResolvedValue({
      remove: mockRemove,
    });

    const bridge = new CapacitorVolumeKeyBridge();
    const unsubscribe = bridge.addVolumeKeyListener(vi.fn());

    expect(() => unsubscribe()).not.toThrow();
    await Promise.resolve();

    // addListener 自体が reject する場合
    vi.mocked(VolumeKeyNative.addListener).mockRejectedValue(
      new Error("Native addListener error"),
    );
    expect(() => bridge.addVolumeKeyListener(vi.fn())).not.toThrow();
    await Promise.resolve();
  });
});

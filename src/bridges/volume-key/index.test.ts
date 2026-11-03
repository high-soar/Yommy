import { describe, it, expect } from "vitest";
import * as volumeKeyBridge from "./index";

describe("bridges/volume-key/index", () => {
  it("CapacitorVolumeKeyBridge、MockVolumeKeyBridge、VolumeKeyNative が正しくエクスポートされていること", () => {
    expect(volumeKeyBridge.CapacitorVolumeKeyBridge).toBeDefined();
    expect(volumeKeyBridge.MockVolumeKeyBridge).toBeDefined();
    expect(volumeKeyBridge.VolumeKeyNative).toBeDefined();
  });
});

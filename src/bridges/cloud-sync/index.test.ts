import { describe, it, expect } from "vitest";
import * as cloudSyncBridge from "./index";

describe("bridges/cloud-sync/index", () => {
  it("CapacitorCloudSyncBridge および MockCloudSyncBridge が正しくエクスポートされていること", () => {
    expect(cloudSyncBridge.CapacitorCloudSyncBridge).toBeDefined();
    expect(cloudSyncBridge.MockCloudSyncBridge).toBeDefined();
    expect(cloudSyncBridge.CloudSyncNative).toBeDefined();
  });
});

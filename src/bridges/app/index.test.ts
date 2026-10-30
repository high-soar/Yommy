import { describe, it, expect } from "vitest";
import * as appBridge from "./index";

describe("bridges/app/index", () => {
  it("CapacitorAppBridge および MockAppBridge が正しくエクスポートされていること", () => {
    expect(appBridge.CapacitorAppBridge).toBeDefined();
    expect(appBridge.MockAppBridge).toBeDefined();
  });
});

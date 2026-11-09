import { describe, it, expect } from "vitest";
import packageJson from "../../../package.json";
import { APP_NAME, APP_VERSION } from "./app";

describe("app constants", () => {
  it("APP_NAME が 'Yommy' であること", () => {
    expect(APP_NAME).toBe("Yommy");
  });

  it("APP_VERSION が package.json の version と完全一致すること (AC-APK-02)", () => {
    expect(APP_VERSION).toBe(packageJson.version);
    expect(APP_VERSION).toBe("1.0.0");
  });
});

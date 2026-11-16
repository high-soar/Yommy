import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import packageJson from "../../../package.json";
import { APP_NAME, APP_VERSION } from "./app";

describe("app constants", () => {
  it("APP_NAME が 'Yommy' であること", () => {
    expect(APP_NAME).toBe("Yommy");
  });

  it("APP_VERSION が package.json の version と完全一致し SemVer 3桁形式であること (AC-APK-02)", () => {
    expect(APP_VERSION).toBe(packageJson.version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("package.json の MAJOR.MINOR が docs/quality/reports/ 内の最新完了マイルストーン番号と一致すること (AC-APK-02)", () => {
    const reportsDir = resolve(process.cwd(), "docs/quality/reports");
    const milestoneReports = readdirSync(reportsDir)
      .map((file) => {
        const match = file.match(/^v(\d+)\.(\d+)-.*\.md$/);
        if (!match) return null;
        return {
          file,
          major: Number(match[1]),
          minor: Number(match[2]),
        };
      })
      .filter(
        (entry): entry is { file: string; major: number; minor: number } =>
          entry !== null,
      )
      .sort((a, b) => a.major - b.major || a.minor - b.minor);

    expect(milestoneReports.length).toBeGreaterThan(0);
    const latest = milestoneReports[milestoneReports.length - 1];
    const [pkgMajor, pkgMinor] = packageJson.version.split(".").map(Number);

    expect(`${pkgMajor}.${pkgMinor}`).toBe(`${latest.major}.${latest.minor}`);
  });
});

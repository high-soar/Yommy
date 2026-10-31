import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

describe("Android ビルド設定および署名・バージョン管理検証 (AC-APK-01, AC-APK-02)", () => {
  const rootDir = process.cwd();
  const keystorePath = path.resolve(rootDir, "android/debug.keystore");
  const buildGradlePath = path.resolve(rootDir, "android/app/build.gradle");
  const workflowPath = path.resolve(
    rootDir,
    ".github/workflows/build-android.yml",
  );

  describe("固定 Debug Keystore の配置検証 (AC-APK-01)", () => {
    it("android/debug.keystore が存在し、ファイルサイズが正であること", () => {
      expect(fs.existsSync(keystorePath)).toBe(true);
      const stat = fs.statSync(keystorePath);
      expect(stat.size).toBeGreaterThan(0);
    });

    it("openssl が利用可能な場合、キーストアのエイリアスとパスワードが正常に読めること", () => {
      let opensslAvailable = false;
      try {
        execSync("which openssl", { stdio: "ignore" });
        opensslAvailable = true;
      } catch {
        opensslAvailable = false;
      }

      if (opensslAvailable) {
        const output = execSync(
          `openssl pkcs12 -info -in "${keystorePath}" -nodes -passin pass:android`,
          { encoding: "utf-8" },
        );
        expect(output).toContain("friendlyName: androiddebugkey");
        expect(output).toContain("CN=Android Debug");
      }
    });
  });

  describe("android/app/build.gradle 署名構成検証 (AC-APK-01)", () => {
    it("signingConfigs.debug に固定キーストアとパスワードが設定されていること", () => {
      const content = fs.readFileSync(buildGradlePath, "utf-8");

      expect(content).toMatch(/signingConfigs\s*\{[\s\S]*?debug\s*\{/);
      expect(content).toMatch(
        /storeFile\s+file\(['"]\.\.\/debug\.keystore['"]\)/,
      );
      expect(content).toMatch(/storePassword\s+['"]android['"]/);
      expect(content).toMatch(/keyAlias\s+['"]androiddebugkey['"]/);
      expect(content).toMatch(/keyPassword\s+['"]android['"]/);
    });

    it("buildTypes.debug に signingConfigs.debug が適用されていること", () => {
      const content = fs.readFileSync(buildGradlePath, "utf-8");

      expect(content).toMatch(
        /buildTypes\s*\{[\s\S]*?debug\s*\{[\s\S]*?signingConfig\s+signingConfigs\.debug/,
      );
    });

    it("CI署名設定として ANDROID_KEYSTORE_BASE64 が存在する場合のデコードと未設定時フォールバック構成が含まれること (AC-APK-03)", () => {
      const content = fs.readFileSync(buildGradlePath, "utf-8");

      expect(content).toMatch(/ANDROID_KEYSTORE_BASE64/);
      expect(content).toMatch(/decodeBase64\(\)/);
      expect(content).toMatch(/signingConfigs\s*\{[\s\S]*?release\s*\{/);
    });

    it("dependencies に Google Play Services Auth が定義されていること (AC-AUTH-01)", () => {
      const content = fs.readFileSync(buildGradlePath, "utf-8");

      expect(content).toMatch(
        /implementation\s+['"]com\.google\.android\.gms:play-services-auth:21\.3\.0['"]/,
      );
    });
  });

  describe("android/app/build.gradle バージョン解決検証 (AC-APK-02)", () => {
    it("versionCode が BUILD_NUMBER および versionCode プロパティから動的に解決されていること", () => {
      const content = fs.readFileSync(buildGradlePath, "utf-8");

      expect(content).toMatch(
        /def\s+appVersionCode\s*=\s*Integer\.parseInt\(System\.getenv\(["']BUILD_NUMBER["']\)\s*\?:\s*\(project\.findProperty\(["']versionCode["']\)\s*\?:\s*["']1["']\)\)/,
      );
      expect(content).toMatch(/versionCode\s+appVersionCode/);
    });

    it("versionName が BUILD_NAME および versionName プロパティから動的に解決されていること", () => {
      const content = fs.readFileSync(buildGradlePath, "utf-8");

      expect(content).toMatch(
        /def\s+appVersionName\s*=\s*System\.getenv\(["']BUILD_NAME["']\)\s*\?:\s*\(project\.findProperty\(["']versionName["']\)\s*\?:\s*["']0\.3\.0["']\)/,
      );
      expect(content).toMatch(/versionName\s+appVersionName/);
    });
  });

  describe("CI ワークフロー設定検証 (AC-APK-02)", () => {
    it("build-android.yml の Build Android Debug APK ステップに BUILD_NUMBER が注入されていること", () => {
      const content = fs.readFileSync(workflowPath, "utf-8");

      expect(content).toMatch(
        /name:\s*Build Android Debug APK[\s\S]*?env:\s*[\s\S]*?BUILD_NUMBER:\s*\$\{\{\s*github\.run_number\s*\}\}/,
      );
    });
  });
});

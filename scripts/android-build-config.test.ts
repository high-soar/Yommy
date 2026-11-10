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
    let opensslAvailable = false;
    try {
      execSync("which openssl", { stdio: "ignore" });
      opensslAvailable = true;
    } catch {
      opensslAvailable = false;
    }

    it("android/debug.keystore が存在し、ファイルサイズが正であること", () => {
      expect(fs.existsSync(keystorePath)).toBe(true);
      const stat = fs.statSync(keystorePath);
      expect(stat.size).toBeGreaterThan(0);
    });

    it.skipIf(!opensslAvailable)(
      "openssl が利用可能な場合、キーストアのエイリアスとパスワードが正常に読めること",
      () => {
        const output = execSync(
          `openssl pkcs12 -info -in "${keystorePath}" -nodes -passin pass:android`,
          { encoding: "utf-8" },
        );
        expect(output).toContain("friendlyName: androiddebugkey");
        expect(output).toContain("CN=Android Debug");
      },
    );
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
        /implementation\s+['"]com\.google\.android\.gms:play-services-auth:21\.4\.0['"]/,
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
        /def\s+appVersionName\s*=\s*System\.getenv\(["']BUILD_NAME["']\)\s*\?:\s*\(project\.findProperty\(["']versionName["']\)\s*\?:\s*["']1\.0\.0["']\)/,
      );
      expect(content).toMatch(/versionName\s+appVersionName/);
    });
  });

  describe("CI ワークフロー設定検証 (AC-APK-02, R1-04, R1-20)", () => {
    const ciWorkflowPath = path.resolve(rootDir, ".github/workflows/ci.yml");

    it("build-android.yml の Build Android Debug APK ステップに BUILD_NUMBER が注入されていること", () => {
      const content = fs.readFileSync(workflowPath, "utf-8");

      expect(content).toMatch(
        /name:\s*Build Android Debug APK[\s\S]*?env:\s*[\s\S]*?BUILD_NUMBER:\s*\$\{\{\s*github\.run_number\s*\}\}/,
      );
    });

    it("build-android.yml の Build Android Debug APK ステップに Keystore Secrets が注入されていること (R1-04)", () => {
      const content = fs.readFileSync(workflowPath, "utf-8");

      expect(content).toMatch(
        /ANDROID_KEYSTORE_BASE64:\s*\$\{\{\s*secrets\.ANDROID_KEYSTORE_BASE64\s*\}\}/,
      );
      expect(content).toMatch(
        /ANDROID_KEYSTORE_PASSWORD:\s*\$\{\{\s*secrets\.ANDROID_KEYSTORE_PASSWORD\s*\}\}/,
      );
      expect(content).toMatch(
        /ANDROID_KEY_ALIAS:\s*\$\{\{\s*secrets\.ANDROID_KEY_ALIAS\s*\}\}/,
      );
      expect(content).toMatch(
        /ANDROID_KEY_PASSWORD:\s*\$\{\{\s*secrets\.ANDROID_KEY_PASSWORD\s*\}\}/,
      );
    });

    it("ci.yml に Android Java コンパイル検査ジョブが存在し quality-gate に含まれていること (R1-20)", () => {
      const content = fs.readFileSync(ciWorkflowPath, "utf-8");

      expect(content).toMatch(/compileDebugJavaWithJavac/);
      expect(content).toMatch(/needs:\s*\[[\s\S]*?android-compile[\s\S]*?\]/);
    });
  });

  describe("CloudSyncPlugin.java 認可フローおよび契約検証 (AC-AUTH-02)", () => {
    const pluginPath = path.resolve(
      rootDir,
      "android/app/src/main/java/com/yommy/app/CloudSyncPlugin.java",
    );

    it("CloudSyncPlugin.java が存在すること", () => {
      expect(fs.existsSync(pluginPath)).toBe(true);
    });

    it("ActivityResultContracts.StartIntentSenderForResult を load() 内で登録していること", () => {
      const content = fs.readFileSync(pluginPath, "utf-8");

      expect(content).toMatch(/public\s+void\s+load\(\)/);
      expect(content).toMatch(
        /registerForActivityResult\(\s*new\s+ActivityResultContracts\.StartIntentSenderForResult\(\)/,
      );
      expect(content).toMatch(/ActivityResultLauncher<IntentSenderRequest>/);
    });

    it("result.hasResolution 時に IntentSenderRequest を構築して launch していること", () => {
      const content = fs.readFileSync(pluginPath, "utf-8");

      expect(content).toMatch(
        /new\s+IntentSenderRequest\.Builder\(result\.getPendingIntent\(\)\)\.build\(\)/,
      );
      expect(content).toMatch(/authLauncher\.launch\(/);
      expect(content).not.toMatch(
        /startActivityForResult\(\s*call,\s*result\.getPendingIntent\(\)\.getIntentSender\(\)/,
      );
    });

    it("GoogleSignInAccount からメールアドレスを取得・設定するロジックが存在すること", () => {
      const content = fs.readFileSync(pluginPath, "utf-8");

      expect(content).toMatch(/toGoogleSignInAccount\(\)/);
      expect(content).toMatch(/getEmail\(\)/);
    });

    it("マルチスレッド共有変数（currentAccessToken, currentUserEmail）に volatile が付与されていること (R1-25)", () => {
      const content = fs.readFileSync(pluginPath, "utf-8");

      expect(content).toMatch(
        /private\s+volatile\s+String\s+currentAccessToken/,
      );
      expect(content).toMatch(/private\s+volatile\s+String\s+currentUserEmail/);
    });

    it("SharedPreferences により連携状態（is_cloud_sync_enabled / cloud_sync_email）を永続化していること (R1-03)", () => {
      const content = fs.readFileSync(pluginPath, "utf-8");

      expect(content).toMatch(/getSharedPreferences\(/);
      expect(content).toMatch(/is_cloud_sync_enabled/);
      expect(content).toMatch(/cloud_sync_email/);
    });

    it("getAuthState() においてサイレント再認可によるセッション復元を行うロジックが存在すること (R1-01)", () => {
      const content = fs.readFileSync(pluginPath, "utf-8");

      expect(content).toMatch(
        /public\s+void\s+getAuthState\s*\(\s*PluginCall\s+call\s*\)[\s\S]*?authorize\(/,
      );
    });

    it("トークン失効（401）時の自動リフレッシュ・サイレント再取得ロジックが存在すること (R1-02)", () => {
      const content = fs.readFileSync(pluginPath, "utf-8");

      expect(content).toMatch(
        /private\s+String\s+refreshAccessToken\s*\(\s*\)/,
      );
      expect(content).toMatch(/private\s+String\s+getOrRefreshToken\s*\(\s*\)/);
      // pullFile 内で findSyncFileId 呼び出し時およびダウンロード時に 401 検知で refreshAccessToken されること
      expect(content).toMatch(
        /pullFile[\s\S]*?findSyncFileId[\s\S]*?refreshAccessToken[\s\S]*?downloadUrl/,
      );
      // pushFile 内で findSyncFileId 呼び出し時およびアップロード時に 401 検知で refreshAccessToken されること
      expect(content).toMatch(
        /pushFile[\s\S]*?findSyncFileId[\s\S]*?refreshAccessToken[\s\S]*?uploadPatch/,
      );
    });

    it("Activity 再生成耐性のために saveCall / getSavedCall / freeSavedCall を利用していること (R1-37)", () => {
      const content = fs.readFileSync(pluginPath, "utf-8");

      expect(content).toMatch(/saveCall\s*\(\s*call\s*\)/);
      expect(content).toMatch(/getSavedCall\s*\(\s*\)/);
      expect(content).toMatch(/freeSavedCall\s*\(\s*\)/);
    });

    it("handleOnDestroy() において executor.shutdownNow() が実装されていること (R1-38)", () => {
      const content = fs.readFileSync(pluginPath, "utf-8");

      expect(content).toMatch(
        /protected\s+void\s+handleOnDestroy\s*\(\s*\)[\s\S]*?executor\.shutdownNow\(\)/,
      );
    });

    it("新規ファイル作成時に multipart/related（uploadType=multipart）で送信していること (R1-06)", () => {
      const content = fs.readFileSync(pluginPath, "utf-8");

      expect(content).toMatch(/uploadType=multipart/);
      expect(content).toMatch(/multipart\/related/);
    });

    it("signOut() 実行時にワーカースレッド内で clearCachedToken を呼び出してローカルキャッシュトークンを破棄していること (R2-20)", () => {
      const content = fs.readFileSync(pluginPath, "utf-8");

      expect(content).toMatch(
        /public\s+void\s+signOut\s*\(\s*PluginCall\s+call\s*\)[\s\S]*?executor\.execute\s*\(\s*\(\)\s*->\s*\{[\s\S]*?clearCachedToken\s*\(\s*token\s*\)/,
      );
    });
  });

  describe("VolumeKeyPlugin.java および MainActivity.java 音量キー連携検証 (AC-RD-26, Issue #203)", () => {
    const volumeKeyPluginPath = path.resolve(
      rootDir,
      "android/app/src/main/java/com/yommy/app/VolumeKeyPlugin.java",
    );
    const mainActivityPath = path.resolve(
      rootDir,
      "android/app/src/main/java/com/yommy/app/MainActivity.java",
    );

    it('VolumeKeyPlugin.java が存在し、@CapacitorPlugin(name = "VolumeKey") が定義されていること', () => {
      expect(fs.existsSync(volumeKeyPluginPath)).toBe(true);
      const content = fs.readFileSync(volumeKeyPluginPath, "utf-8");

      expect(content).toMatch(
        /@CapacitorPlugin\s*\(\s*name\s*=\s*"VolumeKey"\s*\)/,
      );
    });

    it("VolumeKeyPlugin.java が volatile volumeKeyPagingEnabled を持ち、load() と handleOnDestroy() の双方で false に初期化していること (R1-03)", () => {
      const content = fs.readFileSync(volumeKeyPluginPath, "utf-8");

      expect(content).toMatch(
        /private\s+static\s+volatile\s+boolean\s+volumeKeyPagingEnabled\s*=\s*false\s*;/,
      );
      expect(content).toMatch(
        /public\s+void\s+load\s*\(\s*\)\s*\{[\s\S]*?volumeKeyPagingEnabled\s*=\s*false\s*;/,
      );
      expect(content).toMatch(
        /protected\s+void\s+handleOnDestroy\s*\(\s*\)\s*\{[\s\S]*?volumeKeyPagingEnabled\s*=\s*false\s*;/,
      );
    });

    it("MainActivity.java の onCreate 内で registerPlugin(VolumeKeyPlugin.class) が登録されていること", () => {
      expect(fs.existsSync(mainActivityPath)).toBe(true);
      const content = fs.readFileSync(mainActivityPath, "utf-8");

      expect(content).toMatch(
        /onCreate\s*\([\s\S]*?registerPlugin\s*\(\s*VolumeKeyPlugin\.class\s*\)/,
      );
    });

    it("MainActivity.java の dispatchKeyEvent で音量キーと VolumeKeyPlugin.isVolumeKeyPagingEnabled()、getRepeatCount() == 0 を判定していること", () => {
      const content = fs.readFileSync(mainActivityPath, "utf-8");

      expect(content).toMatch(
        /public\s+boolean\s+dispatchKeyEvent\s*\(\s*KeyEvent\s+event\s*\)/,
      );
      expect(content).toMatch(/KeyEvent\.KEYCODE_VOLUME_DOWN/);
      expect(content).toMatch(/KeyEvent\.KEYCODE_VOLUME_UP/);
      expect(content).toMatch(/VolumeKeyPlugin\.isVolumeKeyPagingEnabled\(\)/);
      expect(content).toMatch(/KeyEvent\.ACTION_DOWN/);
      expect(content).toMatch(/event\.getRepeatCount\(\)\s*==\s*0/);
    });
  });

  describe("WebViewDomPlugin.java および MainActivity.java 内蔵ブラウザ・DOMキャプチャ連携検証 (AC-WV-03, Issue #269)", () => {
    const webViewDomPluginPath = path.resolve(
      rootDir,
      "android/app/src/main/java/com/yommy/app/WebViewDomPlugin.java",
    );
    const mainActivityPath = path.resolve(
      rootDir,
      "android/app/src/main/java/com/yommy/app/MainActivity.java",
    );

    it('WebViewDomPlugin.java が存在し、@CapacitorPlugin(name = "WebViewDom") が定義されていること', () => {
      expect(fs.existsSync(webViewDomPluginPath)).toBe(true);
      const content = fs.readFileSync(webViewDomPluginPath, "utf-8");

      expect(content).toMatch(
        /@CapacitorPlugin\s*\(\s*name\s*=\s*"WebViewDom"\s*\)/,
      );
    });

    it("WebViewDomPlugin.java の load() および handleOnDestroy() でリソース解放・クリーンアップが行われていること", () => {
      const content = fs.readFileSync(webViewDomPluginPath, "utf-8");

      expect(content).toMatch(/public\s+void\s+load\s*\(\s*\)/);
      expect(content).toMatch(/protected\s+void\s+handleOnDestroy\s*\(\s*\)/);
      expect(content).toMatch(/webView\.destroy\(\)/);
    });

    it("MainActivity.java の onCreate 内で registerPlugin(WebViewDomPlugin.class) が登録されていること", () => {
      expect(fs.existsSync(mainActivityPath)).toBe(true);
      const content = fs.readFileSync(mainActivityPath, "utf-8");

      expect(content).toMatch(
        /onCreate\s*\([\s\S]*?registerPlugin\s*\(\s*WebViewDomPlugin\.class\s*\)/,
      );
    });

    it("WebViewDomPlugin.java の open メソッドで危険なスキーム（javascript:, data:, file:, intent: 等）を遮断していること", () => {
      const content = fs.readFileSync(webViewDomPluginPath, "utf-8");

      expect(content).toMatch(
        /public\s+void\s+open\s*\(\s*PluginCall\s+call\s*\)/,
      );
      expect(content).toMatch(/shouldOverrideUrlLoading/);
    });

    it("WebViewDomPlugin.java の captureDom メソッドで evaluateJavascript を実行して outerHTML を抽出していること", () => {
      const content = fs.readFileSync(webViewDomPluginPath, "utf-8");

      expect(content).toMatch(
        /public\s+void\s+captureDom\s*\(\s*PluginCall\s+call\s*\)/,
      );
      expect(content).toMatch(/evaluateJavascript/);
      expect(content).toMatch(/document\.documentElement\.outerHTML/);
    });

    it("shouldOverrideUrlLoading で request == null || request.getUrl() == null を安全に遮断していること (R1-41)", () => {
      const content = fs.readFileSync(webViewDomPluginPath, "utf-8");

      expect(content).toMatch(
        /request\s*==\s*null\s*\|\|\s*request\.getUrl\(\)\s*==\s*null/,
      );
    });

    it("evaluateJavascript のコールバック内で webView == null の NPE 防止ガードが存在すること (R1-22)", () => {
      const content = fs.readFileSync(webViewDomPluginPath, "utf-8");

      expect(content).toMatch(
        /evaluateJavascript\([\s\S]*?if\s*\(\s*webView\s*==\s*null\s*\)/,
      );
    });

    it("captureDom で webView が null の場合でもキャッシュから安全に復元するガードが存在すること (R1-41)", () => {
      const content = fs.readFileSync(webViewDomPluginPath, "utf-8");

      expect(content).toMatch(/lastCapturedHtml/);
    });

    it("WebViewDomPlugin.java の isAllowedScheme メソッドで https スキームのみを許可していること (R2-08)", () => {
      const content = fs.readFileSync(webViewDomPluginPath, "utf-8");

      expect(content).toMatch(
        /private\s+boolean\s+isAllowedScheme\s*\(\s*String\s+scheme\s*\)\s*\{[\s\S]*?return\s+["']https["']\.equalsIgnoreCase\s*\(\s*scheme\s*\)\s*;/,
      );
      expect(content).toMatch(/!isAllowedScheme\s*\(\s*scheme\s*\)/);
    });

    it("WebViewDomPlugin.java の close() で dismissAndDestroyDialog() を呼び出し、WebView 本体と直近 DOM キャッシュを確実に破棄していること (R2-18)", () => {
      const content = fs.readFileSync(webViewDomPluginPath, "utf-8");

      expect(content).toMatch(
        /public\s+void\s+close\s*\(\s*PluginCall\s+call\s*\)[\s\S]*?dismissAndDestroyDialog\s*\(\s*\)/,
      );
      expect(content).toMatch(
        /private\s+void\s+dismissAndDestroyDialog\s*\(\s*\)[\s\S]*?lastCapturedHtml\s*=\s*""\s*;[\s\S]*?lastCapturedUrl\s*=\s*""\s*;[\s\S]*?lastCapturedTitle\s*=\s*""\s*;/,
      );
    });
  });
});

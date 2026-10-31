import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MockCloudSyncBridge,
  MOCK_GDRIVE_FILE_STORAGE_KEY,
  MOCK_GDRIVE_AUTH_STORAGE_KEY,
  MOCK_GDRIVE_401_STORAGE_KEY,
} from "./mockCloudSyncBridge";

describe("MockCloudSyncBridge", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("初期状態では unlinked であり、pullFile は null を返すこと", async () => {
    const bridge = new MockCloudSyncBridge({ storage: localStorage });
    const state = await bridge.getAuthState();
    expect(state).toEqual({ status: "unlinked" });
    expect(await bridge.pullFile()).toBeNull();
  });

  it("window が未定義の環境では storage が null にフォールバックすること", async () => {
    vi.stubGlobal("window", undefined);
    try {
      const bridge = new MockCloudSyncBridge();
      expect(await bridge.getAuthState()).toEqual({ status: "unlinked" });
      await bridge.signIn();
      expect(await bridge.getAuthState()).toEqual({
        status: "connected",
        email: "test-user@example.com",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("非 Vitest 環境（ブラウザ実行環境）ではデフォルトで window.localStorage が storage として採用されること", async () => {
    const originalVitest = process.env.VITEST;
    delete process.env.VITEST;
    try {
      localStorage.setItem(MOCK_GDRIVE_FILE_STORAGE_KEY, "browser-file");
      const bridge = new MockCloudSyncBridge();
      expect(await bridge.pullFile()).toBe("browser-file");
    } finally {
      process.env.VITEST = originalVitest;
    }
  });

  it("storage が null の場合でもインメモリで正常に動作すること", async () => {
    const bridge = new MockCloudSyncBridge({ storage: null });
    expect(await bridge.getAuthState()).toEqual({ status: "unlinked" });
    expect(await bridge.pullFile()).toBeNull();

    await bridge.signIn();
    expect(await bridge.getAuthState()).toEqual({
      status: "connected",
      email: "test-user@example.com",
    });

    await bridge.pushFile('{"data":"in-memory"}');
    expect(await bridge.pullFile()).toBe('{"data":"in-memory"}');
    expect(bridge.getFileContent()).toBe('{"data":"in-memory"}');

    bridge.setSimulate401(true);
    await expect(bridge.pullFile()).rejects.toThrow("401");
    await expect(bridge.pushFile("{}")).rejects.toThrow("401");

    bridge.setSimulate401(false);
    expect(await bridge.pullFile()).toBe('{"data":"in-memory"}');

    bridge.setAuthState({ status: "authenticating" });
    expect(await bridge.getAuthState()).toEqual({ status: "authenticating" });

    bridge.setFileContent(null);
    expect(bridge.getFileContent()).toBeNull();

    await bridge.signOut();
    expect(await bridge.getAuthState()).toEqual({ status: "unlinked" });

    bridge.clearStorage();
    expect(await bridge.getAuthState()).toEqual({ status: "unlinked" });
  });

  it("コンストラクタで初期認証状態および初期ファイル内容を指定できること（storage にも同期されること）", async () => {
    const bridge = new MockCloudSyncBridge({
      initialAuthState: { status: "connected", email: "custom@example.com" },
      initialFileContent: '{"version":1}',
      defaultEmail: "default@example.com",
      storage: localStorage,
    });
    expect(await bridge.getAuthState()).toEqual({
      status: "connected",
      email: "custom@example.com",
    });
    expect(await bridge.pullFile()).toBe('{"version":1}');
    expect(localStorage.getItem(MOCK_GDRIVE_AUTH_STORAGE_KEY)).toBe(
      JSON.stringify({ status: "connected", email: "custom@example.com" }),
    );
    expect(localStorage.getItem(MOCK_GDRIVE_FILE_STORAGE_KEY)).toBe(
      '{"version":1}',
    );
  });

  it("既存の storage に保存されたデータ（認証・ファイル・401フラグ）をコンストラクタで正しく復元できること", async () => {
    localStorage.setItem(
      MOCK_GDRIVE_AUTH_STORAGE_KEY,
      JSON.stringify({ status: "connected", email: "stored@example.com" }),
    );
    localStorage.setItem(MOCK_GDRIVE_FILE_STORAGE_KEY, '{"stored":true}');
    localStorage.setItem(MOCK_GDRIVE_401_STORAGE_KEY, "true");

    const bridge = new MockCloudSyncBridge({ storage: localStorage });
    expect(await bridge.getAuthState()).toEqual({
      status: "connected",
      email: "stored@example.com",
    });
    expect(bridge.getFileContent()).toBe('{"stored":true}');
    await expect(bridge.pullFile()).rejects.toThrow("401");
  });

  it("signIn 呼び出しで connected (email 含む) に遷移し、storage に保存されること", async () => {
    const bridge = new MockCloudSyncBridge({ storage: localStorage });
    const state = await bridge.signIn();
    expect(state).toEqual({
      status: "connected",
      email: "test-user@example.com",
    });
    expect(await bridge.getAuthState()).toEqual({
      status: "connected",
      email: "test-user@example.com",
    });
    expect(localStorage.getItem(MOCK_GDRIVE_AUTH_STORAGE_KEY)).toBe(
      JSON.stringify({
        status: "connected",
        email: "test-user@example.com",
      }),
    );
  });

  it("コンストラクタで指定した defaultEmail を signIn で採用すること", async () => {
    const bridge = new MockCloudSyncBridge({
      defaultEmail: "my-account@gmail.com",
      storage: localStorage,
    });
    const state = await bridge.signIn();
    expect(state).toEqual({
      status: "connected",
      email: "my-account@gmail.com",
    });
  });

  it("signOut 呼び出しで unlinked に遷移し、storage が更新されること", async () => {
    const bridge = new MockCloudSyncBridge({
      initialAuthState: { status: "connected", email: "user@example.com" },
      storage: localStorage,
    });
    await bridge.signOut();
    expect(await bridge.getAuthState()).toEqual({ status: "unlinked" });
    expect(localStorage.getItem(MOCK_GDRIVE_AUTH_STORAGE_KEY)).toBe(
      JSON.stringify({ status: "unlinked" }),
    );
  });

  it("pushFile() で保存した内容が pullFile() / getFileContent() で取得でき、setFileContent(null) で削除されること", async () => {
    const bridge = new MockCloudSyncBridge({ storage: localStorage });
    const dummyContent = JSON.stringify({ version: 1, test: true });
    await bridge.pushFile(dummyContent);
    expect(await bridge.pullFile()).toBe(dummyContent);
    expect(bridge.getFileContent()).toBe(dummyContent);
    expect(localStorage.getItem(MOCK_GDRIVE_FILE_STORAGE_KEY)).toBe(
      dummyContent,
    );

    bridge.setFileContent(null);
    expect(bridge.getFileContent()).toBeNull();
    expect(await bridge.pullFile()).toBeNull();
    expect(localStorage.getItem(MOCK_GDRIVE_FILE_STORAGE_KEY)).toBeNull();
  });

  it("外部から storage が直接更新された場合でも、pullFile() や getAuthState() が最新値を反映すること", async () => {
    const bridge = new MockCloudSyncBridge({ storage: localStorage });
    expect(await bridge.pullFile()).toBeNull();

    localStorage.setItem(MOCK_GDRIVE_FILE_STORAGE_KEY, "externally-written");
    expect(await bridge.pullFile()).toBe("externally-written");
    expect(bridge.getFileContent()).toBe("externally-written");

    localStorage.setItem(
      MOCK_GDRIVE_AUTH_STORAGE_KEY,
      JSON.stringify({ status: "connected", email: "external@example.com" }),
    );
    expect(await bridge.getAuthState()).toEqual({
      status: "connected",
      email: "external@example.com",
    });

    localStorage.setItem(MOCK_GDRIVE_401_STORAGE_KEY, "true");
    await expect(bridge.pullFile()).rejects.toThrow("401");
  });

  it("setSimulate401(true) が設定されている場合、pullFile() および pushFile() で 401 エラーが送出されること", async () => {
    const bridge = new MockCloudSyncBridge({ storage: localStorage });
    bridge.setSimulate401(true);
    expect(localStorage.getItem(MOCK_GDRIVE_401_STORAGE_KEY)).toBe("true");
    await expect(bridge.pullFile()).rejects.toThrow("401");
    await expect(bridge.pushFile("{}")).rejects.toThrow("401");

    bridge.setSimulate401(false);
    expect(localStorage.getItem(MOCK_GDRIVE_401_STORAGE_KEY)).toBe("false");
    expect(await bridge.pullFile()).toBeNull();
  });

  it("setAuthState() で任意の状態（authenticating / error など）へ強制遷移できること", async () => {
    const bridge = new MockCloudSyncBridge({ storage: localStorage });
    bridge.setAuthState({ status: "authenticating" });
    expect(await bridge.getAuthState()).toEqual({ status: "authenticating" });

    bridge.setAuthState({ status: "error", message: "Network timeout" });
    expect(await bridge.getAuthState()).toEqual({
      status: "error",
      message: "Network timeout",
    });
  });

  it("clearStorage() で内部状態およびストレージが初期化されること", async () => {
    const bridge = new MockCloudSyncBridge({ storage: localStorage });
    await bridge.signIn();
    await bridge.pushFile("content");
    bridge.setSimulate401(true);

    bridge.clearStorage();

    expect(await bridge.getAuthState()).toEqual({ status: "unlinked" });
    expect(bridge.getFileContent()).toBeNull();
    expect(await bridge.pullFile()).toBeNull();
    expect(localStorage.getItem(MOCK_GDRIVE_AUTH_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(MOCK_GDRIVE_FILE_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(MOCK_GDRIVE_401_STORAGE_KEY)).toBeNull();
  });

  it("storage 操作時に例外が発生してもクラッシュせず安全にフォールバックすること", async () => {
    const throwingStorage: Storage = {
      getItem: () => {
        throw new Error("QuotaExceeded or SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceeded or SecurityError");
      },
      removeItem: () => {
        throw new Error("QuotaExceeded or SecurityError");
      },
      clear: () => {},
      key: () => null,
      length: 0,
    };

    const bridge = new MockCloudSyncBridge({
      storage: throwingStorage,
      initialAuthState: { status: "connected", email: "throw@example.com" },
      initialFileContent: "safe-content",
    });

    expect(await bridge.getAuthState()).toEqual({
      status: "connected",
      email: "throw@example.com",
    });
    expect(await bridge.pullFile()).toBe("safe-content");
    expect(bridge.getFileContent()).toBe("safe-content");

    await bridge.pushFile("new-content");
    expect(bridge.getFileContent()).toBe("new-content");

    bridge.setSimulate401(true);
    await expect(bridge.pullFile()).rejects.toThrow("401");

    bridge.setSimulate401(false);
    await bridge.signOut();
    expect(await bridge.getAuthState()).toEqual({ status: "unlinked" });

    bridge.clearStorage();
    expect(await bridge.getAuthState()).toEqual({ status: "unlinked" });
  });
});

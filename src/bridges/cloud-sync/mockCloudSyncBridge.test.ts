import { describe, it, expect } from "vitest";
import { MockCloudSyncBridge } from "./mockCloudSyncBridge";

describe("MockCloudSyncBridge", () => {
  it("初期状態では unlinked であること", async () => {
    const bridge = new MockCloudSyncBridge();
    const state = await bridge.getAuthState();
    expect(state).toEqual({ status: "unlinked" });
  });

  it("コンストラクタで初期認証状態および初期ファイル内容を指定できること", async () => {
    const bridge = new MockCloudSyncBridge({
      initialAuthState: { status: "connected", email: "custom@example.com" },
      initialFileContent: '{"version":1}',
      defaultEmail: "default@example.com",
    });
    expect(await bridge.getAuthState()).toEqual({
      status: "connected",
      email: "custom@example.com",
    });
    expect(await bridge.pullFile()).toBe('{"version":1}');
  });

  it("signIn 呼び出しで connected (email 含む) に遷移すること", async () => {
    const bridge = new MockCloudSyncBridge();
    const state = await bridge.signIn();
    expect(state).toEqual({
      status: "connected",
      email: "test-user@example.com",
    });
    expect(await bridge.getAuthState()).toEqual({
      status: "connected",
      email: "test-user@example.com",
    });
  });

  it("コンストラクタで指定した defaultEmail を signIn で採用すること", async () => {
    const bridge = new MockCloudSyncBridge({
      defaultEmail: "my-account@gmail.com",
    });
    const state = await bridge.signIn();
    expect(state).toEqual({
      status: "connected",
      email: "my-account@gmail.com",
    });
  });

  it("signOut 呼び出しで unlinked に遷移すること", async () => {
    const bridge = new MockCloudSyncBridge({
      initialAuthState: { status: "connected", email: "user@example.com" },
    });
    await bridge.signOut();
    expect(await bridge.getAuthState()).toEqual({ status: "unlinked" });
  });

  it("初期状態では pullFile() が null を返すこと", async () => {
    const bridge = new MockCloudSyncBridge();
    expect(await bridge.pullFile()).toBeNull();
  });

  it("pushFile() で保存した内容が pullFile() で取得できること", async () => {
    const bridge = new MockCloudSyncBridge();
    const dummyContent = JSON.stringify({ version: 1, test: true });
    await bridge.pushFile(dummyContent);
    expect(await bridge.pullFile()).toBe(dummyContent);
  });

  it("setSimulate401(true) が設定されている場合、pullFile() で 401 エラーが送出されること", async () => {
    const bridge = new MockCloudSyncBridge({ initialFileContent: "{}" });
    bridge.setSimulate401(true);
    await expect(bridge.pullFile()).rejects.toThrow("401");
  });

  it("setSimulate401(true) が設定されている場合、pushFile() で 401 エラーが送出されること", async () => {
    const bridge = new MockCloudSyncBridge();
    bridge.setSimulate401(true);
    await expect(bridge.pushFile("{}")).rejects.toThrow("401");
  });

  it("setSimulate401(false) で 401 エラーが解除され正常にアクセスできること", async () => {
    const bridge = new MockCloudSyncBridge();
    bridge.setSimulate401(true);
    await expect(bridge.pullFile()).rejects.toThrow();

    bridge.setSimulate401(false);
    expect(await bridge.pullFile()).toBeNull();
  });

  it("setAuthState() で任意の状態（authenticating / error など）へ強制遷移できること", async () => {
    const bridge = new MockCloudSyncBridge();
    bridge.setAuthState({ status: "authenticating" });
    expect(await bridge.getAuthState()).toEqual({ status: "authenticating" });

    bridge.setAuthState({ status: "error", message: "Network timeout" });
    expect(await bridge.getAuthState()).toEqual({
      status: "error",
      message: "Network timeout",
    });
  });

  it("setFileContent() および getFileContent() でインメモリのファイル内容を直接操作・参照できること", () => {
    const bridge = new MockCloudSyncBridge();
    expect(bridge.getFileContent()).toBeNull();
    bridge.setFileContent("raw-content");
    expect(bridge.getFileContent()).toBe("raw-content");
  });
});

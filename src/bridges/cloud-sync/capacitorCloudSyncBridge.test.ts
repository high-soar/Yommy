import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CapacitorCloudSyncBridge,
  CloudSyncNative,
  type CloudSyncNativePlugin,
} from "./capacitorCloudSyncBridge";

vi.mock("@capacitor/core", () => ({
  registerPlugin: vi.fn((name: string) => ({ name })),
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

describe("CapacitorCloudSyncBridge", () => {
  let mockPlugin: CloudSyncNativePlugin;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPlugin = {
      getAuthState: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      pullFile: vi.fn(),
      pushFile: vi.fn(),
    };
  });

  describe("コンストラクタ", () => {
    it("引数なしで初期化した場合にデフォルトプラグインでインスタンス化できること", () => {
      const bridge = new CapacitorCloudSyncBridge();
      expect(CloudSyncNative).toBeDefined();
      expect(bridge).toBeDefined();
    });

    it("カスタムプラグインを注入して初期化できること", () => {
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      expect(bridge).toBeDefined();
    });
  });

  describe("getAuthState", () => {
    it("connected 状態を正しく返すこと", async () => {
      vi.mocked(mockPlugin.getAuthState).mockResolvedValue({
        status: "connected",
        email: "test@example.com",
      });
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const state = await bridge.getAuthState();

      expect(state).toEqual({
        status: "connected",
        email: "test@example.com",
      });
    });

    it("connected 状態で email が空文字の場合に undefined に正規化されること", async () => {
      vi.mocked(mockPlugin.getAuthState).mockResolvedValue({
        status: "connected",
        email: "",
      });
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const state = await bridge.getAuthState();

      expect(state).toEqual({
        status: "connected",
        email: undefined,
      });
    });

    it("authenticating 状態を正しく返すこと", async () => {
      vi.mocked(mockPlugin.getAuthState).mockResolvedValue({
        status: "authenticating",
      });
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const state = await bridge.getAuthState();

      expect(state).toEqual({ status: "authenticating" });
    });

    it("unlinked 状態を正しく返すこと", async () => {
      vi.mocked(mockPlugin.getAuthState).mockResolvedValue({
        status: "unlinked",
      });
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const state = await bridge.getAuthState();

      expect(state).toEqual({ status: "unlinked" });
    });

    it("error 状態を正しく返すこと", async () => {
      vi.mocked(mockPlugin.getAuthState).mockResolvedValue({
        status: "error",
        message: "認証トークンの有効期限切れ",
      });
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const state = await bridge.getAuthState();

      expect(state).toEqual({
        status: "error",
        message: "認証トークンの有効期限切れ",
      });
    });

    it("error 状態で message が空の場合にデフォルトメッセージを返すこと", async () => {
      vi.mocked(mockPlugin.getAuthState).mockResolvedValue({
        status: "error",
      });
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const state = await bridge.getAuthState();

      expect(state).toEqual({
        status: "error",
        message: "Unknown error",
      });
    });

    it("プラグイン呼び出しで例外が発生した場合に error 状態を返すこと（Errorインスタンス）", async () => {
      vi.mocked(mockPlugin.getAuthState).mockRejectedValue(
        new Error("ネイティブブリッジ通信失敗"),
      );
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const state = await bridge.getAuthState();

      expect(state).toEqual({
        status: "error",
        message: "ネイティブブリッジ通信失敗",
      });
    });

    it("プラグイン呼び出しで非Error例外が発生した場合に文字列として error 状態を返すこと", async () => {
      vi.mocked(mockPlugin.getAuthState).mockRejectedValue("文字列エラー");
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const state = await bridge.getAuthState();

      expect(state).toEqual({
        status: "error",
        message: "文字列エラー",
      });
    });
  });

  describe("signIn", () => {
    it("connected 状態を正しく返すこと", async () => {
      vi.mocked(mockPlugin.signIn).mockResolvedValue({
        status: "connected",
        email: "user@example.com",
      });
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const state = await bridge.signIn();

      expect(state).toEqual({
        status: "connected",
        email: "user@example.com",
      });
    });

    it("connected 状態で email が空文字の場合に undefined に正規化されること", async () => {
      vi.mocked(mockPlugin.signIn).mockResolvedValue({
        status: "connected",
        email: "",
      });
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const state = await bridge.signIn();

      expect(state).toEqual({
        status: "connected",
        email: undefined,
      });
    });

    it("authenticating 状態を正しく返すこと", async () => {
      vi.mocked(mockPlugin.signIn).mockResolvedValue({
        status: "authenticating",
      });
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const state = await bridge.signIn();

      expect(state).toEqual({ status: "authenticating" });
    });

    it("unlinked（キャンセル時）を正しく返すこと", async () => {
      vi.mocked(mockPlugin.signIn).mockResolvedValue({
        status: "unlinked",
      });
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const state = await bridge.signIn();

      expect(state).toEqual({ status: "unlinked" });
    });

    it("error 状態を正しく返すこと", async () => {
      vi.mocked(mockPlugin.signIn).mockResolvedValue({
        status: "error",
        message: "アカウント選択がキャンセルされました",
      });
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const state = await bridge.signIn();

      expect(state).toEqual({
        status: "error",
        message: "アカウント選択がキャンセルされました",
      });
    });

    it("error 状態で message が空の場合にデフォルトメッセージを返すこと", async () => {
      vi.mocked(mockPlugin.signIn).mockResolvedValue({
        status: "error",
      });
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const state = await bridge.signIn();

      expect(state).toEqual({
        status: "error",
        message: "Authentication failed",
      });
    });

    it("プラグイン呼び出しで例外が発生した場合に error 状態を返すこと（Errorインスタンス）", async () => {
      vi.mocked(mockPlugin.signIn).mockRejectedValue(
        new Error("Google Play Services 連携失敗"),
      );
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const state = await bridge.signIn();

      expect(state).toEqual({
        status: "error",
        message: "Google Play Services 連携失敗",
      });
    });

    it("プラグイン呼び出しで非Error例外が発生した場合に文字列として error 状態を返すこと", async () => {
      vi.mocked(mockPlugin.signIn).mockRejectedValue("未定義のログインエラー");
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const state = await bridge.signIn();

      expect(state).toEqual({
        status: "error",
        message: "未定義のログインエラー",
      });
    });
  });

  describe("signOut", () => {
    it("plugin.signOut が呼び出されること", async () => {
      vi.mocked(mockPlugin.signOut).mockResolvedValue(undefined);
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      await bridge.signOut();

      expect(mockPlugin.signOut).toHaveBeenCalledTimes(1);
    });
  });

  describe("pullFile", () => {
    it("ファイルコンテンツが存在する場合に文字列を返すこと", async () => {
      const mockJson = JSON.stringify({ version: 1, novels: {} });
      vi.mocked(mockPlugin.pullFile).mockResolvedValue({
        content: mockJson,
      });
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const result = await bridge.pullFile();

      expect(result).toBe(mockJson);
      expect(mockPlugin.pullFile).toHaveBeenCalledTimes(1);
    });

    it("ファイルが存在しない場合に null を返すこと", async () => {
      vi.mocked(mockPlugin.pullFile).mockResolvedValue({
        content: null,
      });
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const result = await bridge.pullFile();

      expect(result).toBeNull();
    });

    it("レスポンスの content が undefined の場合に null を返すこと", async () => {
      vi.mocked(mockPlugin.pullFile).mockResolvedValue({} as { content: null });
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      const result = await bridge.pullFile();

      expect(result).toBeNull();
    });

    it("401 Unauthorized エラー検知時に自動で signOut を呼び出し例外をリスローすること", async () => {
      vi.mocked(mockPlugin.pullFile).mockRejectedValue(
        new Error("401 Unauthorized: token expired"),
      );
      vi.mocked(mockPlugin.signOut).mockResolvedValue(undefined);

      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      await expect(bridge.pullFile()).rejects.toThrow("401 Unauthorized");

      expect(mockPlugin.signOut).toHaveBeenCalledTimes(1);
    });

    it("401 Unauthorized エラー検知時に signOut が失敗しても元のエラーをリスローすること", async () => {
      vi.mocked(mockPlugin.pullFile).mockRejectedValue(
        new Error("HTTP 401: Unauthorized"),
      );
      vi.mocked(mockPlugin.signOut).mockRejectedValue(
        new Error("signOut network error"),
      );

      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      await expect(bridge.pullFile()).rejects.toThrow("HTTP 401: Unauthorized");

      expect(mockPlugin.signOut).toHaveBeenCalledTimes(1);
    });

    it("401 以外の一般エラー時には signOut を呼び出さず例外をリスローすること", async () => {
      vi.mocked(mockPlugin.pullFile).mockRejectedValue(
        new Error("Network connection failed"),
      );

      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      await expect(bridge.pullFile()).rejects.toThrow(
        "Network connection failed",
      );

      expect(mockPlugin.signOut).not.toHaveBeenCalled();
    });
  });

  describe("pushFile", () => {
    it("コンテンツを渡して pushFile を呼び出すこと", async () => {
      vi.mocked(mockPlugin.pushFile).mockResolvedValue(undefined);
      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      await bridge.pushFile('{"version": 1}');

      expect(mockPlugin.pushFile).toHaveBeenCalledWith({
        content: '{"version": 1}',
      });
    });

    it("401 Unauthorized エラー検知時に自動で signOut を呼び出し例外をリスローすること", async () => {
      vi.mocked(mockPlugin.pushFile).mockRejectedValue(
        new Error("401 Unauthorized: credentials revoked"),
      );
      vi.mocked(mockPlugin.signOut).mockResolvedValue(undefined);

      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      await expect(bridge.pushFile('{"version": 1}')).rejects.toThrow(
        "401 Unauthorized",
      );

      expect(mockPlugin.signOut).toHaveBeenCalledTimes(1);
    });

    it("401 Unauthorized エラー検知時に非Error例外の場合でも文字列判定で signOut を呼び出すこと", async () => {
      vi.mocked(mockPlugin.pushFile).mockRejectedValue(
        "Error: 401 unauthorized",
      );
      vi.mocked(mockPlugin.signOut).mockResolvedValue(undefined);

      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      await expect(bridge.pushFile('{"version": 1}')).rejects.toBe(
        "Error: 401 unauthorized",
      );

      expect(mockPlugin.signOut).toHaveBeenCalledTimes(1);
    });

    it("401 以外の一般エラー時には signOut を呼び出さず例外をリスローすること", async () => {
      vi.mocked(mockPlugin.pushFile).mockRejectedValue(
        new Error("Disk quota exceeded"),
      );

      const bridge = new CapacitorCloudSyncBridge(mockPlugin);
      await expect(bridge.pushFile('{"version": 1}')).rejects.toThrow(
        "Disk quota exceeded",
      );

      expect(mockPlugin.signOut).not.toHaveBeenCalled();
    });
  });
});

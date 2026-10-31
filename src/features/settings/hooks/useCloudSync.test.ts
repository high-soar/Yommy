import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { useCloudSync } from "./useCloudSync";
import type {
  CloudSyncAuthState,
  CloudSyncBridge,
} from "../../../bridges/cloud-sync/types";
import type { AppSettingsRepository } from "../../../storage/types";
import type { SyncEngine } from "../../cloud-sync/services/syncEngine";

describe("useCloudSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockBridge = (
    initialState: CloudSyncAuthState = { status: "unlinked" },
  ): CloudSyncBridge => ({
    getAuthState: vi.fn().mockResolvedValue(initialState),
    signIn: vi
      .fn()
      .mockResolvedValue({ status: "connected", email: "user@example.com" }),
    signOut: vi.fn().mockResolvedValue(undefined),
    pullFile: vi.fn().mockResolvedValue(null),
    pushFile: vi.fn().mockResolvedValue(undefined),
  });

  const createMockAppSettings = (
    initial: {
      lastSyncedAt?: number | null;
      email?: string | null;
    } = {},
  ): AppSettingsRepository => {
    let lastSynced = initial.lastSyncedAt ?? null;
    let savedEmail = initial.email ?? null;
    return {
      getSetting: vi.fn().mockImplementation(async (key: string) => {
        if (key === "cloud_sync_last_synced_at") {
          return lastSynced !== null ? String(lastSynced) : null;
        }
        if (key === "cloud_sync_account_email") {
          return savedEmail;
        }
        return null;
      }),
      setSetting: vi.fn().mockResolvedValue(undefined),
      getCloudSyncLastSyncedAt: vi
        .fn()
        .mockImplementation(async () => lastSynced),
      setCloudSyncLastSyncedAt: vi
        .fn()
        .mockImplementation(async (val: number | null) => {
          lastSynced = val;
        }),
      getCloudSyncAccountEmail: vi
        .fn()
        .mockImplementation(async () => savedEmail),
      setCloudSyncAccountEmail: vi
        .fn()
        .mockImplementation(async (val: string | null) => {
          savedEmail = val;
        }),
    };
  };

  const createMockSyncEngine = (): SyncEngine =>
    ({
      sync: vi.fn().mockResolvedValue({ pulled: true, mergedNovels: 0 }),
      pullAndMerge: vi
        .fn()
        .mockResolvedValue({ pulled: true, mergedNovels: 0 }),
      pushCurrentState: vi.fn().mockResolvedValue(undefined),
      scheduleDebouncedPush: vi.fn().mockResolvedValue(undefined),
      cancelDebouncedPush: vi.fn(),
      flushDebouncedPush: vi.fn().mockResolvedValue(undefined),
      notifyChanged: vi.fn().mockResolvedValue(undefined),
      isSyncing: false,
    }) as unknown as SyncEngine;

  const createWrapper =
    (services: React.ComponentProps<typeof ServiceProvider>["services"]) =>
    ({ children }: { children: React.ReactNode }) =>
      React.createElement(ServiceProvider, { services }, children);

  describe("初期化パイプライン (AC-ST-08)", () => {
    it("初期化完了後に未連携状態と最終同期日時（未同期）が正しく復元されること", async () => {
      const bridge = createMockBridge({ status: "unlinked" });
      const appSettings = createMockAppSettings();
      const syncEngine = createMockSyncEngine();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
          syncEngine,
        }),
      });

      await waitFor(() => {
        expect(bridge.getAuthState).toHaveBeenCalledTimes(1);
      });

      expect(result.current.authState.status).toBe("unlinked");
      expect(result.current.lastSyncedAt).toBeNull();
      expect(result.current.isSyncing).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("保存済みの最終同期日時と認証状態が存在する場合、正しく復元されること", async () => {
      const lastSyncedTimestamp = 1730376000000;
      const expectedIso = new Date(lastSyncedTimestamp).toISOString();
      const bridge = createMockBridge({
        status: "connected",
        email: "user@example.com",
      });
      const appSettings = createMockAppSettings({
        lastSyncedAt: lastSyncedTimestamp,
        email: "user@example.com",
      });
      const syncEngine = createMockSyncEngine();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
          syncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState).toEqual({
          status: "connected",
          email: "user@example.com",
        });
      });

      expect(result.current.lastSyncedAt).toBe(expectedIso);
      expect(result.current.isSyncing).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("bridge の connected 状態に email がなく appSettings に email が保存されている場合、email が補完されること", async () => {
      const bridge = createMockBridge({ status: "connected" });
      const appSettings = createMockAppSettings({
        email: "saved@example.com",
      });
      const syncEngine = createMockSyncEngine();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
          syncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState).toEqual({
          status: "connected",
          email: "saved@example.com",
        });
      });
    });
  });

  describe("アカウント連携 (signIn, AC-ST-08, AC-ST-11)", () => {
    it("signIn 成功時に connected 状態へ遷移し、初回の自動同期（sync）が実行され最終同期日時が更新されること", async () => {
      const bridge = createMockBridge({ status: "unlinked" });
      const appSettings = createMockAppSettings();
      const syncEngine = createMockSyncEngine();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
          syncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("unlinked");
      });

      await act(async () => {
        await result.current.signIn();
      });

      expect(bridge.signIn).toHaveBeenCalledTimes(1);
      expect(result.current.authState).toEqual({
        status: "connected",
        email: "user@example.com",
      });
      expect(syncEngine.sync).toHaveBeenCalledTimes(1);
      expect(result.current.lastSyncedAt).not.toBeNull();
      expect(appSettings.setCloudSyncLastSyncedAt).toHaveBeenCalled();
      expect(appSettings.setCloudSyncAccountEmail).toHaveBeenCalledWith(
        "user@example.com",
      );
      expect(result.current.isSyncing).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("bridge.signIn が error ステータスを返した場合、error 状態となりエラーメッセージが設定されること", async () => {
      const bridge = createMockBridge({ status: "unlinked" });
      vi.mocked(bridge.signIn).mockResolvedValueOnce({
        status: "error",
        message: "Google ログインがキャンセルされました",
      });
      const appSettings = createMockAppSettings();
      const syncEngine = createMockSyncEngine();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
          syncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("unlinked");
      });

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.authState.status).toBe("error");
      expect(result.current.error).toBe(
        "Google ログインがキャンセルされました",
      );
      expect(syncEngine.sync).not.toHaveBeenCalled();
    });

    it("bridge.signIn 中に 401 Unauthorized 例外が発生した場合、安全に未連携状態へフォールバックしエラー通知されること (AC-ST-11)", async () => {
      const bridge = createMockBridge({ status: "unlinked" });
      const err = new Error("401 Unauthorized: token revoked");
      vi.mocked(bridge.signIn).mockRejectedValueOnce(err);
      const appSettings = createMockAppSettings();
      const syncEngine = createMockSyncEngine();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
          syncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("unlinked");
      });

      await act(async () => {
        await result.current.signIn();
      });

      expect(bridge.signOut).toHaveBeenCalled();
      expect(result.current.authState.status).toBe("unlinked");
      expect(result.current.error).toContain("解除");
    });

    it("bridge.signIn 中に一般的な例外が発生した場合、エラー状態となりメッセージが設定されること", async () => {
      const bridge = createMockBridge({ status: "unlinked" });
      vi.mocked(bridge.signIn).mockRejectedValueOnce(
        new Error("ネットワーク接続エラー"),
      );
      const appSettings = createMockAppSettings();
      const syncEngine = createMockSyncEngine();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
          syncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("unlinked");
      });

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.authState.status).toBe("error");
      expect(result.current.error).toBe("ネットワーク接続エラー");
    });
  });

  describe("アカウント連携解除 (signOut, AC-ST-10)", () => {
    it("signOut 実行時に bridge.signOut が呼び出され、未連携状態へリセットされ最終同期設定がクリアされること", async () => {
      const bridge = createMockBridge({
        status: "connected",
        email: "user@example.com",
      });
      const appSettings = createMockAppSettings({
        lastSyncedAt: 1730376000000,
        email: "user@example.com",
      });
      const syncEngine = createMockSyncEngine();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
          syncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("connected");
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(bridge.signOut).toHaveBeenCalledTimes(1);
      expect(appSettings.setCloudSyncAccountEmail).toHaveBeenCalledWith(null);
      expect(appSettings.setCloudSyncLastSyncedAt).toHaveBeenCalledWith(null);
      expect(result.current.authState).toEqual({ status: "unlinked" });
      expect(result.current.lastSyncedAt).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe("手動即時同期 (syncNow, AC-ST-09, AC-ST-11)", () => {
    it("未連携状態では syncNow を実行しても同期がスキップされること", async () => {
      const bridge = createMockBridge({ status: "unlinked" });
      const appSettings = createMockAppSettings();
      const syncEngine = createMockSyncEngine();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
          syncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("unlinked");
      });

      await act(async () => {
        await result.current.syncNow();
      });

      expect(syncEngine.sync).not.toHaveBeenCalled();
    });

    it("連携中状態で syncNow 実行時に syncEngine.sync が呼び出され、最終同期日時が更新されること (AC-ST-09)", async () => {
      const bridge = createMockBridge({
        status: "connected",
        email: "user@example.com",
      });
      const appSettings = createMockAppSettings();
      const syncEngine = createMockSyncEngine();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
          syncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("connected");
      });

      await act(async () => {
        await result.current.syncNow();
      });

      expect(syncEngine.sync).toHaveBeenCalledTimes(1);
      expect(result.current.lastSyncedAt).not.toBeNull();
      expect(appSettings.setCloudSyncLastSyncedAt).toHaveBeenCalled();
      expect(result.current.isSyncing).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("syncNow 実行中に 401 Unauthorized エラーが発生した場合、自動的に未連携へフォールバックし通知されること (AC-ST-11)", async () => {
      const bridge = createMockBridge({
        status: "connected",
        email: "user@example.com",
      });
      const appSettings = createMockAppSettings();
      const syncEngine = createMockSyncEngine();
      vi.mocked(syncEngine.sync).mockRejectedValueOnce({
        status: 401,
        message: "Unauthorized",
      });

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
          syncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("connected");
      });

      await act(async () => {
        await result.current.syncNow();
      });

      expect(bridge.signOut).toHaveBeenCalled();
      expect(appSettings.setCloudSyncAccountEmail).toHaveBeenCalledWith(null);
      expect(result.current.authState).toEqual({ status: "unlinked" });
      expect(result.current.error).toContain("解除");
      expect(result.current.isSyncing).toBe(false);
    });

    it("syncNow 実行中に通信エラー（503 等）が発生した場合、接続状態を維持したままエラー通知されること", async () => {
      const bridge = createMockBridge({
        status: "connected",
        email: "user@example.com",
      });
      const appSettings = createMockAppSettings();
      const syncEngine = createMockSyncEngine();
      vi.mocked(syncEngine.sync).mockRejectedValueOnce(
        new Error("503 Service Unavailable"),
      );

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
          syncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("connected");
      });

      await act(async () => {
        await result.current.syncNow();
      });

      expect(result.current.authState.status).toBe("connected");
      expect(result.current.error).toBe("503 Service Unavailable");
      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe("境界値および異常系・未設定フォールバック (AC-ST-12)", () => {
    it("syncEngine が未設定（undefined）の場合でもエラーなく動作すること", async () => {
      const bridge = createMockBridge({
        status: "connected",
        email: "user@example.com",
      });
      const appSettings = createMockAppSettings();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
          syncEngine: undefined,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("connected");
      });

      await act(async () => {
        await result.current.syncNow();
      });

      expect(result.current.isSyncing).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("appSettingsRepository が getCloudSyncLastSyncedAt を持たない場合、getSetting から復元されること", async () => {
      const bridge = createMockBridge({ status: "unlinked" });
      const fallbackSettings: AppSettingsRepository = {
        getSetting: vi.fn().mockImplementation(async (key: string) => {
          if (key === "cloud_sync_last_synced_at") {
            return "1730376000000";
          }
          return null;
        }),
        setSetting: vi.fn().mockResolvedValue(undefined),
      };

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: fallbackSettings,
        }),
      });

      await waitFor(() => {
        expect(result.current.lastSyncedAt).toBe(
          new Date(1730376000000).toISOString(),
        );
      });
    });

    it("getSetting が ISO 日時文字列または不正な文字列を返す場合のフォールバック", async () => {
      const bridge = createMockBridge({ status: "unlinked" });
      const isoStr = "2026-10-31T00:00:00.000Z";
      const fallbackSettings: AppSettingsRepository = {
        getSetting: vi.fn().mockResolvedValueOnce(isoStr),
        setSetting: vi.fn().mockResolvedValue(undefined),
      };

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: fallbackSettings,
        }),
      });

      await waitFor(() => {
        expect(result.current.lastSyncedAt).toBe(isoStr);
      });

      // 不正な文字列
      const invalidSettings: AppSettingsRepository = {
        getSetting: vi.fn().mockResolvedValueOnce("not-a-valid-date"),
        setSetting: vi.fn().mockResolvedValue(undefined),
      };

      const { result: invalidResult } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: invalidSettings,
        }),
      });

      await waitFor(() => {
        expect(invalidResult.current.lastSyncedAt).toBeNull();
      });
    });

    it("getSetting が NaN または無効な数値を返す場合、lastSyncedAt が null となること", async () => {
      const bridge = createMockBridge({ status: "unlinked" });
      const fallbackSettings: AppSettingsRepository = {
        getSetting: vi.fn().mockResolvedValueOnce(NaN as unknown as string),
        setSetting: vi.fn().mockResolvedValue(undefined),
      };

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: fallbackSettings,
        }),
      });

      await waitFor(() => {
        expect(result.current.lastSyncedAt).toBeNull();
      });
    });

    it("signIn 中に falsy（null）な例外がスローされた場合も安全に処理されること", async () => {
      const bridge = createMockBridge();
      vi.mocked(bridge.signIn).mockRejectedValueOnce(null);
      const appSettings = createMockAppSettings();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("unlinked");
      });

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.authState.status).toBe("error");
      expect(result.current.error).toBe("null");
    });

    it("syncNow 実行中に非Error例外（文字列）がスローされた場合もエラーメッセージが設定されること", async () => {
      const bridge = createMockBridge({
        status: "connected",
        email: "user@example.com",
      });
      const appSettings = createMockAppSettings();
      const syncEngine = createMockSyncEngine();
      vi.mocked(syncEngine.sync).mockRejectedValueOnce("文字列同期エラー");

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
          syncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("connected");
      });

      await act(async () => {
        await result.current.syncNow();
      });

      expect(result.current.error).toBe("文字列同期エラー");
    });

    it("cloudSyncBridge.getAuthState が存在しない場合、デフォルトで unlinked 状態となること", async () => {
      const dummyBridge = {} as CloudSyncBridge;
      const appSettings = createMockAppSettings();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: dummyBridge,
          appSettingsRepository: appSettings,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("unlinked");
      });
    });

    it("initialize 実行中に例外が発生した場合、エラーメッセージが設定されること", async () => {
      const bridge = createMockBridge();
      vi.mocked(bridge.getAuthState).mockRejectedValueOnce(
        new Error("Bridge init error"),
      );
      const appSettings = createMockAppSettings();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
        }),
      });

      await waitFor(() => {
        expect(result.current.error).toBe("Bridge init error");
      });
    });

    it("bridge の connected 状態かつ email 未設定で getCloudSyncAccountEmail が null を返す場合", async () => {
      const bridge = createMockBridge({ status: "connected" });
      const appSettings = createMockAppSettings({ email: null });

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("connected");
        expect(
          (result.current.authState as { email?: string }).email,
        ).toBeUndefined();
      });
    });

    it("signIn で connected でも error でもないステータスが返された場合、そのステータスがそのまま設定されること", async () => {
      const bridge = createMockBridge();
      vi.mocked(bridge.signIn).mockResolvedValueOnce({
        status: "unlinked",
      });
      const appSettings = createMockAppSettings();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("unlinked");
      });

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.authState.status).toBe("unlinked");
    });

    it("signIn 後の初回 syncEngine.sync で例外が発生しても、警告ログ出力の上で connected 状態を維持すること", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const bridge = createMockBridge();
      const appSettings = createMockAppSettings();
      const syncEngine = createMockSyncEngine();
      vi.mocked(syncEngine.sync).mockRejectedValueOnce(
        new Error("初回 Pull 失敗"),
      );

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
          syncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("unlinked");
      });

      await act(async () => {
        await result.current.signIn();
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Initial sync failed"),
        expect.any(Error),
      );
      expect(result.current.authState.status).toBe("connected");
      warnSpy.mockRestore();
    });

    it("signIn 中に 401 エラーが発生し、その後の bridge.signOut も失敗した場合に例外が伝播せず未連携にフォールバックすること", async () => {
      const bridge = createMockBridge();
      vi.mocked(bridge.signIn).mockRejectedValueOnce({
        statusCode: 401,
        message: "Unauthorized",
      });
      vi.mocked(bridge.signOut).mockRejectedValueOnce(
        new Error("Sign out failed"),
      );
      const appSettings = createMockAppSettings();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("unlinked");
      });

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.authState.status).toBe("unlinked");
      expect(result.current.error).toContain("解除");
    });

    it("signIn 中に非Error例外（文字列）がスローされた場合も error ステートが設定されること", async () => {
      const bridge = createMockBridge();
      vi.mocked(bridge.signIn).mockRejectedValueOnce("ログイン処理中断");
      const appSettings = createMockAppSettings();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("unlinked");
      });

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.authState.status).toBe("error");
      expect(result.current.error).toBe("ログイン処理中断");
    });

    it("signOut 実行時に bridge.signOut が例外を投げた場合、エラーメッセージが設定されること", async () => {
      const bridge = createMockBridge({
        status: "connected",
        email: "user@example.com",
      });
      vi.mocked(bridge.signOut).mockRejectedValueOnce(
        new Error("ログアウト失敗"),
      );
      const appSettings = createMockAppSettings();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("connected");
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.error).toBe("ログアウト失敗");

      // 非Errorオブジェクトの場合
      vi.mocked(bridge.signOut).mockRejectedValueOnce("文字列エラー");
      await act(async () => {
        await result.current.signOut();
      });
      expect(result.current.error).toBe("文字列エラー");
    });

    it("syncNow 実行中に 401 エラーが発生し、その後の bridge.signOut も失敗した場合に安全に処理されること", async () => {
      const bridge = createMockBridge({
        status: "connected",
        email: "user@example.com",
      });
      vi.mocked(bridge.signOut).mockRejectedValueOnce(
        new Error("Sign out failed"),
      );
      const appSettings = createMockAppSettings();
      const syncEngine = createMockSyncEngine();
      vi.mocked(syncEngine.sync).mockRejectedValueOnce({
        status: 401,
        message: "Token expired",
      });

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
          syncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("connected");
      });

      await act(async () => {
        await result.current.syncNow();
      });

      expect(result.current.authState.status).toBe("unlinked");
      expect(result.current.error).toContain("解除");
    });

    it("initialize 実行中に非Error例外（文字列）が発生した場合、エラーメッセージが設定されること", async () => {
      const bridge = createMockBridge();
      vi.mocked(bridge.getAuthState).mockRejectedValueOnce(
        "Bridge string error",
      );
      const appSettings = createMockAppSettings();

      const { result } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
        }),
      });

      await waitFor(() => {
        expect(result.current.error).toBe("Bridge string error");
      });
    });

    it("signIn 処理中または例外発生時にコンポーネントがアンマウントされていた場合、安全に早期リターンすること", async () => {
      const bridge = createMockBridge();
      let resolveSignIn!: (val: unknown) => void;
      bridge.signIn = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSignIn = resolve;
          }),
      );
      const appSettings = createMockAppSettings();

      const { result, unmount } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("unlinked");
      });

      let promise: Promise<void>;
      await act(async () => {
        promise = result.current.signIn();
      });
      unmount();
      await act(async () => {
        resolveSignIn({ status: "connected", email: "unmounted@example.com" });
        await promise;
      });

      // アンマウント後の例外発生パターン
      let rejectSignIn!: (err: unknown) => void;
      bridge.signIn = vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            rejectSignIn = reject;
          }),
      );

      const { result: res2, unmount: unmount2 } = renderHook(
        () => useCloudSync(),
        {
          wrapper: createWrapper({
            cloudSyncBridge: bridge,
            appSettingsRepository: appSettings,
          }),
        },
      );

      await waitFor(() => {
        expect(res2.current.authState.status).toBe("unlinked");
      });

      let p2: Promise<void>;
      await act(async () => {
        p2 = res2.current.signIn();
      });
      unmount2();
      await act(async () => {
        rejectSignIn(new Error("Unmounted error"));
        await p2;
      });
    });

    it("syncNow 例外発生時にコンポーネントがアンマウントされていた場合、安全に早期リターンすること", async () => {
      const bridge = createMockBridge({
        status: "connected",
        email: "user@example.com",
      });
      const appSettings = createMockAppSettings();
      const syncEngine = createMockSyncEngine();
      let rejectSync!: (err: unknown) => void;
      syncEngine.sync = vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            rejectSync = reject;
          }),
      );

      const { result, unmount } = renderHook(() => useCloudSync(), {
        wrapper: createWrapper({
          cloudSyncBridge: bridge,
          appSettingsRepository: appSettings,
          syncEngine,
        }),
      });

      await waitFor(() => {
        expect(result.current.authState.status).toBe("connected");
      });

      let promise: Promise<void>;
      await act(async () => {
        promise = result.current.syncNow();
      });
      unmount();
      await act(async () => {
        rejectSync(new Error("Unmounted sync error"));
        await promise;
      });
    });
  });
});

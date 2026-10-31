import { useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "../../../app/ServiceProvider";
import type { CloudSyncAuthState } from "../../../bridges/cloud-sync/types";

export interface UseCloudSyncResult {
  authState: CloudSyncAuthState;
  lastSyncedAt: string | null;
  isSyncing: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
}

function parseLastSyncedAt(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") {
    return Number.isNaN(raw) ? null : new Date(raw).toISOString();
  }
  if (typeof raw === "string") {
    const asNum = Number(raw);
    if (!Number.isNaN(asNum) && asNum > 0) {
      return new Date(asNum).toISOString();
    }
    const date = Date.parse(raw);
    if (!Number.isNaN(date)) {
      return new Date(date).toISOString();
    }
  }
  return null;
}

function isUnauthorizedError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (obj.status === 401 || obj.statusCode === 401) {
      return true;
    }
    if (typeof obj.message === "string") {
      const msg = obj.message.toLowerCase();
      if (msg.includes("401") || msg.includes("unauthorized")) {
        return true;
      }
    }
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("401") || msg.includes("unauthorized");
  }
  return false;
}

/**
 * Google Drive クラウド同期状態管理・操作フック（SCR-05: Settings）
 *
 * @see docs/specs/features/settings.md §4.3
 */
export function useCloudSync(): UseCloudSyncResult {
  const { cloudSyncBridge, syncEngine, appSettingsRepository, isReady } =
    useServices();

  const [authState, setAuthState] = useState<CloudSyncAuthState>({
    status: "unlinked",
  });
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const isInitializingRef = useRef<boolean>(true);
  const authStateRef = useRef<CloudSyncAuthState>(authState);
  authStateRef.current = authState;

  // 初期化パイプライン
  useEffect(() => {
    isMountedRef.current = true;
    if (!isReady) return;

    let cancelled = false;

    async function initialize() {
      try {
        // 1. 保存済みの最終同期日時を復元
        let restoredLastSynced: string | null = null;
        if (appSettingsRepository.getCloudSyncLastSyncedAt) {
          const ts = await appSettingsRepository.getCloudSyncLastSyncedAt();
          restoredLastSynced = parseLastSyncedAt(ts);
        } else {
          const raw = await appSettingsRepository.getSetting(
            "cloud_sync_last_synced_at",
          );
          restoredLastSynced = parseLastSyncedAt(raw);
        }

        // 2. 認証状態を取得
        let bridgeState: CloudSyncAuthState = { status: "unlinked" };
        if (cloudSyncBridge?.getAuthState) {
          bridgeState = await cloudSyncBridge.getAuthState();
        }

        // 3. email の補完（bridge に email がなく app_settings にある場合）
        if (
          bridgeState.status === "connected" &&
          !bridgeState.email &&
          appSettingsRepository.getCloudSyncAccountEmail
        ) {
          const savedEmail =
            await appSettingsRepository.getCloudSyncAccountEmail();
          if (savedEmail) {
            bridgeState = { ...bridgeState, email: savedEmail };
          }
        }

        if (!cancelled && isMountedRef.current && isInitializingRef.current) {
          setLastSyncedAt(restoredLastSynced);
          setAuthState(bridgeState);
        }
      } catch (err: unknown) {
        if (!cancelled && isMountedRef.current && isInitializingRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        isInitializingRef.current = false;
      }
    }

    initialize();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
    };
  }, [appSettingsRepository, cloudSyncBridge, isReady]);

  // Google アカウント連携（認可フロー実行）
  const signIn = useCallback(async (): Promise<void> => {
    isInitializingRef.current = false;
    if (isMountedRef.current) {
      setError(null);
      setAuthState({ status: "authenticating" });
    }

    try {
      const resultState = await cloudSyncBridge.signIn();
      if (!isMountedRef.current) return;

      if (resultState.status === "connected") {
        setAuthState(resultState);
        if (
          resultState.email &&
          appSettingsRepository.setCloudSyncAccountEmail
        ) {
          await appSettingsRepository.setCloudSyncAccountEmail(
            resultState.email,
          );
        }

        // 初回自動同期（Pull → Merge → Push）を実行
        setIsSyncing(true);
        try {
          if (syncEngine) {
            await syncEngine.sync();
          }
          const nowStr = new Date().toISOString();
          if (isMountedRef.current) {
            setLastSyncedAt(nowStr);
          }
          if (appSettingsRepository.setCloudSyncLastSyncedAt) {
            await appSettingsRepository.setCloudSyncLastSyncedAt(Date.now());
          }
        } catch (syncErr: unknown) {
          console.warn(
            "Initial sync failed after sign in, proceeding:",
            syncErr,
          );
        } finally {
          if (isMountedRef.current) {
            setIsSyncing(false);
          }
        }
      } else if (resultState.status === "error") {
        setAuthState(resultState);
        setError(resultState.message);
      } else {
        setAuthState(resultState);
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;

      if (isUnauthorizedError(err)) {
        try {
          await cloudSyncBridge.signOut();
        } catch {
          // ignore
        }
        setAuthState({ status: "unlinked" });
        setError("認証が解除されました。再度ログインしてください。");
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setAuthState({ status: "error", message: msg });
        setError(msg);
      }
    }
  }, [appSettingsRepository, cloudSyncBridge, syncEngine]);

  // 連携解除
  const signOut = useCallback(async (): Promise<void> => {
    if (isMountedRef.current) {
      setError(null);
    }
    try {
      await cloudSyncBridge.signOut();
      if (appSettingsRepository.setCloudSyncAccountEmail) {
        await appSettingsRepository.setCloudSyncAccountEmail(null);
      }
      if (appSettingsRepository.setCloudSyncLastSyncedAt) {
        await appSettingsRepository.setCloudSyncLastSyncedAt(null);
      }
      if (isMountedRef.current) {
        setAuthState({ status: "unlinked" });
        setLastSyncedAt(null);
        setError(null);
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, [appSettingsRepository, cloudSyncBridge]);

  // 手動即時同期
  const syncNow = useCallback(async (): Promise<void> => {
    if (authStateRef.current.status !== "connected") {
      return;
    }

    if (isMountedRef.current) {
      setIsSyncing(true);
      setError(null);
    }

    try {
      if (syncEngine) {
        await syncEngine.sync();
      }
      const nowStr = new Date().toISOString();
      if (appSettingsRepository.setCloudSyncLastSyncedAt) {
        await appSettingsRepository.setCloudSyncLastSyncedAt(Date.now());
      }
      if (isMountedRef.current) {
        setLastSyncedAt(nowStr);
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;

      if (isUnauthorizedError(err)) {
        try {
          await cloudSyncBridge.signOut();
          if (appSettingsRepository.setCloudSyncAccountEmail) {
            await appSettingsRepository.setCloudSyncAccountEmail(null);
          }
        } catch {
          // ignore
        }
        setAuthState({ status: "unlinked" });
        setError(
          "Google アカウントの連携が解除されています。再度連携してください。",
        );
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [appSettingsRepository, cloudSyncBridge, syncEngine]);

  return {
    authState,
    lastSyncedAt,
    isSyncing,
    error,
    signIn,
    signOut,
    syncNow,
  };
}

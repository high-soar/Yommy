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

/**
 * Google Drive クラウド同期カスタムフック（Red スタブ）
 */
export function useCloudSync(): UseCloudSyncResult {
  return {
    authState: { status: "unlinked" },
    lastSyncedAt: null,
    isSyncing: false,
    error: null,
    signIn: async () => {
      throw new Error("useCloudSync.signIn is not implemented yet");
    },
    signOut: async () => {
      throw new Error("useCloudSync.signOut is not implemented yet");
    },
    syncNow: async () => {
      throw new Error("useCloudSync.syncNow is not implemented yet");
    },
  };
}

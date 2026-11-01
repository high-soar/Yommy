export interface StorageCacheSummary {
  totalCachedChapters: number;
  totalByteSize: number;
}

export interface UseStorageCacheResult {
  summary: StorageCacheSummary;
  isLoading: boolean;
  isClearing: boolean;
  notice: string | null;
  error: string | null;
  clearCache: (options: { onlyRead: boolean }) => Promise<number>;
  refreshSummary: () => Promise<void>;
}

export function useStorageCache(): UseStorageCacheResult {
  return {
    summary: { totalCachedChapters: 0, totalByteSize: 0 },
    isLoading: true,
    isClearing: false,
    notice: null,
    error: null,
    clearCache: async () => 0,
    refreshSummary: async () => {},
  };
}

import { useCallback, useEffect, useState } from "react";
import { useServices } from "../../../app/ServiceProvider";

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
  const { chapterRepository, isReady } = useServices();

  const [summary, setSummary] = useState<StorageCacheSummary>({
    totalCachedChapters: 0,
    totalByteSize: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshSummary = useCallback(async () => {
    setIsLoading(true);
    try {
      const getSummary = chapterRepository?.getStorageCacheSummary;
      if (typeof getSummary === "function") {
        const result = await getSummary.call(chapterRepository);
        setSummary(result);
      } else {
        setSummary({ totalCachedChapters: 0, totalByteSize: 0 });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "キャッシュ情報の取得に失敗しました",
      );
      setSummary({ totalCachedChapters: 0, totalByteSize: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [chapterRepository]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    void refreshSummary();
  }, [isReady, refreshSummary]);

  const clearCache = useCallback(
    async (options: { onlyRead: boolean }): Promise<number> => {
      setIsClearing(true);
      setError(null);
      setNotice(null);

      let deletedCount = 0;
      try {
        const deleteBodies = chapterRepository?.deleteAllCachedBodies;
        if (typeof deleteBodies !== "function") {
          throw new Error("キャッシュ削除機能が利用できません");
        }

        deletedCount = await deleteBodies.call(chapterRepository, options);
        await refreshSummary();
        setNotice(`本文キャッシュを一括削除しました（${deletedCount}話）`);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "キャッシュの削除に失敗しました",
        );
        throw err;
      } finally {
        setIsClearing(false);
      }
      return deletedCount;
    },
    [chapterRepository, refreshSummary],
  );

  return {
    summary,
    isLoading,
    isClearing,
    notice,
    error,
    clearCache,
    refreshSummary,
  };
}

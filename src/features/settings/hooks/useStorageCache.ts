import { useCallback, useEffect, useState } from "react";
import { useServices } from "../../../app/ServiceProvider";

/**
 * ストレージキャッシュサマリー情報
 */
export interface StorageCacheSummary {
  /** 全登録作品の合計キャッシュ済み話数 */
  totalCachedChapters: number;
  /** 全登録作品の合計キャッシュバイト容量 */
  totalByteSize: number;
}

/**
 * useStorageCache フック戻り値
 */
export interface UseStorageCacheResult {
  /** 全体キャッシュ集計情報 */
  summary: StorageCacheSummary;
  /** キャッシュ情報読込中フラグ */
  isLoading: boolean;
  /** キャッシュ一括削除処理中フラグ */
  isClearing: boolean;
  /** 削除完了通知メッセージ */
  notice: string | null;
  /** キャッシュ操作エラーメッセージ */
  error: string | null;
  /** 全体本文キャッシュ一括削除ハンドラー */
  clearCache: (options: { onlyRead: boolean }) => Promise<number>;
  /** キャッシュサマリー再取得ハンドラー */
  refreshSummary: () => Promise<void>;
}

/**
 * 設定画面（SCR-05）におけるアプリ全体キャッシュ集計・一括削除フック
 */
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

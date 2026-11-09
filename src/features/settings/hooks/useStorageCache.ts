import { useCallback, useEffect, useRef, useState } from "react";
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
  const isMountedRef = useRef<boolean>(true);
  const isClearingRef = useRef<boolean>(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [summary, setSummary] = useState<StorageCacheSummary>({
    totalCachedChapters: 0,
    totalByteSize: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshSummary = useCallback(async (): Promise<void> => {
    if (!isMountedRef.current) return;
    setIsLoading(true);
    // R1-02: 再取得開始時に前回のエラーをクリア
    setError(null);
    try {
      if (!chapterRepository) {
        if (isMountedRef.current) {
          setSummary({ totalCachedChapters: 0, totalByteSize: 0 });
        }
        return;
      }
      // R1-08: 不要な typeof === "function" の防御分岐を整理
      const result = await chapterRepository.getStorageCacheSummary();
      if (isMountedRef.current) {
        setSummary(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(
          err instanceof Error
            ? err.message
            : "キャッシュ情報の取得に失敗しました",
        );
        // R1-02: 取得失敗時は前回の summary を維持し 0 B 誤表示を防止
      }
      throw err;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [chapterRepository]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    void refreshSummary().catch(() => {
      // 初期ロード時のエラーは setError 済みのため unhandled rejection を防ぐ
    });
  }, [isReady, refreshSummary]);

  const clearCache = useCallback(
    async (options: { onlyRead: boolean }): Promise<number> => {
      if (!isMountedRef.current || isClearingRef.current) return 0;
      isClearingRef.current = true;
      setIsClearing(true);
      setError(null);
      setNotice(null);

      let deletedCount = 0;
      try {
        if (!chapterRepository) {
          throw new Error("キャッシュ削除機能が利用できません");
        }
        // R1-08: 不要な typeof === "function" の防御分岐を整理
        deletedCount = await chapterRepository.deleteAllCachedBodies(options);
        // R1-02: 再取得が成功した場合のみ完了通知を設定（失敗時は catch 側で error 設定・通知非表示）
        await refreshSummary();
        if (isMountedRef.current) {
          setNotice(`本文キャッシュを一括削除しました（${deletedCount}話）`);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(
            err instanceof Error
              ? err.message
              : "キャッシュの削除に失敗しました",
          );
        }
        throw err;
      } finally {
        isClearingRef.current = false;
        if (isMountedRef.current) {
          setIsClearing(false);
        }
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

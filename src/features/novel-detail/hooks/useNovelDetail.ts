import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServices } from "../../../app/ServiceProvider";
import type { NovelRecord, ChapterSummary } from "../../../storage/types";
import type { UseNovelDetailResult } from "../types";
import {
  SHORT_TIMEOUT_MS,
  STANDARD_TIMEOUT_MS,
  PREFETCH_INTERVAL_MS,
} from "../../../shared/constants/cache";
import { isChapterFresh, delay } from "../../../shared/utils/cache";
import { fetchFullNovelIndex } from "../../../parsers/fetchFullNovelIndex";

export type { UseNovelDetailResult } from "../types";

/** 初回ロード・手動リロード失敗時のデフォルトエラーメッセージ */
export const DEFAULT_FETCH_ERROR_MESSAGE = "作品情報の取得に失敗しました";
/** 目次再取得（更新）失敗時のデフォルトエラーメッセージ */
export const DEFAULT_REFRESH_ERROR_MESSAGE = "目次の更新に失敗しました";
/** 作品削除失敗時のデフォルトエラーメッセージ */
export const DEFAULT_DELETE_ERROR_MESSAGE = "作品の削除に失敗しました";
/** 本文キャッシュ削除失敗時のデフォルトエラーメッセージ */
export const DEFAULT_CLEAR_CACHE_ERROR_MESSAGE =
  "本文キャッシュの削除に失敗しました";

/**
 * 例外オブジェクトからユーザー向けエラーメッセージを安全に抽出する。
 * Error インスタンスかつ非空の message を持つ場合はその message を採用し、
 * それ以外はフォールバックとして指定の defaultMessage を返す。
 */
function extractErrorMessage(err: unknown, defaultMessage: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return defaultMessage;
}

/**
 * 作品詳細・目次画面（SCR-02: `/novels/:novelId`）の状態管理カスタムフック。
 *
 * 【提供機能】
 * 1. 初回ロード（`reloadDetail`）:
 *    - `isReady` 完了後、`novelRepository.getNovelById(novelId)` と
 *      `chapterRepository.listChaptersByNovelId(novelId)` を並行取得。
 *    - アンマウント時の `isMounted` フラグにより、非同期解決時の不要な状態更新を防止。
 * 2. 目次再取得（`refreshToc`）:
 *    - カクヨム等の作品トップ HTML を取得し最新目次を抽出。
 *    - `novelRepository.upsertNovelWithToc` で既存本文キャッシュ・既読・しおりを保持したまま差分反映。
 *    - 新着話数（+N話）または「最新の状態です」のインライン通知を設定。
 * 3. 作品削除確認ダイアログ制御（`openDeleteDialog` / `closeDeleteDialog`）:
 *    - ダイアログの開閉制御。削除中（`isDeleting === true`）のキャンセルをガード。
 * 4. 作品削除確定（`confirmDeleteNovel`）:
 *    - `novelRepository.deleteNovel(novelId)` を実行（SQLite カスケード制約により関連話数も一括削除）。
 *    - 成功時はダイアログを閉じ `true` を返却（呼び出し元で本棚 `/` への遷移 `TR-07` を実行）。
 *
 * @param novelId - 表示対象の作品ID（例: `kakuyomu:1177354054881162325`）
 * @returns 作品詳細・目次画面に必要な状態および操作関数一式
 */
export function useNovelDetail(novelId: string): UseNovelDetailResult {
  const {
    httpClient,
    parserRegistry,
    novelRepository,
    chapterRepository,
    syncEngine,
    isReady,
  } = useServices();

  const [novel, setNovel] = useState<NovelRecord | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isBatchCaching, setIsBatchCaching] = useState<boolean>(false);
  const [batchCacheProgress, setBatchCacheProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isClearCacheDialogOpen, setIsClearCacheDialogOpen] =
    useState<boolean>(false);
  const [isClearingCache, setIsClearingCache] = useState<boolean>(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isBatchCachingRef = useRef<boolean>(false);
  const batchAbortControllerRef = useRef<AbortController | null>(null);

  // アンマウント時の一括キャッシュ中断クリーンアップ
  useEffect(() => {
    return () => {
      if (batchAbortControllerRef.current) {
        batchAbortControllerRef.current.abort();
        batchAbortControllerRef.current = null;
      }
      isBatchCachingRef.current = false;
    };
  }, []);

  // 全話有効キャッシュ済み判定（AC-ND-13）
  const isAllCached = useMemo(() => {
    if (!novel || chapters.length === 0 || novel.totalChapters === 0) {
      return false;
    }
    const now = Date.now();
    return chapters.every((ch) => isChapterFresh(ch, now));
  }, [novel, chapters]);

  // 初回ロード（isReady 完了時に自動実行、アンマウント時のリークを防止）
  useEffect(() => {
    if (!isReady) return;
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    Promise.all([
      novelRepository.getNovelById(novelId),
      chapterRepository.listChaptersByNovelId(novelId),
    ])
      .then(([fetchedNovel, fetchedChapters]) => {
        if (isMounted) {
          if (fetchedNovel?.hasNewUpdate) {
            void novelRepository.clearNewUpdate(novelId);
            setNovel({ ...fetchedNovel, hasNewUpdate: false });
          } else {
            setNovel(fetchedNovel);
          }
          setChapters(fetchedChapters);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(extractErrorMessage(err, DEFAULT_FETCH_ERROR_MESSAGE));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isReady, novelId, novelRepository, chapterRepository]);

  /**
   * 作品情報およびエピソード目次一覧を手動で再取得・更新する
   */
  const reloadDetail = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedNovel, fetchedChapters] = await Promise.all([
        novelRepository.getNovelById(novelId),
        chapterRepository.listChaptersByNovelId(novelId),
      ]);
      setNovel(fetchedNovel);
      setChapters(fetchedChapters);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, DEFAULT_FETCH_ERROR_MESSAGE));
    } finally {
      setIsLoading(false);
    }
  }, [novelId, novelRepository, chapterRepository]);

  /**
   * 作品トップ HTML をリモートから再取得して最新目次へ更新する（差分更新）。
   * 既存の本文キャッシュや既読・しおり状態は保持される。
   *
   * @returns 成功時は `true`、失敗時または未ロード/処理中スキップ時は `false`
   */
  const refreshToc = useCallback(async (): Promise<boolean> => {
    if (
      !novel ||
      isRefreshing ||
      isDeleting ||
      isBatchCaching ||
      isBatchCachingRef.current ||
      isClearingCache
    ) {
      return false;
    }

    setIsRefreshing(true);
    setError(null);
    setRefreshMessage(null);

    const prevCount = chapters.length;
    let isSuccess = false;
    try {
      const parser = parserRegistry.requireParser(novel.canonicalUrl);
      const novelIndex = await fetchFullNovelIndex(
        httpClient,
        parser,
        novel.canonicalUrl,
      );

      await novelRepository.upsertNovelWithToc(
        novelIndex,
        new Date().toISOString(),
      );

      const [updatedNovel, updatedChapters] = await Promise.all([
        novelRepository.getNovelById(novelId),
        chapterRepository.listChaptersByNovelId(novelId),
      ]);

      setNovel(updatedNovel);
      setChapters(updatedChapters);

      const addedCount = Math.max(0, updatedChapters.length - prevCount);
      if (addedCount > 0) {
        setRefreshMessage(`目次を更新しました（+${addedCount}話）`);
      } else {
        setRefreshMessage("最新の状態です");
      }

      isSuccess = true;
    } catch (err: unknown) {
      setError(extractErrorMessage(err, DEFAULT_REFRESH_ERROR_MESSAGE));
      isSuccess = false;
    } finally {
      setIsRefreshing(false);
    }
    return isSuccess;
  }, [
    novel,
    chapters.length,
    isRefreshing,
    isDeleting,
    isBatchCaching,
    isClearingCache,
    parserRegistry,
    httpClient,
    novelRepository,
    chapterRepository,
    novelId,
  ]);

  /**
   * 作品内の未取得話（および7日経過した古いキャッシュ）をレートリミット（1.5秒）を守りながら
   * 順次バックグラウンド直列取得・SQLite 保存する（AC-ND-11, AC-ND-12）。
   */
  const startBatchCache = useCallback(async (): Promise<void> => {
    if (
      !novel ||
      isBatchCaching ||
      isBatchCachingRef.current ||
      isRefreshing ||
      isDeleting ||
      isClearingCache
    ) {
      return;
    }

    const now = Date.now();
    const targetChapters = chapters
      .filter((ch) => !isChapterFresh(ch, now))
      .sort((a, b) => a.chapterIndex - b.chapterIndex);

    if (targetChapters.length === 0) {
      setError(null);
      setRefreshMessage("全話キャッシュ済みです");
      return;
    }

    isBatchCachingRef.current = true;
    const abortController = new AbortController();
    batchAbortControllerRef.current = abortController;
    const signal = abortController.signal;

    setIsBatchCaching(true);
    setBatchCacheProgress({ current: 0, total: targetChapters.length });
    setError(null);
    setRefreshMessage(null);

    try {
      const parser = parserRegistry.requireParser(novel.canonicalUrl);

      for (let i = 0; i < targetChapters.length; i++) {
        const target = targetChapters[i];
        const hasStaleCache = target.downloadedAt !== null;
        const timeoutMs = hasStaleCache
          ? SHORT_TIMEOUT_MS
          : STANDARD_TIMEOUT_MS;

        let html: string;
        try {
          const response = await httpClient.getHtml({
            url: target.url,
            timeoutMs,
            signal,
          });
          if (response.status >= 400) {
            throw new Error(`HTTP ${response.status}`);
          }
          html = response.html;
        } catch (err: unknown) {
          if (signal.aborted) {
            break;
          }
          if (hasStaleCache) {
            setBatchCacheProgress({
              current: i + 1,
              total: targetChapters.length,
            });
            if (i < targetChapters.length - 1) {
              await delay(PREFETCH_INTERVAL_MS, signal);
            }
            continue;
          }
          throw new Error(
            `第${target.chapterIndex}話の取得に失敗したためキャッシュを中断しました: ${extractErrorMessage(err, "通信エラー")}`,
          );
        }

        const parsedContent = parser.parseChapterContent(html, target.url);
        const downloadedAt = new Date().toISOString();

        await chapterRepository.saveChapterBody(
          novelId,
          target.chapterIndex,
          parsedContent,
          downloadedAt,
        );

        setChapters((prev) =>
          prev.map((ch) =>
            ch.chapterIndex === target.chapterIndex
              ? { ...ch, downloadedAt, byteSize: parsedContent.byteSize }
              : ch,
          ),
        );

        setNovel((prev) => {
          const isNewCache = target.downloadedAt === null;
          const oldSize = target.byteSize;
          return {
            ...prev!,
            cachedChapters: isNewCache
              ? prev!.cachedChapters + 1
              : prev!.cachedChapters,
            totalByteSize: Math.max(
              0,
              prev!.totalByteSize - oldSize + parsedContent.byteSize,
            ),
            updatedAt: downloadedAt,
          };
        });

        setBatchCacheProgress({
          current: i + 1,
          total: targetChapters.length,
        });

        if (i < targetChapters.length - 1) {
          await delay(PREFETCH_INTERVAL_MS, signal);
        }
      }

      if (!signal.aborted) {
        const latestNovel = await novelRepository.getNovelById(novelId);
        if (latestNovel) {
          setNovel(latestNovel);
        }
        setRefreshMessage("全話のキャッシュを取得しました");
      }
    } catch (err: unknown) {
      if (!signal.aborted) {
        setError(extractErrorMessage(err, "キャッシュの取得に失敗しました"));
      }
    } finally {
      isBatchCachingRef.current = false;
      setIsBatchCaching(false);
      setBatchCacheProgress(null);
      batchAbortControllerRef.current = null;
    }
  }, [
    novel,
    chapters,
    isBatchCaching,
    isRefreshing,
    isDeleting,
    isClearingCache,
    parserRegistry,
    httpClient,
    chapterRepository,
    novelRepository,
    novelId,
  ]);

  /**
   * 実行中の一括キャッシュ処理を直ちに中断（キャンセル）する（AC-ND-12）。
   */
  const cancelBatchCache = useCallback(() => {
    if (batchAbortControllerRef.current) {
      batchAbortControllerRef.current.abort();
      batchAbortControllerRef.current = null;
    }
  }, []);

  /**
   * 作品削除確認ダイアログを開く
   */
  const openDeleteDialog = useCallback(() => {
    setIsDeleteDialogOpen(true);
  }, []);

  /**
   * 作品削除確認ダイアログを閉じる（削除処理中は安全のため閉じない）
   */
  const closeDeleteDialog = useCallback(() => {
    if (isDeleting) {
      return;
    }
    setIsDeleteDialogOpen(false);
  }, [isDeleting]);

  /**
   * 作品削除を確定実行し、DBから作品レコードおよび関連チャプターを一括削除する。
   *
   * @returns 成功時は `true`（ダイアログを閉じる）、失敗時は `false`（ダイアログを開いたままエラー設定）
   */
  const confirmDeleteNovel = useCallback(async (): Promise<boolean> => {
    if (
      isDeleting ||
      isRefreshing ||
      isBatchCaching ||
      isBatchCachingRef.current ||
      isClearingCache
    ) {
      return false;
    }

    setIsDeleting(true);
    setError(null);

    let isSuccess = false;
    try {
      await novelRepository.deleteNovel(novelId);
      if (syncEngine) {
        syncEngine.notifyChanged().catch(() => {});
      }
      setIsDeleteDialogOpen(false);
      isSuccess = true;
    } catch (err: unknown) {
      setError(extractErrorMessage(err, DEFAULT_DELETE_ERROR_MESSAGE));
      isSuccess = false;
    } finally {
      setIsDeleting(false);
    }
    return isSuccess;
  }, [
    isDeleting,
    isRefreshing,
    isBatchCaching,
    isClearingCache,
    novelRepository,
    syncEngine,
    novelId,
  ]);

  /**
   * 本文キャッシュ整理確認ダイアログを開く
   */
  const openClearCacheDialog = useCallback(() => {
    setIsClearCacheDialogOpen(true);
  }, []);

  /**
   * 本文キャッシュ整理確認ダイアログを閉じる（削除処理中は安全のため閉じない）
   */
  const closeClearCacheDialog = useCallback(() => {
    if (isClearingCache) {
      return;
    }
    setIsClearCacheDialogOpen(false);
  }, [isClearingCache]);

  /**
   * 本文キャッシュ削除を確定実行し、親作品レコードとエピソード一覧を即時再取得・反映する。
   *
   * @param options.onlyRead - true の場合は既読話のみ削除、false の場合は全話削除
   * @returns 削除された話数（失敗時は 0）
   */
  const confirmClearCache = useCallback(
    async (options: { onlyRead: boolean }): Promise<number> => {
      if (
        isClearingCache ||
        isRefreshing ||
        isBatchCaching ||
        isDeleting ||
        isBatchCachingRef.current
      ) {
        return 0;
      }

      setIsClearingCache(true);
      setError(null);

      let deletedCount = 0;
      try {
        deletedCount = await chapterRepository.deleteCachedBodies(
          novelId,
          options,
        );
        setIsClearCacheDialogOpen(false);
        if (deletedCount === 0) {
          // R1-09: 削除0件時は無駄なDB再クエリを行わず早期リターン
          setRefreshMessage("削除対象の本文キャッシュはありませんでした");
          return 0;
        }
        const [updatedNovel, updatedChapters] = await Promise.all([
          novelRepository.getNovelById(novelId),
          chapterRepository.listChaptersByNovelId(novelId),
        ]);
        setNovel(updatedNovel);
        setChapters(updatedChapters);
        setRefreshMessage(`本文キャッシュを削除しました（${deletedCount}話）`);
      } catch (err: unknown) {
        setError(extractErrorMessage(err, DEFAULT_CLEAR_CACHE_ERROR_MESSAGE));
      } finally {
        setIsClearingCache(false);
      }
      return deletedCount;
    },
    [
      isClearingCache,
      isRefreshing,
      isBatchCaching,
      isDeleting,
      chapterRepository,
      novelRepository,
      novelId,
    ],
  );

  return {
    novel,
    chapters,
    isLoading,
    isRefreshing,
    isBatchCaching,
    batchCacheProgress,
    isAllCached,
    isDeleteDialogOpen,
    isDeleting,
    isClearCacheDialogOpen,
    isClearingCache,
    refreshMessage,
    error,
    refreshToc,
    startBatchCache,
    cancelBatchCache,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDeleteNovel,
    openClearCacheDialog,
    closeClearCacheDialog,
    confirmClearCache,
    toggleFavorite: async () => false,
    reloadDetail,
  };
}

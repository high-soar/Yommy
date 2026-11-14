import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServices } from "../../../app/ServiceProvider";
import type {
  NovelRecord,
  ChapterSummary,
  DownloadQueueItem,
} from "../../../storage/types";
import type { UseNovelDetailResult } from "../types";
import {
  SHORT_TIMEOUT_MS,
  STANDARD_TIMEOUT_MS,
  PREFETCH_INTERVAL_MS,
} from "../../../shared/constants/cache";
import { isChapterFresh, delay } from "../../../shared/utils/cache";
import { fetchFullNovelIndex } from "../../../parsers/fetchFullNovelIndex";
import type { CacheNovelProgress } from "../../cache/types";

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
/** お気に入り更新失敗時のデフォルトエラーメッセージ */
export const DEFAULT_TOGGLE_FAVORITE_ERROR_MESSAGE =
  "お気に入りの更新に失敗しました";

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
 * CacheNovelProgress がバックグラウンド一括キャッシュ実行中状態かどうかを判定する。
 */
function isBatchProgressActive(
  progress: CacheNovelProgress | null,
): progress is CacheNovelProgress & { status: "running" | "preempted" } {
  return (
    progress !== null &&
    (progress.status === "running" || progress.status === "preempted")
  );
}

/**
 * 未キャッシュまたは鮮度切れ（7日超）のエピソードを chapterIndex 昇順で抽出する。
 */
function getUncachedOrStaleChapters(
  chapters: ChapterSummary[],
  now: number,
): ChapterSummary[] {
  return chapters
    .filter((ch) => !isChapterFresh(ch, now))
    .sort((a, b) => a.chapterIndex - b.chapterIndex);
}

/**
 * download_queue の `failed` 行のうち、対象話が未キャッシュである chapterIndex を昇順で抽出する。
 */
function extractUncachedFailedChapterIndexes(
  chapters: ChapterSummary[],
  queueItems: DownloadQueueItem[],
): number[] {
  const downloadedMap = new Map(
    chapters.map((ch) => [ch.chapterIndex, ch.downloadedAt !== null]),
  );
  return queueItems
    .filter(
      (item) =>
        item.status === "failed" &&
        downloadedMap.get(item.chapterIndex) !== true,
    )
    .map((item) => item.chapterIndex)
    .sort((a, b) => a - b);
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
    queueRepository,
    syncEngine,
    cacheScheduler,
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
  const [pendingCacheCount, setPendingCacheCount] = useState<number>(0);
  const [failedChapterIndexes, setFailedChapterIndexes] = useState<number[]>(
    [],
  );
  const failedCacheCount = failedChapterIndexes.length;
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isClearCacheDialogOpen, setIsClearCacheDialogOpen] =
    useState<boolean>(false);
  const [isClearingCache, setIsClearingCache] = useState<boolean>(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isRefreshingRef = useRef<boolean>(false);
  const isBatchCachingRef = useRef<boolean>(false);
  const isDeletingRef = useRef<boolean>(false);
  const isClearingCacheRef = useRef<boolean>(false);
  const isTogglingFavoriteRef = useRef<boolean>(false);
  const pendingSilentReloadRef = useRef<boolean>(false);
  const isDeletedRef = useRef<boolean>(false);
  const batchAbortControllerRef = useRef<AbortController | null>(null);
  const batchCancelRequestedRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const progressSyncSeqRef = useRef<number>(0);
  const exclusiveOpSeqRef = useRef<number>(0);
  const cacheSchedulerRef = useRef(cacheScheduler);
  cacheSchedulerRef.current = cacheScheduler;
  const queueRepositoryRef = useRef(queueRepository);
  queueRepositoryRef.current = queueRepository;

  const runIfMounted = useCallback((callback: () => void) => {
    if (isMountedRef.current) {
      callback();
    }
  }, []);

  const isAnyExclusiveOperationActive = useCallback(
    () =>
      isRefreshingRef.current ||
      isDeletingRef.current ||
      isClearingCacheRef.current,
    [],
  );

  // マウント状態の追跡（isReady 遷移と独立）
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // アンマウント・作品切替時のクリーンアップ（isReady 完了後のみ有効化し、CacheScheduler 未注入時のみレガシー中断・リセットを行う）
  useEffect(() => {
    if (!isReady) {
      return;
    }
    isDeletedRef.current = false;
    pendingSilentReloadRef.current = false;
    batchCancelRequestedRef.current = false;
    return () => {
      if (batchAbortControllerRef.current) {
        batchAbortControllerRef.current.abort();
        batchAbortControllerRef.current = null;
      }
      isRefreshingRef.current = false;
      isBatchCachingRef.current = false;
      batchCancelRequestedRef.current = false;
      isDeletingRef.current = false;
      isClearingCacheRef.current = false;
      isTogglingFavoriteRef.current = false;
      if (!cacheSchedulerRef.current) {
        void queueRepositoryRef.current.resetInterruptedToPending(novelId);
      }
    };
  }, [isReady, novelId]);

  // 全話有効キャッシュ済み判定（AC-ND-13）
  const isAllCached = useMemo(() => {
    if (!novel || chapters.length === 0 || novel.totalChapters === 0) {
      return false;
    }
    const now = Date.now();
    return chapters.every((ch) => isChapterFresh(ch, now));
  }, [novel, chapters]);

  /**
   * download_queue と各話キャッシュ状態を同期し、pending/failed 状態を State に反映する
   */
  const syncQueueState = useCallback(
    async (
      currentNovelId: string,
      currentChapters: ChapterSummary[],
    ): Promise<void> => {
      // 1. スケジューラ実行中でなければ中断された downloading を pending にリセット
      if (cacheScheduler?.isNovelBatchCaching(currentNovelId) !== true) {
        await queueRepository.resetInterruptedToPending(currentNovelId);
      }

      const now = Date.now();
      const allCached =
        currentChapters.length > 0 &&
        currentChapters.every((ch) => isChapterFresh(ch, now));

      // 2. 全話有効キャッシュ済みの場合はキュー全削除
      if (allCached) {
        await queueRepository.clearNovelQueue(currentNovelId);
        runIfMounted(() => {
          setPendingCacheCount(0);
          setFailedChapterIndexes([]);
        });
        return;
      }

      // 3. 有効キャッシュ済みまたは completed のレコードをキューから除外
      const freshIndexes = currentChapters
        .filter((ch) => isChapterFresh(ch, now))
        .map((ch) => ch.chapterIndex);
      const currentQueue = await queueRepository.listByNovelId(currentNovelId);
      const completedIndexes = currentQueue
        .filter((item) => item.status === "completed")
        .map((item) => item.chapterIndex);

      const toRemoveIndexes = Array.from(
        new Set([...freshIndexes, ...completedIndexes]),
      );
      if (toRemoveIndexes.length > 0) {
        await queueRepository.deleteByNovelAndChapters(
          currentNovelId,
          toRemoveIndexes,
        );
      }

      // 4. 残存キューから集計
      const remainingItems =
        await queueRepository.listByNovelId(currentNovelId);
      const pCount = remainingItems.filter(
        (item) => item.status === "pending",
      ).length;
      const uncachedFailedIndexes = extractUncachedFailedChapterIndexes(
        currentChapters,
        remainingItems,
      );

      if (!isMountedRef.current) return;
      setPendingCacheCount(pCount);
      setFailedChapterIndexes(uncachedFailedIndexes);
    },
    [cacheScheduler, queueRepository, runIfMounted],
  );

  const restoreSchedulerProgress = useCallback(() => {
    if (!cacheScheduler) {
      return;
    }
    const currentProgress = cacheScheduler.getNovelProgress(novelId);
    if (isBatchProgressActive(currentProgress)) {
      isBatchCachingRef.current = true;
      setIsBatchCaching(true);
      setBatchCacheProgress({
        current: currentProgress.current,
        total: currentProgress.total,
      });
      setFailedChapterIndexes(currentProgress.failedChapterIndexes);
    } else {
      isBatchCachingRef.current = false;
      setIsBatchCaching(false);
      setBatchCacheProgress(null);
    }
  }, [cacheScheduler, novelId]);

  const syncProgressFromDb = useCallback(
    (syncSeq: number, progressFailedIndexes: number[]) => {
      void (async () => {
        try {
          const [fetchedNovel, fetchedChapters, queueItems] = await Promise.all(
            [
              novelRepository.getNovelById(novelId),
              chapterRepository.listChaptersByNovelId(novelId),
              queueRepository.listByNovelId(novelId),
            ],
          );
          if (
            !isMountedRef.current ||
            isDeletedRef.current ||
            isDeletingRef.current ||
            syncSeq !== progressSyncSeqRef.current
          ) {
            return;
          }
          if (fetchedNovel) {
            setNovel((prev) =>
              prev
                ? { ...fetchedNovel, updatedAt: prev.updatedAt }
                : fetchedNovel,
            );
          }
          setChapters(fetchedChapters);
          const pendingCount = queueItems.filter(
            (item) => item.status === "pending",
          ).length;
          setPendingCacheCount(pendingCount);
          const dbFailedIndexes = extractUncachedFailedChapterIndexes(
            fetchedChapters,
            queueItems,
          );
          const mergedFailedIndexes = Array.from(
            new Set([...dbFailedIndexes, ...progressFailedIndexes]),
          ).sort((a, b) => a - b);
          setFailedChapterIndexes(mergedFailedIndexes);
        } catch {
          // バックグラウンド進捗同期の例外は後続イベントで回復するため安全に無視
        }
      })();
    },
    [novelId, novelRepository, chapterRepository, queueRepository],
  );

  // CacheScheduler の現在進捗の即時復元および進捗イベント購読
  useEffect(() => {
    if (!isReady || !cacheScheduler) {
      return;
    }
    restoreSchedulerProgress();

    return cacheScheduler.subscribeProgress(novelId, (progress) => {
      const syncSeq = ++progressSyncSeqRef.current;

      if (isBatchProgressActive(progress)) {
        isBatchCachingRef.current = true;
        setIsBatchCaching(true);
        setBatchCacheProgress({
          current: progress.current,
          total: progress.total,
        });
        setFailedChapterIndexes(progress.failedChapterIndexes);
      } else {
        isBatchCachingRef.current = false;
        setIsBatchCaching(false);
        setBatchCacheProgress(null);
        setFailedChapterIndexes(progress.failedChapterIndexes);
        if (progress.status === "completed") {
          if (progress.failedCount === 0) {
            setError(null);
            setRefreshMessage("全話のキャッシュを取得しました");
          } else {
            setRefreshMessage(null);
            setError(
              `${progress.failedCount}話の取得に失敗しました（再試行可能）`,
            );
          }
        }
      }

      syncProgressFromDb(syncSeq, progress.failedChapterIndexes);
    });
  }, [
    isReady,
    cacheScheduler,
    novelId,
    restoreSchedulerProgress,
    syncProgressFromDb,
  ]);

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
          void (async () => {
            try {
              await syncQueueState(novelId, fetchedChapters);
            } catch {
              // 初回キュー同期失敗時は安全に握りつぶす
            }
          })();
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
  }, [isReady, novelId, novelRepository, chapterRepository, syncQueueState]);

  /**
   * 作品情報およびエピソード目次一覧を再取得・更新する（`silent: true` 時は `isLoading` を変更せず一覧 DOM・スクロール位置を保持）
   */
  const reloadDetail = useCallback(
    async (options?: { silent?: boolean }): Promise<void> => {
      const silent = options?.silent === true;
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const [fetchedNovel, fetchedChapters] = await Promise.all([
          novelRepository.getNovelById(novelId),
          chapterRepository.listChaptersByNovelId(novelId),
        ]);
        if (!isMountedRef.current) return;
        if (fetchedNovel?.hasNewUpdate) {
          await novelRepository.clearNewUpdate(novelId);
          if (!isMountedRef.current) return;
          setNovel({ ...fetchedNovel, hasNewUpdate: false });
        } else {
          setNovel(fetchedNovel);
        }
        setChapters(fetchedChapters);
        await syncQueueState(novelId, fetchedChapters);
        runIfMounted(restoreSchedulerProgress);
      } catch (err: unknown) {
        if (!silent && isMountedRef.current) {
          setError(extractErrorMessage(err, DEFAULT_FETCH_ERROR_MESSAGE));
        }
      } finally {
        if (!silent && isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [
      novelId,
      novelRepository,
      chapterRepository,
      syncQueueState,
      runIfMounted,
      restoreSchedulerProgress,
    ],
  );

  // 排他操作完了後に保留されていた自動 Pull サイレントリロードを遅延実行する (R1-22)
  const flushPendingSilentReload = useCallback(() => {
    if (
      pendingSilentReloadRef.current &&
      isMountedRef.current &&
      !isDeletedRef.current
    ) {
      pendingSilentReloadRef.current = false;
      void reloadDetail({ silent: true });
    }
  }, [reloadDetail]);

  // 全画面自動 Pull 完了時に表示中作品・目次・既読状態をサイレント更新 (AC-ND-28)
  useEffect(() => {
    if (!isReady || !syncEngine?.subscribePullCompleted) {
      return;
    }
    return syncEngine.subscribePullCompleted((result) => {
      if (!result.pulled) {
        return;
      }
      if (isAnyExclusiveOperationActive()) {
        pendingSilentReloadRef.current = true;
        return;
      }
      void reloadDetail({ silent: true });
    });
  }, [isReady, syncEngine, isAnyExclusiveOperationActive, reloadDetail]);

  /**
   * 作品トップ HTML をリモートから再取得して最新目次へ更新する（差分更新）。
   * 既存の本文キャッシュや既読・しおり状態は保持される。
   *
   * @returns 成功時は `true`、失敗時または未ロード/処理中スキップ時は `false`
   */
  const refreshToc = useCallback(async (): Promise<boolean> => {
    if (!novel || isAnyExclusiveOperationActive()) {
      return false;
    }

    isRefreshingRef.current = true;
    exclusiveOpSeqRef.current += 1;
    setIsRefreshing(true);
    setError(null);
    setRefreshMessage(null);

    const prevCount = chapters.length;
    let isSuccess = false;
    const wasBatchCaching =
      cacheScheduler?.isNovelBatchCaching(novelId) === true;

    const resumePausedBatchCacheIfNeeded = async (): Promise<void> => {
      if (!cacheScheduler || !wasBatchCaching) {
        return;
      }
      const isResumeBlocked = (): boolean =>
        isDeletedRef.current ||
        isAnyExclusiveOperationActive() ||
        cacheScheduler.getNovelProgress(novelId)?.status === "cancelled";

      if (isResumeBlocked()) {
        return;
      }
      try {
        const [latestChapters, queueAfterRefresh] = await Promise.all([
          chapterRepository.listChaptersByNovelId(novelId),
          queueRepository.listByNovelId(novelId),
        ]);
        if (isResumeBlocked()) {
          return;
        }
        const remainingTargets = getUncachedOrStaleChapters(
          latestChapters,
          Date.now(),
        );
        const failedIndexSet = new Set(
          queueAfterRefresh
            .filter((item) => item.status === "failed")
            .map((item) => item.chapterIndex),
        );
        const remainingIndexes = remainingTargets
          .filter((ch) => !failedIndexSet.has(ch.chapterIndex))
          .map((ch) => ch.chapterIndex);
        if (remainingIndexes.length > 0) {
          await cacheScheduler.enqueueBatchCache(novelId, remainingIndexes);
          runIfMounted(restoreSchedulerProgress);
        }
      } catch {
        // 目次更新後処理でのバックグラウンド再開失敗は後続クリーンアップを妨げない
      }
    };

    try {
      await cacheScheduler?.pauseNovelTasks(novelId);
      if (!isMountedRef.current) {
        return false;
      }

      const parser = parserRegistry.requireParser(novel.canonicalUrl);
      const normalizedUrl = parser.normalizeWorkUrl(novel.canonicalUrl);
      const novelIndex = await fetchFullNovelIndex(
        httpClient,
        parser,
        normalizedUrl,
      );

      const upserted = await novelRepository.upsertNovelWithToc(
        novelIndex,
        new Date().toISOString(),
        { updateOnly: true },
      );
      if (!upserted) {
        return false;
      }

      const [updatedNovel, updatedChapters] = await Promise.all([
        novelRepository.getNovelById(novelId),
        chapterRepository.listChaptersByNovelId(novelId),
      ]);

      if (updatedNovel?.hasNewUpdate) {
        await novelRepository.clearNewUpdate(novelId);
        runIfMounted(() => {
          setNovel({ ...updatedNovel, hasNewUpdate: false });
        });
      } else {
        runIfMounted(() => {
          setNovel(updatedNovel);
        });
      }
      runIfMounted(() => {
        setChapters(updatedChapters);
      });
      await syncQueueState(novelId, updatedChapters);

      const addedCount = Math.max(0, updatedChapters.length - prevCount);
      runIfMounted(() => {
        if (addedCount > 0) {
          setRefreshMessage(`目次を更新しました（+${addedCount}話）`);
        } else {
          setRefreshMessage("最新の状態です");
        }
      });

      isSuccess = true;
    } catch (err: unknown) {
      runIfMounted(() => {
        setError(extractErrorMessage(err, DEFAULT_REFRESH_ERROR_MESSAGE));
      });
      isSuccess = false;
    } finally {
      isRefreshingRef.current = false;
      runIfMounted(() => {
        setIsRefreshing(false);
      });
      runIfMounted(restoreSchedulerProgress);
      await resumePausedBatchCacheIfNeeded();
      flushPendingSilentReload();
    }
    return isSuccess;
  }, [
    novel,
    chapters.length,
    isAnyExclusiveOperationActive,
    cacheScheduler,
    parserRegistry,
    httpClient,
    novelRepository,
    chapterRepository,
    queueRepository,
    syncQueueState,
    novelId,
    runIfMounted,
    restoreSchedulerProgress,
    flushPendingSilentReload,
  ]);

  /**
   * 作品内の未取得話（および7日経過した古いキャッシュ）をレートリミット（1.5秒）を守りながら
   * 順次バックグラウンド直列取得・SQLite 保存する（AC-ND-11, AC-ND-12, AC-ND-24, AC-ND-25）。
   */
  const startBatchCache = useCallback(async (): Promise<void> => {
    if (
      !novel ||
      isAnyExclusiveOperationActive() ||
      isBatchCachingRef.current ||
      cacheScheduler?.isNovelBatchCaching(novelId) === true
    ) {
      return;
    }

    const now = Date.now();
    const targetChapters = getUncachedOrStaleChapters(chapters, now);

    if (targetChapters.length === 0) {
      await queueRepository.clearNovelQueue(novelId);
      runIfMounted(() => {
        setPendingCacheCount(0);
        setFailedChapterIndexes([]);
        setError(null);
        setRefreshMessage("全話キャッシュ済みです");
      });
      return;
    }

    // 多重実行防止ガード・進捗状態を同期的に即時設定 (AC-ND-11, AC-ND-12)
    isBatchCachingRef.current = true;
    batchCancelRequestedRef.current = false;
    setIsBatchCaching(true);
    setBatchCacheProgress({ current: 0, total: targetChapters.length });
    setFailedChapterIndexes([]);
    setError(null);
    setRefreshMessage(null);
    const startExclusiveOpSeq = exclusiveOpSeqRef.current;

    if (cacheScheduler) {
      try {
        const targetIndexes = targetChapters.map((ch) => ch.chapterIndex);
        await cacheScheduler.enqueueBatchCache(novelId, targetIndexes);
        if (!isMountedRef.current) {
          return;
        }
        const progressAfterEnqueue = cacheScheduler.getNovelProgress(novelId);
        const isStillCaching =
          progressAfterEnqueue !== null
            ? isBatchProgressActive(progressAfterEnqueue)
            : cacheScheduler.isNovelBatchCaching(novelId);
        if (
          batchCancelRequestedRef.current ||
          isAnyExclusiveOperationActive() ||
          isDeletedRef.current ||
          startExclusiveOpSeq !== exclusiveOpSeqRef.current ||
          !isStillCaching
        ) {
          isBatchCachingRef.current = false;
          setIsBatchCaching(false);
          setBatchCacheProgress(null);
          if (!isDeletedRef.current && !isAnyExclusiveOperationActive()) {
            await syncQueueState(novelId, chapters);
          }
          return;
        }
      } catch (err: unknown) {
        isBatchCachingRef.current = false;
        runIfMounted(() => {
          setIsBatchCaching(false);
          setBatchCacheProgress(null);
          setError(extractErrorMessage(err, "キャッシュの取得に失敗しました"));
        });
      } finally {
        if (!cacheScheduler.isNovelBatchCaching(novelId)) {
          isBatchCachingRef.current = false;
        }
      }
      return;
    }

    // cacheScheduler 未注入時のレガシー直列フォールバック
    const abortController = new AbortController();
    batchAbortControllerRef.current = abortController;
    const signal = abortController.signal;

    let isAborted = false;

    try {
      // 開始時に中断された downloading を pending に戻し、有効キャッシュ済み話を整理
      await queueRepository.resetInterruptedToPending(novelId);
      const nowTs = Date.now();
      const freshIndexes = chapters
        .filter((ch) => isChapterFresh(ch, nowTs))
        .map((ch) => ch.chapterIndex);
      if (freshIndexes.length > 0) {
        await queueRepository.deleteByNovelAndChapters(novelId, freshIndexes);
      }

      // 対象エピソード群を enqueueChapters で pending 登録（既存 failed もリセット）
      const targetInputs = targetChapters.map((ch) => ({
        chapterIndex: ch.chapterIndex,
        targetUrl: ch.url,
      }));
      await queueRepository.enqueueChapters(novelId, targetInputs);

      const parser = parserRegistry.requireParser(novel.canonicalUrl);

      for (let i = 0; i < targetChapters.length; i++) {
        const target = targetChapters[i];
        const hasStaleCache = target.downloadedAt !== null;
        const timeoutMs = hasStaleCache
          ? SHORT_TIMEOUT_MS
          : STANDARD_TIMEOUT_MS;

        await queueRepository.updateStatus(
          novelId,
          target.chapterIndex,
          "downloading",
        );

        let html: string | null = null;
        try {
          const response = await httpClient.getHtml({
            url: target.url,
            timeoutMs,
            signal,
          });
          if (signal.aborted) {
            await queueRepository.updateStatus(
              novelId,
              target.chapterIndex,
              "pending",
            );
            isAborted = true;
            break;
          }
          if (response.status >= 400) {
            throw new Error(`HTTP ${response.status}`);
          }
          html = response.html;
        } catch (fetchErr: unknown) {
          if (signal.aborted) {
            await queueRepository.updateStatus(
              novelId,
              target.chapterIndex,
              "pending",
            );
            isAborted = true;
            break;
          }

          if (hasStaleCache) {
            // 7日経過キャッシュ存在時の短タイムアウト失敗は既存キャッシュへフォールバックして完了扱いとし、不要なキュー行を削除する
            await queueRepository.deleteByNovelAndChapters(novelId, [
              target.chapterIndex,
            ]);
          } else {
            // 未キャッシュ話の失敗時はループを中断せず failed 記録し後続話を継続
            const errMsg = extractErrorMessage(fetchErr, "通信エラー");
            await queueRepository.updateStatus(
              novelId,
              target.chapterIndex,
              "failed",
              {
                lastError: errMsg,
                incrementRetry: true,
              },
            );
            runIfMounted(() => {
              setFailedChapterIndexes((prev) =>
                Array.from(new Set([...prev, target.chapterIndex])).sort(
                  (a, b) => a - b,
                ),
              );
            });
          }
        }

        if (html !== null) {
          try {
            const parsedContent = parser.parseChapterContent(html, target.url);
            const downloadedAt = new Date().toISOString();

            await chapterRepository.saveChapterBody(
              novelId,
              target.chapterIndex,
              parsedContent,
              downloadedAt,
            );

            await queueRepository.deleteByNovelAndChapters(novelId, [
              target.chapterIndex,
            ]);

            runIfMounted(() => {
              setChapters((prev) =>
                prev.map((ch) =>
                  ch.chapterIndex === target.chapterIndex
                    ? { ...ch, downloadedAt, byteSize: parsedContent.byteSize }
                    : ch,
                ),
              );

              // R2-16: 一括キャッシュ進行中は novels.updated_at 保護規約（R1-01）と整合させ updatedAt を保持する
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
                };
              });

              setFailedChapterIndexes((prev) =>
                prev.filter((idx) => idx !== target.chapterIndex),
              );
            });
          } catch (parseErr: unknown) {
            if (signal.aborted) {
              await queueRepository.updateStatus(
                novelId,
                target.chapterIndex,
                "pending",
              );
              isAborted = true;
              break;
            }

            const errMsg = extractErrorMessage(parseErr, "パースエラー");
            await queueRepository.updateStatus(
              novelId,
              target.chapterIndex,
              "failed",
              {
                lastError: errMsg,
                incrementRetry: true,
              },
            );
            runIfMounted(() => {
              setFailedChapterIndexes((prev) =>
                Array.from(new Set([...prev, target.chapterIndex])).sort(
                  (a, b) => a - b,
                ),
              );
            });
          }
        }

        runIfMounted(() => {
          setBatchCacheProgress({
            current: i + 1,
            total: targetChapters.length,
          });
        });

        if (i < targetChapters.length - 1) {
          try {
            await delay(PREFETCH_INTERVAL_MS, signal);
          } catch {
            isAborted = true;
            break;
          }
        }
      }

      if (isAborted || signal.aborted) {
        await queueRepository.resetInterruptedToPending(novelId);
        const remainingItems = await queueRepository.listByNovelId(novelId);
        const pCount = remainingItems.filter(
          (item) => item.status === "pending",
        ).length;
        const fItems = remainingItems.filter(
          (item) => item.status === "failed",
        );
        const sortedFailed = fItems
          .map((item) => item.chapterIndex)
          .sort((a, b) => a - b);
        runIfMounted(() => {
          setPendingCacheCount(pCount);
          setFailedChapterIndexes(sortedFailed);
        });
      } else {
        const remainingItems = await queueRepository.listByNovelId(novelId);
        const failedItems = remainingItems.filter(
          (item) => item.status === "failed",
        );
        const nonFailedIndexes = remainingItems
          .filter((item) => item.status !== "failed")
          .map((item) => item.chapterIndex);

        if (failedItems.length === 0) {
          await queueRepository.clearNovelQueue(novelId);
          const latestNovel = await novelRepository.getNovelById(novelId);
          runIfMounted(() => {
            setPendingCacheCount(0);
            setFailedChapterIndexes([]);
            setRefreshMessage("全話のキャッシュを取得しました");
            setError(null);
            if (latestNovel) {
              setNovel(latestNovel);
            }
          });
        } else {
          if (nonFailedIndexes.length > 0) {
            await queueRepository.deleteByNovelAndChapters(
              novelId,
              nonFailedIndexes,
            );
          }
          const sortedFailed = failedItems
            .map((item) => item.chapterIndex)
            .sort((a, b) => a - b);
          runIfMounted(() => {
            setPendingCacheCount(0);
            setFailedChapterIndexes(sortedFailed);
            setError(
              `${failedItems.length}話の取得に失敗しました（再試行可能）`,
            );
          });
        }
      }
    } catch (err: unknown) {
      if (!signal.aborted && !isAborted) {
        runIfMounted(() => {
          setError(extractErrorMessage(err, "キャッシュの取得に失敗しました"));
        });
      }
    } finally {
      isBatchCachingRef.current = false;
      batchAbortControllerRef.current = null;
      runIfMounted(() => {
        setIsBatchCaching(false);
        setBatchCacheProgress(null);
      });
      flushPendingSilentReload();
    }
  }, [
    novel,
    chapters,
    isAnyExclusiveOperationActive,
    cacheScheduler,
    parserRegistry,
    httpClient,
    chapterRepository,
    novelRepository,
    queueRepository,
    novelId,
    syncQueueState,
    runIfMounted,
    flushPendingSilentReload,
  ]);

  /**
   * 実行中の一括キャッシュ処理を直ちに中断（キャンセル）する（AC-ND-12）。
   */
  const cancelBatchCache = useCallback(() => {
    if (cacheScheduler) {
      batchCancelRequestedRef.current = true;
      void cacheScheduler.pauseNovelTasks(novelId);
      return;
    }
    if (batchAbortControllerRef.current) {
      batchAbortControllerRef.current.abort();
      batchAbortControllerRef.current = null;
    }
  }, [cacheScheduler, novelId]);

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
    if (isAnyExclusiveOperationActive()) {
      return false;
    }

    isDeletingRef.current = true;
    exclusiveOpSeqRef.current += 1;
    setIsDeleting(true);
    setError(null);

    let isSuccess = false;
    try {
      await cacheScheduler?.cancelNovelTasks(novelId, { clearQueue: true });
      await novelRepository.deleteNovel(novelId);
      isDeletedRef.current = true;
      if (syncEngine) {
        syncEngine.notifyChanged().catch(() => {});
      }
      runIfMounted(() => {
        setIsDeleteDialogOpen(false);
      });
      isSuccess = true;
    } catch (err: unknown) {
      runIfMounted(() => {
        setError(extractErrorMessage(err, DEFAULT_DELETE_ERROR_MESSAGE));
      });
      isSuccess = false;
    } finally {
      isDeletingRef.current = false;
      runIfMounted(() => {
        setIsDeleting(false);
      });
      flushPendingSilentReload();
    }
    return isSuccess;
  }, [
    isAnyExclusiveOperationActive,
    cacheScheduler,
    novelRepository,
    syncEngine,
    novelId,
    runIfMounted,
    flushPendingSilentReload,
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
      if (isAnyExclusiveOperationActive()) {
        return 0;
      }

      isClearingCacheRef.current = true;
      exclusiveOpSeqRef.current += 1;
      setIsClearingCache(true);
      setError(null);

      let deletedCount = 0;
      try {
        await cacheScheduler?.cancelNovelTasks(novelId, {
          clearQueue: !options.onlyRead,
        });
        if (!isMountedRef.current) {
          return 0;
        }
        deletedCount = await chapterRepository.deleteCachedBodies(
          novelId,
          options,
        );
        if (!isMountedRef.current) {
          return deletedCount;
        }
        setIsClearCacheDialogOpen(false);
        if (deletedCount === 0) {
          // R1-09: 削除0件時は無駄なDB再クエリを行わず早期リターン
          // R1-18: 0件早期リターン時にもキュー状態を同期
          await syncQueueState(novelId, chapters);
          runIfMounted(() => {
            setRefreshMessage("削除対象の本文キャッシュはありませんでした");
          });
          return 0;
        }
        const [updatedNovel, updatedChapters] = await Promise.all([
          novelRepository.getNovelById(novelId),
          chapterRepository.listChaptersByNovelId(novelId),
        ]);
        if (!isMountedRef.current) {
          return deletedCount;
        }
        setNovel(updatedNovel);
        setChapters(updatedChapters);
        await syncQueueState(novelId, updatedChapters);
        runIfMounted(() => {
          setRefreshMessage(
            `本文キャッシュを削除しました（${deletedCount}話）`,
          );
        });
      } catch (err: unknown) {
        runIfMounted(() => {
          setError(extractErrorMessage(err, DEFAULT_CLEAR_CACHE_ERROR_MESSAGE));
        });
      } finally {
        isClearingCacheRef.current = false;
        runIfMounted(() => {
          setIsClearingCache(false);
        });
        flushPendingSilentReload();
      }
      return deletedCount;
    },
    [
      isAnyExclusiveOperationActive,
      cacheScheduler,
      chapterRepository,
      novelRepository,
      syncQueueState,
      novelId,
      chapters,
      runIfMounted,
      flushPendingSilentReload,
    ],
  );

  /**
   * 作品のお気に入り（★）状態を反転登録/解除し、DB永続化およびクラウド同期通知を行う。
   * 排他処理中または作品未読み込み時は操作をガードして false を返す。
   * 多重タップ防止ガード（isTogglingFavoriteRef）および stale state 防止関数型更新を適用 (R1-09)
   */
  const toggleFavorite = useCallback(async (): Promise<boolean> => {
    if (
      !novel ||
      isTogglingFavoriteRef.current ||
      isAnyExclusiveOperationActive()
    ) {
      return false;
    }

    isTogglingFavoriteRef.current = true;
    const nextIsFavorite = !novel.isFavorite;
    let isSuccess = false;
    try {
      await novelRepository.setFavorite(novelId, nextIsFavorite);
      const nowIso = new Date().toISOString();
      runIfMounted(() => {
        setNovel((prev) =>
          prev
            ? {
                ...prev,
                isFavorite: nextIsFavorite,
                updatedAt: nowIso,
              }
            : prev,
        );
      });
      if (syncEngine) {
        syncEngine.notifyChanged().catch(() => {});
      }
      isSuccess = true;
    } catch (err: unknown) {
      runIfMounted(() => {
        setError(
          extractErrorMessage(err, DEFAULT_TOGGLE_FAVORITE_ERROR_MESSAGE),
        );
      });
      isSuccess = false;
    } finally {
      isTogglingFavoriteRef.current = false;
    }
    return isSuccess;
  }, [
    novel,
    isAnyExclusiveOperationActive,
    novelRepository,
    novelId,
    syncEngine,
    runIfMounted,
  ]);

  return {
    novel,
    chapters,
    isLoading,
    isRefreshing,
    isBatchCaching,
    batchCacheProgress,
    isAllCached,
    pendingCacheCount,
    failedCacheCount,
    failedChapterIndexes,
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
    toggleFavorite,
    reloadDetail,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "../../../app/ServiceProvider";
import type { BookshelfSortOrder, NovelSummary } from "../../../storage/types";
import { fetchFullNovelIndex } from "../../../parsers/fetchFullNovelIndex";

export interface UseBookshelfOptions {
  /** 更新チェック時のリクエスト間隔ウェイト（ミリ秒、既定値: 1000ms） */
  intervalMs?: number;
}

export interface UseBookshelfResult {
  novels: NovelSummary[];
  totalNovelsCount: number;
  isLoading: boolean;
  isCheckingUpdates: boolean;
  updateCheckProgress: { current: number; total: number } | null;
  sortOrder: BookshelfSortOrder;
  favoriteOnly: boolean;
  error: string | null;
  setSortOrder: (order: BookshelfSortOrder) => Promise<void>;
  setFavoriteOnly: (favoriteOnly: boolean) => Promise<void>;
  toggleFavoriteFilter: () => Promise<void>;
  toggleFavorite: (novelId: string, nextIsFavorite?: boolean) => Promise<void>;
  checkUpdates: (forceAll?: boolean) => Promise<void>;
  reloadNovels: () => Promise<void>;
  clearNovelUpdate: (novelId: string) => Promise<void>;
  deleteNovel?: (novelId: string) => Promise<void>;
  addNovel?: (url: string) => Promise<void>;
}

export const SETTINGS_KEY_BOOKSHELF_SORT_ORDER = "bookshelf_sort_order";
export const SETTINGS_KEY_BOOKSHELF_FAVORITE_ONLY = "bookshelf_favorite_only";
export const DEFAULT_UPDATE_CHECK_INTERVAL_MS = 1000;
export const UPDATE_CHECK_THRESHOLD_MS = 3600000; // 1時間 (60 * 60 * 1000 ms)
export const DEFAULT_SORT_ORDER: BookshelfSortOrder = "unread_first";

const VALID_SORT_ORDERS: Set<BookshelfSortOrder> = new Set([
  "unread_first",
  "last_read",
  "latest_published",
  "created_at",
  "title",
]);

function isValidSortOrder(value: unknown): value is BookshelfSortOrder {
  return (
    typeof value === "string" &&
    VALID_SORT_ORDERS.has(value as BookshelfSortOrder)
  );
}

function isUpdateCheckTarget(novel: NovelSummary, now: number): boolean {
  if (novel.lastCheckedAt === null) {
    return true;
  }
  const lastChecked = Date.parse(novel.lastCheckedAt);
  if (Number.isNaN(lastChecked)) {
    return true;
  }
  return now - lastChecked >= UPDATE_CHECK_THRESHOLD_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 本棚画面（SCR-01）の登録済み作品一覧、自動/手動更新チェック、ソート順を管理するカスタムフック
 */
export function useBookshelf(
  options?: UseBookshelfOptions,
): UseBookshelfResult {
  const {
    httpClient,
    parserRegistry,
    novelRepository,
    appSettingsRepository,
    syncEngine,
    cloudSyncBridge,
    isReady,
  } = useServices();

  const intervalMs = options?.intervalMs ?? DEFAULT_UPDATE_CHECK_INTERVAL_MS;

  const [allNovels, setAllNovels] = useState<NovelSummary[]>([]);
  const [favoriteOnly, setFavoriteOnlyState] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState<boolean>(false);
  const [updateCheckProgress, setUpdateCheckProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [sortOrder, setSortOrderState] =
    useState<BookshelfSortOrder>(DEFAULT_SORT_ORDER);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const isCheckingUpdatesRef = useRef<boolean>(false);
  const sortOrderRef = useRef<BookshelfSortOrder>(DEFAULT_SORT_ORDER);
  const allNovelsRef = useRef<NovelSummary[]>([]);
  const favoriteOnlyRef = useRef<boolean>(false);

  useEffect(() => {
    sortOrderRef.current = sortOrder;
  }, [sortOrder]);

  useEffect(() => {
    allNovelsRef.current = allNovels;
  }, [allNovels]);

  useEffect(() => {
    favoriteOnlyRef.current = favoriteOnly;
  }, [favoriteOnly]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const runSequentialUpdateCheck = useCallback(
    async (targets: NovelSummary[]) => {
      if (targets.length === 0) {
        return;
      }
      isCheckingUpdatesRef.current = true;
      if (isMountedRef.current) {
        setIsCheckingUpdates(true);
        setUpdateCheckProgress({ current: 0, total: targets.length });
      }

      try {
        for (let i = 0; i < targets.length; i++) {
          if (i > 0 && intervalMs > 0) {
            await sleep(intervalMs);
          }
          if (!isMountedRef.current) break;

          const target = targets[i];
          try {
            const parser = parserRegistry.requireParser(target.canonicalUrl);
            const parsedIndex = await fetchFullNovelIndex(
              httpClient,
              parser,
              target.canonicalUrl,
            );
            await novelRepository.upsertNovelWithToc(
              parsedIndex,
              new Date().toISOString(),
            );
          } catch (err: unknown) {
            console.error("Failed to check update for novel:", target.id, err);
          }

          if (!isMountedRef.current) break;

          setUpdateCheckProgress({
            current: i + 1,
            total: targets.length,
          });

          // 各作品更新完了時に一覧を最新化してステートに反映
          const updatedList = await novelRepository.listNovels(
            sortOrderRef.current,
          );
          if (isMountedRef.current) {
            setAllNovels(updatedList);
          }
        }
      } finally {
        if (isMountedRef.current) {
          setIsCheckingUpdates(false);
          setUpdateCheckProgress(null);
        }
        isCheckingUpdatesRef.current = false;
      }
    },
    [httpClient, intervalMs, novelRepository, parserRegistry],
  );

  const checkUpdates = useCallback(
    async (forceAll = true): Promise<void> => {
      if (isCheckingUpdatesRef.current) {
        return;
      }

      const currentAll = allNovelsRef.current;
      const baseList = favoriteOnlyRef.current
        ? currentAll.filter((novel) => novel.isFavorite)
        : currentAll;
      const targets = forceAll
        ? baseList
        : baseList.filter((novel) => isUpdateCheckTarget(novel, Date.now()));

      await runSequentialUpdateCheck(targets);
    },
    [runSequentialUpdateCheck],
  );

  // 初回ロード & 自動更新チェック
  useEffect(() => {
    if (!isReady) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function loadInitial() {
      try {
        // 保存されたソート順とお気に入りフィルタ状態を取得
        const [savedOrder, savedFavOnly] = await Promise.all([
          appSettingsRepository.getSetting(SETTINGS_KEY_BOOKSHELF_SORT_ORDER),
          appSettingsRepository.getSetting(
            SETTINGS_KEY_BOOKSHELF_FAVORITE_ONLY,
          ),
        ]);
        const resolvedOrder: BookshelfSortOrder = isValidSortOrder(savedOrder)
          ? savedOrder
          : DEFAULT_SORT_ORDER;
        const resolvedFavOnly = savedFavOnly === "true";

        // 作品一覧を取得
        const list = await novelRepository.listNovels(resolvedOrder);

        if (cancelled) return;
        setSortOrderState(resolvedOrder);
        sortOrderRef.current = resolvedOrder;
        setFavoriteOnlyState(resolvedFavOnly);
        favoriteOnlyRef.current = resolvedFavOnly;
        setAllNovels(list);
        allNovelsRef.current = list;
        setIsLoading(false);

        // 1時間経過した作品を対象に自動更新チェックを起動
        const autoTargets = list.filter((novel) =>
          isUpdateCheckTarget(novel, Date.now()),
        );
        if (autoTargets.length > 0) {
          runSequentialUpdateCheck(autoTargets);
        }

        // クラウド同期連携: 初回自動 Pull (AC-BS-13, R1-14)
        if (syncEngine) {
          (async () => {
            if (cloudSyncBridge?.getAuthState) {
              const authState = await cloudSyncBridge.getAuthState();
              if (authState.status !== "connected") {
                return;
              }
            }
            await syncEngine.pullAndMerge();
            if (!cancelled && isMountedRef.current) {
              const refreshed = await novelRepository.listNovels(
                sortOrderRef.current,
              );
              if (!cancelled && isMountedRef.current) {
                setAllNovels(refreshed);
                allNovelsRef.current = refreshed;
              }
            }
          })().catch(() => {
            // オフライン時等の Pull 失敗は既存表示を維持
          });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setIsLoading(false);
        }
      }
    }

    loadInitial();

    return () => {
      cancelled = true;
    };
  }, [
    appSettingsRepository,
    cloudSyncBridge,
    isReady,
    novelRepository,
    runSequentialUpdateCheck,
    syncEngine,
  ]);

  // バックグラウンド復帰時の自動 Pull（休止5分以上経過検知: AC-BS-13）
  useEffect(() => {
    let lastHiddenAt: number | null = null;
    const backgroundThresholdMs = 5 * 60 * 1000; // 5分 (300,000ms)

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        lastHiddenAt = Date.now();
      } else if (document.visibilityState === "visible") {
        if (lastHiddenAt !== null) {
          const elapsed = Date.now() - lastHiddenAt;
          lastHiddenAt = null;
          if (elapsed >= backgroundThresholdMs && syncEngine) {
            (async () => {
              if (cloudSyncBridge?.getAuthState) {
                const authState = await cloudSyncBridge.getAuthState();
                if (authState.status !== "connected") {
                  return;
                }
              }
              await syncEngine.pullAndMerge();
              if (isMountedRef.current) {
                const refreshed = await novelRepository.listNovels(
                  sortOrderRef.current,
                );
                if (isMountedRef.current) {
                  setAllNovels(refreshed);
                  allNovelsRef.current = refreshed;
                }
              }
            })().catch(() => {});
          }
        }
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      }
    };
  }, [cloudSyncBridge, novelRepository, syncEngine]);

  const setSortOrder = useCallback(
    async (order: BookshelfSortOrder): Promise<void> => {
      try {
        await appSettingsRepository.setSetting(
          SETTINGS_KEY_BOOKSHELF_SORT_ORDER,
          order,
        );
        const list = await novelRepository.listNovels(order);
        if (isMountedRef.current) {
          setSortOrderState(order);
          sortOrderRef.current = order;
          setAllNovels(list);
          allNovelsRef.current = list;
          setError(null);
        }
      } catch (err: unknown) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [appSettingsRepository, novelRepository],
  );

  const setFavoriteOnly = useCallback(
    async (nextFavoriteOnly: boolean): Promise<void> => {
      try {
        await appSettingsRepository.setSetting(
          SETTINGS_KEY_BOOKSHELF_FAVORITE_ONLY,
          String(nextFavoriteOnly),
        );
        if (isMountedRef.current) {
          setFavoriteOnlyState(nextFavoriteOnly);
          favoriteOnlyRef.current = nextFavoriteOnly;
          setError(null);
        }
      } catch (err: unknown) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [appSettingsRepository],
  );

  const toggleFavoriteFilter = useCallback(async (): Promise<void> => {
    await setFavoriteOnly(!favoriteOnlyRef.current);
  }, [setFavoriteOnly]);

  const toggleFavorite = useCallback(
    async (novelId: string, nextIsFavorite?: boolean): Promise<void> => {
      const current = allNovelsRef.current.find((n) => n.id === novelId);
      const targetValue =
        nextIsFavorite !== undefined ? nextIsFavorite : !current?.isFavorite;
      try {
        await novelRepository.setFavorite(novelId, targetValue);
        const nowIso = new Date().toISOString();
        if (isMountedRef.current) {
          setAllNovels((prev) => {
            const updated = prev.map((novel) =>
              novel.id === novelId
                ? { ...novel, isFavorite: targetValue, updatedAt: nowIso }
                : novel,
            );
            allNovelsRef.current = updated;
            return updated;
          });
          setError(null);
        }
        if (syncEngine) {
          syncEngine.notifyChanged().catch(() => {});
        }
      } catch (err: unknown) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [novelRepository, syncEngine],
  );

  const clearNovelUpdate = useCallback(
    async (novelId: string): Promise<void> => {
      try {
        await novelRepository.clearNewUpdate(novelId);
        if (isMountedRef.current) {
          setAllNovels((prev) => {
            const updated = prev.map((novel) =>
              novel.id === novelId ? { ...novel, hasNewUpdate: false } : novel,
            );
            allNovelsRef.current = updated;
            return updated;
          });
          setError(null);
        }
      } catch (err: unknown) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [novelRepository],
  );

  const reloadNovels = useCallback(async (): Promise<void> => {
    if (isMountedRef.current) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const list = await novelRepository.listNovels(sortOrderRef.current);
      if (isMountedRef.current) {
        setAllNovels(list);
        allNovelsRef.current = list;
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [novelRepository]);

  const deleteNovel = useCallback(
    async (novelId: string): Promise<void> => {
      try {
        await novelRepository.deleteNovel(novelId);
        if (syncEngine) {
          syncEngine.notifyChanged().catch(() => {});
        }
        if (isMountedRef.current) {
          const updated = await novelRepository.listNovels(
            sortOrderRef.current,
          );
          setAllNovels(updated);
          allNovelsRef.current = updated;
          setError(null);
        }
      } catch (err: unknown) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [novelRepository, syncEngine],
  );

  const addNovel = useCallback(
    async (url: string): Promise<void> => {
      try {
        const parser = parserRegistry.requireParser(url);
        const parsed = await fetchFullNovelIndex(httpClient, parser, url);
        await novelRepository.upsertNovelWithToc(
          parsed,
          new Date().toISOString(),
        );
        if (syncEngine) {
          syncEngine.notifyChanged().catch(() => {});
        }
        if (isMountedRef.current) {
          const updated = await novelRepository.listNovels(
            sortOrderRef.current,
          );
          setAllNovels(updated);
          allNovelsRef.current = updated;
          setError(null);
        }
      } catch (err: unknown) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [httpClient, novelRepository, parserRegistry, syncEngine],
  );

  const novels = favoriteOnly
    ? allNovels.filter((novel) => novel.isFavorite)
    : allNovels;

  return {
    novels,
    totalNovelsCount: allNovels.length,
    isLoading,
    isCheckingUpdates,
    updateCheckProgress,
    sortOrder,
    favoriteOnly,
    error,
    setSortOrder,
    setFavoriteOnly,
    toggleFavoriteFilter,
    toggleFavorite,
    checkUpdates,
    reloadNovels,
    clearNovelUpdate,
    deleteNovel,
    addNovel,
  };
}

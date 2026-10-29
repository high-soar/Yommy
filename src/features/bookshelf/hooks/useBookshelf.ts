import { useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "../../../app/ServiceProvider";
import type { BookshelfSortOrder, NovelSummary } from "../../../storage/types";

export interface UseBookshelfOptions {
  /** 更新チェック時のリクエスト間隔ウェイト（ミリ秒、既定値: 1000ms） */
  intervalMs?: number;
}

export interface UseBookshelfResult {
  novels: NovelSummary[];
  isLoading: boolean;
  isCheckingUpdates: boolean;
  updateCheckProgress: { current: number; total: number } | null;
  sortOrder: BookshelfSortOrder;
  error: string | null;
  setSortOrder: (order: BookshelfSortOrder) => Promise<void>;
  checkUpdates: (forceAll?: boolean) => Promise<void>;
  reloadNovels: () => Promise<void>;
  clearNovelUpdate: (novelId: string) => Promise<void>;
}

export const SETTINGS_KEY_BOOKSHELF_SORT_ORDER = "bookshelf_sort_order";
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
    isReady,
  } = useServices();

  const intervalMs = options?.intervalMs ?? DEFAULT_UPDATE_CHECK_INTERVAL_MS;

  const [novels, setNovels] = useState<NovelSummary[]>([]);
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
  const novelsRef = useRef<NovelSummary[]>([]);

  useEffect(() => {
    sortOrderRef.current = sortOrder;
  }, [sortOrder]);

  useEffect(() => {
    novelsRef.current = novels;
  }, [novels]);

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
            const response = await httpClient.getHtml({
              url: target.canonicalUrl,
            });
            const parsedIndex = parser.parseNovelIndex(
              response.html,
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
            setNovels(updatedList);
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

      const currentNovels = novelsRef.current;
      const targets = forceAll
        ? currentNovels
        : currentNovels.filter((novel) =>
            isUpdateCheckTarget(novel, Date.now()),
          );

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
        // 保存されたソート順を取得
        const savedOrder = await appSettingsRepository.getSetting(
          SETTINGS_KEY_BOOKSHELF_SORT_ORDER,
        );
        const resolvedOrder: BookshelfSortOrder = isValidSortOrder(savedOrder)
          ? savedOrder
          : DEFAULT_SORT_ORDER;

        // 作品一覧を取得
        const list = await novelRepository.listNovels(resolvedOrder);

        if (cancelled) return;
        setSortOrderState(resolvedOrder);
        sortOrderRef.current = resolvedOrder;
        setNovels(list);
        novelsRef.current = list;
        setIsLoading(false);

        // 1時間経過した作品を対象に自動更新チェックを起動
        const autoTargets = list.filter((novel) =>
          isUpdateCheckTarget(novel, Date.now()),
        );
        if (autoTargets.length > 0) {
          runSequentialUpdateCheck(autoTargets);
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
    isReady,
    novelRepository,
    runSequentialUpdateCheck,
  ]);

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
          setNovels(list);
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

  const clearNovelUpdate = useCallback(
    async (novelId: string): Promise<void> => {
      try {
        await novelRepository.clearNewUpdate(novelId);
        if (isMountedRef.current) {
          setNovels((prev) =>
            prev.map((novel) =>
              novel.id === novelId ? { ...novel, hasNewUpdate: false } : novel,
            ),
          );
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
        setNovels(list);
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

  return {
    novels,
    isLoading,
    isCheckingUpdates,
    updateCheckProgress,
    sortOrder,
    error,
    setSortOrder,
    checkUpdates,
    reloadNovels,
    clearNovelUpdate,
  };
}

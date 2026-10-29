import { useCallback, useState } from "react";
import type { BookshelfSortOrder, NovelSummary } from "../../../storage/types";

export interface UseBookshelfOptions {
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

/**
 * 本棚画面（SCR-01）の登録済み作品一覧、自動/手動更新チェック、ソート順を管理するカスタムフック
 */
export function useBookshelf(
  _options?: UseBookshelfOptions,
): UseBookshelfResult {
  const [novels] = useState<NovelSummary[]>([]);
  const [isLoading] = useState<boolean>(true);
  const [isCheckingUpdates] = useState<boolean>(false);
  const [updateCheckProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [sortOrder] = useState<BookshelfSortOrder>("unread_first");
  const [error] = useState<string | null>(null);

  const setSortOrder = useCallback(
    async (_order: BookshelfSortOrder): Promise<void> => {
      throw new Error("Not implemented yet");
    },
    [],
  );

  const checkUpdates = useCallback(
    async (_forceAll?: boolean): Promise<void> => {
      throw new Error("Not implemented yet");
    },
    [],
  );

  const reloadNovels = useCallback(async (): Promise<void> => {
    throw new Error("Not implemented yet");
  }, []);

  const clearNovelUpdate = useCallback(
    async (_novelId: string): Promise<void> => {
      throw new Error("Not implemented yet");
    },
    [],
  );

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

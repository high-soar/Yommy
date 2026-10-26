import { useCallback, useEffect, useState } from "react";
import { useServices } from "../../../app/ServiceProvider";
import type { NovelRecord, ChapterSummary } from "../../../storage/types";
import type { UseNovelDetailResult } from "../types";

export type { UseNovelDetailResult } from "../types";

export const DEFAULT_FETCH_ERROR_MESSAGE = "作品情報の取得に失敗しました";
export const DEFAULT_REFRESH_ERROR_MESSAGE = "目次の更新に失敗しました";
export const DEFAULT_DELETE_ERROR_MESSAGE = "作品の削除に失敗しました";

/**
 * 例外オブジェクトからユーザー向けエラーメッセージを安全に抽出する
 */
function extractErrorMessage(err: unknown, defaultMessage: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return defaultMessage;
}

/**
 * 作品詳細・目次画面（SCR-02）の状態管理カスタムフック
 */
export function useNovelDetail(novelId: string): UseNovelDetailResult {
  const {
    httpClient,
    parserRegistry,
    novelRepository,
    chapterRepository,
    isReady,
  } = useServices();

  const [novel, setNovel] = useState<NovelRecord | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 初回ロード
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
          setNovel(fetchedNovel);
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

  const refreshToc = useCallback(async (): Promise<boolean> => {
    if (!novel || isRefreshing || isDeleting) {
      return false;
    }

    setIsRefreshing(true);
    setError(null);
    setRefreshMessage(null);

    const prevCount = chapters.length;
    let isSuccess = false;
    try {
      const parser = parserRegistry.requireParser(novel.canonicalUrl);
      const normalizedWorkUrl = parser.normalizeWorkUrl(novel.canonicalUrl);

      const response = await httpClient.getHtml({ url: normalizedWorkUrl });
      const novelIndex = parser.parseNovelIndex(
        response.html,
        normalizedWorkUrl,
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
    parserRegistry,
    httpClient,
    novelRepository,
    chapterRepository,
    novelId,
  ]);

  const openDeleteDialog = useCallback(() => {
    setIsDeleteDialogOpen(true);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    if (isDeleting) {
      return;
    }
    setIsDeleteDialogOpen(false);
  }, [isDeleting]);

  const confirmDeleteNovel = useCallback(async (): Promise<boolean> => {
    if (isDeleting || isRefreshing) {
      return false;
    }

    setIsDeleting(true);
    setError(null);

    let isSuccess = false;
    try {
      await novelRepository.deleteNovel(novelId);
      setIsDeleteDialogOpen(false);
      isSuccess = true;
    } catch (err: unknown) {
      setError(extractErrorMessage(err, DEFAULT_DELETE_ERROR_MESSAGE));
      isSuccess = false;
    } finally {
      setIsDeleting(false);
    }
    return isSuccess;
  }, [isDeleting, isRefreshing, novelRepository, novelId]);

  return {
    novel,
    chapters,
    isLoading,
    isRefreshing,
    isDeleteDialogOpen,
    isDeleting,
    refreshMessage,
    error,
    refreshToc,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDeleteNovel,
    reloadDetail,
  };
}

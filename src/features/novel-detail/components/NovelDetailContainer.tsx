import React, { useCallback } from "react";
import { useRouter } from "../../../app/router";
import { useNovelDetail } from "../hooks/useNovelDetail";
import { NovelDetailPage } from "./NovelDetailPage";
import type { NovelDetailContainerProps } from "../types";

export type { NovelDetailContainerProps } from "../types";

/**
 * 作品詳細・目次画面（SCR-02: `/novels/:novelId`）の Container コンポーネント。
 *
 * useNovelDetail フックと useRouter を接続し、作品ヘッダー情報・あらすじ・統計、
 * 章見出し付き目次エピソード一覧、読書開始（TR-04）、しおり位置からの読書再開（TR-04）、
 * 目次再取得（更新）、および作品削除（TR-07）を画面全体に統合管理する。
 */
export const NovelDetailContainer: React.FC<NovelDetailContainerProps> = ({
  novelId,
  onBackToBookshelf,
  onSelectEpisode,
}) => {
  const router = useRouter();
  const {
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
  } = useNovelDetail(novelId);

  const handleBackToBookshelf = useCallback(() => {
    if (onBackToBookshelf) {
      onBackToBookshelf();
    } else {
      router.navigateToBookshelf();
    }
  }, [onBackToBookshelf, router]);

  const handleSelectEpisode = useCallback(
    (chapterIndex: number) => {
      if (onSelectEpisode) {
        onSelectEpisode(novelId, chapterIndex);
      } else {
        router.navigateToReader(novelId, chapterIndex);
      }
    },
    [novelId, onSelectEpisode, router],
  );

  const handleStartFromBeginning = useCallback(() => {
    handleSelectEpisode(1);
  }, [handleSelectEpisode]);

  const handleResumeBookmark = useCallback(
    (chapterIndex: number) => {
      handleSelectEpisode(chapterIndex);
    },
    [handleSelectEpisode],
  );

  const handleRefreshToc = useCallback(async () => {
    await refreshToc();
  }, [refreshToc]);

  const handleConfirmDelete = useCallback(async () => {
    const success = await confirmDeleteNovel();
    if (success) {
      handleBackToBookshelf();
    }
  }, [confirmDeleteNovel, handleBackToBookshelf]);

  return (
    <NovelDetailPage
      novel={novel}
      chapters={chapters}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      isDeleteDialogOpen={isDeleteDialogOpen}
      isDeleting={isDeleting}
      refreshMessage={refreshMessage}
      error={error}
      onBackToBookshelf={handleBackToBookshelf}
      onStartFromBeginning={handleStartFromBeginning}
      onResumeBookmark={handleResumeBookmark}
      onSelectEpisode={handleSelectEpisode}
      onRefreshToc={handleRefreshToc}
      onOpenDeleteDialog={openDeleteDialog}
      onCloseDeleteDialog={closeDeleteDialog}
      onConfirmDelete={handleConfirmDelete}
    />
  );
};

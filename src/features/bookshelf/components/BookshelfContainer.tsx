import React, { useCallback } from "react";
import { useRouter } from "../../../app/router";
import { useBookshelf } from "../hooks/useBookshelf";
import { BookshelfPage } from "./BookshelfPage";

export interface BookshelfContainerProps {
  onSelectNovel?: (novelId: string) => void;
  onResumeNovel?: (novelId: string, chapterIndex: number) => void;
}

/**
 * 本棚画面（SCR-01）の Container コンポーネント
 *
 * useBookshelf フックと useRouter を接続し、登録作品一覧、URL作品登録ダイアログ、
 * 作品詳細への遷移（TR-02）、しおり位置からの読書再開（TR-03）を管理する。
 */
export const BookshelfContainer: React.FC<BookshelfContainerProps> = ({
  onSelectNovel,
  onResumeNovel,
}) => {
  const router = useRouter();
  const {
    novels,
    isLoading,
    isDialogOpen,
    isSubmitting,
    dialogError,
    openDialog,
    closeDialog,
    addNovelByUrl,
  } = useBookshelf();

  const handleSelectNovel = useCallback(
    (novelId: string) => {
      if (onSelectNovel) {
        onSelectNovel(novelId);
      } else {
        router.navigateToNovelDetail(novelId);
      }
    },
    [onSelectNovel, router],
  );

  const handleResumeNovel = useCallback(
    (novelId: string, chapterIndex: number) => {
      if (onResumeNovel) {
        onResumeNovel(novelId, chapterIndex);
      } else {
        router.navigateToReader(novelId, chapterIndex);
      }
    },
    [onResumeNovel, router],
  );

  const handleAddNovel = useCallback(
    async (url: string) => {
      await addNovelByUrl(url);
    },
    [addNovelByUrl],
  );

  return (
    <BookshelfPage
      novels={novels}
      isLoading={isLoading}
      isDialogOpen={isDialogOpen}
      isSubmitting={isSubmitting}
      dialogError={dialogError}
      onOpenDialog={openDialog}
      onCloseDialog={closeDialog}
      onAddNovel={handleAddNovel}
      onSelectNovel={handleSelectNovel}
      onResumeNovel={handleResumeNovel}
    />
  );
};

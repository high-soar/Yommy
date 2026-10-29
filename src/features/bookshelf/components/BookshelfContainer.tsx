import React, { useCallback } from "react";
import { useRouter } from "../../../app/router";
import { useBookshelf } from "../hooks/useBookshelf";
import { BookshelfPage } from "./BookshelfPage";

export interface BookshelfContainerProps {
  /** 作品カード本体タップ時の遷移コールバック（省略時は useRouter().navigateToNovelDetail を使用） */
  onSelectNovel?: (novelId: string) => void;
  /** 「続きから読む」タップ時の遷移コールバック（省略時は useRouter().navigateToReader を使用） */
  onResumeNovel?: (novelId: string, chapterIndex: number) => void;
  /** 検索画面への遷移コールバック（省略時は useRouter().navigateToSearch を使用） */
  onNavigateSearch?: () => void;
  /** ランキング画面への遷移コールバック（省略時は useRouter().navigateToRanking を使用） */
  onNavigateRanking?: () => void;
}

/**
 * 本棚画面（SCR-01）の Container コンポーネント
 *
 * useBookshelf フックと useRouter を接続し、登録作品一覧、作品詳細への遷移（TR-02）、
 * しおり位置からの読書再開（TR-03）、検索/ランキング画面への誘導（TR-15）を管理する。
 */
export const BookshelfContainer: React.FC<BookshelfContainerProps> = ({
  onSelectNovel,
  onResumeNovel,
  onNavigateSearch,
  onNavigateRanking,
}) => {
  const router = useRouter();
  const {
    novels,
    isLoading,
    isCheckingUpdates,
    updateCheckProgress,
    sortOrder,
    setSortOrder,
    checkUpdates,
    clearNovelUpdate,
  } = useBookshelf();

  const handleSelectNovel = useCallback(
    async (novelId: string) => {
      const targetNovel = novels.find((n) => n.id === novelId);
      if (targetNovel?.hasNewUpdate) {
        await clearNovelUpdate(novelId);
      }
      if (onSelectNovel) {
        onSelectNovel(novelId);
      } else {
        router.navigateToNovelDetail(novelId);
      }
    },
    [clearNovelUpdate, novels, onSelectNovel, router],
  );

  const handleResumeNovel = useCallback(
    async (novelId: string, chapterIndex: number) => {
      const targetNovel = novels.find((n) => n.id === novelId);
      if (targetNovel?.hasNewUpdate) {
        await clearNovelUpdate(novelId);
      }
      if (onResumeNovel) {
        onResumeNovel(novelId, chapterIndex);
      } else {
        router.navigateToReader(novelId, chapterIndex, {
          fromBookshelfResume: true,
        });
      }
    },
    [clearNovelUpdate, novels, onResumeNovel, router],
  );

  const handleNavigateSearch = useCallback(() => {
    if (onNavigateSearch) {
      onNavigateSearch();
    } else {
      router.navigateToSearch();
    }
  }, [onNavigateSearch, router]);

  const handleNavigateRanking = useCallback(() => {
    if (onNavigateRanking) {
      onNavigateRanking();
    } else {
      router.navigateToRanking();
    }
  }, [onNavigateRanking, router]);

  return (
    <BookshelfPage
      novels={novels}
      isLoading={isLoading}
      isCheckingUpdates={isCheckingUpdates}
      updateCheckProgress={updateCheckProgress}
      sortOrder={sortOrder}
      onSortChange={setSortOrder}
      onCheckUpdates={checkUpdates}
      onNavigateSearch={handleNavigateSearch}
      onNavigateRanking={handleNavigateRanking}
      onSelectNovel={handleSelectNovel}
      onResumeNovel={handleResumeNovel}
    />
  );
};

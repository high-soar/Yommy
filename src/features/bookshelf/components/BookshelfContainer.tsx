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
  const { novels, isLoading } = useBookshelf();

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
        router.navigateToReader(novelId, chapterIndex, {
          fromBookshelfResume: true,
        });
      }
    },
    [onResumeNovel, router],
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
      onNavigateSearch={handleNavigateSearch}
      onNavigateRanking={handleNavigateRanking}
      onSelectNovel={handleSelectNovel}
      onResumeNovel={handleResumeNovel}
    />
  );
};

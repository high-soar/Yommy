import React, { useCallback } from "react";
import { useRouter } from "../../../app/router";
import { useReader } from "../hooks/useReader";
import { ReaderPage } from "./ReaderPage";
import type { ReaderTheme } from "../../../storage/types";

export interface ReaderContainerProps {
  /** 対象作品 ID（省略時は登録作品一覧の先頭） */
  novelId?: string;
  /** 対象エピソード連番（1始まり、省略時は 1） */
  chapterIndex?: number;
  /** 単体検証・手動取得時の対象作品 URL（既定値: 検証用カクヨム作品 URL） */
  initialWorkUrl?: string;
  /** 「本棚へ戻る」タップ時のコールバック（省略時はルーターの navigateToBookshelf を使用） */
  onBackToBookshelf?: () => void;
  /** 「作品詳細へ」タップ時のコールバック（省略時はルーターの navigateToNovelDetail を使用） */
  onBackToDetail?: (novelId: string) => void;
  /** 前後話遷移タップ時のコールバック（省略時はルーターの navigateToReader を使用） */
  onNavigateChapter?: (novelId: string, chapterIndex: number) => void;
}

/**
 * 小説リーダー画面（SCR-03: `/novels/:novelId/chapters/:chapterIndex`）の Container コンポーネント。
 *
 * useReader フックと useRouter を接続し、縦書き・横書き組版表示、テーマ・文字サイズ・行間設定、
 * 前後エピソード連続遷移（TR-05）、しおり・スクロール進捗率の自動保存・復元、
 * 本棚（SCR-01）および作品詳細・目次（SCR-02、TR-06）への画面遷移を統合管理する。
 */
export const ReaderContainer: React.FC<ReaderContainerProps> = ({
  novelId,
  chapterIndex,
  initialWorkUrl,
  onBackToBookshelf,
  onBackToDetail,
  onNavigateChapter,
}) => {
  const router = useRouter();
  const {
    novel,
    chapter,
    chapterIndex: currentChapterIndex,
    totalChapters,
    writingMode,
    theme,
    fontSizePx,
    lineHeight,
    initialScrollProgress,
    isLoading,
    error,
    toggleWritingMode,
    changeTheme,
    changeFontSize,
    changeLineHeight,
    updateScrollProgress,
    flushBookmark,
    goToChapter,
    fetchNovelFromUrl,
  } = useReader({ novelId, chapterIndex, initialWorkUrl });

  const handleBackToBookshelf = useCallback(async () => {
    await flushBookmark();
    if (onBackToBookshelf) {
      onBackToBookshelf();
    } else {
      router.navigateToBookshelf();
    }
  }, [flushBookmark, onBackToBookshelf, router]);

  const handleBackToDetail = useCallback(async () => {
    await flushBookmark();
    const targetId = novelId ?? novel?.id;
    if (targetId) {
      if (onBackToDetail) {
        onBackToDetail(targetId);
      } else {
        router.navigateToNovelDetail(targetId);
      }
    }
  }, [flushBookmark, novelId, novel?.id, onBackToDetail, router]);

  const handlePrevChapter = useCallback(async () => {
    const targetIndex = currentChapterIndex - 1;
    const ok = await goToChapter(targetIndex);
    if (ok) {
      const targetId = novelId ?? novel?.id;
      if (targetId) {
        if (onNavigateChapter) {
          onNavigateChapter(targetId, targetIndex);
        } else {
          router.navigateToReader(targetId, targetIndex);
        }
      }
    }
  }, [
    currentChapterIndex,
    goToChapter,
    novelId,
    novel?.id,
    onNavigateChapter,
    router,
  ]);

  const handleNextChapter = useCallback(async () => {
    const targetIndex = currentChapterIndex + 1;
    const ok = await goToChapter(targetIndex);
    if (ok) {
      const targetId = novelId ?? novel?.id;
      if (targetId) {
        if (onNavigateChapter) {
          onNavigateChapter(targetId, targetIndex);
        } else {
          router.navigateToReader(targetId, targetIndex);
        }
      }
    }
  }, [
    currentChapterIndex,
    goToChapter,
    novelId,
    novel?.id,
    onNavigateChapter,
    router,
  ]);

  const handleToggleWritingMode = useCallback(() => {
    void toggleWritingMode();
  }, [toggleWritingMode]);

  const handleChangeTheme = useCallback(
    (nextTheme: ReaderTheme) => {
      void changeTheme(nextTheme);
    },
    [changeTheme],
  );

  const handleChangeFontSize = useCallback(
    (sizePx: number) => {
      void changeFontSize(sizePx);
    },
    [changeFontSize],
  );

  const handleChangeLineHeight = useCallback(
    (height: number) => {
      void changeLineHeight(height);
    },
    [changeLineHeight],
  );

  const handleScrollProgressChange = useCallback(
    (progress: number) => {
      void updateScrollProgress(progress);
    },
    [updateScrollProgress],
  );

  const handleFetchNovel = useCallback(() => {
    void fetchNovelFromUrl();
  }, [fetchNovelFromUrl]);

  return (
    <ReaderPage
      novel={novel}
      chapter={chapter}
      chapterIndex={currentChapterIndex}
      totalChapters={totalChapters}
      writingMode={writingMode}
      theme={theme}
      fontSizePx={fontSizePx}
      lineHeight={lineHeight}
      initialScrollProgress={initialScrollProgress}
      isLoading={isLoading}
      error={error}
      onToggleWritingMode={handleToggleWritingMode}
      onChangeTheme={handleChangeTheme}
      onChangeFontSize={handleChangeFontSize}
      onChangeLineHeight={handleChangeLineHeight}
      onPrevChapter={handlePrevChapter}
      onNextChapter={handleNextChapter}
      onScrollProgressChange={handleScrollProgressChange}
      onBackToBookshelf={handleBackToBookshelf}
      onBackToDetail={handleBackToDetail}
      onFetchNovel={handleFetchNovel}
    />
  );
};

import React, { useCallback } from "react";
import { useRouter } from "../../../app/router";
import { useReader } from "../hooks/useReader";
import { ReaderPage } from "./ReaderPage";
import type { ReaderTheme } from "../../../storage/types";

/**
 * 小説リーダーコンテナ（ReaderContainer）のプロパティ定義
 */
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
  /** 「設定へ」タップ時のコールバック（省略時はルーターの navigate('/settings') を使用） */
  onNavigateSettings?: () => void;
  /** 前後話遷移タップ時のコールバック（省略時はルーターの navigateToReader を使用） */
  onNavigateChapter?: (novelId: string, chapterIndex: number) => void;
}

/**
 * 小説リーダー画面（SCR-03: `/novels/:novelId/chapters/:chapterIndex`）の Container コンポーネント。
 *
 * useReader フックと useRouter を接続し、以下の機能および画面遷移を統合管理する：
 * 1. 縦書き（vertical-rl）・横書き（horizontal-tb）組版表示およびルビ・傍点描画（AC-RD-01〜03）
 * 2. 4カラーテーマ・文字サイズ・行間の変更と永続化（AC-RD-04, AC-RD-05）
 * 3. 前後エピソード連続遷移（TR-05, AC-RD-06）および既読フラグの自動更新（AC-RD-07）
 * 4. しおり（bookmark_chapter_index）とスクロール進捗率（0.0〜1.0）の自動保存・復元（AC-RD-08）
 * 5. 本棚画面（SCR-01）および作品詳細・目次画面（SCR-02, TR-06）への画面遷移
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

  // 本棚へ戻る（TR-01 / TR-03逆方向）
  const handleBackToBookshelf = useCallback(async () => {
    await flushBookmark();
    if (onBackToBookshelf) {
      onBackToBookshelf();
    } else {
      router.navigateToBookshelf();
    }
  }, [flushBookmark, onBackToBookshelf, router]);

  // 作品詳細・目次へ戻る（TR-06）
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

  // 前後話エピソード遷移共通処理（TR-05）
  const navigateToTargetChapter = useCallback(
    async (targetIndex: number) => {
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
    },
    [goToChapter, novelId, novel?.id, onNavigateChapter, router],
  );

  // 前の話へ（TR-05）
  const handlePrevChapter = useCallback(async () => {
    await navigateToTargetChapter(currentChapterIndex - 1);
  }, [currentChapterIndex, navigateToTargetChapter]);

  // 次の話へ（TR-05）
  const handleNextChapter = useCallback(async () => {
    await navigateToTargetChapter(currentChapterIndex + 1);
  }, [currentChapterIndex, navigateToTargetChapter]);

  // 組み方向切替（AC-RD-03）
  const handleToggleWritingMode = useCallback(() => {
    void toggleWritingMode();
  }, [toggleWritingMode]);

  // カラーテーマ切替（AC-RD-04）
  const handleChangeTheme = useCallback(
    (nextTheme: ReaderTheme) => {
      void changeTheme(nextTheme);
    },
    [changeTheme],
  );

  // 文字サイズ変更（AC-RD-05）
  const handleChangeFontSize = useCallback(
    (sizePx: number) => {
      void changeFontSize(sizePx);
    },
    [changeFontSize],
  );

  // 行間変更（AC-RD-05）
  const handleChangeLineHeight = useCallback(
    (height: number) => {
      void changeLineHeight(height);
    },
    [changeLineHeight],
  );

  // スクロール進捗更新（AC-RD-08）
  const handleScrollProgressChange = useCallback(
    (progress: number) => {
      void updateScrollProgress(progress);
    },
    [updateScrollProgress],
  );

  // 手動作品取得・更新パイプライン
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

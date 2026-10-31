import React, { useCallback, useEffect } from "react";
import { useRouter } from "../../../app/router";
import { useReader } from "../hooks/useReader";
import { ReaderPage } from "./ReaderPage";

/**
 * 小説リーダーコンテナ（ReaderContainer）のプロパティ定義
 */
import type { BottomTab } from "../../../shared/ui/BottomTabBar";

export interface ReaderContainerProps {
  /** 対象作品 ID（省略時は登録作品一覧の先頭） */
  novelId?: string;
  /** 対象エピソード連番（1始まり、省略時は 1） */
  chapterIndex?: number;
  /** 単体検証・手動取得時の対象作品 URL（既定値: 検証用カクヨム作品 URL） */
  initialWorkUrl?: string;
  /** リーダー画面のアクティブタブ（省略時: "bookshelf"） */
  activeTab?: BottomTab;
  /** 「本棚へ戻る」タップ時のコールバック（省略時はルーターの navigateToBookshelf を使用） */
  onBackToBookshelf?: () => void;
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
 * 2. 前後話ナビゲーションおよび下部タブ（本棚/設定）を統合した ReaderBottomOverlay との連携（AC-RD-06, AC-RD-10）
 * 3. 前後エピソード連続遷移（TR-05）および既読フラグの自動更新（AC-RD-07）
 * 4. 下部タブ遷移時および OS バックキー（popstate）離脱時のスクロール進捗率自動保存（flushBookmark, AC-RD-08）
 * 5. 全画面テキスト表示化（AC-RD-09）
 * 6. ページ送りモード（auto / paged / scroll）とページネーション状態・コールバックの伝播（AC-RD-15, AC-RD-16, AC-RD-20）
 */
export const ReaderContainer: React.FC<ReaderContainerProps> = ({
  novelId,
  chapterIndex,
  initialWorkUrl,
  activeTab,
  onBackToBookshelf,
  onNavigateSettings,
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
    pagingMode,
    currentPage,
    totalPages,
    isLoading,
    error,
    goToPage,
    setTotalPages,
    updateScrollProgress,
    flushBookmark,
    goToChapter,
  } = useReader({ novelId, chapterIndex, initialWorkUrl });

  // OS バックキー（popstate イベント）およびアンマウント離脱時のしおり保存（AC-RD-08, TR-06）
  useEffect(() => {
    const handlePopState = () => {
      void flushBookmark();
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      void flushBookmark();
    };
  }, [flushBookmark]);

  // 下部タブ選択（本棚 / 検索 / ランキング / 設定）および画面遷移前のしおり保存（AC-RD-08, TR-01）
  const handleSelectTab = useCallback(
    async (tab: BottomTab) => {
      await flushBookmark();
      if (tab === "bookshelf") {
        if (onBackToBookshelf) {
          onBackToBookshelf();
        } else {
          router.navigateToBookshelf();
        }
      } else if (tab === "search") {
        router.navigateToSearch();
      } else if (tab === "ranking") {
        router.navigateToRanking();
      } else if (tab === "settings") {
        if (onNavigateSettings) {
          onNavigateSettings();
        } else {
          router.navigate("/settings");
        }
      }
    },
    [flushBookmark, onBackToBookshelf, onNavigateSettings, router],
  );

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
            router.navigateToReader(targetId, targetIndex, { replace: true });
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

  // スクロール進捗更新（AC-RD-08）
  const handleScrollProgressChange = useCallback(
    (progress: number) => {
      void updateScrollProgress(progress);
    },
    [updateScrollProgress],
  );

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
      pagingMode={pagingMode}
      currentPage={currentPage}
      totalPages={totalPages}
      isLoading={isLoading}
      error={error}
      activeTab={activeTab}
      onPrevChapter={handlePrevChapter}
      onNextChapter={handleNextChapter}
      onPageChange={goToPage}
      onTotalPagesChange={setTotalPages}
      onScrollProgressChange={handleScrollProgressChange}
      onSelectTab={handleSelectTab}
    />
  );
};

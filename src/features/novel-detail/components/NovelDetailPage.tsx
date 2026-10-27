import React, { useEffect, useRef } from "react";
import { NovelDetailHeader } from "./NovelDetailHeader";
import { EpisodeList } from "./EpisodeList";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import type { NovelDetailPageProps } from "../types";

export type { NovelDetailPageProps } from "../types";

/**
 * 作品詳細・目次画面全体のレイアウト統合コンポーネント（Presentational）
 *
 * ローディング、未検出作品（Not Found）、および通常表示（固定ヘッダー＋内部スクロール目次リスト＋削除ダイアログ）の排他描画を制御する。
 */
export const NovelDetailPage: React.FC<NovelDetailPageProps> = ({
  novel,
  chapters,
  isLoading,
  isRefreshing,
  isDeleteDialogOpen,
  isDeleting,
  refreshMessage,
  error,
  onBackToBookshelf,
  onStartFromBeginning,
  onResumeBookmark,
  onSelectEpisode,
  onRefreshToc,
  onOpenDeleteDialog,
  onCloseDeleteDialog,
  onConfirmDelete,
}) => {
  const episodeContainerRef = useRef<HTMLElement | null>(null);
  const scrolledNovelIdRef = useRef<string | null>(null);

  const currentNovelId = novel?.id ?? null;
  const bookmarkChapterIndex = novel?.bookmarkChapterIndex ?? null;

  useEffect(() => {
    if (!isLoading && currentNovelId && bookmarkChapterIndex !== null) {
      if (scrolledNovelIdRef.current !== currentNovelId) {
        const targetElement = episodeContainerRef.current?.querySelector(
          `[data-chapter-index="${bookmarkChapterIndex}"]`,
        );
        if (
          targetElement &&
          typeof targetElement.scrollIntoView === "function"
        ) {
          targetElement.scrollIntoView({
            block: "start",
            behavior: "instant",
          });
          scrolledNovelIdRef.current = currentNovelId;
        }
      }
    }
  }, [isLoading, currentNovelId, bookmarkChapterIndex]);

  return (
    <div
      data-testid="novel-detail-page"
      className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
    >
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div
            role="status"
            data-testid="novel-detail-loading"
            className="flex flex-col items-center justify-center py-24 text-slate-500 dark:text-slate-400"
          >
            <div
              aria-hidden="true"
              className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"
            />
            <p className="text-sm font-medium">作品情報を読み込み中...</p>
          </div>
        </div>
      ) : novel === null ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div
            role="alert"
            data-testid="novel-detail-not-found"
            className="w-full max-w-md flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-center shadow-xs"
          >
            <div className="text-4xl mb-3" aria-hidden="true">
              📭
            </div>
            <p className="text-sm md:text-base font-medium text-slate-700 dark:text-slate-200 mb-6">
              {error ?? "指定された作品が見つかりません。"}
            </p>
            <button
              type="button"
              data-testid="back-to-bookshelf-button"
              aria-label="本棚へ戻る"
              onClick={onBackToBookshelf}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-medium rounded-lg shadow-xs transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <span aria-hidden="true">←</span>
              <span>本棚へ戻る</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="shrink-0 w-full max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-0 md:pb-0 lg:pb-0">
            <NovelDetailHeader
              novel={novel}
              isRefreshing={isRefreshing}
              refreshMessage={refreshMessage}
              error={error}
              onStartFromBeginning={onStartFromBeginning}
              onResumeBookmark={onResumeBookmark}
              onRefreshToc={onRefreshToc}
              onOpenDeleteDialog={onOpenDeleteDialog}
            />
          </div>

          <main
            ref={episodeContainerRef}
            data-testid="episode-list-container"
            className="flex-1 min-h-0 overflow-y-auto w-full max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pt-3 md:pt-4 lg:pt-4"
          >
            <EpisodeList
              chapters={chapters}
              bookmarkChapterIndex={novel.bookmarkChapterIndex}
              onSelectEpisode={onSelectEpisode}
            />
          </main>

          <DeleteConfirmDialog
            isOpen={isDeleteDialogOpen}
            novelTitle={novel.title}
            isDeleting={isDeleting}
            onClose={onCloseDeleteDialog}
            onConfirm={onConfirmDelete}
          />
        </>
      )}
    </div>
  );
};

import React from "react";
import type { NovelRecord, ChapterSummary } from "../../../storage/types";
import { NovelDetailHeader } from "./NovelDetailHeader";
import { EpisodeList } from "./EpisodeList";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

export interface NovelDetailPageProps {
  novel: NovelRecord | null;
  chapters: ChapterSummary[];
  isLoading: boolean;
  isRefreshing: boolean;
  isDeleteDialogOpen: boolean;
  isDeleting: boolean;
  refreshMessage?: string | null;
  error?: string | null;
  onBackToBookshelf: () => void;
  onStartFromBeginning: () => void;
  onResumeBookmark: (chapterIndex: number) => void;
  onSelectEpisode: (chapterIndex: number) => void;
  onRefreshToc: () => void | Promise<void>;
  onOpenDeleteDialog: () => void;
  onCloseDeleteDialog: () => void;
  onConfirmDelete: () => void | Promise<void>;
}

/**
 * 作品詳細・目次画面全体のレイアウト統合コンポーネント（Presentational）
 * ローディング、未存在作品（Not Found）、通常表示の排他描画を制御する
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
  return (
    <div
      data-testid="novel-detail-page"
      className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 md:p-6 lg:p-8"
    >
      <div className="max-w-4xl mx-auto">
        {isLoading ? (
          <div
            data-testid="novel-detail-loading"
            className="flex flex-col items-center justify-center py-24 text-slate-500 dark:text-slate-400"
          >
            <div
              aria-hidden="true"
              className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"
            />
            <p className="text-sm font-medium">作品情報を読み込み中...</p>
          </div>
        ) : novel === null ? (
          <div
            data-testid="novel-detail-not-found"
            className="flex flex-col items-center justify-center py-20 px-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-center shadow-xs"
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
              onClick={onBackToBookshelf}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-medium rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <span aria-hidden="true">←</span>
              <span>本棚へ戻る</span>
            </button>
          </div>
        ) : (
          <>
            <NovelDetailHeader
              novel={novel}
              isRefreshing={isRefreshing}
              refreshMessage={refreshMessage}
              error={error}
              onBackToBookshelf={onBackToBookshelf}
              onStartFromBeginning={onStartFromBeginning}
              onResumeBookmark={onResumeBookmark}
              onRefreshToc={onRefreshToc}
              onOpenDeleteDialog={onOpenDeleteDialog}
            />

            <main>
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
    </div>
  );
};

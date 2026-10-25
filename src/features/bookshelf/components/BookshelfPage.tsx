import React from "react";
import type { NovelSummary } from "../../../storage/types";
import { BookshelfEmptyState } from "./BookshelfEmptyState";
import { NovelCard } from "./NovelCard";
import { AddNovelDialog } from "./AddNovelDialog";

export interface BookshelfPageProps {
  novels: NovelSummary[];
  isLoading: boolean;
  isDialogOpen: boolean;
  isSubmitting: boolean;
  dialogError?: string | null;
  onOpenDialog: () => void;
  onCloseDialog: () => void;
  onAddNovel: (url: string) => void | Promise<void>;
  onSelectNovel: (novelId: string) => void;
  onResumeNovel: (novelId: string, chapterIndex: number) => void;
}

/**
 * 本棚画面（SCR-01）のレイアウト統合コンポーネント（Presentational）
 * ヘッダー、作品カード一覧または空状態UI、および作品追加ダイアログを配置する
 */
export const BookshelfPage: React.FC<BookshelfPageProps> = ({
  novels,
  isLoading,
  isDialogOpen,
  isSubmitting,
  dialogError,
  onOpenDialog,
  onCloseDialog,
  onAddNovel,
  onSelectNovel,
  onResumeNovel,
}) => {
  return (
    <div
      data-testid="bookshelf-page"
      className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 md:p-6 lg:p-8"
    >
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl select-none" aria-hidden="true">
              📚
            </span>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              本棚
            </h1>
          </div>

          <button
            type="button"
            data-testid="open-add-novel-button"
            onClick={onOpenDialog}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-medium rounded-lg shadow-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <span>＋</span>
            <span>URLから作品を追加</span>
          </button>
        </header>

        <main>
          {isLoading ? (
            <div
              data-testid="bookshelf-loading"
              className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400"
            >
              <div
                aria-hidden="true"
                className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"
              />
              <p className="text-sm font-medium">作品一覧を読み込み中...</p>
            </div>
          ) : novels.length === 0 ? (
            <BookshelfEmptyState onOpenAdd={onOpenDialog} />
          ) : (
            <div
              data-testid="novel-list"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {novels.map((novel) => (
                <NovelCard
                  key={novel.id}
                  novel={novel}
                  onSelect={onSelectNovel}
                  onResume={onResumeNovel}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <AddNovelDialog
        isOpen={isDialogOpen}
        isSubmitting={isSubmitting}
        error={dialogError}
        onClose={onCloseDialog}
        onSubmit={onAddNovel}
      />
    </div>
  );
};

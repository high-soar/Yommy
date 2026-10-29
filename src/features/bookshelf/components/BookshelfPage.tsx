import React from "react";
import type { BookshelfSortOrder, NovelSummary } from "../../../storage/types";
import { BookshelfEmptyState } from "./BookshelfEmptyState";
import { NovelCard } from "./NovelCard";

export interface BookshelfPageProps {
  novels: NovelSummary[];
  isLoading: boolean;
  isCheckingUpdates?: boolean;
  updateCheckProgress?: { current: number; total: number } | null;
  sortOrder?: BookshelfSortOrder;
  onSortChange?: (order: BookshelfSortOrder) => void;
  onCheckUpdates?: () => void;
  onNavigateSearch?: () => void;
  onNavigateRanking?: () => void;
  onSelectNovel: (novelId: string) => void;
  onResumeNovel: (novelId: string, chapterIndex: number) => void;
}

/**
 * 本棚画面（SCR-01）のレイアウト統合コンポーネント（Presentational）
 *
 * 全画面シェル（100dvh）内で上部ヘッダーを固定し、作品カード一覧または空状態 UI を
 * 内部縦スクロール領域（overflow-y-auto）として描画する（AC-BS-07）。
 */
export const BookshelfPage: React.FC<BookshelfPageProps> = ({
  novels,
  isLoading,
  onNavigateSearch,
  onNavigateRanking,
  onSelectNovel,
  onResumeNovel,
}) => {
  return (
    <div
      data-testid="bookshelf-page"
      className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
    >
      <header className="shrink-0 w-full max-w-6xl mx-auto p-4 md:p-6 lg:p-8 pb-0 md:pb-0 lg:pb-0">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl select-none" aria-hidden="true">
              📚
            </span>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              本棚
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto w-full max-w-6xl mx-auto p-4 md:p-6 lg:p-8 pt-4 md:pt-6">
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
          <BookshelfEmptyState
            onNavigateSearch={onNavigateSearch}
            onNavigateRanking={onNavigateRanking}
          />
        ) : (
          <div
            data-testid="novel-list"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
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
  );
};

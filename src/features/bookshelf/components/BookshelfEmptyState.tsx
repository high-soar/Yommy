import React from "react";

export interface BookshelfEmptyStateProps {
  onOpenAdd: () => void;
}

/**
 * 本棚に登録作品が0件のときに表示される空状態案内 UI
 */
export const BookshelfEmptyState: React.FC<BookshelfEmptyStateProps> = ({
  onOpenAdd,
}) => {
  return (
    <div
      data-testid="bookshelf-empty"
      className="flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 shadow-xs max-w-md mx-auto my-12"
    >
      <div className="w-16 h-16 mb-4 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-300 text-2xl select-none">
        📖
      </div>
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
        本棚に作品が登録されていません
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
        カクヨムの作品URLを入力して小説を追加しましょう。
        <br />
        登録した作品はオフラインでも読書できます。
      </p>
      <button
        type="button"
        data-testid="empty-add-novel-button"
        onClick={onOpenAdd}
        className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        URLから作品を追加
      </button>
    </div>
  );
};

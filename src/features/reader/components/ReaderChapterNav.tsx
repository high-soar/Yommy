import React from "react";

export interface ReaderChapterNavProps {
  chapterIndex: number;
  totalChapters: number;
  isLoading?: boolean;
  onPrevChapter: () => void;
  onNextChapter: () => void;
}

/**
 * 前後エピソード連続遷移ナビゲーションバー（Presentational）
 *
 * 同一作品の「前の話へ」「次の話へ」の遷移および現在話数インジケーターを提供する。
 */
export const ReaderChapterNav: React.FC<ReaderChapterNavProps> = ({
  chapterIndex,
  totalChapters,
  isLoading = false,
  onPrevChapter,
  onNextChapter,
}) => {
  const isPrevDisabled = chapterIndex <= 1 || isLoading;
  const isNextDisabled =
    chapterIndex >= totalChapters || totalChapters <= 0 || isLoading;

  return (
    <nav
      data-testid="reader-chapter-nav"
      aria-label="エピソードナビゲーション"
      className="bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 shadow-xs flex items-center justify-between gap-3 text-xs"
    >
      <button
        type="button"
        data-testid="reader-prev-chapter"
        disabled={isPrevDisabled}
        onClick={onPrevChapter}
        className="inline-flex items-center gap-1 px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500"
      >
        <span aria-hidden="true">←</span>
        <span>前の話へ</span>
      </button>

      <span
        data-testid="reader-chapter-indicator"
        className="font-medium text-slate-600 dark:text-slate-300 select-none text-center"
      >
        第 {chapterIndex} 話 / 全 {totalChapters} 話
      </span>

      <button
        type="button"
        data-testid="reader-next-chapter"
        disabled={isNextDisabled}
        onClick={onNextChapter}
        className="inline-flex items-center gap-1 px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500"
      >
        <span>次の話へ</span>
        <span aria-hidden="true">→</span>
      </button>
    </nav>
  );
};

import React from "react";
import type { NovelSummary } from "../../../storage/types";

export interface NovelCardProps {
  novel: NovelSummary;
  onSelect: (novelId: string) => void;
  onResume: (novelId: string, chapterIndex: number) => void;
}

/**
 * 登録済み1作品を表示し、詳細画面遷移または読書再開を提供するカードコンポーネント
 */
export const NovelCard: React.FC<NovelCardProps> = ({
  novel,
  onSelect,
  onResume,
}) => {
  const isBookmarked = novel.bookmarkChapterIndex !== null;
  const bookmarkLabel = isBookmarked
    ? `しおり: 第${novel.bookmarkChapterIndex}話`
    : "未読";
  const resumeButtonLabel = isBookmarked
    ? `第${novel.bookmarkChapterIndex}話から読む`
    : "第1話から読む";

  const handleResume = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const targetChapter = novel.bookmarkChapterIndex ?? 1;
    onResume(novel.id, targetChapter);
  };

  return (
    <div
      data-testid="novel-card"
      data-novel-id={novel.id}
      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
    >
      <button
        type="button"
        data-testid="novel-card-select"
        onClick={() => onSelect(novel.id)}
        className="cursor-pointer group flex-1 focus:outline-hidden focus:ring-2 focus:ring-blue-500 rounded-lg p-1 -m-1 text-left w-full"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3
            data-testid="novel-card-title"
            className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2"
          >
            {novel.title}
          </h3>
          <span
            data-testid="novel-card-bookmark"
            className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
              isBookmarked
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
            }`}
          >
            {bookmarkLabel}
          </span>
        </div>

        <p
          data-testid="novel-card-author"
          className="text-xs text-slate-600 dark:text-slate-400 mb-3"
        >
          {novel.author || "著者不明"}
        </p>

        <p
          data-testid="novel-card-chapters"
          className="text-xs text-slate-500 dark:text-slate-400 mb-4"
        >
          全 {novel.totalChapters} 話（取得済み {novel.cachedChapters} 話）
        </p>
      </button>

      <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 mt-auto">
        <button
          type="button"
          data-testid="novel-card-resume"
          onClick={handleResume}
          className="w-full inline-flex items-center justify-center px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
        >
          {resumeButtonLabel}
        </button>
      </div>
    </div>
  );
};

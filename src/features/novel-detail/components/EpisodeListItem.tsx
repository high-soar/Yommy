import React from "react";
import type { EpisodeListItemProps } from "../types";

export type { EpisodeListItemProps } from "../types";

const formatEpisodeDate = (dateStr: string): string => {
  if (dateStr.includes("T")) {
    return dateStr.split("T")[0].replace(/-/g, "/");
  }
  return dateStr.replace(/-/g, "/");
};

/**
 * 単一エピソード行コンポーネント（話数・タイトル・日時・取得状態・既読・しおり表示）
 */
export const EpisodeListItem: React.FC<EpisodeListItemProps> = ({
  chapter,
  isBookmarked,
  onSelectEpisode,
}) => {
  const isCached = chapter.downloadedAt !== null || chapter.byteSize > 0;
  const bookmarkStyle = isBookmarked
    ? "border-amber-300 dark:border-amber-700/70 bg-amber-50/20 dark:bg-amber-950/20"
    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80";

  return (
    <button
      type="button"
      data-testid="episode-item"
      data-chapter-index={chapter.chapterIndex}
      aria-label={`第${chapter.chapterIndex}話 ${chapter.title}`}
      onClick={() => onSelectEpisode(chapter.chapterIndex)}
      className={`w-full text-left p-3.5 sm:p-4 rounded-xl border ${bookmarkStyle} hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer flex flex-col gap-1.5`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          data-testid="episode-item-title"
          className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-2"
        >
          第{chapter.chapterIndex}話 {chapter.title}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {isCached ? (
            <span
              data-testid="episode-cached-badge"
              className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
            >
              取得済み
            </span>
          ) : (
            <span
              data-testid="episode-uncached-badge"
              className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
            >
              未取得
            </span>
          )}

          {chapter.isRead && (
            <span
              data-testid="episode-read-badge"
              className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
            >
              既読
            </span>
          )}

          {isBookmarked && (
            <span
              data-testid="episode-bookmark-badge"
              className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
            >
              しおり
            </span>
          )}
        </div>
      </div>

      {chapter.publishedAt && (
        <span
          data-testid="episode-item-date"
          className="text-xs text-slate-500 dark:text-slate-400"
        >
          {formatEpisodeDate(chapter.publishedAt)}
        </span>
      )}
    </button>
  );
};

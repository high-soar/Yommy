import React from "react";
import { EpisodeListItem } from "./EpisodeListItem";
import type { EpisodeListProps } from "../types";

export type { EpisodeListProps } from "../types";

/**
 * 章見出し付きエピソード一覧コンポーネント（フラットリスト形式）
 */
export const EpisodeList: React.FC<EpisodeListProps> = ({
  chapters,
  bookmarkChapterIndex,
  onSelectEpisode,
}) => {
  if (chapters.length === 0) {
    return (
      <div
        data-testid="episode-list-empty"
        className="p-8 text-center text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700"
      >
        エピソード目次がありません。
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="エピソード目次"
      data-testid="episode-list"
      className="space-y-2"
    >
      {chapters.map((chapter, index) => {
        const prevPartTitle = index > 0 ? chapters[index - 1].partTitle : null;
        const hasPartTitle = Boolean(
          chapter.partTitle && chapter.partTitle.trim().length > 0,
        );
        const shouldRenderHeader =
          hasPartTitle && chapter.partTitle !== prevPartTitle;

        return (
          <React.Fragment key={chapter.id}>
            {shouldRenderHeader && (
              <div
                role="heading"
                aria-level={3}
                data-testid="chapter-section-header"
                className="pt-4 pb-1 px-1 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
              >
                {chapter.partTitle}
              </div>
            )}
            <EpisodeListItem
              chapter={chapter}
              isBookmarked={bookmarkChapterIndex === chapter.chapterIndex}
              onSelectEpisode={onSelectEpisode}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};

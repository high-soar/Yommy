import React from "react";
import type { NovelRankingPeriod } from "../../../parsers/types";
import { RANKING_GENRES, RANKING_PERIODS } from "../types";

export interface RankingFilterBarProps {
  selectedPeriod: NovelRankingPeriod;
  onSelectPeriod: (period: NovelRankingPeriod) => void;
  selectedGenre?: string;
  onSelectGenre: (genre?: string) => void;
}

/**
 * ランキング集計期間・ジャンル切替バー（期間ピル、ジャンル横スクロールピル）
 */
export const RankingFilterBar: React.FC<RankingFilterBarProps> = ({
  selectedPeriod,
  onSelectPeriod,
  selectedGenre,
  onSelectGenre,
}) => {
  return (
    <div
      data-testid="ranking-filter-bar"
      className="flex flex-col gap-2 w-full py-1 text-xs sm:text-sm"
    >
      {/* 上段: 集計期間ピル（4種: 日間 / 週間 / 月間 / 累計） */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        <div
          role="group"
          aria-label="集計期間"
          className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 shrink-0"
        >
          {RANKING_PERIODS.map((period) => {
            const isSelected = selectedPeriod === period.value;
            return (
              <button
                key={period.value}
                type="button"
                data-testid={`ranking-period-${period.value}`}
                aria-pressed={isSelected}
                onClick={() => onSelectPeriod(period.value)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  isSelected
                    ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {period.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 下段: ジャンル横スクロールピル（総合 ＋ 主要12ジャンル） */}
      <div
        role="group"
        aria-label="ジャンル"
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1"
      >
        {RANKING_GENRES.map((genre) => {
          const isSelected = selectedGenre === genre.id;
          return (
            <button
              key={genre.id ?? "all"}
              type="button"
              data-testid={`ranking-genre-${genre.id ?? "all"}`}
              aria-pressed={isSelected}
              onClick={() => onSelectGenre(genre.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors border ${
                isSelected
                  ? "bg-sky-600 border-sky-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {genre.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

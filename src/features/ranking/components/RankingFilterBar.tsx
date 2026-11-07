import React from "react";
import type {
  NovelRankingPeriod,
  NovelRankingWorkVariation,
  NovelSiteType,
} from "../../../parsers/types";
import {
  RANKING_GENRES,
  RANKING_PERIODS,
  RANKING_WORK_VARIATIONS,
} from "../types";
import { NAROU_RANKING_GENRES } from "../../../parsers/narou/genres";

export interface RankingFilterBarProps {
  /** 選択中サイト識別子（サイト別ジャンルピル切替用、省略時は "kakuyomu"、v0.7 Issue #240） */
  selectedSite?: NovelSiteType;
  selectedPeriod: NovelRankingPeriod;
  onSelectPeriod: (period: NovelRankingPeriod) => void;
  /** 選択中作品種別（すべて / 長編・連載 / 短編、省略時は "long"、v0.8 Issue #265） */
  selectedWorkVariation?: NovelRankingWorkVariation;
  /** 作品種別変更コールバック（v0.8 Issue #265） */
  onSelectWorkVariation?: (workVariation: NovelRankingWorkVariation) => void;
  selectedGenre?: string;
  onSelectGenre: (genre?: string) => void;
  /** 通信中操作抑止フラグ（省略時は false） */
  disabled?: boolean;
}

/**
 * ランキング集計期間・作品種別・ジャンル切替バー（期間ピル、作品種別ピル、ジャンル横スクロールピル）
 */
export const RankingFilterBar: React.FC<RankingFilterBarProps> = ({
  selectedSite = "kakuyomu",
  selectedPeriod,
  onSelectPeriod,
  selectedWorkVariation,
  onSelectWorkVariation,
  selectedGenre,
  onSelectGenre,
  disabled = false,
}) => {
  const genres =
    selectedSite === "narou" ? NAROU_RANKING_GENRES : RANKING_GENRES;
  const currentWorkVariation = selectedWorkVariation ?? "long";

  return (
    <div
      data-testid="ranking-filter-bar"
      className="flex flex-col gap-2 w-full py-1 text-xs sm:text-sm"
    >
      {/* 上段: 集計期間ピル（4種） & 作品種別ピル（3種） */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        {/* 集計期間ピル */}
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
                disabled={disabled}
                aria-pressed={isSelected}
                onClick={() => {
                  if (!disabled) {
                    onSelectPeriod(period.value);
                  }
                }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  isSelected
                    ? `bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs ${
                        disabled ? "cursor-not-allowed opacity-60" : ""
                      }`
                    : disabled
                      ? "text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {period.label}
              </button>
            );
          })}
        </div>

        {/* 作品種別ピル */}
        <div
          role="group"
          aria-label="作品種別"
          className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 shrink-0"
        >
          {RANKING_WORK_VARIATIONS.map((opt) => {
            const isSelected = currentWorkVariation === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                data-testid={`ranking-variation-${opt.value}`}
                disabled={disabled}
                aria-pressed={isSelected}
                onClick={() => {
                  if (!disabled) {
                    onSelectWorkVariation?.(opt.value);
                  }
                }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  isSelected
                    ? `bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs ${
                        disabled ? "cursor-not-allowed opacity-60" : ""
                      }`
                    : disabled
                      ? "text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 下段: ジャンル横スクロールピル（総合 ＋ 主要12ジャンル / なろう小ジャンル21種） */}
      <div
        role="group"
        aria-label="ジャンル"
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1"
      >
        {genres.map((genre) => {
          const isSelected = selectedGenre === genre.id;
          return (
            <button
              key={genre.id ?? "all"}
              type="button"
              data-testid={`ranking-genre-${genre.id ?? "all"}`}
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => {
                if (!disabled) {
                  onSelectGenre(genre.id);
                }
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors border ${
                isSelected
                  ? `bg-sky-600 border-sky-600 text-white shadow-xs ${
                      disabled ? "cursor-not-allowed opacity-60" : ""
                    }`
                  : disabled
                    ? "bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60"
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

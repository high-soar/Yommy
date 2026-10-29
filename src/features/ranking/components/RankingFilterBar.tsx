import React from "react";
import type { NovelRankingPeriod } from "../../../parsers/types";

export interface RankingFilterBarProps {
  selectedPeriod: NovelRankingPeriod;
  onSelectPeriod: (period: NovelRankingPeriod) => void;
  selectedGenre?: string;
  onSelectGenre: (genre?: string) => void;
}

/**
 * ランキング集計期間・ジャンル切替バー
 */
export const RankingFilterBar: React.FC<RankingFilterBarProps> = () => {
  return <div data-testid="ranking-filter-bar-stub">RankingFilterBar Stub</div>;
};

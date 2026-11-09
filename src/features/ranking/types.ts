import type {
  NovelRankingOptions,
  NovelRankingPeriod,
  NovelRankingResultItem,
  NovelRankingWorkVariation,
  NovelSearchResultItem,
  NovelSiteType,
} from "../../parsers/types";

export type {
  NovelRankingOptions,
  NovelRankingPeriod,
  NovelRankingResultItem,
  NovelRankingWorkVariation,
  NovelSearchResultItem,
  NovelSiteType,
};

/**
 * ランキング対象サイトの選択肢定義
 */
export interface RankingSiteOption {
  readonly siteType: NovelSiteType;
  readonly label: string;
  readonly isAvailable: boolean;
}

/**
 * 集計期間の選択肢定義（4種）
 */
export interface RankingPeriodOption {
  readonly value: NovelRankingPeriod;
  readonly label: string;
}

/**
 * 作品種別の選択肢定義（3種: すべて / 長編・連載 / 短編、v0.8 Issue #265）
 */
export interface RankingWorkVariationOption {
  readonly value: NovelRankingWorkVariation;
  readonly label: string;
}

/**
 * カクヨム主要12ジャンルの選択肢定義（総合＋12種）
 */
export interface RankingGenreOption {
  readonly id?: string;
  readonly label: string;
}

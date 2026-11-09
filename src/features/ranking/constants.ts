import type {
  RankingGenreOption,
  RankingPeriodOption,
  RankingSiteOption,
  RankingWorkVariationOption,
} from "./types";

/**
 * ランキング対象サイトの選択肢定義
 */
export const RANKING_SITES: readonly RankingSiteOption[] = [
  { siteType: "kakuyomu", label: "カクヨム", isAvailable: true },
  { siteType: "narou", label: "小説家になろう", isAvailable: true },
] as const;

/**
 * 集計期間の選択肢定義（4種）
 */
export const RANKING_PERIODS: readonly RankingPeriodOption[] = [
  { value: "daily", label: "日間" },
  { value: "weekly", label: "週間" },
  { value: "monthly", label: "月間" },
  { value: "entire", label: "累計" },
] as const;

/**
 * 作品種別の選択肢定義（3種: すべて / 長編・連載 / 短編、v0.8 Issue #265）
 */
export const RANKING_WORK_VARIATIONS: readonly RankingWorkVariationOption[] = [
  { value: "all", label: "すべて" },
  { value: "long", label: "長編・連載" },
  { value: "short", label: "短編" },
] as const;

/**
 * カクヨム主要12ジャンルの選択肢定義（総合＋12種）
 */
export const RANKING_GENRES: readonly RankingGenreOption[] = [
  { id: undefined, label: "総合" },
  { id: "fantasy", label: "異世界ファンタジー" },
  { id: "action", label: "現代ファンタジー" },
  { id: "sf", label: "SF" },
  { id: "love_story", label: "恋愛" },
  { id: "romance", label: "ラブコメ" },
  { id: "drama", label: "現代ドラマ" },
  { id: "horror", label: "ホラー" },
  { id: "mystery", label: "ミステリー" },
  { id: "nonfiction", label: "エッセイ・ノンフィクション" },
  { id: "history", label: "歴史・時代・伝奇" },
  { id: "criticism", label: "創作論・評論" },
  { id: "others", label: "詩・童話・その他" },
] as const;

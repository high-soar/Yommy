/**
 * なろう公式小ジャンル（全21種）の定義とヘルパー
 * docs/specs/parsers/narou.md §5.2 および docs/specs/changes/issue-240-narou-search-ranking-and-site-selector.md §2.2 に準拠
 */

export interface NarouGenreItem {
  readonly id: string;
  readonly label: string;
  readonly category: string;
}

export interface NarouGenreOption {
  readonly id?: string;
  readonly label: string;
}

/**
 * 小ジャンル21種一覧（TDD Red用スタブ）
 */
export const NAROU_GENRES: readonly NarouGenreItem[] = [];

/**
 * ジャンルコードからジャンル情報へのマップ（TDD Red用スタブ）
 */
export const NAROU_GENRE_MAP: Readonly<Record<string, NarouGenreItem>> = {};

/**
 * ジャンルコードから日本語ラベルへのマップ（TDD Red用スタブ）
 */
export const NAROU_GENRE_LABELS: Readonly<Record<string, string>> = {};

/**
 * ジャンルコードから日本語ラベルを取得する（未定義時は「その他」）（TDD Red用スタブ）
 */
export function getNarouGenreLabel(
  _code: string | number | null | undefined,
): string {
  return "";
}

/**
 * 検索画面用ジャンル選択肢一覧（先頭「すべて」）（TDD Red用スタブ）
 */
export const NAROU_SEARCH_GENRES: readonly NarouGenreOption[] = [];

/**
 * ランキング画面用ジャンル選択肢一覧（先頭「総合」）（TDD Red用スタブ）
 */
export const NAROU_RANKING_GENRES: readonly NarouGenreOption[] = [];

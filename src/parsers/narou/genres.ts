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
 * なろう公式小ジャンル21種一覧
 * 利用頻度の高いファンタジー系・恋愛系を先頭に配置
 */
export const NAROU_GENRES: readonly NarouGenreItem[] = [
  { id: "201", label: "ハイファンタジー", category: "ファンタジー" },
  { id: "202", label: "ローファンタジー", category: "ファンタジー" },
  { id: "101", label: "異世界〔恋愛〕", category: "恋愛" },
  { id: "102", label: "現実世界〔恋愛〕", category: "恋愛" },
  { id: "301", label: "純文学", category: "文芸" },
  { id: "302", label: "ヒューマンドラマ", category: "文芸" },
  { id: "303", label: "歴史", category: "文芸" },
  { id: "304", label: "推理", category: "文芸" },
  { id: "305", label: "ホラー", category: "文芸" },
  { id: "306", label: "アクション", category: "文芸" },
  { id: "307", label: "コメディー", category: "文芸" },
  { id: "401", label: "VRゲーム", category: "SF" },
  { id: "402", label: "宇宙", category: "SF" },
  { id: "403", label: "空想科学", category: "SF" },
  { id: "404", label: "パニック", category: "SF" },
  { id: "9901", label: "童話", category: "その他" },
  { id: "9902", label: "詩", category: "その他" },
  { id: "9903", label: "エッセイ", category: "その他" },
  { id: "9904", label: "リプレイ", category: "その他" },
  { id: "9999", label: "その他", category: "その他" },
  { id: "9801", label: "ノンジャンル", category: "ノンジャンル" },
] as const;

/**
 * ジャンルコードからジャンル情報への逆引きマップ
 */
export const NAROU_GENRE_MAP: Readonly<Record<string, NarouGenreItem>> =
  Object.freeze(
    NAROU_GENRES.reduce<Record<string, NarouGenreItem>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {}),
  );

/**
 * ジャンルコードから日本語ラベルへの逆引きマップ
 */
export const NAROU_GENRE_LABELS: Readonly<Record<string, string>> =
  Object.freeze(
    NAROU_GENRES.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = item.label;
      return acc;
    }, {}),
  );

/**
 * ジャンルコードから日本語ラベルを取得する（未定義時は「その他」）
 */
export function getNarouGenreLabel(
  code: string | number | null | undefined,
): string {
  if (code === null || code === undefined) {
    return "その他";
  }
  const key = String(code).trim();
  return NAROU_GENRE_LABELS[key] ?? "その他";
}

/**
 * 検索画面用ジャンル選択肢一覧（先頭「すべて」）
 */
export const NAROU_SEARCH_GENRES: readonly NarouGenreOption[] = Object.freeze([
  { id: undefined, label: "すべて" },
  ...NAROU_GENRES.map((g) => ({ id: g.id, label: g.label })),
]);

/**
 * ランキング画面用ジャンル選択肢一覧（先頭「総合」）
 */
export const NAROU_RANKING_GENRES: readonly NarouGenreOption[] = Object.freeze([
  { id: undefined, label: "総合" },
  ...NAROU_GENRES.map((g) => ({ id: g.id, label: g.label })),
]);

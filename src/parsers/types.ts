/**
 * 対応サイト識別子
 */
export type NovelSiteType = "kakuyomu" | "narou" | "generic";

/**
 * 目次内の1エピソード情報
 */
export interface ParsedTocItem {
  chapterIndex: number; // 1始まりの連番
  remoteChapterId: string; // サイト固有のエピソード識別子（カクヨムepisodeId、なろう話数等）
  partTitle: string | null; // 章・部見出し（存在しない場合は null）
  title: string; // サブタイトル（各話タイトル）
  url: string; // エピソード本文ページの正規化URL
  publishedAt: string | null; // 公開・更新日時文字列（取得可能な場合）
}

/**
 * 作品トップ（目次）ページから抽出される作品メタデータと目次リスト
 */
export interface ParsedNovelIndex {
  siteType: NovelSiteType;
  remoteWorkId: string; // サイト固有の作品識別子（例: カクヨム workId, なろう ncode）
  canonicalUrl: string; // 正規化された作品トップURL
  title: string; // 作品タイトル
  author: string; // 著者名
  synopsis: string; // あらすじテキスト
  chapters: ParsedTocItem[]; // エピソード目次一覧
  nextTocPageUrl: string | null; // 目次が複数ページに分かれる場合の次ページURL（なろう等）
}

/**
 * 各話ページから抽出される本文データ
 */
export interface ParsedChapterContent {
  remoteChapterId: string;
  title: string; // サブタイトル
  bodyHtml: string; // サニタイズ済み本文HTML（<p>, <br>, <ruby>, <rb>, <rt>, <rp>, <em> のみ許容）
  byteSize: number; // UTF-8 バイトサイズ
  prevChapterUrl: string | null;
  nextChapterUrl: string | null;
}

/**
 * 小説検索の並び順
 */
export type NovelSearchOrder =
  "weekly_ranking" | "popular" | "last_episode_published_at" | "published_at";

export type SearchOrder = NovelSearchOrder;

/**
 * 小説検索の連載状態
 */
export type NovelSerialStatus = "all" | "running" | "completed";

/**
 * 小説検索オプション
 */
export interface NovelSearchOptions {
  order?: NovelSearchOrder;
  serialStatus?: NovelSerialStatus;
  genre?: string;
  page?: number;
}

/**
 * 検索結果の1作品情報
 */
export interface NovelSearchResultItem {
  remoteWorkId: string;
  title: string;
  author: string;
  synopsis: string;
  genre: string;
  genreLabel: string;
  serialStatus: "running" | "completed";
  serialStatusLabel: string;
  episodeCount: number;
  characterCount: number;
  tags: string[];
  reviewPoints: number;
  lastEpisodePublishedAt: string | null;
  workUrl: string;
}

/**
 * 検索結果全体
 */
export interface ParsedSearchResult {
  items: NovelSearchResultItem[];
  pageInfo: {
    currentPage: number;
    hasNextPage: boolean;
    totalCount?: number;
  };
}

/**
 * ランキング集計期間
 */
export type NovelRankingPeriod = "daily" | "weekly" | "monthly" | "entire";

export type RankingPeriod = NovelRankingPeriod;

/**
 * ランキング取得オプション
 */
export interface NovelRankingOptions {
  period?: NovelRankingPeriod;
  genre?: string;
  page?: number;
}

/**
 * ランキング結果の1作品情報
 */
export interface NovelRankingResultItem extends NovelSearchResultItem {
  rank: number; // 1始まりの順位
}

/**
 * ランキング結果全体
 */
export interface ParsedRankingResult {
  items: NovelRankingResultItem[];
  pageInfo: {
    currentPage: number;
    hasNextPage: boolean;
  };
}

/**
 * サイト別パーサーの共通インターフェース（Strategyパターン）
 */
export interface NovelParser {
  readonly siteType: NovelSiteType;

  /** 指定されたURLがこのパーサーの対象サイトかどうかを判定する */
  canParse(url: string): boolean;

  /** エピソードURL等から作品トップURLへ正規化する */
  normalizeWorkUrl(url: string): string;

  /** 作品トップHTMLから作品情報と目次一覧を抽出する（純粋関数・通信なし） */
  parseNovelIndex(html: string, pageUrl: string): ParsedNovelIndex;

  /** 各話HTMLから整形・サニタイズ済み本文HTMLを抽出する（純粋関数・通信なし） */
  parseChapterContent(html: string, pageUrl: string): ParsedChapterContent;

  /** 検索URLを構築する（純粋関数・オプション） */
  buildSearchUrl?(query: string, options?: NovelSearchOptions): string;

  /** 検索結果HTMLから作品一覧とページ情報を抽出する（純粋関数・オプション） */
  searchNovels?(html: string, pageUrl: string): ParsedSearchResult;

  /** ランキングURLを構築する（純粋関数・オプション） */
  buildRankingUrl?(options?: NovelRankingOptions): string;

  /** ランキングHTMLから作品一覧と順位を抽出する（純粋関数・オプション） */
  getRanking?(html: string, pageUrl: string): ParsedRankingResult;
}

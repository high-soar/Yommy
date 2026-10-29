import type {
  NovelSearchOrder,
  NovelSearchResultItem,
  NovelSerialStatus,
  NovelSiteType,
} from "../../parsers/types";

export type {
  NovelSearchOrder,
  NovelSearchResultItem,
  NovelSerialStatus,
  NovelSiteType,
};

/**
 * 検索対象サイトの選択肢定義
 */
export interface SearchSiteOption {
  readonly siteType: NovelSiteType;
  readonly label: string;
  readonly isAvailable: boolean;
}

export const SEARCH_SITES: readonly SearchSiteOption[] = [
  { siteType: "kakuyomu", label: "カクヨム", isAvailable: true },
  { siteType: "narou", label: "小説家になろう", isAvailable: false },
] as const;

/**
 * 並び順の選択肢定義
 */
export interface SearchOrderOption {
  readonly value: NovelSearchOrder;
  readonly label: string;
}

export const SEARCH_ORDERS: readonly SearchOrderOption[] = [
  { value: "weekly_ranking", label: "週間ランキング順" },
  { value: "popular", label: "累計ランキング順" },
  { value: "last_episode_published_at", label: "更新順" },
  { value: "published_at", label: "新作順" },
] as const;

/**
 * 連載状況の選択肢定義
 */
export interface SearchSerialStatusOption {
  readonly value: NovelSerialStatus;
  readonly label: string;
}

export const SEARCH_SERIAL_STATUSES: readonly SearchSerialStatusOption[] = [
  { value: "all", label: "すべて" },
  { value: "running", label: "連載中" },
  { value: "completed", label: "完結済" },
] as const;

/**
 * カクヨム主要12ジャンルの選択肢定義
 */
export interface SearchGenreOption {
  readonly id?: string;
  readonly label: string;
}

export const SEARCH_GENRES: readonly SearchGenreOption[] = [
  { id: undefined, label: "すべて" },
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

/**
 * テスト・Storybook検証用のサンプル検索結果作品アイテム
 */
export const sampleSearchItem: NovelSearchResultItem = {
  remoteWorkId: "16817330658027210412",
  title: "境界迷宮と異界の魔術師",
  author: "小野崎",
  synopsis: "異世界転生した主人公が古代迷宮を攻略する王道ファンタジー。",
  genre: "fantasy",
  genreLabel: "異世界ファンタジー",
  serialStatus: "running",
  serialStatusLabel: "連載中",
  episodeCount: 45,
  characterCount: 152000,
  tags: ["異世界", "魔法", "チート"],
  reviewPoints: 1250,
  lastEpisodePublishedAt: "2026-10-28T12:00:00Z",
  workUrl: "https://kakuyomu.jp/works/16817330658027210412",
};

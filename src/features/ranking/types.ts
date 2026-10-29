import type {
  NovelRankingOptions,
  NovelRankingPeriod,
  NovelRankingResultItem,
  NovelSearchResultItem,
  NovelSiteType,
} from "../../parsers/types";

export type {
  NovelRankingOptions,
  NovelRankingPeriod,
  NovelRankingResultItem,
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

export const RANKING_SITES: readonly RankingSiteOption[] = [
  { siteType: "kakuyomu", label: "カクヨム", isAvailable: true },
  { siteType: "narou", label: "小説家になろう", isAvailable: false },
] as const;

/**
 * 集計期間の選択肢定義（4種）
 */
export interface RankingPeriodOption {
  readonly value: NovelRankingPeriod;
  readonly label: string;
}

export const RANKING_PERIODS: readonly RankingPeriodOption[] = [
  { value: "daily", label: "日間" },
  { value: "weekly", label: "週間" },
  { value: "monthly", label: "月間" },
  { value: "entire", label: "累計" },
] as const;

/**
 * カクヨム主要12ジャンルの選択肢定義（総合＋12種）
 */
export interface RankingGenreOption {
  readonly id?: string;
  readonly label: string;
}

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

/**
 * テスト・Storybook検証用のサンプルランキング作品アイテム
 */
export const sampleRankingItem1: NovelRankingResultItem = {
  rank: 1,
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
  reviewPoints: 12500,
  lastEpisodePublishedAt: "2026-10-28T12:00:00Z",
  workUrl: "https://kakuyomu.jp/works/16817330658027210412",
};

export const sampleRankingItem2: NovelRankingResultItem = {
  rank: 2,
  remoteWorkId: "1177354054881162325",
  title: "現代ダンジョン配信者",
  author: "羽田遼亮",
  synopsis: "ダンジョンが突如出現した現代で、最弱スキルから配信を始める。",
  genre: "action",
  genreLabel: "現代ファンタジー",
  serialStatus: "completed",
  serialStatusLabel: "完結済",
  episodeCount: 120,
  characterCount: 380000,
  tags: ["現代ダンジョン", "配信", "成り上がり"],
  reviewPoints: 9800,
  lastEpisodePublishedAt: "2026-10-27T08:30:00Z",
  workUrl: "https://kakuyomu.jp/works/1177354054881162325",
};

export const sampleRankingItem3: NovelRankingResultItem = {
  rank: 3,
  remoteWorkId: "16816927863115505051",
  title: "星屑のステラマリス",
  author: "星野宙",
  synopsis: "宇宙開拓時代の果て、少女型アンドロイドと往く銀河航路の旅。",
  genre: "sf",
  genreLabel: "SF",
  serialStatus: "running",
  serialStatusLabel: "連載中",
  episodeCount: 30,
  characterCount: 95000,
  tags: ["SF", "宇宙", "アンドロイド"],
  reviewPoints: 7200,
  lastEpisodePublishedAt: "2026-10-26T15:00:00Z",
  workUrl: "https://kakuyomu.jp/works/16816927863115505051",
};

export const sampleRankingItem4: NovelRankingResultItem = {
  rank: 4,
  remoteWorkId: "16816452218841737722",
  title: "放課後アトリエ奇譚",
  author: "水野彩",
  synopsis: "美術部の部室に遺された未完の肖像画が囁く、淡い恋の謎。",
  genre: "drama",
  genreLabel: "現代ドラマ",
  serialStatus: "completed",
  serialStatusLabel: "完結済",
  episodeCount: 18,
  characterCount: 62000,
  tags: ["青春", "美術", "日常の謎"],
  reviewPoints: 4500,
  lastEpisodePublishedAt: null,
  workUrl: "https://kakuyomu.jp/works/16816452218841737722",
};

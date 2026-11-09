import type { NovelRankingResultItem } from "../types";

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

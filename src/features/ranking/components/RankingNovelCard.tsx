import React from "react";
import type { NovelRankingResultItem } from "../../../parsers/types";

export interface RankingNovelCardProps {
  item: NovelRankingResultItem;
  /** すでに SQLite DB に登録済みかどうか */
  isRegistered: boolean;
  /** 現在本棚追加の通信中かどうか */
  isAdding: boolean;
  /** 「＋ 本棚に追加」ボタン押下ハンドラ */
  onAdd: () => void;
  /** カード本体タップハンドラ */
  onSelect: () => void;
}

/**
 * ランキング作品カードコンポーネント（SCR-07）
 */
export const RankingNovelCard: React.FC<RankingNovelCardProps> = () => {
  return <div data-testid="ranking-novel-card-stub">RankingNovelCard Stub</div>;
};

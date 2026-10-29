import React from "react";

export interface RankingContainerProps {
  /** 作品カード本体タップ時の遷移コールバック（省略時は useNovelRanking().handleCardSelect を使用） */
  onSelectNovel?: (novelId: string) => void;
}

/**
 * ランキング画面の Container コンポーネント（SCR-07）
 */
export const RankingContainer: React.FC<RankingContainerProps> = () => {
  return <div data-testid="ranking-container-stub">RankingContainer Stub</div>;
};

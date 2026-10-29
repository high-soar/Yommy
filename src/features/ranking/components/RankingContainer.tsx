import React, { useCallback } from "react";
import type { NovelRankingResultItem } from "../../../parsers/types";
import { useNovelRanking } from "../hooks/useNovelRanking";
import { RankingPage } from "./RankingPage";

export interface RankingContainerProps {
  /** 作品カード本体タップ時の遷移コールバック（省略時は useNovelRanking().handleCardSelect を使用） */
  onSelectNovel?: (novelId: string) => void;
}

/**
 * ランキング画面の Container コンポーネント（SCR-07）
 *
 * useNovelRanking カスタムフックと接続し、状態と操作ハンドラを
 * RankingPage（Presentational）にバインドする。
 */
export const RankingContainer: React.FC<RankingContainerProps> = ({
  onSelectNovel,
}) => {
  const ranking = useNovelRanking();

  const handleSelectCard = useCallback(
    async (item: NovelRankingResultItem) => {
      if (onSelectNovel) {
        if (ranking.registeredWorkIds.has(item.remoteWorkId)) {
          onSelectNovel(`${ranking.selectedSite}:${item.remoteWorkId}`);
        } else {
          const novelId = await ranking.addNovelToBookshelf(item);
          if (novelId) {
            onSelectNovel(novelId);
          }
        }
        return;
      }

      await ranking.handleCardSelect(item);
    },
    [onSelectNovel, ranking],
  );

  return (
    <RankingPage
      selectedSite={ranking.selectedSite}
      onSelectSite={ranking.setSelectedSite}
      selectedPeriod={ranking.period}
      onSelectPeriod={ranking.setPeriod}
      selectedGenre={ranking.genre}
      onSelectGenre={ranking.setGenre}
      items={ranking.items}
      registeredWorkIds={ranking.registeredWorkIds}
      addingWorkId={ranking.addingWorkId}
      isLoading={ranking.isLoading}
      error={ranking.error}
      onRetry={ranking.retry}
      onAddNovel={async (item) => {
        await ranking.addNovelToBookshelf(item);
      }}
      onSelectCard={handleSelectCard}
    />
  );
};

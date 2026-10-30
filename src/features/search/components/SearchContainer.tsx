import React, { useCallback } from "react";
import type { NovelSearchResultItem } from "../../../parsers/types";
import { useNovelSearch } from "../hooks/useNovelSearch";
import { SearchPage } from "./SearchPage";

export interface SearchContainerProps {
  /** 作品カード本体タップ時の遷移コールバック（省略時は useNovelSearch().handleCardSelect を使用） */
  onSelectNovel?: (novelId: string) => void;
}

/**
 * 検索画面の Container コンポーネント（SCR-06）
 *
 * useNovelSearch カスタムフックと接続し、状態と操作ハンドラを
 * SearchPage（Presentational）にバインドする。
 */
export const SearchContainer: React.FC<SearchContainerProps> = ({
  onSelectNovel,
}) => {
  const search = useNovelSearch();

  const handleSelectCard = useCallback(
    async (item: NovelSearchResultItem) => {
      if (onSelectNovel) {
        if (search.registeredWorkIds.has(item.remoteWorkId)) {
          onSelectNovel(`${search.selectedSite}:${item.remoteWorkId}`);
        } else {
          const novelId = await search.addNovelToBookshelf(item);
          if (novelId) {
            onSelectNovel(novelId);
          }
        }
        return;
      }

      await search.handleCardSelect(item);
    },
    [onSelectNovel, search],
  );

  return (
    <SearchPage
      selectedSite={search.selectedSite}
      onSelectSite={search.setSelectedSite}
      keyword={search.keyword}
      onChangeKeyword={search.setKeyword}
      onSubmitSearch={search.search}
      selectedOrder={search.order}
      onSelectOrder={search.setOrder}
      selectedSerialStatus={search.serialStatus}
      onSelectSerialStatus={search.setSerialStatus}
      selectedGenre={search.genre}
      onSelectGenre={search.setGenre}
      items={search.items}
      registeredWorkIds={search.registeredWorkIds}
      addingWorkId={search.addingWorkId}
      isLoading={search.isLoading}
      hasSearched={search.hasSearched}
      isLoadingMore={search.isLoadingMore}
      hasNextPage={search.hasNextPage}
      onLoadMore={search.loadMore}
      error={search.error}
      onRetry={search.retry}
      onAddNovel={async (item) => {
        await search.addNovelToBookshelf(item);
      }}
      onSelectCard={handleSelectCard}
    />
  );
};

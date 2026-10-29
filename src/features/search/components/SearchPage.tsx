import React from "react";
import type {
  NovelSearchOrder,
  NovelSearchResultItem,
  NovelSerialStatus,
  NovelSiteType,
} from "../../../parsers/types";

export interface SearchPageProps {
  selectedSite: NovelSiteType;
  onSelectSite: (site: NovelSiteType) => void;
  keyword: string;
  onChangeKeyword: (keyword: string) => void;
  onSubmitSearch: () => void;
  selectedOrder: NovelSearchOrder;
  onSelectOrder: (order: NovelSearchOrder) => void;
  selectedSerialStatus: NovelSerialStatus;
  onSelectSerialStatus: (status: NovelSerialStatus) => void;
  selectedGenre?: string;
  onSelectGenre: (genre?: string) => void;
  items: NovelSearchResultItem[];
  registeredWorkIds: Set<string>;
  addingWorkId: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  error: string | null;
  onRetry: () => void;
  onAddNovel: (item: NovelSearchResultItem) => void | Promise<void>;
  onSelectCard: (item: NovelSearchResultItem) => void;
}

export const SearchPage: React.FC<SearchPageProps> = () => {
  return null;
};

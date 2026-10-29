import type {
  NovelSearchOrder,
  NovelSearchResultItem,
  NovelSerialStatus,
  NovelSiteType,
} from "../../../parsers/types";

export interface UseNovelSearchResult {
  selectedSite: NovelSiteType;
  setSelectedSite: (site: NovelSiteType) => void;
  keyword: string;
  setKeyword: (keyword: string) => void;
  search: () => Promise<void>;
  order: NovelSearchOrder;
  setOrder: (order: NovelSearchOrder) => void;
  serialStatus: NovelSerialStatus;
  setSerialStatus: (status: NovelSerialStatus) => void;
  genre: string | undefined;
  setGenre: (genre: string | undefined) => void;
  items: NovelSearchResultItem[];
  registeredWorkIds: Set<string>;
  addingWorkId: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasNextPage: boolean;
  loadMore: () => Promise<void>;
  error: string | null;
  retry: () => Promise<void>;
  addNovelToBookshelf: (item: NovelSearchResultItem) => Promise<string | null>;
  handleCardSelect: (item: NovelSearchResultItem) => Promise<void>;
}

export function useNovelSearch(): UseNovelSearchResult {
  return {} as UseNovelSearchResult;
}

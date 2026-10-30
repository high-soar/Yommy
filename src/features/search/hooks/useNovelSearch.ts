import { useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "../../../app/ServiceProvider";
import { useRouter } from "../../../app/router";
import type {
  NovelSearchOrder,
  NovelSearchResultItem,
  NovelSerialStatus,
  NovelSiteType,
} from "../../../parsers/types";

export interface UseNovelSearchResult {
  /** 選択中小説サイト */
  selectedSite: NovelSiteType;
  /** サイト選択変更 */
  setSelectedSite: (site: NovelSiteType) => void;
  /** 検索キーワード */
  keyword: string;
  /** キーワード入力更新 */
  setKeyword: (keyword: string) => void;
  /** 検索実行アクション */
  search: () => Promise<void>;
  /** 並び順 */
  order: NovelSearchOrder;
  /** 並び順変更 */
  setOrder: (order: NovelSearchOrder) => void;
  /** 連載状況 */
  serialStatus: NovelSerialStatus;
  /** 連載状況変更 */
  setSerialStatus: (status: NovelSerialStatus) => void;
  /** ジャンル（未指定時 undefined） */
  genre: string | undefined;
  /** ジャンル変更 */
  setGenre: (genre: string | undefined) => void;
  /** 検索結果作品リスト */
  items: NovelSearchResultItem[];
  /** 登録済み作品 ID（remoteWorkId）のセット */
  registeredWorkIds: Set<string>;
  /** 現在追加処理中の remoteWorkId（未処理時は null） */
  addingWorkId: string | null;
  /** 検索中ローディングフラグ */
  isLoading: boolean;
  /** 検索実行済みフラグ（未検索時は false、1度でも検索実行されると true） */
  hasSearched: boolean;
  /** 次ページ追加読み込み中フラグ */
  isLoadingMore: boolean;
  /** 次ページが存在するかどうか */
  hasNextPage: boolean;
  /** 次ページ追加読み込みアクション */
  loadMore: () => Promise<void>;
  /** エラーメッセージ（エラーなし時は null） */
  error: string | null;
  /** 現在の条件で再試行 */
  retry: () => Promise<void>;
  /** 作品カードを本棚へ登録するアクション（成功時は novelId を返却） */
  addNovelToBookshelf: (item: NovelSearchResultItem) => Promise<string | null>;
  /** カード本体タップ時のハンドラ（登録済み時は詳細へ、未登録時は本棚追加後に詳細へ） */
  handleCardSelect: (item: NovelSearchResultItem) => Promise<void>;
}

interface ExecuteSearchParams {
  order?: NovelSearchOrder;
  serialStatus?: NovelSerialStatus;
  genre?: string | undefined;
}

/**
 * 検索画面の状態管理・HTTP取得・SQLite登録を統括するカスタムフック（SCR-06）
 *
 * キーワード検索、並び順・連載状況・ジャンルフィルタリング、次ページ追加読み込み、
 * 登録済み作品の照合・その場本棚追加、および詳細画面への遷移制御を提供する。
 */
export function useNovelSearch(): UseNovelSearchResult {
  const { httpClient, parserRegistry, novelRepository, isReady } =
    useServices();
  const router = useRouter();

  const [selectedSite, setSelectedSite] = useState<NovelSiteType>("kakuyomu");
  const [keyword, setKeyword] = useState<string>("");
  const [order, setOrderState] = useState<NovelSearchOrder>("weekly_ranking");
  const [serialStatus, setSerialStatusState] =
    useState<NovelSerialStatus>("all");
  const [genre, setGenreState] = useState<string | undefined>(undefined);

  const [items, setItems] = useState<NovelSearchResultItem[]>([]);
  const [registeredWorkIds, setRegisteredWorkIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [addingWorkId, setAddingWorkId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  const hasSearchedRef = useRef<boolean>(false);

  // DB内の登録済み作品ID一覧を更新
  const refreshRegisteredIds = useCallback(async () => {
    if (!novelRepository) return;
    try {
      const novels = await novelRepository.listNovels();
      const ids = new Set(
        novels
          .filter((n) => n.siteType === selectedSite)
          .map((n) => n.remoteWorkId),
      );
      setRegisteredWorkIds(ids);
    } catch {
      // 登録済みID取得の失敗時は空セットにフォールバック
      setRegisteredWorkIds(new Set());
    }
  }, [novelRepository, selectedSite]);

  useEffect(() => {
    if (isReady) {
      void refreshRegisteredIds();
    }
  }, [isReady, refreshRegisteredIds]);

  // 内部検索実行処理
  const executeSearch = useCallback(
    async (params?: ExecuteSearchParams) => {
      const targetOrder = params?.order !== undefined ? params.order : order;
      const targetSerial =
        params?.serialStatus !== undefined ? params.serialStatus : serialStatus;
      const targetGenre = params && "genre" in params ? params.genre : genre;

      setIsLoading(true);
      setError(null);
      hasSearchedRef.current = true;

      try {
        const parser = parserRegistry
          .getAll()
          .find((p) => p.siteType === selectedSite);

        if (!parser || !parser.buildSearchUrl || !parser.searchNovels) {
          throw new Error(`検索機能が未実装のサイトです: ${selectedSite}`);
        }

        const url = parser.buildSearchUrl(keyword, {
          order: targetOrder,
          serialStatus: targetSerial,
          genre: targetGenre,
          page: 1,
        });

        const response = await httpClient.getHtml({ url });
        const result = parser.searchNovels(response.html, url);

        setItems(result.items);
        setCurrentPage(result.pageInfo.currentPage);
        setHasNextPage(result.pageInfo.hasNextPage);

        await refreshRegisteredIds();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setItems([]);
        setHasNextPage(false);
      } finally {
        setIsLoading(false);
      }
    },
    [
      keyword,
      order,
      serialStatus,
      genre,
      selectedSite,
      parserRegistry,
      httpClient,
      refreshRegisteredIds,
    ],
  );

  const search = useCallback(async () => {
    await executeSearch();
  }, [executeSearch]);

  const loadMore = useCallback(async () => {
    if (!hasNextPage || isLoadingMore || isLoading) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    try {
      const parser = parserRegistry
        .getAll()
        .find((p) => p.siteType === selectedSite);

      if (!parser || !parser.buildSearchUrl || !parser.searchNovels) {
        throw new Error(`検索機能が未実装のサイトです: ${selectedSite}`);
      }

      const nextPage = currentPage + 1;
      const url = parser.buildSearchUrl(keyword, {
        order,
        serialStatus,
        genre,
        page: nextPage,
      });

      const response = await httpClient.getHtml({ url });
      const result = parser.searchNovels(response.html, url);

      setItems((prev) => [...prev, ...result.items]);
      setCurrentPage(result.pageInfo.currentPage);
      setHasNextPage(result.pageInfo.hasNextPage);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    hasNextPage,
    isLoadingMore,
    isLoading,
    parserRegistry,
    selectedSite,
    currentPage,
    keyword,
    order,
    serialStatus,
    genre,
    httpClient,
  ]);

  const retry = useCallback(async () => {
    await executeSearch();
  }, [executeSearch]);

  const setOrder = useCallback(
    (newOrder: NovelSearchOrder) => {
      setOrderState(newOrder);
      if (hasSearchedRef.current) {
        void executeSearch({ order: newOrder });
      }
    },
    [executeSearch],
  );

  const setSerialStatus = useCallback(
    (newStatus: NovelSerialStatus) => {
      setSerialStatusState(newStatus);
      if (hasSearchedRef.current) {
        void executeSearch({ serialStatus: newStatus });
      }
    },
    [executeSearch],
  );

  const setGenre = useCallback(
    (newGenre: string | undefined) => {
      setGenreState(newGenre);
      if (hasSearchedRef.current) {
        void executeSearch({ genre: newGenre });
      }
    },
    [executeSearch],
  );

  const addNovelToBookshelf = useCallback(
    async (item: NovelSearchResultItem): Promise<string | null> => {
      setAddingWorkId(item.remoteWorkId);
      setError(null);

      try {
        const parser = parserRegistry.requireParser(item.workUrl);

        const response = await httpClient.getHtml({ url: item.workUrl });
        const parsedIndex = parser.parseNovelIndex(response.html, item.workUrl);

        const savedNovel = await novelRepository.upsertNovelWithToc(
          parsedIndex,
          new Date().toISOString(),
        );

        setRegisteredWorkIds((prev) => new Set(prev).add(item.remoteWorkId));
        setAddingWorkId(null);
        return savedNovel.id;
      } catch (err) {
        setAddingWorkId(null);
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return null;
      }
    },
    [httpClient, novelRepository, parserRegistry],
  );

  const handleCardSelect = useCallback(
    async (item: NovelSearchResultItem): Promise<void> => {
      if (registeredWorkIds.has(item.remoteWorkId)) {
        const fallbackSiteType =
          (item as { siteType?: NovelSiteType }).siteType ?? selectedSite;
        let novelId = `${fallbackSiteType}:${item.remoteWorkId}`;
        try {
          const novels = await novelRepository.listNovels();
          const found = novels?.find(
            (n) =>
              n.siteType === fallbackSiteType &&
              n.remoteWorkId === item.remoteWorkId,
          );
          if (found?.id) {
            novelId = found.id;
          }
        } catch {
          // listNovels 取得失敗時は決定論的 ID をフォールバックとして使用
        }
        router.navigateToNovelDetail(novelId, "/search");
        return;
      }

      const novelId = await addNovelToBookshelf(item);
      if (novelId) {
        router.navigateToNovelDetail(novelId, "/search");
      }
    },
    [
      registeredWorkIds,
      addNovelToBookshelf,
      novelRepository,
      selectedSite,
      router,
    ],
  );

  return {
    selectedSite,
    setSelectedSite,
    keyword,
    setKeyword,
    search,
    order,
    setOrder,
    serialStatus,
    setSerialStatus,
    genre,
    setGenre,
    items,
    registeredWorkIds,
    addingWorkId,
    isLoading,
    hasSearched: false,
    isLoadingMore,
    hasNextPage,
    loadMore,
    error,
    retry,
    addNovelToBookshelf,
    handleCardSelect,
  };
}

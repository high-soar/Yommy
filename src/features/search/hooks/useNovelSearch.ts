import { useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "../../../app/ServiceProvider";
import { useRouter } from "../../../app/router";
import type {
  NovelSearchOrder,
  NovelSearchResultItem,
  NovelSerialStatus,
  NovelSiteType,
} from "../../../parsers/types";
import { fetchFullNovelIndex } from "../../../parsers/fetchFullNovelIndex";

export interface UseNovelSearchResult {
  /** 選択中小説サイト */
  selectedSite: NovelSiteType;
  /** サイト選択変更 */
  setSelectedSite: (site: NovelSiteType) => void;
  /** 検索キーワード */
  keyword: string;
  /** キーワード入力更新 */
  setKeyword: (keyword: string) => void;
  /** 除外キーワード（v0.8 Issue #264） */
  excludeKeyword: string;
  /** 除外キーワード入力更新（v0.8 Issue #264） */
  setExcludeKeyword: (excludeKeyword: string) => void;
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
  /** 単一ジャンル（後方互換用: genres[0]） */
  genre: string | undefined;
  /** 複数ジャンルID配列（v0.8 Issue #264） */
  genres: string[];
  /** ジャンルトグル変更（undefined時は全解除、v0.8 Issue #264） */
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
  site?: NovelSiteType;
  order?: NovelSearchOrder;
  serialStatus?: NovelSerialStatus;
  genres?: string[];
}

/**
 * 検索画面の状態管理・HTTP取得・SQLite登録を統括するカスタムフック（SCR-06）
 *
 * キーワード検索、並び順・連載状況・ジャンルフィルタリング、次ページ追加読み込み、
 * 登録済み作品の照合・その場本棚追加、および詳細画面への遷移制御を提供する。
 * 通信中（isLoading === true）の重複リクエストガードおよび非同期競合（Race Condition）防止を内包する（v0.7 Issue #238 / AC-SE-09）。
 */
export function useNovelSearch(): UseNovelSearchResult {
  const { httpClient, parserRegistry, novelRepository, syncEngine, isReady } =
    useServices();
  const router = useRouter();

  const [selectedSite, setSelectedSiteState] =
    useState<NovelSiteType>("kakuyomu");
  const [keyword, setKeyword] = useState<string>("");
  const [excludeKeyword, setExcludeKeyword] = useState<string>("");
  const [order, setOrderState] = useState<NovelSearchOrder>("weekly_ranking");
  const [serialStatus, setSerialStatusState] =
    useState<NovelSerialStatus>("all");
  const [genres, setGenresState] = useState<string[]>([]);
  const genre = genres[0];

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

  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const hasSearchedRef = useRef<boolean>(false);

  // 通信重複ガードおよび非同期競合（Race Condition）防止用 ref
  const isSearchingRef = useRef<boolean>(false);
  const searchGenerationRef = useRef<number>(0);
  const selectedSiteRef = useRef<NovelSiteType>(selectedSite);

  useEffect(() => {
    selectedSiteRef.current = selectedSite;
  }, [selectedSite]);

  /**
   * DB内の登録済み作品ID一覧を更新（サイト切替時は targetSite を明示して照合）
   */
  const refreshRegisteredIds = useCallback(
    async (targetSite?: NovelSiteType) => {
      if (!novelRepository) return;
      const siteToQuery = targetSite ?? selectedSite;
      try {
        const novels = await novelRepository.listNovels();
        const ids = new Set(
          novels
            .filter((n) => n.siteType === siteToQuery)
            .map((n) => n.remoteWorkId),
        );
        setRegisteredWorkIds(ids);
      } catch {
        // 登録済みID取得の失敗時は空セットにフォールバック
        setRegisteredWorkIds(new Set());
      }
    },
    [novelRepository, selectedSite],
  );

  useEffect(() => {
    if (isReady) {
      void refreshRegisteredIds();
    }
  }, [isReady, refreshRegisteredIds]);

  // 内部検索実行処理
  const executeSearch = useCallback(
    async (params?: ExecuteSearchParams) => {
      if (isSearchingRef.current) return;
      isSearchingRef.current = true;
      searchGenerationRef.current += 1;

      const targetSite =
        params?.site !== undefined ? params.site : selectedSite;
      const targetOrder = params?.order !== undefined ? params.order : order;
      const targetSerial =
        params?.serialStatus !== undefined ? params.serialStatus : serialStatus;
      const targetGenres =
        params?.genres !== undefined ? params.genres : genres;
      const targetGenre = targetGenres[0];

      setIsLoading(true);
      setError(null);
      setHasSearched(true);
      hasSearchedRef.current = true;

      try {
        const parser = parserRegistry
          .getAll()
          .find((p) => p.siteType === targetSite);

        if (!parser || !parser.buildSearchUrl || !parser.searchNovels) {
          throw new Error(`検索機能が未実装のサイトです: ${targetSite}`);
        }

        const url = parser.buildSearchUrl(keyword, {
          order: targetOrder,
          serialStatus: targetSerial,
          genre: targetGenre,
          genres: targetGenres,
          excludeKeyword,
          page: 1,
        });

        const response = await httpClient.getHtml({ url });
        const result = parser.searchNovels(response.html, url);

        setItems(result.items);
        setCurrentPage(result.pageInfo.currentPage);
        setHasNextPage(result.pageInfo.hasNextPage);

        await refreshRegisteredIds(targetSite);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setItems([]);
        setHasNextPage(false);
      } finally {
        isSearchingRef.current = false;
        setIsLoading(false);
      }
    },
    [
      keyword,
      excludeKeyword,
      order,
      serialStatus,
      genres,
      selectedSite,
      parserRegistry,
      httpClient,
      refreshRegisteredIds,
    ],
  );

  const setSelectedSite = useCallback(
    (newSite: NovelSiteType) => {
      if (isLoadingMore || isSearchingRef.current || newSite === selectedSite) {
        return;
      }
      searchGenerationRef.current += 1;
      selectedSiteRef.current = newSite;
      setSelectedSiteState(newSite);
      setGenresState([]);
      setError(null);
      if (hasSearchedRef.current) {
        void executeSearch({ site: newSite, genres: [] });
      } else {
        void refreshRegisteredIds(newSite);
      }
    },
    [isLoadingMore, selectedSite, executeSearch, refreshRegisteredIds],
  );

  const search = useCallback(async () => {
    await executeSearch();
  }, [executeSearch]);

  const loadMore = useCallback(async () => {
    if (!hasNextPage || isLoadingMore || isLoading || isSearchingRef.current) {
      return;
    }

    const generationAtStart = searchGenerationRef.current;
    const siteAtStart = selectedSite;

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
        genre: genres[0],
        genres,
        excludeKeyword,
        page: nextPage,
      });

      const response = await httpClient.getHtml({ url });
      if (
        searchGenerationRef.current !== generationAtStart ||
        selectedSiteRef.current !== siteAtStart
      ) {
        return;
      }
      const result = parser.searchNovels(response.html, url);

      setItems((prev) => [...prev, ...result.items]);
      setCurrentPage(result.pageInfo.currentPage);
      setHasNextPage(result.pageInfo.hasNextPage);
    } catch (err) {
      if (
        searchGenerationRef.current !== generationAtStart ||
        selectedSiteRef.current !== siteAtStart
      ) {
        return;
      }
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
    excludeKeyword,
    order,
    serialStatus,
    genres,
    httpClient,
  ]);

  const retry = useCallback(async () => {
    await executeSearch();
  }, [executeSearch]);

  const setOrder = useCallback(
    (newOrder: NovelSearchOrder) => {
      if (isLoadingMore || isSearchingRef.current) return;
      searchGenerationRef.current += 1;
      setOrderState(newOrder);
      if (hasSearchedRef.current) {
        void executeSearch({ order: newOrder });
      }
    },
    [isLoadingMore, executeSearch],
  );

  const setSerialStatus = useCallback(
    (newStatus: NovelSerialStatus) => {
      if (isLoadingMore || isSearchingRef.current) return;
      searchGenerationRef.current += 1;
      setSerialStatusState(newStatus);
      if (hasSearchedRef.current) {
        void executeSearch({ serialStatus: newStatus });
      }
    },
    [isLoadingMore, executeSearch],
  );

  const setGenre = useCallback(
    (targetGenre: string | undefined) => {
      if (isLoadingMore || isSearchingRef.current) return;
      searchGenerationRef.current += 1;
      let nextGenres: string[];
      if (targetGenre === undefined) {
        nextGenres = [];
      } else {
        if (genres.includes(targetGenre)) {
          nextGenres = genres.filter((g) => g !== targetGenre);
        } else {
          nextGenres = [...genres, targetGenre];
        }
      }
      setGenresState(nextGenres);
      if (hasSearchedRef.current) {
        void executeSearch({ genres: nextGenres });
      }
    },
    [isLoadingMore, genres, executeSearch],
  );

  const addNovelToBookshelf = useCallback(
    async (item: NovelSearchResultItem): Promise<string | null> => {
      if (addingWorkId === item.remoteWorkId) return null;

      const siteAtStart = selectedSite;
      setAddingWorkId(item.remoteWorkId);
      setError(null);

      try {
        const parser = parserRegistry.requireParser(item.workUrl);

        const parsedIndex = await fetchFullNovelIndex(
          httpClient,
          parser,
          item.workUrl,
        );

        const savedNovel = await novelRepository.upsertNovelWithToc(
          parsedIndex,
          new Date().toISOString(),
        );

        if (selectedSiteRef.current === siteAtStart) {
          setRegisteredWorkIds((prev) => new Set(prev).add(item.remoteWorkId));
        }
        setAddingWorkId((prev) => (prev === item.remoteWorkId ? null : prev));
        syncEngine?.notifyChanged().catch(() => {});
        return savedNovel.id;
      } catch (err) {
        setAddingWorkId((prev) => (prev === item.remoteWorkId ? null : prev));
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return null;
      }
    },
    [
      addingWorkId,
      httpClient,
      novelRepository,
      parserRegistry,
      selectedSite,
      syncEngine,
    ],
  );

  const handleCardSelect = useCallback(
    async (item: NovelSearchResultItem): Promise<void> => {
      if (addingWorkId === item.remoteWorkId) return;

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
      addingWorkId,
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
    excludeKeyword,
    setExcludeKeyword,
    search,
    order,
    setOrder,
    serialStatus,
    setSerialStatus,
    genre,
    genres,
    setGenre,
    items,
    registeredWorkIds,
    addingWorkId,
    isLoading,
    hasSearched,
    isLoadingMore,
    hasNextPage,
    loadMore,
    error,
    retry,
    addNovelToBookshelf,
    handleCardSelect,
  };
}

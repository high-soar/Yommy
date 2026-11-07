import { useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "../../../app/ServiceProvider";
import { useRouter } from "../../../app/router";
import type {
  NovelRankingPeriod,
  NovelRankingResultItem,
  NovelRankingWorkVariation,
  NovelSiteType,
} from "../../../parsers/types";
import { fetchFullNovelIndex } from "../../../parsers/fetchFullNovelIndex";

export interface UseNovelRankingResult {
  /** 選択中小説サイト */
  selectedSite: NovelSiteType;
  /** サイト選択変更 */
  setSelectedSite: (site: NovelSiteType) => void;
  /** 集計期間 */
  period: NovelRankingPeriod;
  /** 集計期間変更 */
  setPeriod: (period: NovelRankingPeriod) => void;
  /** 作品種別（すべて / 長編・連載 / 短編、省略時は "long"、v0.8 Issue #265） */
  workVariation: NovelRankingWorkVariation;
  /** 作品種別変更コールバック（v0.8 Issue #265） */
  setWorkVariation: (workVariation: NovelRankingWorkVariation) => void;
  /** ジャンル（未指定時 undefined） */
  genre: string | undefined;
  /** ジャンル変更 */
  setGenre: (genre: string | undefined) => void;
  /** ランキング作品リスト */
  items: NovelRankingResultItem[];
  /** 登録済み作品 ID（remoteWorkId）のセット */
  registeredWorkIds: Set<string>;
  /** 現在追加処理中の remoteWorkId（未処理時は null） */
  addingWorkId: string | null;
  /** ランキング取得中ローディングフラグ */
  isLoading: boolean;
  /** エラーメッセージ（エラーなし時は null） */
  error: string | null;
  /** 現在の条件で再試行 */
  retry: () => Promise<void>;
  /** 作品カードを本棚へ登録するアクション（成功時は novelId を返却） */
  addNovelToBookshelf: (item: NovelRankingResultItem) => Promise<string | null>;
  /** カード本体タップ時のハンドラ（登録済み時は詳細へ、未登録時は本棚追加後に詳細へ） */
  handleCardSelect: (item: NovelRankingResultItem) => Promise<void>;
}

interface ExecuteFetchParams {
  site?: NovelSiteType;
  period?: NovelRankingPeriod;
  workVariation?: NovelRankingWorkVariation;
  genre?: string | undefined;
}

/**
 * ランキング画面の状態管理・HTTP取得・SQLite登録を統括するカスタムフック（SCR-07）
 *
 * 期間（4種）およびジャンル（総合＋12種）の切り替えに応じた自動再取得、
 * 登録済み作品の照合・その場本棚追加、および詳細画面への探索元付き遷移制御を提供する。
 */
export function useNovelRanking(): UseNovelRankingResult {
  const { httpClient, parserRegistry, novelRepository, syncEngine, isReady } =
    useServices();
  const router = useRouter();

  const [selectedSite, setSelectedSiteState] =
    useState<NovelSiteType>("kakuyomu");
  const [period, setPeriodState] = useState<NovelRankingPeriod>("weekly");
  const [workVariation, setWorkVariationState] =
    useState<NovelRankingWorkVariation>("long");
  const [genre, setGenreState] = useState<string | undefined>(undefined);

  const [items, setItems] = useState<NovelRankingResultItem[]>([]);
  const [registeredWorkIds, setRegisteredWorkIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [addingWorkId, setAddingWorkId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 通信中重複リクエストガードおよび非同期競合（Race Condition）防止用 ref
  const isFetchingRef = useRef<boolean>(false);
  const requestIdRef = useRef<number>(0);
  const selectedSiteRef = useRef<NovelSiteType>(selectedSite);

  useEffect(() => {
    selectedSiteRef.current = selectedSite;
  }, [selectedSite]);

  useEffect(() => {
    return () => {
      // アンマウント時に世代を進め、完了後のステート更新を防止 (R1-08)
      requestIdRef.current += 1;
    };
  }, []);

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
        setRegisteredWorkIds(new Set());
      }
    },
    [novelRepository, selectedSite],
  );

  // ランキング取得処理
  const executeFetch = useCallback(
    async (params?: ExecuteFetchParams) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      const currentRequestId = ++requestIdRef.current;

      const targetSite =
        params?.site !== undefined ? params.site : selectedSite;
      const targetPeriod =
        params?.period !== undefined ? params.period : period;
      const targetVariation =
        params?.workVariation !== undefined
          ? params.workVariation
          : workVariation;
      const targetGenre = params && "genre" in params ? params.genre : genre;

      setIsLoading(true);
      setError(null);

      try {
        const parser = parserRegistry
          .getAll()
          .find((p) => p.siteType === targetSite);

        if (!parser || !parser.buildRankingUrl || !parser.getRanking) {
          throw new Error(`ランキング機能が未実装のサイトです: ${targetSite}`);
        }

        const url = parser.buildRankingUrl({
          period: targetPeriod,
          genre: targetGenre,
          workVariation: targetVariation,
          page: 1,
        });

        const response = await httpClient.getHtml({ url });
        const result = parser.getRanking(response.html, url);

        if (currentRequestId === requestIdRef.current) {
          setItems(result.items);
          await refreshRegisteredIds(targetSite);
        }
      } catch (err) {
        if (currentRequestId === requestIdRef.current) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          setItems([]);
        }
      } finally {
        // 世代に関わらず通信完了時は isFetchingRef を確実に解除し永久ロックを防止 (R1-08)
        isFetchingRef.current = false;
        if (currentRequestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [
      selectedSite,
      period,
      workVariation,
      genre,
      parserRegistry,
      httpClient,
      refreshRegisteredIds,
    ],
  );

  // 初回マウント時またはDIサービス準備完了時に自動取得
  const initialFetchDoneRef = useRef<boolean>(false);
  useEffect(() => {
    if (isReady) {
      void refreshRegisteredIds();
      if (!initialFetchDoneRef.current) {
        initialFetchDoneRef.current = true;
        void executeFetch();
      }
    }
  }, [isReady, executeFetch, refreshRegisteredIds]);

  const setSelectedSite = useCallback(
    (newSite: NovelSiteType) => {
      if (isFetchingRef.current || newSite === selectedSite) return;
      selectedSiteRef.current = newSite;
      setSelectedSiteState(newSite);
      setGenreState(undefined);
      setError(null);
      void executeFetch({ site: newSite, genre: undefined });
    },
    [selectedSite, executeFetch],
  );

  const setPeriod = useCallback(
    (newPeriod: NovelRankingPeriod) => {
      if (isFetchingRef.current) return;
      setPeriodState(newPeriod);
      void executeFetch({ period: newPeriod });
    },
    [executeFetch],
  );

  const setWorkVariation = useCallback(
    (newVariation: NovelRankingWorkVariation) => {
      if (isFetchingRef.current) return;
      setWorkVariationState(newVariation);
      void executeFetch({ workVariation: newVariation });
    },
    [executeFetch],
  );

  const setGenre = useCallback(
    (newGenre: string | undefined) => {
      if (isFetchingRef.current) return;
      setGenreState(newGenre);
      void executeFetch({ genre: newGenre });
    },
    [executeFetch],
  );

  const retry = useCallback(async () => {
    await executeFetch();
  }, [executeFetch]);

  const addNovelToBookshelf = useCallback(
    async (item: NovelRankingResultItem): Promise<string | null> => {
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
    async (item: NovelRankingResultItem): Promise<void> => {
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
        router.navigateToNovelDetail(novelId, "/ranking");
        return;
      }

      const novelId = await addNovelToBookshelf(item);
      if (novelId) {
        router.navigateToNovelDetail(novelId, "/ranking");
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
    period,
    setPeriod,
    workVariation,
    setWorkVariation,
    genre,
    setGenre,
    items,
    registeredWorkIds,
    addingWorkId,
    isLoading,
    error,
    retry,
    addNovelToBookshelf,
    handleCardSelect,
  };
}

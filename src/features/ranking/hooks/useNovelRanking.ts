import { useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "../../../app/ServiceProvider";
import { useRouter } from "../../../app/router";
import type {
  NovelRankingPeriod,
  NovelRankingResultItem,
  NovelSiteType,
} from "../../../parsers/types";

export interface UseNovelRankingResult {
  /** 選択中小説サイト */
  selectedSite: NovelSiteType;
  /** サイト選択変更 */
  setSelectedSite: (site: NovelSiteType) => void;
  /** 集計期間 */
  period: NovelRankingPeriod;
  /** 集計期間変更 */
  setPeriod: (period: NovelRankingPeriod) => void;
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
  genre?: string | undefined;
}

/**
 * ランキング画面の状態管理・HTTP取得・SQLite登録を統括するカスタムフック（SCR-07）
 *
 * 期間（4種）およびジャンル（総合＋12種）の切り替えに応じた自動再取得、
 * 登録済み作品の照合・その場本棚追加、および詳細画面への探索元付き遷移制御を提供する。
 */
export function useNovelRanking(): UseNovelRankingResult {
  const { httpClient, parserRegistry, novelRepository, isReady } =
    useServices();
  const router = useRouter();

  const [selectedSite, setSelectedSiteState] =
    useState<NovelSiteType>("kakuyomu");
  const [period, setPeriodState] = useState<NovelRankingPeriod>("weekly");
  const [genre, setGenreState] = useState<string | undefined>(undefined);

  const [items, setItems] = useState<NovelRankingResultItem[]>([]);
  const [registeredWorkIds, setRegisteredWorkIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [addingWorkId, setAddingWorkId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
      setRegisteredWorkIds(new Set());
    }
  }, [novelRepository, selectedSite]);

  // ランキング取得処理
  const executeFetch = useCallback(
    async (params?: ExecuteFetchParams) => {
      const targetSite =
        params?.site !== undefined ? params.site : selectedSite;
      const targetPeriod =
        params?.period !== undefined ? params.period : period;
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
          page: 1,
        });

        const response = await httpClient.getHtml({ url });
        const result = parser.getRanking(response.html, url);

        setItems(result.items);
        await refreshRegisteredIds();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      selectedSite,
      period,
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
      setSelectedSiteState(newSite);
      void executeFetch({ site: newSite });
    },
    [executeFetch],
  );

  const setPeriod = useCallback(
    (newPeriod: NovelRankingPeriod) => {
      setPeriodState(newPeriod);
      void executeFetch({ period: newPeriod });
    },
    [executeFetch],
  );

  const setGenre = useCallback(
    (newGenre: string | undefined) => {
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
        setAddingWorkId((prev) => (prev === item.remoteWorkId ? null : prev));
        return savedNovel.id;
      } catch (err) {
        setAddingWorkId((prev) => (prev === item.remoteWorkId ? null : prev));
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return null;
      }
    },
    [addingWorkId, httpClient, novelRepository, parserRegistry],
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

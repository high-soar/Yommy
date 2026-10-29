import { useState } from "react";
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

/**
 * ランキング画面の状態管理・HTTP取得・SQLite登録を統括するカスタムフック（SCR-07）
 */
export function useNovelRanking(): UseNovelRankingResult {
  const [selectedSite, setSelectedSite] = useState<NovelSiteType>("kakuyomu");
  const [period, setPeriod] = useState<NovelRankingPeriod>("weekly");
  const [genre, setGenre] = useState<string | undefined>(undefined);
  const [items] = useState<NovelRankingResultItem[]>([]);
  const [registeredWorkIds] = useState<Set<string>>(() => new Set());
  const [addingWorkId] = useState<string | null>(null);
  const [isLoading] = useState<boolean>(false);
  const [error] = useState<string | null>(null);

  const retry = async () => {};
  const addNovelToBookshelf = async () => null;
  const handleCardSelect = async () => {};

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

import React from "react";
import type {
  NovelRankingPeriod,
  NovelRankingResultItem,
  NovelSiteType,
} from "../../../parsers/types";

export interface RankingPageProps {
  /** 選択中サイト識別子 */
  selectedSite: NovelSiteType;
  /** サイト変更コールバック */
  onSelectSite: (site: NovelSiteType) => void;
  /** 選択中集計期間 */
  selectedPeriod: NovelRankingPeriod;
  /** 集計期間変更コールバック */
  onSelectPeriod: (period: NovelRankingPeriod) => void;
  /** 選択中ジャンル（総合時は undefined または "all"） */
  selectedGenre?: string;
  /** ジャンル変更コールバック */
  onSelectGenre: (genre?: string) => void;
  /** ランキング作品リスト（順位昇順） */
  items: NovelRankingResultItem[];
  /** 登録済み作品 ID（remoteWorkId）のセット */
  registeredWorkIds: Set<string>;
  /** 現在追加処理中の remoteWorkId（処理中でない場合 null） */
  addingWorkId: string | null;
  /** 通信中フラグ */
  isLoading: boolean;
  /** エラーメッセージ（エラーがない場合 null） */
  error: string | null;
  /** エラー再試行コールバック */
  onRetry: () => void;
  /** カード内「＋ 本棚に追加」ボタン押下時のコールバック */
  onAddNovel: (item: NovelRankingResultItem) => void | Promise<void>;
  /** カード本体タップ時のコールバック */
  onSelectCard: (item: NovelRankingResultItem) => void;
}

/**
 * ランキング画面 Presentational レイアウト統合コンポーネント（SCR-07）
 */
export const RankingPage: React.FC<RankingPageProps> = () => {
  return <div data-testid="ranking-page-stub">RankingPage Stub</div>;
};

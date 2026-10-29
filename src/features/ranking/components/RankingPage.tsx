import React from "react";
import type {
  NovelRankingPeriod,
  NovelRankingResultItem,
  NovelSiteType,
} from "../../../parsers/types";
import { SiteSelector } from "./SiteSelector";
import { RankingFilterBar } from "./RankingFilterBar";
import { RankingNovelCard } from "./RankingNovelCard";

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
 *
 * サイト切替、期間・ジャンルフィルタバー、ランキング作品カード一覧、
 * 空状態、ローディング、およびエラー再試行UIを統括して描画する。
 */
export const RankingPage: React.FC<RankingPageProps> = ({
  selectedSite,
  onSelectSite,
  selectedPeriod,
  onSelectPeriod,
  selectedGenre,
  onSelectGenre,
  items,
  registeredWorkIds,
  addingWorkId,
  isLoading,
  error,
  onRetry,
  onAddNovel,
  onSelectCard,
}) => {
  return (
    <div
      data-testid="ranking-page"
      className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden"
    >
      {/* 固定ヘッダー領域 */}
      <header className="px-4 pt-3 pb-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-10 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <span aria-hidden="true">🏆</span>
            <span>ランキング</span>
          </h1>
          <SiteSelector
            selectedSite={selectedSite}
            onSelectSite={onSelectSite}
          />
        </div>

        <RankingFilterBar
          selectedPeriod={selectedPeriod}
          onSelectPeriod={onSelectPeriod}
          selectedGenre={selectedGenre}
          onSelectGenre={onSelectGenre}
        />
      </header>

      {/* スクロール可能なランキングコンテンツ領域 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {/* エラー表示 */}
        {error && (
          <div
            data-testid="ranking-error"
            className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex flex-col items-center text-center gap-3 my-4"
          >
            <span className="text-2xl" aria-hidden="true">
              ⚠️
            </span>
            <p className="text-sm font-medium">{error}</p>
            <button
              type="button"
              data-testid="ranking-error-retry-button"
              onClick={onRetry}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              再試行する
            </button>
          </div>
        )}

        {/* 初回ローディング（結果がまだない場合） */}
        {isLoading && items.length === 0 && (
          <div
            data-testid="ranking-loading"
            className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400 gap-3"
          >
            <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">ランキングを取得中...</p>
          </div>
        )}

        {/* ランキング結果 0 件空状態 */}
        {!isLoading && !error && items.length === 0 && (
          <div
            data-testid="ranking-empty-state"
            className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400 gap-3 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl">
              📭
            </div>
            <div className="max-w-xs">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
                ランキング作品が見つかりませんでした
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                指定された期間・ジャンルに一致するランキング作品はありませんでした。別の集計期間やジャンルをお試しください。
              </p>
            </div>
          </div>
        )}

        {/* ランキング作品カード一覧 */}
        {items.length > 0 && (
          <div
            data-testid="ranking-results-list"
            className="flex flex-col gap-3 max-w-3xl mx-auto pb-6"
          >
            {items.map((item) => (
              <RankingNovelCard
                key={item.remoteWorkId}
                item={item}
                isRegistered={registeredWorkIds.has(item.remoteWorkId)}
                isAdding={addingWorkId === item.remoteWorkId}
                onAdd={() => onAddNovel(item)}
                onSelect={() => onSelectCard(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

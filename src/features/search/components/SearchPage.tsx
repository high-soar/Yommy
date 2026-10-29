import React from "react";
import type {
  NovelSearchOrder,
  NovelSearchResultItem,
  NovelSerialStatus,
  NovelSiteType,
} from "../../../parsers/types";
import { SiteSelector } from "./SiteSelector";
import { SearchInputBar } from "./SearchInputBar";
import { SearchFilterBar } from "./SearchFilterBar";
import { SearchNovelCard } from "./SearchNovelCard";

export interface SearchPageProps {
  /** 選択中サイト識別子 */
  selectedSite: NovelSiteType;
  /** サイト変更コールバック */
  onSelectSite: (site: NovelSiteType) => void;
  /** 入力中のキーワード文字列 */
  keyword: string;
  /** キーワード変更コールバック */
  onChangeKeyword: (keyword: string) => void;
  /** 検索実行コールバック */
  onSubmitSearch: () => void;
  /** 選択中並び順 */
  selectedOrder: NovelSearchOrder;
  /** 並び順変更コールバック */
  onSelectOrder: (order: NovelSearchOrder) => void;
  /** 選択中連載状況 */
  selectedSerialStatus: NovelSerialStatus;
  /** 連載状況変更コールバック */
  onSelectSerialStatus: (status: NovelSerialStatus) => void;
  /** 選択中ジャンル（未指定時 undefined） */
  selectedGenre?: string;
  /** ジャンル変更コールバック */
  onSelectGenre: (genre?: string) => void;
  /** 検索結果作品リスト */
  items: NovelSearchResultItem[];
  /** 登録済み作品 ID（remoteWorkId）のセット */
  registeredWorkIds: Set<string>;
  /** 現在追加処理中の remoteWorkId（処理中でない場合 null） */
  addingWorkId: string | null;
  /** 通信中フラグ */
  isLoading: boolean;
  /** 次ページ通信中フラグ */
  isLoadingMore: boolean;
  /** 次ページが存在するかどうか */
  hasNextPage: boolean;
  /** 次ページ取得コールバック */
  onLoadMore: () => void;
  /** エラーメッセージ（エラーがない場合 null） */
  error: string | null;
  /** エラー再試行コールバック */
  onRetry: () => void;
  /** カード内「＋ 本棚に追加」ボタン押下時のコールバック */
  onAddNovel: (item: NovelSearchResultItem) => void | Promise<void>;
  /** カード本体タップ時のコールバック */
  onSelectCard: (item: NovelSearchResultItem) => void;
}

/**
 * 検索画面 Presentational レイアウト統合コンポーネント（SCR-06）
 */
export const SearchPage: React.FC<SearchPageProps> = ({
  selectedSite,
  onSelectSite,
  keyword,
  onChangeKeyword,
  onSubmitSearch,
  selectedOrder,
  onSelectOrder,
  selectedSerialStatus,
  onSelectSerialStatus,
  selectedGenre,
  onSelectGenre,
  items,
  registeredWorkIds,
  addingWorkId,
  isLoading,
  isLoadingMore,
  hasNextPage,
  onLoadMore,
  error,
  onRetry,
  onAddNovel,
  onSelectCard,
}) => {
  return (
    <div
      data-testid="search-page"
      className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden"
    >
      {/* 固定ヘッダー領域 */}
      <header className="px-4 pt-3 pb-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-10 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <span aria-hidden="true">🔍</span>
            <span>検索</span>
          </h1>
          <SiteSelector
            selectedSite={selectedSite}
            onSelectSite={onSelectSite}
          />
        </div>

        <SearchInputBar
          keyword={keyword}
          onChangeKeyword={onChangeKeyword}
          onSubmitSearch={onSubmitSearch}
        />

        <SearchFilterBar
          selectedOrder={selectedOrder}
          onSelectOrder={onSelectOrder}
          selectedSerialStatus={selectedSerialStatus}
          onSelectSerialStatus={onSelectSerialStatus}
          selectedGenre={selectedGenre}
          onSelectGenre={onSelectGenre}
        />
      </header>

      {/* スクロール可能な検索コンテンツ領域 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {/* エラー表示 */}
        {error && (
          <div
            data-testid="search-error"
            className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex flex-col items-center text-center gap-3 my-4"
          >
            <span className="text-2xl" aria-hidden="true">
              ⚠️
            </span>
            <p className="text-sm font-medium">{error}</p>
            <button
              type="button"
              data-testid="search-error-retry-button"
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
            data-testid="search-loading"
            className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400 gap-3"
          >
            <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">作品を検索中...</p>
          </div>
        )}

        {/* 初期未検索状態 */}
        {!isLoading && !error && items.length === 0 && keyword === "" && (
          <div
            data-testid="search-initial-state"
            className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400 gap-3 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl">
              🔍
            </div>
            <div className="max-w-xs">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
                キーワードを入力して小説を検索
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                カクヨムに投稿された作品名・著者名・キーワードやジャンルからお好みの小説を見つけることができます。
              </p>
            </div>
          </div>
        )}

        {/* 検索結果 0 件空状態 */}
        {!isLoading && !error && items.length === 0 && keyword !== "" && (
          <div
            data-testid="search-empty-state"
            className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400 gap-3 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl">
              📭
            </div>
            <div className="max-w-xs">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
                作品が見つかりませんでした
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                指定された条件に一致する作品はありませんでした。別のキーワードやジャンルをお試しください。
              </p>
            </div>
          </div>
        )}

        {/* 検索結果カード一覧 */}
        {items.length > 0 && (
          <div
            data-testid="search-results-list"
            className="flex flex-col gap-3 max-w-3xl mx-auto pb-6"
          >
            {items.map((item) => (
              <SearchNovelCard
                key={item.remoteWorkId}
                item={item}
                isRegistered={registeredWorkIds.has(item.remoteWorkId)}
                isAdding={addingWorkId === item.remoteWorkId}
                onAdd={() => onAddNovel(item)}
                onSelect={() => onSelectCard(item)}
              />
            ))}

            {/* 次ページ読み込みボタン */}
            {hasNextPage && (
              <div className="flex justify-center pt-2 pb-4">
                <button
                  type="button"
                  disabled={isLoadingMore}
                  data-testid="search-load-more-button"
                  onClick={onLoadMore}
                  className={`w-full max-w-sm py-2.5 px-4 rounded-xl text-sm font-medium transition-colors border shadow-xs flex items-center justify-center gap-2 ${
                    isLoadingMore
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                      : "bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800 hover:bg-sky-50 dark:hover:bg-slate-700"
                  }`}
                >
                  {isLoadingMore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                      <span>読み込み中...</span>
                    </>
                  ) : (
                    <span>さらに読み込む</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

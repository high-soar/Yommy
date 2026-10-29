import React from "react";
import type { NovelSearchResultItem } from "../../../parsers/types";

export interface SearchNovelCardProps {
  item: NovelSearchResultItem;
  /** すでに SQLite DB に登録済みかどうか */
  isRegistered: boolean;
  /** 現在本棚追加の通信中かどうか */
  isAdding: boolean;
  /** 「＋ 本棚に追加」ボタン押下ハンドラ */
  onAdd: () => void;
  /** カード本体タップハンドラ */
  onSelect: () => void;
}

/**
 * 検索結果作品カードコンポーネント（SCR-06）
 */
export const SearchNovelCard: React.FC<SearchNovelCardProps> = ({
  item,
  isRegistered,
  isAdding,
  onAdd,
  onSelect,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isRegistered && !isAdding) {
      onAdd();
    }
  };

  return (
    <article
      tabIndex={0}
      role="button"
      data-testid={`search-novel-card-${item.remoteWorkId}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs hover:border-sky-300 dark:hover:border-sky-600 transition-all duration-150 cursor-pointer flex flex-col gap-2.5 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
    >
      {/* 上部: ジャンル・連載状態・最新更新・本棚追加ボタン */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            data-testid="search-card-genre"
            className="px-2 py-0.5 rounded-md text-xs font-semibold bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900"
          >
            {item.genreLabel || item.genre}
          </span>
          <span
            data-testid="search-card-serial-status"
            className={`px-2 py-0.5 rounded-md text-xs font-medium border ${
              item.serialStatus === "completed"
                ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900"
                : "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900"
            }`}
          >
            {item.serialStatusLabel}
          </span>
        </div>

        {/* アクションボタン */}
        <div
          data-testid="search-card-action-wrapper"
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {isRegistered ? (
            <button
              type="button"
              disabled
              data-testid="search-card-registered-button"
              className="px-3 py-1 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 cursor-default"
            >
              ✓ 登録済み
            </button>
          ) : (
            <button
              type="button"
              disabled={isAdding}
              data-testid="search-card-add-button"
              onClick={handleAddClick}
              onKeyDown={(e) => e.stopPropagation()}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors shadow-xs ${
                isAdding
                  ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                  : "bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white"
              }`}
            >
              {isAdding ? "追加中..." : "＋ 本棚に追加"}
            </button>
          )}
        </div>
      </div>

      {/* タイトル & 著者 */}
      <div>
        <h3
          data-testid="search-card-title"
          className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug"
        >
          {item.title}
        </h3>
        <p
          data-testid="search-card-author"
          className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5"
        >
          {item.author}
        </p>
      </div>

      {/* あらすじ */}
      {item.synopsis && (
        <p
          data-testid="search-card-synopsis"
          className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed"
        >
          {item.synopsis}
        </p>
      )}

      {/* タグ一覧 */}
      {item.tags && item.tags.length > 0 && (
        <div
          data-testid="search-card-tags"
          className="flex flex-wrap gap-1 items-center"
        >
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* 下部メタデータ: 話数・文字数・★ポイント・最終更新 */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/60 mt-1 flex-wrap gap-y-1">
        <div className="flex items-center gap-3">
          <span data-testid="search-card-episodes">{item.episodeCount}話</span>
          <span data-testid="search-card-characters">
            {item.characterCount.toLocaleString()}文字
          </span>
          <span
            data-testid="search-card-review-points"
            className="text-amber-600 dark:text-amber-400 font-semibold"
          >
            ★ {item.reviewPoints.toLocaleString()}
          </span>
        </div>

        {item.lastEpisodePublishedAt && (
          <span
            data-testid="search-card-last-published"
            className="text-[11px] text-slate-400 dark:text-slate-500"
          >
            更新:{" "}
            {new Date(item.lastEpisodePublishedAt).toLocaleDateString("ja-JP")}
          </span>
        )}
      </div>
    </article>
  );
};

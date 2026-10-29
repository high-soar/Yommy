import React from "react";
import type {
  NovelSearchOrder,
  NovelSerialStatus,
} from "../../../parsers/types";
import { SEARCH_GENRES, SEARCH_ORDERS, SEARCH_SERIAL_STATUSES } from "../types";

export interface SearchFilterBarProps {
  selectedOrder: NovelSearchOrder;
  onSelectOrder: (order: NovelSearchOrder) => void;
  selectedSerialStatus: NovelSerialStatus;
  onSelectSerialStatus: (status: NovelSerialStatus) => void;
  selectedGenre?: string;
  onSelectGenre: (genre?: string) => void;
}

/**
 * 検索フィルタ・並び順バー（並び順セレクタ、連載状況ピル、ジャンル横スクロールピル）
 */
export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  selectedOrder,
  onSelectOrder,
  selectedSerialStatus,
  onSelectSerialStatus,
  selectedGenre,
  onSelectGenre,
}) => {
  return (
    <div
      data-testid="search-filter-bar"
      className="flex flex-col gap-2 w-full py-1 text-xs sm:text-sm"
    >
      {/* 上段: 並び順セレクタ & 連載状況ピル */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        {/* 並び順ドロップダウン */}
        <div className="flex items-center gap-1.5 shrink-0">
          <label
            htmlFor="search-order-select"
            className="text-slate-500 dark:text-slate-400 text-xs font-medium shrink-0"
          >
            並び順:
          </label>
          <select
            id="search-order-select"
            data-testid="search-order-select"
            aria-label="並び順"
            value={selectedOrder}
            onChange={(e) => onSelectOrder(e.target.value as NovelSearchOrder)}
            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-sky-500 cursor-pointer"
          >
            {SEARCH_ORDERS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 連載状況ピル */}
        <div
          role="group"
          aria-label="連載状況"
          className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 shrink-0"
        >
          {SEARCH_SERIAL_STATUSES.map((opt) => {
            const isSelected = selectedSerialStatus === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                data-testid={`search-serial-${opt.value}`}
                aria-pressed={isSelected}
                onClick={() => onSelectSerialStatus(opt.value)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  isSelected
                    ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 下段: ジャンル横スクロールピル */}
      <div
        role="group"
        aria-label="ジャンル"
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1"
      >
        {SEARCH_GENRES.map((opt) => {
          const isSelected = selectedGenre === opt.id;
          return (
            <button
              key={opt.id ?? "all"}
              type="button"
              data-testid={`search-genre-${opt.id ?? "all"}`}
              aria-pressed={isSelected}
              onClick={() => onSelectGenre(opt.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors border ${
                isSelected
                  ? "bg-sky-600 border-sky-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

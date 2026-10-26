import React from "react";
import type { WritingMode, ReaderTheme } from "./ReaderView";

export interface ReaderToolbarProps {
  writingMode: WritingMode;
  theme: ReaderTheme;
  fontSizePx?: number;
  lineHeight?: number;
  onToggleWritingMode: () => void;
  onChangeTheme: (theme: ReaderTheme) => void;
  onChangeFontSize?: (nextSizePx: number) => void;
  onChangeLineHeight?: (nextHeight: number) => void;
  onBackToDetail?: () => void;
  onBackToBookshelf?: () => void;
  onFetchNovel?: () => void;
  isLoading?: boolean;
}

const themeOptions: { value: ReaderTheme; label: string; testId: string }[] = [
  { value: "light", label: "白", testId: "theme-light" },
  { value: "sepia", label: "セピア", testId: "theme-sepia" },
  { value: "dark", label: "ダーク", testId: "theme-dark" },
  { value: "black", label: "黒", testId: "theme-black" },
];

/**
 * リーダー画面の上部で操作可能なツールバーコンポーネント
 * 戻る導線、縦横切替、4カラーテーマ選択、文字サイズ・行間ステッパー、および作品取得トリガーを提供
 */
export const ReaderToolbar: React.FC<ReaderToolbarProps> = ({
  writingMode,
  theme,
  fontSizePx = 18,
  lineHeight = 1.8,
  onToggleWritingMode,
  onChangeTheme,
  onChangeFontSize,
  onChangeLineHeight,
  onBackToDetail,
  onBackToBookshelf,
  onFetchNovel,
  isLoading = false,
}) => {
  return (
    <div
      data-testid="reader-toolbar"
      className="bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-sm flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        {onBackToBookshelf && (
          <button
            type="button"
            data-testid="reader-back-to-bookshelf"
            onClick={onBackToBookshelf}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <span aria-hidden="true">←</span>
            <span>本棚へ戻る</span>
          </button>
        )}

        {onBackToDetail && (
          <button
            type="button"
            data-testid="reader-back-to-detail"
            onClick={onBackToDetail}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <span aria-hidden="true">←</span>
            <span>作品詳細へ</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleWritingMode}
          className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors cursor-pointer"
          data-testid="toggle-orientation"
        >
          {writingMode === "vertical-rl"
            ? "横書き表示に切替"
            : "縦書き表示に切替"}
        </button>

        <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 rounded p-0.5 text-xs">
          {themeOptions.map((opt) => {
            const isSelected = theme === opt.value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => onChangeTheme(opt.value)}
                data-testid={opt.testId}
                aria-pressed={isSelected}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* 文字サイズステッパー */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 rounded px-1.5 py-0.5 text-xs gap-1">
          <span className="text-slate-500 dark:text-slate-400 select-none mr-0.5">
            字
          </span>
          <button
            type="button"
            data-testid="font-size-decrease"
            disabled={fontSizePx <= 12}
            onClick={() => onChangeFontSize?.(Math.max(12, fontSizePx - 2))}
            aria-label="文字サイズ縮小"
            className="w-5 h-5 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 rounded disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            −
          </button>
          <span
            data-testid="font-size-value"
            className="w-8 text-center font-mono font-medium text-slate-800 dark:text-slate-200"
          >
            {fontSizePx}px
          </span>
          <button
            type="button"
            data-testid="font-size-increase"
            disabled={fontSizePx >= 32}
            onClick={() => onChangeFontSize?.(Math.min(32, fontSizePx + 2))}
            aria-label="文字サイズ拡大"
            className="w-5 h-5 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 rounded disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            ＋
          </button>
        </div>

        {/* 行間ステッパー */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 rounded px-1.5 py-0.5 text-xs gap-1">
          <span className="text-slate-500 dark:text-slate-400 select-none mr-0.5">
            行
          </span>
          <button
            type="button"
            data-testid="line-height-decrease"
            disabled={lineHeight <= 1.4}
            onClick={() =>
              onChangeLineHeight?.(
                Math.max(1.4, Math.round((lineHeight - 0.2) * 10) / 10),
              )
            }
            aria-label="行間縮小"
            className="w-5 h-5 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 rounded disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            −
          </button>
          <span
            data-testid="line-height-value"
            className="w-7 text-center font-mono font-medium text-slate-800 dark:text-slate-200"
          >
            {lineHeight.toFixed(1)}
          </span>
          <button
            type="button"
            data-testid="line-height-increase"
            disabled={lineHeight >= 2.4}
            onClick={() =>
              onChangeLineHeight?.(
                Math.min(2.4, Math.round((lineHeight + 0.2) * 10) / 10),
              )
            }
            aria-label="行間拡大"
            className="w-5 h-5 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 rounded disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            ＋
          </button>
        </div>

        {onFetchNovel && (
          <button
            type="button"
            onClick={onFetchNovel}
            disabled={isLoading}
            data-testid="fetch-novel-button"
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {isLoading ? "取得中..." : "作品を取得/更新"}
          </button>
        )}
      </div>
    </div>
  );
};

import React from "react";
import type { WritingMode, ReaderTheme } from "./ReaderView";

export interface ReaderToolbarProps {
  writingMode: WritingMode;
  theme: ReaderTheme;
  onToggleWritingMode: () => void;
  onChangeTheme: (theme: ReaderTheme) => void;
  onFetchNovel?: () => void;
  isLoading?: boolean;
}

const themeOptions: { value: ReaderTheme; label: string; testId: string }[] = [
  { value: "light", label: "白", testId: "theme-light" },
  { value: "sepia", label: "セピア", testId: "theme-sepia" },
  { value: "dark", label: "ダーク", testId: "theme-dark" },
  { value: "black", label: "黒", testId: "theme-black" },
];

export const ReaderToolbar: React.FC<ReaderToolbarProps> = ({
  writingMode,
  theme,
  onToggleWritingMode,
  onChangeTheme,
  onFetchNovel,
  isLoading = false,
}) => {
  return (
    <div
      data-testid="reader-toolbar"
      className="bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-sm flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleWritingMode}
          className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors"
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
                key={opt.value}
                onClick={() => onChangeTheme(opt.value)}
                data-testid={opt.testId}
                aria-pressed={isSelected}
                className={`px-2.5 py-1 rounded transition-colors ${
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

      {onFetchNovel && (
        <button
          onClick={onFetchNovel}
          disabled={isLoading}
          data-testid="fetch-novel-button"
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors"
        >
          {isLoading ? "取得中..." : "作品を取得/更新"}
        </button>
      )}
    </div>
  );
};

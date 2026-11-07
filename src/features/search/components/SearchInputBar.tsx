import React, { useState } from "react";

export interface SearchInputBarProps {
  keyword: string;
  onChangeKeyword: (keyword: string) => void;
  /** 除外キーワード文字列（省略時は ""、v0.8 Issue #264） */
  excludeKeyword?: string;
  /** 除外キーワード変更コールバック（v0.8 Issue #264） */
  onChangeExcludeKeyword?: (excludeKeyword: string) => void;
  onSubmitSearch: () => void;
  /** 検索通信中フラグ（true時は検索ボタン無効化、テキスト入力はフォーカス・入力可能維持 / v0.7 Issue #238） */
  isLoading?: boolean;
  /** 除外キーワード入力欄の初期展開状態（省略時は excludeKeyword が非空の場合に展開） */
  defaultOpenExclude?: boolean;
}

/**
 * 検索キーワード入力・クリア・実行バー（除外キーワードインライン開閉対応）
 */
export const SearchInputBar: React.FC<SearchInputBarProps> = ({
  keyword,
  onChangeKeyword,
  excludeKeyword = "",
  onChangeExcludeKeyword,
  onSubmitSearch,
  isLoading = false,
  defaultOpenExclude,
}) => {
  const [isExcludeOpen, setIsExcludeOpen] = useState<boolean>(() =>
    defaultOpenExclude !== undefined
      ? defaultOpenExclude
      : Boolean(excludeKeyword && excludeKeyword.trim().length > 0),
  );

  const hasActiveExclude = Boolean(
    excludeKeyword && excludeKeyword.trim().length > 0,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    onSubmitSearch();
  };

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 w-full"
    >
      {/* 1段目: メインキーワード・除外語トグル・検索ボタン */}
      <div className="flex items-center gap-2 w-full">
        <div className="relative flex-1 flex items-center">
          <span
            className="absolute left-3 text-slate-400 dark:text-slate-500 pointer-events-none text-base"
            aria-hidden="true"
          >
            🔍
          </span>
          <input
            type="search"
            data-testid="search-input"
            value={keyword}
            onChange={(e) => onChangeKeyword(e.target.value)}
            placeholder="作品名・著者名・キーワードを入力"
            className="w-full pl-9 pr-9 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-200 dark:border-slate-700 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-colors"
          />
          {keyword.length > 0 && (
            <button
              type="button"
              data-testid="search-clear-button"
              aria-label="キーワードをクリア"
              onClick={() => onChangeKeyword("")}
              className="absolute right-2.5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs flex items-center justify-center w-5 h-5"
            >
              ✕
            </button>
          )}
        </div>

        <button
          type="button"
          data-testid="search-exclude-toggle-button"
          aria-expanded={isExcludeOpen}
          aria-label={
            isExcludeOpen
              ? "除外キーワード入力を閉じる"
              : "除外キーワード入力を開く"
          }
          data-active={hasActiveExclude ? "true" : undefined}
          onClick={() => setIsExcludeOpen((prev) => !prev)}
          className={`px-2.5 py-2 rounded-xl text-xs font-medium border transition-colors shrink-0 flex items-center gap-1 min-h-[38px] ${
            hasActiveExclude
              ? "bg-sky-50 dark:bg-sky-950/80 border-sky-400 dark:border-sky-600 text-sky-700 dark:text-sky-300 font-semibold shadow-xs"
              : isExcludeOpen
                ? "bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200"
                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <span>除外語</span>
          {hasActiveExclude && (
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          )}
        </button>

        <button
          type="submit"
          data-testid="search-submit-button"
          aria-label="検索"
          disabled={isLoading}
          className={`px-4 py-2 rounded-xl text-white text-sm font-medium shadow-xs transition-colors shrink-0 flex items-center justify-center min-h-[38px] ${
            isLoading
              ? "bg-slate-400 dark:bg-slate-600 cursor-not-allowed opacity-60"
              : "bg-sky-600 hover:bg-sky-500 active:bg-sky-700"
          }`}
        >
          検索
        </button>
      </div>

      {/* 2段目: 除外キーワードインライン展開入力欄 */}
      {isExcludeOpen && (
        <div className="relative flex items-center w-full">
          <span
            className="absolute left-3 text-slate-400 dark:text-slate-500 pointer-events-none text-xs font-semibold"
            aria-hidden="true"
          >
            除外:
          </span>
          <input
            type="search"
            data-testid="search-exclude-input"
            value={excludeKeyword}
            onChange={(e) => onChangeExcludeKeyword?.(e.target.value)}
            placeholder="除外ワード（スペース区切り）"
            className="w-full pl-12 pr-9 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-200 dark:border-slate-700 text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-colors"
          />
          {excludeKeyword.length > 0 && (
            <button
              type="button"
              data-testid="search-exclude-clear-button"
              aria-label="除外キーワードをクリア"
              onClick={() => onChangeExcludeKeyword?.("")}
              className="absolute right-2.5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs flex items-center justify-center w-5 h-5"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </form>
  );
};

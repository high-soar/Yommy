import React from "react";

export interface SearchInputBarProps {
  keyword: string;
  onChangeKeyword: (keyword: string) => void;
  onSubmitSearch: () => void;
}

/**
 * 検索キーワード入力・クリア・実行バー
 */
export const SearchInputBar: React.FC<SearchInputBarProps> = ({
  keyword,
  onChangeKeyword,
  onSubmitSearch,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitSearch();
  };

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex items-center gap-2 w-full"
    >
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
        type="submit"
        data-testid="search-submit-button"
        aria-label="検索"
        className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-sm font-medium shadow-xs transition-colors shrink-0 flex items-center justify-center min-h-[38px]"
      >
        検索
      </button>
    </form>
  );
};

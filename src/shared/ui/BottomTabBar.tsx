import React from "react";

export type BottomTab = "bookshelf" | "search" | "ranking" | "settings";

export interface BottomTabBarProps {
  /** 現在アクティブなタブ */
  activeTab: BottomTab;
  /** 「本棚」タブ選択時のコールバック */
  onSelectBookshelf: () => void;
  /** 「検索」タブ選択時のコールバック */
  onSelectSearch?: () => void;
  /** 「ランキング」タブ選択時のコールバック */
  onSelectRanking?: () => void;
  /** 「設定」タブ選択時のコールバック */
  onSelectSettings: () => void;
  /** 追加の CSS クラス（任意） */
  className?: string;
}

interface TabItem {
  id: BottomTab;
  label: string;
  icon: string;
  testId: string;
  onSelect?: () => void;
}

/**
 * 画面最下部に固定表示される下部タブバー（Presentational）
 *
 * 「本棚」「検索」「ランキング」「設定」の4タブナビゲーションを提供する。
 */
export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onSelectBookshelf,
  onSelectSearch,
  onSelectRanking,
  onSelectSettings,
  className,
}) => {
  const tabs: TabItem[] = [
    {
      id: "bookshelf",
      label: "本棚",
      icon: "📚",
      testId: "tab-bookshelf",
      onSelect: onSelectBookshelf,
    },
    {
      id: "search",
      label: "検索",
      icon: "🔍",
      testId: "tab-search",
      onSelect: onSelectSearch,
    },
    {
      id: "ranking",
      label: "ランキング",
      icon: "🏆",
      testId: "tab-ranking",
      onSelect: onSelectRanking,
    },
    {
      id: "settings",
      label: "設定",
      icon: "⚙️",
      testId: "tab-settings",
      onSelect: onSelectSettings,
    },
  ];

  return (
    <nav
      data-testid="bottom-tab-bar"
      role="tablist"
      aria-label="メインナビゲーション"
      className={`h-14 border-t bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 grid grid-cols-4 max-w-4xl mx-auto w-full ${className ?? ""}`.trim()}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-testid={tab.testId}
            aria-selected={isActive}
            onClick={tab.onSelect}
            className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 py-1.5 sm:py-3 px-1 sm:px-4 text-xs sm:text-sm font-medium transition-colors cursor-pointer select-none whitespace-nowrap focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              isActive
                ? "text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50/50 dark:bg-emerald-950/20"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <span aria-hidden="true">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

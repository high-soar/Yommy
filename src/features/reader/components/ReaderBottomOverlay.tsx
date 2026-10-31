import React from "react";
import type { BottomTab } from "../../../shared/ui/BottomTabBar";
import { ReaderChapterNav } from "./ReaderChapterNav";

export interface ReaderBottomOverlayProps {
  /** オーバーレイの開閉表示状態（true: スライドイン表示、false: 画面外へ退避） */
  isOpen: boolean;
  /** 現在表示中のエピソード連番（1始まり） */
  chapterIndex: number;
  /** 作品の全エピソード数 */
  totalChapters: number;
  /** エピソード通信中フラグ（省略時: false） */
  isLoading?: boolean;
  /** リーダー画面のアクティブタブ（省略時: "bookshelf"） */
  activeTab?: BottomTab;
  /** 「前の話へ」ボタン押下時のコールバック */
  onPrevChapter: () => void;
  /** 「次の話へ」ボタン押下時のコールバック */
  onNextChapter: () => void;
  /** 下部タブ選択時のコールバック */
  onSelectTab?: (tab: BottomTab) => void;
}

interface ReaderTabItem {
  id: BottomTab;
  label: string;
  icon: string;
  testId: string;
}

const READER_TABS: ReaderTabItem[] = [
  {
    id: "bookshelf",
    label: "本棚",
    icon: "📚",
    testId: "reader-bottom-tab-bookshelf",
  },
  {
    id: "search",
    label: "検索",
    icon: "🔍",
    testId: "reader-bottom-tab-search",
  },
  {
    id: "ranking",
    label: "ランキング",
    icon: "🏆",
    testId: "reader-bottom-tab-ranking",
  },
  {
    id: "settings",
    label: "設定",
    icon: "⚙️",
    testId: "reader-bottom-tab-settings",
  },
];

/**
 * 前後話ナビゲーションと4タブバー（本棚/検索/ランキング/設定）を統合したスライドインオーバーレイ（Presentational）
 *
 * 画面最下部タッチでスライドイン表示され、読書没入感を保ちつつ素早いナビゲーションを提供する。
 */
export const ReaderBottomOverlay: React.FC<ReaderBottomOverlayProps> = ({
  isOpen,
  chapterIndex,
  totalChapters,
  isLoading = false,
  activeTab = "bookshelf",
  onPrevChapter,
  onNextChapter,
  onSelectTab,
}) => {
  return (
    <div
      data-testid="reader-bottom-overlay"
      aria-hidden={!isOpen}
      className={`fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 shadow-lg border-t border-zinc-200 dark:border-zinc-800 transition-transform duration-200 ease-in-out ${
        isOpen ? "translate-y-0" : "translate-y-full pointer-events-none"
      }`}
    >
      {/* 上段: 前後話ナビゲーション */}
      <div className="p-3 pb-2 max-w-4xl mx-auto w-full">
        <ReaderChapterNav
          chapterIndex={chapterIndex}
          totalChapters={totalChapters}
          isLoading={isLoading}
          onPrevChapter={onPrevChapter}
          onNextChapter={onNextChapter}
        />
      </div>

      {/* 下段: 下部タブバー */}
      <div
        data-testid="reader-bottom-tabs"
        role="tablist"
        aria-label="リーダーナビゲーションタブ"
        className="grid grid-cols-4 border-t border-zinc-200 dark:border-zinc-800 max-w-4xl mx-auto w-full"
      >
        {READER_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              data-testid={tab.testId}
              aria-selected={isActive}
              onClick={() => onSelectTab?.(tab.id)}
              className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 py-1.5 sm:py-3 px-1 sm:px-4 text-xs sm:text-sm font-medium transition-colors cursor-pointer select-none whitespace-nowrap ${
                isActive
                  ? "text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50/50 dark:bg-emerald-950/20"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <span aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

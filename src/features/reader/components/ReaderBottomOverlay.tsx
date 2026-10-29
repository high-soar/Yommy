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
  /** オーバーレイを閉じる要求コールバック */
  onClose?: () => void;
}

/**
 * 前後話ナビゲーションと下部タブバー（本棚/設定）を統合したスライドインオーバーレイ（Presentational）
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
  onClose,
}) => {
  return (
    <div
      data-testid="reader-bottom-overlay"
      aria-hidden={!isOpen}
      className={`fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 shadow-lg border-t border-zinc-200 dark:border-zinc-800 transition-transform duration-200 ease-in-out ${
        isOpen ? "translate-y-0" : "translate-y-full pointer-events-none"
      }`}
    >
      {onClose && (
        <button
          type="button"
          data-testid="reader-bottom-overlay-close"
          aria-label="オーバーレイを閉じる"
          onClick={onClose}
          className="absolute top-2 right-2 p-1.5 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-full transition-colors cursor-pointer text-xs leading-none z-10"
        >
          ✕
        </button>
      )}

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
        className="grid grid-cols-2 border-t border-zinc-200 dark:border-zinc-800 max-w-4xl mx-auto w-full"
      >
        <button
          type="button"
          role="tab"
          data-testid="reader-bottom-tab-bookshelf"
          aria-selected={activeTab === "bookshelf"}
          onClick={() => onSelectTab?.("bookshelf")}
          className={`flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "bookshelf"
              ? "text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50/50 dark:bg-emerald-950/20"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          <span aria-hidden="true">📚</span>
          <span>本棚</span>
        </button>

        <button
          type="button"
          role="tab"
          data-testid="reader-bottom-tab-settings"
          aria-selected={activeTab === "settings"}
          onClick={() => onSelectTab?.("settings")}
          className={`flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "settings"
              ? "text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50/50 dark:bg-emerald-950/20"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          <span aria-hidden="true">⚙️</span>
          <span>設定</span>
        </button>
      </div>
    </div>
  );
};

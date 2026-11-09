import React from "react";

export interface ReaderTopOverlayProps {
  /** オーバーレイの開閉表示状態（true: スライドイン表示、false: 画面外へ退避） */
  isOpen: boolean;
  /** 作品タイトル */
  novelTitle: string;
  /** エピソードサブタイトル */
  chapterTitle: string;
  /** 「← 目次」ボタン押下時のコールバック */
  onBackToToc: () => void;
}

/**
 * 作品名・サブタイトル1行固定省略表示と「← 目次」導線を提供する上部スライドインオーバーレイ（Presentational）
 *
 * 下部オーバーレイ（ReaderBottomOverlay）の開閉と完全同期して画面上端からスライドイン表示され、
 * 100文字超の長文タイトルであっても1行省略（truncate）によりレイアウト崩れを防ぎつつ、
 * 作品詳細・目次画面（SCR-02）への復帰導線を提供する。
 */
export const ReaderTopOverlay: React.FC<ReaderTopOverlayProps> = ({
  isOpen,
  novelTitle,
  chapterTitle,
  onBackToToc,
}) => {
  return (
    <header
      data-testid="reader-top-overlay"
      aria-hidden={!isOpen}
      inert={!isOpen ? true : undefined}
      className={`fixed top-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 shadow-md border-b border-zinc-200 dark:border-zinc-800 transition-transform duration-200 ease-in-out ${
        isOpen ? "translate-y-0" : "-translate-y-full pointer-events-none"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-2.5 max-w-4xl mx-auto w-full">
        {/* 左端: 目次復帰ボタン */}
        <button
          type="button"
          data-testid="reader-top-back-to-toc"
          onClick={onBackToToc}
          className="shrink-0 inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        >
          ← 目次
        </button>

        {/* 右側: タイトル情報（長文保護） */}
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <span
            data-testid="reader-top-novel-title"
            className="text-xs text-zinc-500 dark:text-zinc-400 truncate"
          >
            {novelTitle}
          </span>
          <span
            data-testid="reader-top-chapter-title"
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate"
          >
            {chapterTitle}
          </span>
        </div>
      </div>
    </header>
  );
};

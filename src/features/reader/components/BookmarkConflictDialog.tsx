import React, { useEffect } from "react";

export interface BookmarkConflictDialogProps {
  /** ダイアログの表示状態 */
  isOpen: boolean;
  /** 現在この端末で表示しているエピソード連番 */
  currentChapterIndex: number;
  /** 他端末で更新されたクラウド同期しおりのエピソード連番 */
  remoteChapterIndex: number;
  /** 解決アクション（移動／維持）の実行中フラグ */
  isResolving?: boolean;
  /** 「第{remoteChapterIndex}話へ移動する」押下時のコールバック */
  onMoveToRemote?: () => void;
  /** 「第{currentChapterIndex}話のまま読む」押下時のコールバック */
  onKeepCurrent?: () => void;
}

/**
 * クラウド同期によるしおり競合確認モーダルダイアログ
 *
 * 他端末でより進んだ／異なるエピソードへしおりが更新されたことを復帰時 Pull で検知した際、
 * ユーザーの明示的な2択選択まで背景操作・Escape・OS 戻る操作による誤離脱を抑止する。
 */
export const BookmarkConflictDialog: React.FC<BookmarkConflictDialogProps> = ({
  isOpen,
  currentChapterIndex,
  remoteChapterIndex,
  isResolving = false,
  onMoveToRemote,
  onKeepCurrent,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      data-testid="bookmark-conflict-backdrop"
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bookmark-conflict-title"
        aria-describedby="bookmark-conflict-message"
        data-testid="bookmark-conflict-dialog"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-xl w-full max-w-md mx-auto"
      >
        <h2
          id="bookmark-conflict-title"
          className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2"
        >
          他の端末で読書位置が更新されました
        </h2>
        <p
          id="bookmark-conflict-message"
          data-testid="bookmark-conflict-message"
          className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed"
        >
          別の端末で第{remoteChapterIndex}話まで読み進められています（現在は第
          {currentChapterIndex}話を表示中）。どちらの話から読みますか？
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
          <button
            type="button"
            data-testid="bookmark-conflict-keep-button"
            onClick={onKeepCurrent}
            disabled={isResolving}
            className="px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            第{currentChapterIndex}話のまま読む
          </button>
          <button
            type="button"
            data-testid="bookmark-conflict-move-button"
            onClick={onMoveToRemote}
            disabled={isResolving}
            className="px-4 py-2.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:bg-emerald-400 cursor-pointer disabled:cursor-not-allowed"
          >
            第{remoteChapterIndex}話へ移動する
          </button>
        </div>
      </div>
    </div>
  );
};

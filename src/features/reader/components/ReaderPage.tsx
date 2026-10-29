import React, { useState, useEffect, useRef, useCallback } from "react";
import type {
  NovelRecord,
  ChapterRecord,
  WritingMode,
  ReaderTheme,
} from "../../../storage/types";
import type { BottomTab } from "../../../shared/ui/BottomTabBar";
import { ReaderView } from "./ReaderView";
import { ReaderBottomOverlay } from "./ReaderBottomOverlay";

export interface ReaderPageProps {
  novel: NovelRecord | null;
  chapter: ChapterRecord | null;
  chapterIndex: number;
  totalChapters: number;
  writingMode: WritingMode;
  theme: ReaderTheme;
  fontSizePx: number;
  lineHeight: number;
  initialScrollProgress: number;
  isLoading: boolean;
  error?: string | null;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  onScrollProgressChange: (progress: number) => void;
  onSelectTab?: (tab: BottomTab) => void;
  initialOverlayOpen?: boolean;
}

const pageBgStyles: Record<ReaderTheme, string> = {
  light: "bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100",
  sepia: "bg-[#f4ebd0] text-[#433523]",
  dark: "bg-slate-950 text-slate-100",
  black: "bg-black text-slate-200",
};

/**
 * 小説リーダー画面全体のレイアウト統合コンポーネント（Presentational）
 *
 * 全画面本文（ReaderView）と最下部タッチ連動の下部オーバーレイ（ReaderBottomOverlay）、
 * および状態別表示（ローディング・エラー・空状態）を統合する。
 */
export const ReaderPage: React.FC<ReaderPageProps> = ({
  novel,
  chapter,
  chapterIndex,
  totalChapters,
  writingMode,
  theme,
  fontSizePx,
  lineHeight,
  initialScrollProgress,
  isLoading,
  error,
  onPrevChapter,
  onNextChapter,
  onScrollProgressChange,
  onSelectTab,
  initialOverlayOpen,
}) => {
  const hasNovel = novel !== null;
  const hasBodyHtml = Boolean(chapter && chapter.bodyHtml !== null);
  const isInitialOpen =
    initialOverlayOpen ??
    Boolean(error || (!isLoading && (!hasNovel || !hasBodyHtml)));

  const [isOpen, setIsOpen] = useState(isInitialOpen);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );

  useEffect(() => {
    if (initialOverlayOpen !== undefined) {
      setIsOpen(initialOverlayOpen);
    }
  }, [initialOverlayOpen]);

  useEffect(() => {
    if (
      initialOverlayOpen === undefined &&
      !isLoading &&
      (error || !hasNovel || !hasBodyHtml)
    ) {
      setIsOpen(true);
    }
  }, [error, isLoading, hasNovel, hasBodyHtml, initialOverlayOpen]);

  // 最下部タッチゾーン: ポインター押下
  const handleTouchZonePointerDown = useCallback((e: React.PointerEvent) => {
    const x = e.clientX ?? 0;
    const y = e.clientY ?? 0;
    touchStartRef.current = {
      x,
      y,
      time: Date.now(),
    };
  }, []);

  // 最下部タッチゾーン: ポインター離上（スワイプ誤検知防止: 移動10px未満かつ500ms未満）
  const handleTouchZonePointerUp = useCallback((e: React.PointerEvent) => {
    if (!touchStartRef.current) return;
    const currentX = e.clientX ?? 0;
    const currentY = e.clientY ?? 0;
    const dx = currentX - touchStartRef.current.x;
    const dy = currentY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    const distance = Math.hypot(dx, dy);
    if (distance < 10 && dt < 500) {
      setIsOpen((prev) => !prev);
    }
  }, []);

  // 最下部タッチゾーン: ポインターキャンセル
  const handleTouchZonePointerCancel = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  // 最下部タッチゾーン: キーボード操作
  const handleTouchZoneKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
  }, []);

  // 自動非表示: 本文スクロール
  const handleScrollProgressChange = useCallback(
    (progress: number) => {
      setIsOpen(false);
      onScrollProgressChange(progress);
    },
    [onScrollProgressChange],
  );

  // 自動非表示: 本文エリアクリック
  const handleMainClick = useCallback(() => {
    if (hasBodyHtml) {
      setIsOpen(false);
    }
  }, [hasBodyHtml]);

  // 前話遷移（遷移と同時にオーバーレイ自動非表示）
  const handlePrevChapter = useCallback(() => {
    setIsOpen(false);
    onPrevChapter();
  }, [onPrevChapter]);

  // 次話遷移（遷移と同時にオーバーレイ自動非表示）
  const handleNextChapter = useCallback(() => {
    setIsOpen(false);
    onNextChapter();
  }, [onNextChapter]);

  // 閉じる要求
  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <div
      data-testid="reader-page"
      className={`h-dvh w-full overflow-hidden relative select-none transition-colors duration-200 ${pageBgStyles[theme]}`}
    >
      {/* メイン本文領域（排他描画） */}
      <main className="w-full h-full min-w-0" onClick={handleMainClick}>
        {error ? (
          <div className="flex items-center justify-center h-full p-6">
            <div
              role="alert"
              data-testid="reader-error"
              className="max-w-md w-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-lg text-sm shadow-xs"
            >
              <div className="font-semibold mb-1">エラー</div>
              <div>{error}</div>
            </div>
          </div>
        ) : isLoading && !hasBodyHtml ? (
          <div
            role="status"
            data-testid="reader-loading"
            className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400"
          >
            <div
              aria-hidden="true"
              className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"
            ></div>
            <p className="text-sm font-medium">エピソードを読み込み中...</p>
          </div>
        ) : !hasNovel || !chapter || chapter.bodyHtml === null ? (
          <div className="flex items-center justify-center h-full p-6">
            <div
              data-testid="reader-empty"
              className="max-w-md w-full border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-12 text-center text-slate-500 dark:text-slate-400"
            >
              <p className="text-base font-medium mb-1">
                作品またはエピソードが見つかりません。
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                作品が登録されていないか、エピソード本文がまだ取得されていません。
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full w-full">
            <ReaderView
              title={novel.title}
              chapterTitle={chapter.title}
              bodyHtml={chapter.bodyHtml}
              writingMode={writingMode}
              theme={theme}
              fontSizePx={fontSizePx}
              lineHeight={lineHeight}
              initialScrollProgress={initialScrollProgress}
              onScrollProgressChange={handleScrollProgressChange}
            />
          </div>
        )}
      </main>

      {/* 最下部タッチゾーン（下端約 72px） */}
      <div
        data-testid="reader-bottom-touch-zone"
        className="absolute bottom-0 left-0 right-0 h-[72px] z-30 pointer-events-auto cursor-pointer"
        onPointerDown={handleTouchZonePointerDown}
        onPointerUp={handleTouchZonePointerUp}
        onPointerCancel={handleTouchZonePointerCancel}
        onKeyDown={handleTouchZoneKeyDown}
        aria-label="下部ナビゲーション表示"
        role="button"
        tabIndex={0}
      />

      {/* 下部オーバーレイ（前後話ナビ＋下部タブ） */}
      <ReaderBottomOverlay
        isOpen={isOpen}
        chapterIndex={chapterIndex}
        totalChapters={totalChapters}
        isLoading={isLoading}
        activeTab="bookshelf"
        onPrevChapter={handlePrevChapter}
        onNextChapter={handleNextChapter}
        onSelectTab={onSelectTab}
        onClose={handleClose}
      />
    </div>
  );
};

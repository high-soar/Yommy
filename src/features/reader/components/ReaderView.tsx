import React, { useEffect, useCallback, useState } from "react";
import type {
  WritingMode,
  ReaderTheme,
  ReaderPagingMode,
  ReaderFontFamily,
} from "../../../storage/types";
import { resolveEffectivePagingMode } from "../hooks/useReader";
import {
  FONT_FAMILY_STACKS,
  DEFAULT_FONT_FAMILY,
  DEFAULT_PAGE_MARGIN_PX,
} from "../../../shared/constants/typography";

export type { WritingMode, ReaderTheme, ReaderPagingMode, ReaderFontFamily };

export interface ReaderViewProps {
  title?: string;
  chapterTitle?: string;
  bodyHtml: string;
  writingMode?: WritingMode;
  theme?: ReaderTheme;
  fontSizePx?: number;
  lineHeight?: number;
  fontFamily?: ReaderFontFamily;
  pageMarginPx?: number;
  initialScrollProgress?: number;
  onScrollProgressChange?: (progress: number) => void;
  pagingMode?: ReaderPagingMode;
  currentPage?: number;
  totalPages?: number;
  slideOffsetPx?: number;
  isAnimating?: boolean;
  onTotalPagesChange?: (totalPages: number) => void;
  chapterIndex?: number;
  totalChapters?: number;
  onPrevChapter?: () => void;
  onNextChapter?: () => void;
}

const themeStyles: Record<ReaderTheme, string> = {
  light: "bg-[#fcfcfc] text-slate-900 border-slate-200",
  sepia: "bg-[#fbf0d9] text-[#5f4b32] border-[#ebd9b9]",
  dark: "bg-slate-900 text-slate-200 border-slate-800",
  black: "bg-black text-slate-300 border-neutral-900",
};

function clampProgress(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * 水平スワイプラックのインラインスタイルを生成する純粋関数
 * （右綴じ書籍に即した水平配置: [次ページ(左), 現在ページ(中央), 前ページ(右)]）
 *
 * @param pageWidth 1ページあたりの表示幅 (px)
 * @param slideOffsetPx スワイプドラッグ中またはアニメーション中の水平変位量 (px)
 * @param isAnimating ページ遷移スライドアニメーション中フラグ（true: "left 200ms ease-out", false: "none"）
 */
export function calculateSwipeTrackStyle(
  pageWidth: number,
  slideOffsetPx: number,
  isAnimating: boolean = false,
): React.CSSProperties {
  const left = -pageWidth + slideOffsetPx;
  const transition = isAnimating ? "left 200ms ease-out" : "none";

  return {
    position: "absolute",
    top: 0,
    left: `${left}px`,
    width: `${pageWidth * 3}px`,
    height: "100%",
    display: "flex",
    flexDirection: "row",
    writingMode: "horizontal-tb",
    transition,
  };
}

/**
 * 縦書き 1ページ CSS マルチカラム組版およびページスロットのインラインスタイルを生成する純粋関数
 * （※ページめくりは縦書き専用、各ページは CSS マルチカラムで文字切れを防止しつつ内部 translateY で静的表示: AC-RD-16）
 */
function getPagedSlotContentStyle(
  slotPage: number,
  pageHeight: number,
  containerWidth?: number,
  containerHeight?: number,
  pageMarginPx: number = DEFAULT_PAGE_MARGIN_PX,
): React.CSSProperties {
  const width =
    containerWidth !== undefined && containerWidth > 0
      ? `${Math.max(1, containerWidth - pageMarginPx * 2)}px`
      : undefined;
  const height =
    containerHeight !== undefined && containerHeight > 0
      ? `${Math.max(1, containerHeight - pageMarginPx * 2)}px`
      : undefined;
  const translateY = pageHeight > 0 ? -(slotPage - 1) * pageHeight : 0;

  return {
    columns: 1,
    columnGap: `${pageMarginPx * 2}px`,
    columnFill: "auto",
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    transform: `translateY(${translateY}px)`,
    transition: "none",
  };
}

/**
 * マルチカラム要素の scrollHeight とコンテナ高さから総ページ数を算出する純粋関数 (AC-RD-16)
 * （gap = pageMarginPx * 2, pageStride = pageHeight）
 */
function calculateMeasuredTotalPages(
  scrollHeight: number,
  pageHeight: number,
  pageMarginPx: number = DEFAULT_PAGE_MARGIN_PX,
): number {
  if (pageHeight <= 0) return 1;
  return Math.max(
    1,
    Math.round((scrollHeight + pageMarginPx * 2) / pageHeight),
  );
}

/**
 * スクロールコンテナの進捗率（0.0 〜 1.0）を算出する純粋関数
 */
function calculateScrollProgress(
  el: HTMLElement,
  writingMode: WritingMode,
): number {
  if (writingMode === "horizontal-tb") {
    const maxScroll = el.scrollHeight - el.clientHeight;
    return maxScroll > 0 ? clampProgress(el.scrollTop / maxScroll) : 0;
  }
  const maxScroll = el.scrollWidth - el.clientWidth;
  return maxScroll > 0 ? clampProgress(Math.abs(el.scrollLeft) / maxScroll) : 0;
}

/**
 * スクロールコンテナの表示位置を進捗率に基づいて復元する純粋関数
 */
function restoreScrollPosition(
  el: HTMLElement,
  writingMode: WritingMode,
  initialScrollProgress: number,
): void {
  const clampedProgress = clampProgress(initialScrollProgress);
  if (writingMode === "horizontal-tb") {
    const maxScroll = el.scrollHeight - el.clientHeight;
    el.scrollTop = maxScroll > 0 ? clampedProgress * maxScroll : 0;
  } else {
    const maxScroll = el.scrollWidth - el.clientWidth;
    el.scrollLeft = maxScroll > 0 ? -clampedProgress * maxScroll : 0;
  }
}

/**
 * 小説本文の全画面（h-full w-full）縦書き/横書き組版表示、ルビ・傍点、カラーテーマ描画、
 * 1ページ組版・横スライドアニメーション・ページインジケーター表示、
 * および縦横双方のスクロール進捗率算出・初期位置復元を担う Presentational コンポーネント
 */
export const ReaderView: React.FC<ReaderViewProps> = ({
  title,
  chapterTitle,
  bodyHtml,
  writingMode = "vertical-rl",
  theme = "light",
  fontSizePx = 18,
  lineHeight = 1.8,
  fontFamily = DEFAULT_FONT_FAMILY,
  pageMarginPx = DEFAULT_PAGE_MARGIN_PX,
  initialScrollProgress = 0,
  onScrollProgressChange,
  pagingMode = "auto",
  currentPage = 1,
  totalPages = 1,
  slideOffsetPx = 0,
  isAnimating = false,
  onTotalPagesChange,
  chapterIndex = 1,
  totalChapters,
  onPrevChapter,
  onNextChapter,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const isVertical = writingMode === "vertical-rl";
  const effectivePagingMode = resolveEffectivePagingMode(
    pagingMode,
    writingMode,
  );
  const isPaged = effectivePagingMode === "paged";

  // コンテナ寸法の動的追従（リサイズおよび初期計測）
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [containerHeight, setContainerHeight] = useState<number>(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    setContainerHeight(el.clientHeight);

    const handleResize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        setContainerWidth(w);
        setContainerHeight(h);
        if (isPaged && contentRef.current) {
          const measuredPages = calculateMeasuredTotalPages(
            contentRef.current.scrollHeight,
            h,
            pageMarginPx,
          );
          onTotalPagesChange?.(measuredPages);
        }
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isPaged, onTotalPagesChange, pageMarginPx]);

  // DOM 寸法計測（総ページ数算出）: マウント時および chapterTitle, bodyHtml, initialScrollProgress, writingMode, fontSizePx, lineHeight, fontFamily, pageMarginPx, pagingMode, containerWidth, containerHeight 変更時
  useEffect(() => {
    if (!isPaged) return;
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    let isDisposed = false;

    const measure = () => {
      if (isDisposed) return;
      const currentWidth = container.clientWidth || containerWidth;
      const currentHeight = container.clientHeight || containerHeight;
      if (currentWidth > 0 && currentHeight > 0) {
        content.style.width = `${Math.max(1, currentWidth - pageMarginPx * 2)}px`;
        content.style.height = `${Math.max(1, currentHeight - pageMarginPx * 2)}px`;
      }
      const measuredPages = calculateMeasuredTotalPages(
        content.scrollHeight,
        currentHeight,
        pageMarginPx,
      );
      onTotalPagesChange?.(measuredPages);
    };

    // 即時計測
    measure();

    // 次フレームでの再計測（フォントロード・CSSマルチカラムレイアウト完了追従）
    const rafId = requestAnimationFrame(() => {
      measure();
    });

    // タイマー（非同期フォントロード完了待機）
    const timerId = setTimeout(() => {
      measure();
    }, 100);

    if (typeof document !== "undefined" && document.fonts) {
      void document.fonts.ready.then(() => {
        measure();
      });
    }

    return () => {
      isDisposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [
    isPaged,
    chapterTitle,
    bodyHtml,
    initialScrollProgress,
    writingMode,
    fontSizePx,
    lineHeight,
    fontFamily,
    pageMarginPx,
    pagingMode,
    containerWidth,
    containerHeight,
    onTotalPagesChange,
  ]);

  // スクロール操作時の進捗率（0.0 〜 1.0）算出（実効 paged 時はスクロール進捗を通知せず先頭巻き戻しを防止: R1-22）
  const handleScroll = useCallback(() => {
    if (isPaged) return;
    const el = containerRef.current;
    if (!el) return;
    if (!onScrollProgressChange) return;

    const progress = calculateScrollProgress(el, writingMode);
    onScrollProgressChange(progress);
  }, [isPaged, writingMode, onScrollProgressChange]);

  // マウント時および bodyHtml / writingMode / initialScrollProgress / pagingMode 変化時のスクロール位置復元
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (isPaged) {
      // 実効 paged モード時は translateY/translateX で位置管理するためスクロールオフセットを 0 にリセット（二重変位防止: R1-27）
      el.scrollLeft = 0;
      el.scrollTop = 0;
    } else {
      restoreScrollPosition(el, writingMode, initialScrollProgress);
    }
  }, [initialScrollProgress, bodyHtml, writingMode, pagingMode, isPaged]);

  // pageWidth, pageHeight の解決
  const pageWidth = containerRef.current?.clientWidth ?? containerWidth;
  const pageHeight = containerRef.current?.clientHeight ?? containerHeight;

  // 小説本文・ヘッダー描画用ヘルパー
  const renderNovelContent = (active: boolean = true) => (
    <>
      {(title || chapterTitle) && (
        <header
          className={`mb-6 pb-4 border-b ${
            isVertical ? "border-l border-b-0 pl-4 mr-6" : "border-b pb-4 mb-6"
          } opacity-80`}
        >
          {title && (
            <h2
              {...(active ? { "data-testid": "reader-title" } : {})}
              className="text-xs font-semibold tracking-wider uppercase mb-1"
            >
              {title}
            </h2>
          )}
          {chapterTitle && (
            <h1
              {...(active ? { "data-testid": "reader-chapter-title" } : {})}
              className="text-lg md:text-xl font-bold tracking-tight"
            >
              {chapterTitle}
            </h1>
          )}
        </header>
      )}

      <div
        {...(active ? { "data-testid": "reader-body" } : {})}
        className="novel-content"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    </>
  );

  return (
    <div
      ref={containerRef}
      data-testid="reader-view"
      data-writing-mode={writingMode}
      data-theme={theme}
      data-font-size={String(fontSizePx)}
      data-line-height={String(lineHeight)}
      data-font-family={fontFamily}
      data-page-margin={String(pageMarginPx)}
      data-paging-mode={pagingMode}
      data-effective-paging-mode={effectivePagingMode}
      data-current-page={isPaged ? String(currentPage) : undefined}
      data-total-pages={isPaged ? String(totalPages) : undefined}
      onScroll={handleScroll}
      className={`h-full w-full max-w-full transition-colors duration-200 relative ${
        themeStyles[theme]
      } ${isVertical ? "writing-vertical-rl" : "writing-horizontal-tb"} ${
        isPaged
          ? "overflow-hidden touch-none"
          : isVertical
            ? "overflow-x-auto overflow-y-hidden leading-loose"
            : "overflow-y-auto overflow-x-hidden leading-relaxed"
      }`}
      style={{
        fontSize: `${fontSizePx}px`,
        lineHeight,
        fontFamily: FONT_FAMILY_STACKS[fontFamily],
        ...(!isPaged ? { padding: `${pageMarginPx}px` } : {}),
      }}
    >
      {isPaged ? (
        <div
          data-testid="reader-swipe-track"
          style={calculateSwipeTrackStyle(
            pageWidth,
            slideOffsetPx,
            isAnimating,
          )}
        >
          {/* 左スロット: 次ページ (currentPage + 1) */}
          <div
            aria-hidden="true"
            className="h-full overflow-hidden relative flex-shrink-0"
            style={{
              width: `${pageWidth}px`,
              padding: `${pageMarginPx}px`,
              boxSizing: "border-box",
            }}
          >
            {currentPage < totalPages && (
              <div
                className="h-full w-full writing-vertical-rl"
                style={getPagedSlotContentStyle(
                  currentPage + 1,
                  pageHeight,
                  pageWidth,
                  pageHeight,
                  pageMarginPx,
                )}
              >
                {renderNovelContent(false)}
              </div>
            )}
          </div>

          {/* 中央スロット: 現在ページ (currentPage) */}
          <div
            className="h-full overflow-hidden relative flex-shrink-0"
            style={{
              width: `${pageWidth}px`,
              padding: `${pageMarginPx}px`,
              boxSizing: "border-box",
            }}
          >
            <div
              ref={contentRef}
              data-testid="reader-content"
              className="h-full w-full writing-vertical-rl"
              style={getPagedSlotContentStyle(
                currentPage,
                pageHeight,
                pageWidth,
                pageHeight,
                pageMarginPx,
              )}
            >
              {renderNovelContent(true)}
            </div>
          </div>

          {/* 右スロット: 前ページ (currentPage - 1) */}
          <div
            aria-hidden="true"
            className="h-full overflow-hidden relative flex-shrink-0"
            style={{
              width: `${pageWidth}px`,
              padding: `${pageMarginPx}px`,
              boxSizing: "border-box",
            }}
          >
            {currentPage > 1 && (
              <div
                className="h-full w-full writing-vertical-rl"
                style={getPagedSlotContentStyle(
                  currentPage - 1,
                  pageHeight,
                  pageWidth,
                  pageHeight,
                  pageMarginPx,
                )}
              >
                {renderNovelContent(false)}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          ref={contentRef}
          data-testid="reader-content"
          className="h-full w-full"
        >
          <div
            className={`flex ${
              isVertical
                ? "flex-col items-center justify-center my-6"
                : "justify-center my-6"
            }`}
          >
            <button
              type="button"
              data-testid="reader-scroll-prev-chapter"
              disabled={chapterIndex <= 1}
              onClick={onPrevChapter}
              className={`px-5 py-2 text-sm font-medium rounded-lg border transition-opacity cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed [writing-mode:horizontal-tb] ${
                theme === "dark" || theme === "black"
                  ? "border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700"
                  : theme === "sepia"
                    ? "border-[#e0d0b0] bg-[#f0e4c8] text-[#5f4b32] hover:bg-[#e8dbbf]"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              前の話へ
            </button>
          </div>

          {renderNovelContent()}

          <div
            className={`flex ${
              isVertical
                ? "flex-col items-center justify-center my-6"
                : "justify-center my-6"
            }`}
          >
            <button
              type="button"
              data-testid="reader-scroll-next-chapter"
              disabled={
                totalChapters !== undefined
                  ? chapterIndex >= totalChapters
                  : false
              }
              onClick={onNextChapter}
              className={`px-5 py-2 text-sm font-medium rounded-lg border transition-opacity cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed [writing-mode:horizontal-tb] ${
                theme === "dark" || theme === "black"
                  ? "border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700"
                  : theme === "sepia"
                    ? "border-[#e0d0b0] bg-[#f0e4c8] text-[#5f4b32] hover:bg-[#e8dbbf]"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              次の話へ
            </button>
          </div>
        </div>
      )}

      {isPaged && (
        <div
          data-testid="reader-page-indicator"
          className="absolute bottom-3 right-4 pointer-events-none select-none text-xs opacity-60 tabular-nums font-sans [writing-mode:horizontal-tb]"
        >
          {currentPage} / {totalPages}
        </div>
      )}
    </div>
  );
};

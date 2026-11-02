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
 * ページ確定変位（translateX）およびスワイプ追従変位（translateX）を算出する純粋関数
 * （右綴じ書籍に即した左側次ページへの水平スライド変位: AC-RD-16）
 */
function calculatePageTransforms(
  currentPage: number,
  pageWidth: number,
  slideOffsetPx: number,
): { transform: string; transition: string } {
  const baseTranslateX = pageWidth > 0 ? (currentPage - 1) * pageWidth : 0;
  const translateX = baseTranslateX - slideOffsetPx;
  const transform = `translateX(${translateX}px)`;
  const transition = slideOffsetPx !== 0 ? "none" : "transform 200ms ease-out";
  return { transform, transition };
}

/**
 * 本文要素の scrollWidth とコンテナ幅から総ページ数を算出する純粋関数 (AC-RD-16)
 */
function calculateMeasuredTotalPages(
  scrollWidth: number,
  pageWidth: number,
): number {
  if (pageWidth <= 0) return 1;
  return Math.max(1, Math.ceil(scrollWidth / pageWidth));
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
 * 縦書き 1ページ組版および水平スライドアニメーションのインラインスタイルを生成する純粋関数
 * （※ページめくりは縦書き専用、右綴じ書籍に即した左側次ページへの水平変位: AC-RD-16）
 */
function getPagedContentStyle(
  isPaged: boolean,
  currentPage: number = 1,
  pageWidth: number = 0,
  slideOffsetPx: number = 0,
  pageMarginPx: number = DEFAULT_PAGE_MARGIN_PX,
): React.CSSProperties | undefined {
  if (!isPaged) return undefined;

  const { transform, transition } = calculatePageTransforms(
    currentPage,
    pageWidth,
    slideOffsetPx,
  );

  return {
    height: "100%",
    padding: `${pageMarginPx}px`,
    boxSizing: "border-box",
    transform,
    transition,
  };
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);

    const handleResize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        setContainerWidth(w);
        if (isPaged && contentRef.current) {
          const measuredPages = calculateMeasuredTotalPages(
            contentRef.current.scrollWidth,
            w,
          );
          onTotalPagesChange?.(measuredPages);
        }
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isPaged, onTotalPagesChange]);

  // DOM 寸法計測（総ページ数算出）: マウント時および chapterTitle, bodyHtml, initialScrollProgress, writingMode, fontSizePx, lineHeight, fontFamily, pageMarginPx, pagingMode, containerWidth 変更時
  useEffect(() => {
    if (!isPaged) return;
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const currentWidth = container.clientWidth || containerWidth;
    const measuredPages = calculateMeasuredTotalPages(
      content.scrollWidth,
      currentWidth,
    );
    onTotalPagesChange?.(measuredPages);
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

  // pageWidth の解決
  const pageWidth = containerRef.current?.clientWidth ?? containerWidth;

  // 将来のジェスチャー遷移連携・アニメーション中制御のために参照
  void isAnimating;

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
      <div
        ref={contentRef}
        data-testid="reader-content"
        className={`h-full w-full ${isPaged ? "m-auto" : ""}`}
        style={getPagedContentStyle(
          isPaged,
          currentPage,
          pageWidth,
          slideOffsetPx,
          pageMarginPx,
        )}
      >
        {!isPaged && (
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
        )}

        {(title || chapterTitle) && (
          <header
            className={`mb-6 pb-4 border-b ${
              isVertical
                ? "border-l border-b-0 pl-4 mr-6"
                : "border-b pb-4 mb-6"
            } opacity-80`}
          >
            {title && (
              <h2
                data-testid="reader-title"
                className="text-xs font-semibold tracking-wider uppercase mb-1"
              >
                {title}
              </h2>
            )}
            {chapterTitle && (
              <h1
                data-testid="reader-chapter-title"
                className="text-lg md:text-xl font-bold tracking-tight"
              >
                {chapterTitle}
              </h1>
            )}
          </header>
        )}

        <div
          data-testid="reader-body"
          className="novel-content"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />

        {!isPaged && (
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
        )}
      </div>

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

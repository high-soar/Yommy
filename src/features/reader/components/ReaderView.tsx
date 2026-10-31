import React, { useEffect, useCallback, useState } from "react";
import type {
  WritingMode,
  ReaderTheme,
  ReaderPagingMode,
} from "../../../storage/types";
import { resolveEffectivePagingMode } from "../hooks/useReader";

export type { WritingMode, ReaderTheme, ReaderPagingMode };

export interface ReaderViewProps {
  title?: string;
  chapterTitle?: string;
  bodyHtml: string;
  writingMode?: WritingMode;
  theme?: ReaderTheme;
  fontSizePx?: number;
  lineHeight?: number;
  initialScrollProgress?: number;
  onScrollProgressChange?: (progress: number) => void;
  pagingMode?: ReaderPagingMode;
  currentPage?: number;
  totalPages?: number;
  slideOffsetPx?: number;
  isAnimating?: boolean;
  onTotalPagesChange?: (totalPages: number) => void;
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
 * ページめくり表示における横スライド変位量（translateX）を算出する純粋関数
 */
function calculateSlideTranslateX(
  isVertical: boolean,
  currentPage: number,
  pageWidth: number,
  slideOffsetPx: number,
): number {
  if (pageWidth <= 0) return 0;
  return isVertical
    ? (currentPage - 1) * pageWidth + slideOffsetPx
    : -(currentPage - 1) * pageWidth + slideOffsetPx;
}

/**
 * コンテナ寸法から総ページ数を算出する純粋関数
 */
function calculateMeasuredTotalPages(
  scrollWidth: number,
  clientWidth: number,
): number {
  return clientWidth > 0
    ? Math.max(1, Math.ceil(scrollWidth / clientWidth))
    : 1;
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
 * 1ページ組版およびスライドアニメーションのインラインスタイルを生成する純粋関数
 */
function getPagedContentStyle(
  isPaged: boolean,
  isVertical: boolean,
  slideTranslateX: number,
  slideOffsetPx: number,
): React.CSSProperties | undefined {
  if (!isPaged) return undefined;
  return {
    transform: `translateX(${slideTranslateX}px)`,
    transition: slideOffsetPx !== 0 ? "none" : "transform 200ms ease-out",
    ...(isVertical
      ? {}
      : {
          columns: "1",
          columnWidth: "100%",
          columnGap: "0px",
          columnFill: "auto",
        }),
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
  initialScrollProgress = 0,
  onScrollProgressChange,
  pagingMode = "auto",
  currentPage = 1,
  totalPages = 1,
  slideOffsetPx = 0,
  isAnimating = false,
  onTotalPagesChange,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isVertical = writingMode === "vertical-rl";
  const effectivePagingMode = resolveEffectivePagingMode(
    pagingMode,
    writingMode,
  );
  const isPaged = effectivePagingMode === "paged";

  // コンテナ幅の動的追従（リサイズおよび初期計測）
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);

    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // DOM 寸法計測（総ページ数算出）: マウント時および bodyHtml, writingMode, fontSizePx, lineHeight, pagingMode 変更時
  useEffect(() => {
    if (!isPaged) return;
    const el = containerRef.current;
    if (!el) return;

    const measuredPages = calculateMeasuredTotalPages(
      el.scrollWidth,
      el.clientWidth,
    );
    onTotalPagesChange?.(measuredPages);
  }, [
    isPaged,
    bodyHtml,
    writingMode,
    fontSizePx,
    lineHeight,
    pagingMode,
    onTotalPagesChange,
  ]);

  // スクロール操作時の進捗率（0.0 〜 1.0）算出（実効 scroll 時）
  const handleScroll = useCallback(() => {
    if (isPaged) return;
    const el = containerRef.current;
    if (!el) return;
    if (!onScrollProgressChange) return;

    const progress = calculateScrollProgress(el, writingMode);
    onScrollProgressChange(progress);
  }, [isPaged, writingMode, onScrollProgressChange]);

  // マウント時および bodyHtml / writingMode / initialScrollProgress / pagingMode 変化時のスクロール位置復元（実効 scroll 時）
  useEffect(() => {
    if (isPaged) return;
    const el = containerRef.current;
    if (!el) return;

    restoreScrollPosition(el, writingMode, initialScrollProgress);
  }, [isPaged, initialScrollProgress, bodyHtml, writingMode, pagingMode]);

  // pageWidth はコンテナの clientWidth（取得できない場合は 0）
  const pageWidth = containerRef.current?.clientWidth ?? containerWidth;
  const slideTranslateX = calculateSlideTranslateX(
    isVertical,
    currentPage,
    pageWidth,
    slideOffsetPx,
  );

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
      data-paging-mode={pagingMode}
      data-effective-paging-mode={effectivePagingMode}
      data-current-page={isPaged ? String(currentPage) : undefined}
      data-total-pages={isPaged ? String(totalPages) : undefined}
      onScroll={handleScroll}
      className={`h-full w-full max-w-full font-serif transition-colors duration-200 relative ${
        themeStyles[theme]
      } ${isVertical ? "writing-vertical-rl" : "writing-horizontal-tb"} ${
        isPaged
          ? "overflow-hidden"
          : isVertical
            ? "overflow-x-auto overflow-y-hidden leading-loose p-6"
            : "overflow-y-auto overflow-x-hidden leading-relaxed p-6"
      }`}
      style={{
        fontSize: `${fontSizePx}px`,
        lineHeight,
      }}
    >
      <div
        data-testid="reader-content"
        className={`h-full w-full ${isPaged ? "p-6" : ""}`}
        style={getPagedContentStyle(
          isPaged,
          isVertical,
          slideTranslateX,
          slideOffsetPx,
        )}
      >
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
      </div>

      {isPaged && (
        <div
          data-testid="reader-page-indicator"
          className="absolute bottom-3 right-4 pointer-events-none select-none text-xs opacity-60 tabular-nums font-sans"
        >
          {currentPage} / {totalPages}
        </div>
      )}
    </div>
  );
};

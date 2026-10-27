import React, { useEffect, useCallback } from "react";

/**
 * 小説リーダーの組版方向（縦書き/横書き）
 */
export type WritingMode = "vertical-rl" | "horizontal-tb";

/**
 * リーダーの背景・文字色テーマ
 */
export type ReaderTheme = "light" | "sepia" | "dark" | "black";

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
 * 小説本文の全画面（h-full w-full）縦書き/横書き組版表示、ルビ・傍点、カラーテーマ描画、
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
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isVertical = writingMode === "vertical-rl";

  // スクロール操作時の進捗率（0.0 〜 1.0）算出
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || !onScrollProgressChange) return;

    let progress = 0;
    if (writingMode === "horizontal-tb") {
      const maxScroll = el.scrollHeight - el.clientHeight;
      progress = maxScroll > 0 ? clampProgress(el.scrollTop / maxScroll) : 0;
    } else {
      const maxScroll = el.scrollWidth - el.clientWidth;
      progress =
        maxScroll > 0 ? clampProgress(Math.abs(el.scrollLeft) / maxScroll) : 0;
    }
    onScrollProgressChange(progress);
  }, [writingMode, onScrollProgressChange]);

  // マウント時および bodyHtml / writingMode / initialScrollProgress 変化時の位置復元
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const clampedProgress = clampProgress(initialScrollProgress);
    if (writingMode === "horizontal-tb") {
      const maxScroll = el.scrollHeight - el.clientHeight;
      el.scrollTop = maxScroll > 0 ? clampedProgress * maxScroll : 0;
    } else {
      const maxScroll = el.scrollWidth - el.clientWidth;
      el.scrollLeft = maxScroll > 0 ? -clampedProgress * maxScroll : 0;
    }
  }, [initialScrollProgress, bodyHtml, writingMode]);

  return (
    <div
      ref={containerRef}
      data-testid="reader-view"
      data-writing-mode={writingMode}
      data-theme={theme}
      data-font-size={String(fontSizePx)}
      data-line-height={String(lineHeight)}
      onScroll={handleScroll}
      className={`h-full w-full max-w-full p-6 font-serif transition-colors duration-200 ${
        themeStyles[theme]
      } ${
        isVertical
          ? "writing-vertical-rl overflow-x-auto overflow-y-hidden leading-loose"
          : "writing-horizontal-tb overflow-y-auto overflow-x-hidden leading-relaxed"
      }`}
      style={{
        fontSize: `${fontSizePx}px`,
        lineHeight,
      }}
    >
      {(title || chapterTitle) && (
        <header
          className={`mb-6 pb-4 border-b ${
            isVertical ? "border-l border-b-0 pl-4 mr-6" : "border-b pb-4 mb-6"
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
  );
};

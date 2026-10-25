import React from "react";

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
}

const themeStyles: Record<ReaderTheme, string> = {
  light: "bg-[#fcfcfc] text-slate-900 border-slate-200",
  sepia: "bg-[#fbf0d9] text-[#5f4b32] border-[#ebd9b9]",
  dark: "bg-slate-900 text-slate-200 border-slate-800",
  black: "bg-black text-slate-300 border-neutral-900",
};

/**
 * 小説本文の縦書き/横書き組版表示、ルビ・傍点、カラーテーマ描画を担う Presentational コンポーネント
 */
export const ReaderView: React.FC<ReaderViewProps> = ({
  title,
  chapterTitle,
  bodyHtml,
  writingMode = "vertical-rl",
  theme = "light",
  fontSizePx = 18,
  lineHeight = 1.8,
}) => {
  const isVertical = writingMode === "vertical-rl";

  return (
    <div
      data-testid="reader-view"
      data-writing-mode={writingMode}
      data-theme={theme}
      className={`rounded-lg p-6 shadow-sm border font-serif transition-colors duration-200 ${
        themeStyles[theme]
      } ${
        isVertical
          ? "writing-vertical-rl overflow-x-auto overflow-y-hidden h-[70vh] md:h-[80vh] leading-loose"
          : "writing-horizontal-tb overflow-y-auto overflow-x-hidden max-h-[70vh] md:max-h-[80vh] leading-relaxed"
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

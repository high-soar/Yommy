import React, { useMemo } from "react";
import type { WritingMode, ReaderTheme } from "../../../storage/types";
import { sanitizeChapterHtml } from "../../../parsers/sanitizer";

export interface SampleTextPreviewProps {
  /** 組み方向（'vertical-rl' または 'horizontal-tb'） */
  writingMode: WritingMode;
  /** カラーテーマ（'light' | 'sepia' | 'dark' | 'black'） */
  theme: ReaderTheme;
  /** 文字サイズ (px) */
  fontSizePx: number;
  /** 行間倍率 */
  lineHeight: number;
  /** 追加の CSS クラス（任意） */
  className?: string;
}

const themeStyles: Record<ReaderTheme, string> = {
  light: "bg-[#fcfcfc] text-slate-900 border-slate-200",
  sepia: "bg-[#fbf0d9] text-[#5f4b32] border-[#ebd9b9]",
  dark: "bg-slate-900 text-slate-200 border-slate-800",
  black: "bg-black text-slate-300 border-neutral-900",
};

const SAMPLE_TEXT_HTML =
  "<p>吾輩は<ruby>猫<rp>（</rp><rt>ねこ</rt><rp>）</rp></ruby>である。名前はまだ無い。</p>" +
  '<p>どこで生れたかとんと<em class="bouten">見当</em>がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。</p>';

/**
 * 設定画面（SCR-05）において、組版・フォント・テーマ変更をリアルタイムに反映する
 * サンプル小説文プレビュー Presentational コンポーネント
 */
export const SampleTextPreview: React.FC<SampleTextPreviewProps> = ({
  writingMode,
  theme,
  fontSizePx,
  lineHeight,
  className,
}) => {
  const isVertical = writingMode === "vertical-rl";
  const sanitizedHtml = useMemo(
    () => sanitizeChapterHtml(SAMPLE_TEXT_HTML),
    [],
  );

  const containerClasses = [
    "rounded-xl border shadow-xs h-64 w-full p-4 md:p-6 font-serif transition-colors duration-200 select-none",
    themeStyles[theme],
    isVertical
      ? "writing-vertical-rl overflow-x-auto overflow-y-hidden leading-loose"
      : "writing-horizontal-tb overflow-y-auto overflow-x-hidden leading-relaxed",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      data-testid="sample-text-preview"
      data-writing-mode={writingMode}
      data-theme={theme}
      data-font-size={String(fontSizePx)}
      data-line-height={String(lineHeight)}
      className={containerClasses}
      style={{
        fontSize: `${fontSizePx}px`,
        lineHeight,
      }}
    >
      <div
        className="novel-content"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    </div>
  );
};

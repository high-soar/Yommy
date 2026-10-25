import React from "react";

export type WritingMode = "vertical-rl" | "horizontal-tb";
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

export const ReaderView: React.FC<ReaderViewProps> = () => {
  return null;
};

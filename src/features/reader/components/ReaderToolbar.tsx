import React from "react";
import type { WritingMode, ReaderTheme } from "./ReaderView";

export interface ReaderToolbarProps {
  writingMode: WritingMode;
  theme: ReaderTheme;
  onToggleWritingMode: () => void;
  onChangeTheme: (theme: ReaderTheme) => void;
  onFetchNovel?: () => void;
  isLoading?: boolean;
}

export const ReaderToolbar: React.FC<ReaderToolbarProps> = () => {
  return null;
};

import React from "react";
import type {
  NovelRecord,
  ChapterRecord,
  WritingMode,
  ReaderTheme,
} from "../../../storage/types";

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
  onToggleWritingMode: () => void;
  onChangeTheme: (theme: ReaderTheme) => void;
  onChangeFontSize: (sizePx: number) => void;
  onChangeLineHeight: (height: number) => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  onScrollProgressChange: (progress: number) => void;
  onBackToDetail?: () => void;
  onBackToBookshelf?: () => void;
  onFetchNovel?: () => void;
}

/**
 * 小説リーダー画面レイアウト統合コンポーネント（スタブ）
 */
export const ReaderPage: React.FC<ReaderPageProps> = () => {
  return null;
};

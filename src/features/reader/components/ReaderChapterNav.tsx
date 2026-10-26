import React from "react";

export interface ReaderChapterNavProps {
  chapterIndex: number;
  totalChapters: number;
  isLoading?: boolean;
  onPrevChapter: () => void;
  onNextChapter: () => void;
}

/**
 * 前後エピソード遷移ナビゲーションバー（スタブ）
 */
export const ReaderChapterNav: React.FC<ReaderChapterNavProps> = () => {
  return null;
};

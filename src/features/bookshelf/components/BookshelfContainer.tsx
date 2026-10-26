import React from "react";

export interface BookshelfContainerProps {
  onSelectNovel?: (novelId: string) => void;
  onResumeNovel?: (novelId: string, chapterIndex: number) => void;
}

/**
 * 本棚画面（SCR-01）の Container コンポーネント（未実装スタブ）
 */
export const BookshelfContainer: React.FC<BookshelfContainerProps> = () => {
  return null;
};

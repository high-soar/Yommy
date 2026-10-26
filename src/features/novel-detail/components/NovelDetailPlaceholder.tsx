import React from "react";

export interface NovelDetailPlaceholderProps {
  novelId: string;
  onBackToBookshelf?: () => void;
  onRead?: (novelId: string, chapterIndex: number) => void;
}

/**
 * 作品詳細・目次画面（SCR-02）の最小プレースホルダ画面（未実装スタブ）
 */
export const NovelDetailPlaceholder: React.FC<
  NovelDetailPlaceholderProps
> = () => {
  return null;
};

import React from "react";

export interface ReaderBottomOverlayProps {
  isOpen: boolean;
  chapterIndex: number;
  totalChapters: number;
  isLoading?: boolean;
  activeTab?: "bookshelf" | "settings";
  onPrevChapter: () => void;
  onNextChapter: () => void;
  onSelectTab?: (tab: "bookshelf" | "settings") => void;
  onClose?: () => void;
}

/**
 * 前後話ナビゲーションと下部タブバーを統合したスライドインオーバーレイ（Presentational）
 *
 * 【Red状態スタブ】
 */
export const ReaderBottomOverlay: React.FC<ReaderBottomOverlayProps> = () => {
  return null;
};

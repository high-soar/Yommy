import React from "react";

export interface ReaderTopOverlayProps {
  /** オーバーレイの開閉表示状態（true: スライドイン表示、false: 画面外へ退避） */
  isOpen: boolean;
  /** 作品タイトル */
  novelTitle: string;
  /** エピソードサブタイトル */
  chapterTitle: string;
  /** 「← 目次」ボタン押下時のコールバック */
  onBackToToc: () => void;
}

/**
 * 上部スライドインオーバーレイ（作品タイトル・エピソードサブタイトル表示と目次復帰導線）
 */
export const ReaderTopOverlay: React.FC<ReaderTopOverlayProps> = () => {
  return null;
};

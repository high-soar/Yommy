import React from "react";

export interface ReaderContainerProps {
  /** 対象作品 ID（省略時は登録作品一覧の先頭） */
  novelId?: string;
  /** 対象エピソード連番（1始まり、省略時は 1） */
  chapterIndex?: number;
  /** 単体検証・手動取得時の対象作品 URL（既定値: 検証用カクヨム作品 URL） */
  initialWorkUrl?: string;
  /** 「本棚へ戻る」タップ時のコールバック（省略時はルーターの navigateToBookshelf を使用） */
  onBackToBookshelf?: () => void;
  /** 「作品詳細へ」タップ時のコールバック（省略時はルーターの navigateToNovelDetail を使用） */
  onBackToDetail?: (novelId: string) => void;
  /** 前後話遷移タップ時のコールバック（省略時はルーターの navigateToReader を使用） */
  onNavigateChapter?: (novelId: string, chapterIndex: number) => void;
}

/**
 * 小説リーダー画面（SCR-03）Container コンポーネント（最小スタブ）
 */
export const ReaderContainer: React.FC<ReaderContainerProps> = () => {
  return null;
};

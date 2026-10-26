import React from "react";
import type { NovelRecord } from "../../../storage/types";

export interface NovelDetailHeaderProps {
  novel: NovelRecord;
  isRefreshing: boolean;
  refreshMessage?: string | null;
  error?: string | null;
  onBackToBookshelf: () => void;
  onStartFromBeginning: () => void;
  onResumeBookmark: (chapterIndex: number) => void;
  onRefreshToc: () => void | Promise<void>;
  onOpenDeleteDialog: () => void;
}

/**
 * 作品詳細ヘッダーコンポーネント（スタブ）
 */
export const NovelDetailHeader: React.FC<NovelDetailHeaderProps> = () => {
  return null;
};

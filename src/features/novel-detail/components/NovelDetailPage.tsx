import React from "react";
import type { NovelRecord, ChapterSummary } from "../../../storage/types";

export interface NovelDetailPageProps {
  novel: NovelRecord | null;
  chapters: ChapterSummary[];
  isLoading: boolean;
  isRefreshing: boolean;
  isDeleteDialogOpen: boolean;
  isDeleting: boolean;
  refreshMessage?: string | null;
  error?: string | null;
  onBackToBookshelf: () => void;
  onStartFromBeginning: () => void;
  onResumeBookmark: (chapterIndex: number) => void;
  onSelectEpisode: (chapterIndex: number) => void;
  onRefreshToc: () => void | Promise<void>;
  onOpenDeleteDialog: () => void;
  onCloseDeleteDialog: () => void;
  onConfirmDelete: () => void | Promise<void>;
}

/**
 * 作品詳細・目次画面全体のレイアウト統合コンポーネント（スタブ）
 */
export const NovelDetailPage: React.FC<NovelDetailPageProps> = () => {
  return null;
};

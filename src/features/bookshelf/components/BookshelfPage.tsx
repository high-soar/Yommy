import React from "react";
import type { NovelSummary } from "../../../storage/types";

export interface BookshelfPageProps {
  novels: NovelSummary[];
  isLoading: boolean;
  isDialogOpen: boolean;
  isSubmitting: boolean;
  dialogError?: string | null;
  onOpenDialog: () => void;
  onCloseDialog: () => void;
  onAddNovel: (url: string) => void | Promise<void>;
  onSelectNovel: (novelId: string) => void;
  onResumeNovel: (novelId: string, chapterIndex: number) => void;
}

export const BookshelfPage: React.FC<BookshelfPageProps> = () => {
  return null;
};

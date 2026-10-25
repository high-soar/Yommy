import type { NovelSummary } from "../../../storage/types";

export interface UseBookshelfResult {
  novels: NovelSummary[];
  isLoading: boolean;
  isDialogOpen: boolean;
  isSubmitting: boolean;
  dialogError: string | null;
  openDialog: () => void;
  closeDialog: () => void;
  addNovelByUrl: (url: string) => Promise<boolean>;
  reloadNovels: () => Promise<void>;
}

export function useBookshelf(): UseBookshelfResult {
  throw new Error("not implemented");
}

import type { NovelRecord, ChapterSummary } from "../../storage/types";

/**
 * useNovelDetail フックの返却値インターフェース
 */
export interface UseNovelDetailResult {
  novel: NovelRecord | null;
  chapters: ChapterSummary[];
  isLoading: boolean;
  isRefreshing: boolean;
  isDeleteDialogOpen: boolean;
  isDeleting: boolean;
  refreshMessage: string | null;
  error: string | null;
  refreshToc: () => Promise<boolean>;
  openDeleteDialog: () => void;
  closeDeleteDialog: () => void;
  confirmDeleteNovel: () => Promise<boolean>;
  reloadDetail: () => Promise<void>;
}

/**
 * 作品詳細ヘッダーコンポーネント（NovelDetailHeader）Props
 */
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
 * 単一エピソード行コンポーネント（EpisodeListItem）Props
 */
export interface EpisodeListItemProps {
  chapter: ChapterSummary;
  isBookmarked: boolean;
  onSelectEpisode: (chapterIndex: number) => void;
}

/**
 * 章見出し付きエピソード一覧コンポーネント（EpisodeList）Props
 */
export interface EpisodeListProps {
  chapters: ChapterSummary[];
  bookmarkChapterIndex: number | null;
  onSelectEpisode: (chapterIndex: number) => void;
}

/**
 * 作品削除確認ダイアログコンポーネント（DeleteConfirmDialog）Props
 */
export interface DeleteConfirmDialogProps {
  isOpen: boolean;
  novelTitle: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

/**
 * 作品詳細・目次画面 Presentational コンポーネント（NovelDetailPage）Props
 */
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
 * 作品詳細・目次画面 Container コンポーネント（NovelDetailContainer）Props
 */
export interface NovelDetailContainerProps {
  novelId: string;
  onBackToBookshelf?: () => void;
  onSelectEpisode?: (novelId: string, chapterIndex: number) => void;
}

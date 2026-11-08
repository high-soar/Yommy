import type {
  NovelSiteType,
  ParsedChapterContent,
  ParsedNovelIndex,
} from "../parsers/types";

export interface NovelRecord {
  id: string;
  siteType: NovelSiteType;
  remoteWorkId: string;
  canonicalUrl: string;
  title: string;
  author: string;
  synopsis: string;
  totalChapters: number;
  cachedChapters: number;
  totalByteSize: number;
  bookmarkChapterIndex: number | null;
  bookmarkScrollProgress: number;
  isFavorite: boolean;
  hasNewUpdate?: boolean;
  latestEpisodePublishedAt?: string | null;
  lastCheckedAt: string | null;
  lastReadAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NovelSummary = Omit<NovelRecord, "synopsis">;

export interface ChapterRecord {
  id: string;
  novelId: string;
  chapterIndex: number;
  remoteChapterId: string;
  partTitle: string | null;
  title: string;
  url: string;
  bodyHtml: string | null;
  byteSize: number;
  isRead: boolean;
  publishedAt: string | null;
  downloadedAt: string | null;
}

export type ChapterSummary = Omit<ChapterRecord, "bodyHtml">;

export type WritingMode = "vertical-rl" | "horizontal-tb";
export type ReaderTheme = "light" | "sepia" | "dark" | "black";
export type ReaderFontFamily =
  "mincho" | "gothic" | "biz-ud-mincho" | "biz-ud-gothic" | "klee";

/**
 * ページ送り動作モード（v0.4 Issue #122）
 * - auto: 自動（縦書き時はページめくり、横書き時はスクロール）
 * - paged: 常に 1 画面単位のページめくり
 * - scroll: 常に連続スクロール
 */
export type ReaderPagingMode = "auto" | "paged" | "scroll";

export interface ReaderSettings {
  writingMode: WritingMode;
  theme: ReaderTheme;
  fontFamily: ReaderFontFamily;
  fontSizePx: number;
  lineHeight: number;
  pageMarginPx: number;
  enableTapPaging: boolean;
  enableVolumeKeyPaging: boolean;
  pagingMode: ReaderPagingMode;
  updatedAt: string;
}

export type BookshelfSortOrder =
  "unread_first" | "last_read" | "latest_published" | "created_at" | "title";

export interface AppSettingRecord {
  key: string;
  value: string;
  updatedAt: string;
}

export interface DeletedNovelRecord {
  id: string;
  deletedAt: number;
}

export interface NovelRepository {
  listNovels(sortOrder?: BookshelfSortOrder): Promise<NovelSummary[]>;
  getNovelById(novelId: string): Promise<NovelRecord | null>;
  upsertNovelWithToc(
    index: ParsedNovelIndex,
    fetchedAt: string,
  ): Promise<NovelRecord>;
  updateBookmark(
    novelId: string,
    chapterIndex: number,
    scrollProgress: number,
  ): Promise<void>;
  setFavorite(novelId: string, isFavorite: boolean): Promise<void>;
  deleteNovel(novelId: string): Promise<void>;
  clearNewUpdate(novelId: string): Promise<void>;
  updateLastCheckedAt(novelId: string, checkedAt: string): Promise<void>;
  getDeletedNovels?(): Promise<DeletedNovelRecord[]>;
  purgeDeletedNovels?(idList: string[]): Promise<void>;
  updateSyncMetadata?(
    novelId: string,
    metadata: {
      isFavorite?: boolean;
      lastReadAt?: string | null;
      createdAt?: string;
      updatedAt?: string;
    },
  ): Promise<void>;
  purgeExpiredDeletedNovels?(cutoffTimeMs: number): Promise<void>;
}

export interface AppSettingsRepository {
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  getCloudSyncLastSyncedAt?(): Promise<number | null>;
  setCloudSyncLastSyncedAt?(timestamp: number | null): Promise<void>;
  getCloudSyncAccountEmail?(): Promise<string | null>;
  setCloudSyncAccountEmail?(email: string | null): Promise<void>;
}

export interface ChapterRepository {
  listChaptersByNovelId(novelId: string): Promise<ChapterSummary[]>;
  getChapter(
    novelId: string,
    chapterIndex: number,
  ): Promise<ChapterRecord | null>;
  saveChapterBody(
    novelId: string,
    chapterIndex: number,
    content: ParsedChapterContent,
    downloadedAt: string,
  ): Promise<void>;
  markChapterRead(
    novelId: string,
    chapterIndex: number,
    isRead: boolean,
  ): Promise<void>;
  deleteCachedBodies(
    novelId: string,
    options?: { onlyRead?: boolean },
  ): Promise<number>;
  deleteAllCachedBodies(options?: { onlyRead?: boolean }): Promise<number>;
  getStorageCacheSummary(): Promise<{
    totalCachedChapters: number;
    totalByteSize: number;
  }>;
}

export interface SettingsRepository {
  getReaderSettings(): Promise<ReaderSettings>;
  updateReaderSettings(patch: Partial<ReaderSettings>): Promise<ReaderSettings>;
  getCloudSyncLastSyncedAt?(): Promise<number | null>;
  setCloudSyncLastSyncedAt?(timestamp: number | null): Promise<void>;
  getCloudSyncAccountEmail?(): Promise<string | null>;
  setCloudSyncAccountEmail?(email: string | null): Promise<void>;
}

export type DownloadQueueStatus =
  "pending" | "downloading" | "completed" | "failed";

export interface DownloadQueueItem {
  id: number;
  novelId: string;
  chapterIndex: number;
  targetUrl: string;
  status: DownloadQueueStatus;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueChapterInput {
  chapterIndex: number;
  targetUrl: string;
}

export interface QueueRepository {
  /**
   * 対象エピソード群をダウンロードキューへ一括登録（Upsert）する。
   * 既に同一 (novel_id, chapter_index) のレコードが存在する場合は、
   * target_url を更新し、status = 'pending', last_error = NULL, updated_at = nowIso にリセットする（retry_count は保持）。
   */
  enqueueChapters(
    novelId: string,
    items: EnqueueChapterInput[],
    nowIso?: string,
  ): Promise<void>;

  /**
   * 指定作品のダウンロードキュー一覧を chapter_index 昇順で取得する。
   */
  listByNovelId(novelId: string): Promise<DownloadQueueItem[]>;

  /**
   * 指定エピソードのキューステータスを更新する。
   * options.incrementRetry === true の場合は retry_count = retry_count + 1 に加算し、
   * options.lastError が指定された場合は last_error を更新する（status === 'completed' または 'pending' 時は省略時 NULL クリア）。
   */
  updateStatus(
    novelId: string,
    chapterIndex: number,
    status: DownloadQueueStatus,
    options?: {
      lastError?: string | null;
      incrementRetry?: boolean;
      nowIso?: string;
    },
  ): Promise<void>;

  /**
   * 画面アンマウントやアプリ再起動時に残存している 'downloading' 状態のレコードを 'pending' に戻す。
   */
  resetInterruptedToPending(novelId: string, nowIso?: string): Promise<void>;

  /**
   * 指定作品の特定話数リストに該当するキューレコードを削除する（個別話閲覧・先読み完了時の整理用）。
   */
  deleteByNovelAndChapters(
    novelId: string,
    chapterIndexes: number[],
  ): Promise<void>;

  /**
   * 指定作品の全キューレコードを削除する（全話キャッシュ完了時・作品キャッシュ削除時用）。
   */
  clearNovelQueue(novelId: string): Promise<void>;

  /**
   * 全作品の全キューレコードを削除する（設定画面での全キャッシュ一括削除時用）。
   */
  clearAllQueue(): Promise<void>;
}

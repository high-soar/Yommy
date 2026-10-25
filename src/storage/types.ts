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

export interface ReaderSettings {
  writingMode: WritingMode;
  theme: ReaderTheme;
  fontFamily: ReaderFontFamily;
  fontSizePx: number;
  lineHeight: number;
  pageMarginPx: number;
  enableTapPaging: boolean;
  enableVolumeKeyPaging: boolean;
  updatedAt: string;
}

export interface NovelRepository {
  listNovels(): Promise<NovelSummary[]>;
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
  deleteNovel(novelId: string): Promise<void>;
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
}

export interface SettingsRepository {
  getReaderSettings(): Promise<ReaderSettings>;
  updateReaderSettings(patch: Partial<ReaderSettings>): Promise<ReaderSettings>;
}

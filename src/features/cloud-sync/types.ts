import type { NovelSiteType } from "../../parsers/types";

/**
 * yommy-sync-state.json のルートデータ構造
 */
export interface YommySyncState {
  /** スキーマバージョン（初期値: 1） */
  version: 1;
  /** 最終同期日時（ISO 8601 UTC 文字列） */
  lastSyncedAt: string;
  /** 作品基本情報・しおり・既読マップ（キー: novelId） */
  novels: Record<string, SyncNovelData>;
  /** 削除済み作品の Tombstone マップ（キー: novelId, 値: 削除日時 ISO 8601） */
  deletedNovels: Record<string, string>;
}

/**
 * 同期対象の個別作品データ構造
 */
export interface SyncNovelData {
  id: string; // "{site_type}:{remote_work_id}"
  siteType: NovelSiteType;
  remoteWorkId: string;
  canonicalUrl: string; // 作品トップURL
  title: string;
  author: string;
  synopsis: string;
  totalChapters: number;
  isFavorite: number; // 0 | 1
  hasNewUpdate: number; // 0 | 1
  latestEpisodePublishedAt: string | null;
  bookmarkChapterIndex: number | null; // しおり話数（1始まり）
  lastReadAt: string | null; // 最終閲覧日時（ISO 8601）
  readChapterIds: string[]; // 既読エピソードID（remote_chapter_id）の配列
  createdAt: string; // 初回登録日時（ISO 8601）
  updatedAt: string; // レコード更新日時（ISO 8601）
}

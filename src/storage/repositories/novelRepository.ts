import type { DatabaseAdapter } from "../adapter/types";
import type {
  BookshelfSortOrder,
  DeletedNovelRecord,
  NovelRecord,
  NovelRepository,
  NovelSummary,
} from "../types";
import type { ParsedNovelIndex, ParsedTocItem } from "../../parsers/types";

interface NovelRow {
  id: string;
  site_type: NovelRecord["siteType"];
  remote_work_id: string;
  canonical_url: string;
  title: string;
  author: string;
  synopsis: string;
  total_chapters: number;
  cached_chapters: number;
  total_byte_size: number;
  bookmark_chapter_index: number | null;
  bookmark_scroll_progress: number;
  is_favorite: number;
  has_new_update: number;
  latest_episode_published_at: string | null;
  last_checked_at: string | null;
  last_read_at: string | null;
  created_at: string;
  updated_at: string;
}

const UPSERT_CHAPTER_SQL = `
INSERT INTO chapters (
  id, novel_id, chapter_index, remote_chapter_id, part_title, title, url,
  body_html, byte_size, is_read, published_at, downloaded_at
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, NULL, 0, 0, ?, NULL
)
ON CONFLICT(novel_id, remote_chapter_id) DO UPDATE SET
  chapter_index = excluded.chapter_index,
  part_title = excluded.part_title,
  title = excluded.title,
  url = excluded.url,
  published_at = excluded.published_at;
`;

/**
 * 5種の本棚ソート順に対応する ORDER BY 句の定義
 * （docs/specs/db-schema.md および docs/specs/changes/issue-80-bookshelf-update-check-and-sort.md に準拠）
 */
const ORDER_BY_CLAUSES: Record<BookshelfSortOrder, string> = {
  unread_first: `ORDER BY
    novels.has_new_update DESC,
    CASE WHEN novels.last_read_at IS NOT NULL THEN 0 ELSE 1 END,
    novels.last_read_at DESC,
    novels.created_at DESC`,
  last_read: `ORDER BY
    CASE WHEN novels.last_read_at IS NOT NULL THEN 0 ELSE 1 END,
    novels.last_read_at DESC,
    novels.created_at DESC`,
  latest_published: `ORDER BY
    CASE WHEN novels.latest_episode_published_at IS NOT NULL THEN 0 ELSE 1 END,
    novels.latest_episode_published_at DESC,
    novels.updated_at DESC`,
  created_at: `ORDER BY novels.created_at DESC`,
  title: `ORDER BY novels.title COLLATE NOCASE ASC`,
};

/**
 * 各話目次エピソード一覧から有効な publishedAt の最大値（最新公開・更新日時）を算出し、
 * SQLite の文字列ソート順と実時刻順を一致させるため ISO 8601 UTC 文字列（例: "2026-01-01T20:00:00.000Z"）に正規化して返却する
 * （docs/specs/db-schema.md §3.1 に準拠）
 */
export function computeLatestEpisodePublishedAt(
  chapters: ParsedTocItem[],
): string | null {
  let maxTime = -Infinity;

  for (const chapter of chapters) {
    if (!chapter.publishedAt) {
      continue;
    }
    const timestamp = Date.parse(chapter.publishedAt);
    if (Number.isNaN(timestamp)) {
      continue;
    }
    if (timestamp > maxTime) {
      maxTime = timestamp;
    }
  }

  if (maxTime === -Infinity) {
    return null;
  }

  return new Date(maxTime).toISOString();
}

/**
 * SQLite バックエンドによる作品リポジトリ実装
 * （docs/specs/architecture.md および docs/specs/db-schema.md に準拠）
 */
export class SqlNovelRepository implements NovelRepository {
  constructor(private db: DatabaseAdapter) {}

  private mapRowToRecord(row: NovelRow): NovelRecord {
    return {
      id: row.id,
      siteType: row.site_type,
      remoteWorkId: row.remote_work_id,
      canonicalUrl: row.canonical_url,
      title: row.title,
      author: row.author,
      synopsis: row.synopsis,
      totalChapters: row.total_chapters,
      cachedChapters: row.cached_chapters,
      totalByteSize: row.total_byte_size,
      bookmarkChapterIndex: row.bookmark_chapter_index,
      bookmarkScrollProgress: row.bookmark_scroll_progress,
      isFavorite: row.is_favorite === 1,
      hasNewUpdate: row.has_new_update === 1,
      latestEpisodePublishedAt: row.latest_episode_published_at,
      lastCheckedAt: row.last_checked_at,
      lastReadAt: row.last_read_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * 作品一覧を指定されたソート順で取得する（既定値: 'unread_first'）
   */
  async listNovels(
    order: BookshelfSortOrder = "unread_first",
  ): Promise<NovelSummary[]> {
    const orderByClause =
      ORDER_BY_CLAUSES[order] ?? ORDER_BY_CLAUSES.unread_first;

    const rows = await this.db.query<NovelRow>(
      `SELECT
        id, site_type, remote_work_id, canonical_url, title, author,
        total_chapters, cached_chapters, total_byte_size,
        bookmark_chapter_index, bookmark_scroll_progress, is_favorite,
        has_new_update, latest_episode_published_at,
        last_checked_at, last_read_at, created_at, updated_at
      FROM novels
      ${orderByClause};`,
    );

    return rows.map((row) => {
      const record = this.mapRowToRecord(row);
      const { synopsis: _synopsis, ...summary } = record;
      return summary;
    });
  }

  /**
   * 作品 ID に対応する詳細レコードを取得する。存在しない場合は null を返す。
   */
  async getNovelById(novelId: string): Promise<NovelRecord | null> {
    const rows = await this.db.query<NovelRow>(
      "SELECT * FROM novels WHERE id = ?;",
      [novelId],
    );
    if (rows.length === 0) {
      return null;
    }
    return this.mapRowToRecord(rows[0]);
  }

  /**
   * 目次パース結果から作品情報および各話目次レコードをトランザクション内で保存・更新する。
   * 話数増加時は has_new_update = 1 を記録し、最新話公開日時（latest_episode_published_at）を更新する。
   */
  async upsertNovelWithToc(
    index: ParsedNovelIndex,
    fetchedAt: string,
  ): Promise<NovelRecord> {
    const id = `${index.siteType}:${index.remoteWorkId}`;
    const latestEpisodePublishedAt = computeLatestEpisodePublishedAt(
      index.chapters,
    );

    return await this.db.runTransaction(async () => {
      const existing = await this.getNovelById(id);

      if (existing === null) {
        await this.db.execute(
          `INSERT INTO novels (
            id, site_type, remote_work_id, canonical_url, title, author, synopsis,
            total_chapters, cached_chapters, total_byte_size,
            bookmark_chapter_index, bookmark_scroll_progress, is_favorite,
            has_new_update, latest_episode_published_at,
            last_checked_at, last_read_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, 0, 0, 0, ?, ?, NULL, ?, ?);`,
          [
            id,
            index.siteType,
            index.remoteWorkId,
            index.canonicalUrl,
            index.title,
            index.author,
            index.synopsis,
            index.chapters.length,
            latestEpisodePublishedAt,
            fetchedAt,
            fetchedAt,
            fetchedAt,
          ],
        );
      } else {
        const existingChapterRows = await this.db.query<{
          remote_chapter_id: string;
        }>(`SELECT remote_chapter_id FROM chapters WHERE novel_id = ?;`, [id]);
        const existingRemoteIds = new Set(
          existingChapterRows.map((r) => r.remote_chapter_id),
        );
        const hasNewChapter = index.chapters.some(
          (c) => !existingRemoteIds.has(c.remoteChapterId),
        );

        const hasNewUpdate =
          index.chapters.length > existing.totalChapters || hasNewChapter
            ? 1
            : existing.hasNewUpdate
              ? 1
              : 0;

        await this.db.execute(
          `UPDATE novels
           SET site_type = ?, remote_work_id = ?, canonical_url = ?, title = ?, author = ?, synopsis = ?,
               total_chapters = ?, has_new_update = ?, latest_episode_published_at = ?,
               last_checked_at = ?, updated_at = ?
           WHERE id = ?;`,
          [
            index.siteType,
            index.remoteWorkId,
            index.canonicalUrl,
            index.title,
            index.author,
            index.synopsis,
            index.chapters.length,
            hasNewUpdate,
            latestEpisodePublishedAt,
            fetchedAt,
            fetchedAt,
            id,
          ],
        );
      }

      for (const chapter of index.chapters) {
        const chapterId = `${id}:${chapter.remoteChapterId}`;
        await this.db.execute(UPSERT_CHAPTER_SQL, [
          chapterId,
          id,
          chapter.chapterIndex,
          chapter.remoteChapterId,
          chapter.partTitle ?? null,
          chapter.title,
          chapter.url,
          chapter.publishedAt ?? null,
        ]);
      }

      const result = await this.getNovelById(id);
      return result!;
    });
  }

  /**
   * しおり位置および閲覧日時を更新する
   */
  async updateBookmark(
    novelId: string,
    chapterIndex: number,
    scrollProgress: number,
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db.execute(
      `UPDATE novels
       SET bookmark_chapter_index = ?, bookmark_scroll_progress = ?, last_read_at = ?, updated_at = ?
       WHERE id = ?;`,
      [chapterIndex, scrollProgress, now, now, novelId],
    );
  }

  /**
   * 作品および紐づくエピソード・ダウンロードキュー（CASCADE）を削除する
   */
  async deleteNovel(novelId: string): Promise<void> {
    await this.db.execute("DELETE FROM novels WHERE id = ?;", [novelId]);
  }

  /**
   * 指定作品の新着エピソードフラグ（has_new_update）を 0 に解除する
   */
  async clearNewUpdate(novelId: string): Promise<void> {
    await this.db.execute(
      "UPDATE novels SET has_new_update = 0 WHERE id = ?;",
      [novelId],
    );
  }

  /**
   * 指定作品の最終更新確認日時（last_checked_at）を更新する
   */
  async updateLastCheckedAt(novelId: string, checkedAt: string): Promise<void> {
    await this.db.execute(
      "UPDATE novels SET last_checked_at = ? WHERE id = ?;",
      [checkedAt, novelId],
    );
  }

  /**
   * 削除済み作品の Tombstone レコード一覧を取得する（Red スタブ）
   */
  async getDeletedNovels(): Promise<DeletedNovelRecord[]> {
    throw new Error("getDeletedNovels is not implemented yet");
  }

  /**
   * 指定された作品 ID の Tombstone を削除（パージ）する（Red スタブ）
   */
  async purgeDeletedNovels(_idList: string[]): Promise<void> {
    throw new Error("purgeDeletedNovels is not implemented yet");
  }
}

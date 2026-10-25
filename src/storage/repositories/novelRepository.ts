import type { DatabaseAdapter } from "../adapter/types";
import type { NovelRecord, NovelRepository, NovelSummary } from "../types";
import type { ParsedNovelIndex } from "../../parsers/types";

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
      lastCheckedAt: row.last_checked_at,
      lastReadAt: row.last_read_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listNovels(): Promise<NovelSummary[]> {
    const rows = await this.db.query<NovelRow>(
      `SELECT
        id, site_type, remote_work_id, canonical_url, title, author,
        total_chapters, cached_chapters, total_byte_size,
        bookmark_chapter_index, bookmark_scroll_progress, is_favorite,
        last_checked_at, last_read_at, created_at, updated_at
      FROM novels
      ORDER BY
        CASE WHEN last_read_at IS NOT NULL THEN 0 ELSE 1 END,
        last_read_at DESC,
        created_at DESC;`,
    );

    return rows.map((row) => {
      const record = this.mapRowToRecord(row);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { synopsis, ...summary } = record;
      return summary;
    });
  }

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

  async upsertNovelWithToc(
    index: ParsedNovelIndex,
    fetchedAt: string,
  ): Promise<NovelRecord> {
    const id = `${index.siteType}:${index.remoteWorkId}`;

    return await this.db.runTransaction(async () => {
      const existing = await this.getNovelById(id);

      if (existing === null) {
        await this.db.execute(
          `INSERT INTO novels (
            id, site_type, remote_work_id, canonical_url, title, author, synopsis,
            total_chapters, cached_chapters, total_byte_size,
            bookmark_chapter_index, bookmark_scroll_progress, is_favorite,
            last_checked_at, last_read_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, 0, 0, ?, NULL, ?, ?);`,
          [
            id,
            index.siteType,
            index.remoteWorkId,
            index.canonicalUrl,
            index.title,
            index.author,
            index.synopsis,
            index.chapters.length,
            fetchedAt,
            fetchedAt,
            fetchedAt,
          ],
        );
      } else {
        await this.db.execute(
          `UPDATE novels
           SET site_type = ?, remote_work_id = ?, canonical_url = ?, title = ?, author = ?, synopsis = ?,
               total_chapters = ?, last_checked_at = ?, updated_at = ?
           WHERE id = ?;`,
          [
            index.siteType,
            index.remoteWorkId,
            index.canonicalUrl,
            index.title,
            index.author,
            index.synopsis,
            index.chapters.length,
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
          chapter.partTitle,
          chapter.title,
          chapter.url,
          chapter.publishedAt,
        ]);
      }

      const result = await this.getNovelById(id);
      return result!;
    });
  }

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

  async deleteNovel(novelId: string): Promise<void> {
    await this.db.execute("DELETE FROM novels WHERE id = ?;", [novelId]);
  }
}

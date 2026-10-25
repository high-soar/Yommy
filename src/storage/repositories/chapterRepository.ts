import type { DatabaseAdapter } from "../adapter/types";
import type {
  ChapterRecord,
  ChapterRepository,
  ChapterSummary,
} from "../types";
import type { ParsedChapterContent } from "../../parsers/types";

interface ChapterRow {
  id: string;
  novel_id: string;
  chapter_index: number;
  remote_chapter_id: string;
  part_title: string | null;
  title: string;
  url: string;
  body_html: string | null;
  byte_size: number;
  is_read: number;
  published_at: string | null;
  downloaded_at: string | null;
}

export class SqlChapterRepository implements ChapterRepository {
  constructor(private db: DatabaseAdapter) {}

  private mapRowToRecord(row: ChapterRow): ChapterRecord {
    return {
      id: row.id,
      novelId: row.novel_id,
      chapterIndex: row.chapter_index,
      remoteChapterId: row.remote_chapter_id,
      partTitle: row.part_title,
      title: row.title,
      url: row.url,
      bodyHtml: row.body_html,
      byteSize: row.byte_size,
      isRead: row.is_read === 1,
      publishedAt: row.published_at,
      downloadedAt: row.downloaded_at,
    };
  }

  async listChaptersByNovelId(novelId: string): Promise<ChapterSummary[]> {
    const rows = await this.db.query<ChapterRow>(
      `SELECT
        id, novel_id, chapter_index, remote_chapter_id, part_title, title, url,
        byte_size, is_read, published_at, downloaded_at
      FROM chapters
      WHERE novel_id = ?
      ORDER BY chapter_index ASC;`,
      [novelId],
    );

    return rows.map((row) => {
      const record = this.mapRowToRecord({
        ...row,
        body_html: null,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { bodyHtml, ...summary } = record;
      return summary;
    });
  }

  async getChapter(
    novelId: string,
    chapterIndex: number,
  ): Promise<ChapterRecord | null> {
    const rows = await this.db.query<ChapterRow>(
      "SELECT * FROM chapters WHERE novel_id = ? AND chapter_index = ?;",
      [novelId, chapterIndex],
    );
    if (rows.length === 0) {
      return null;
    }
    return this.mapRowToRecord(rows[0]);
  }

  async saveChapterBody(
    novelId: string,
    chapterIndex: number,
    content: ParsedChapterContent,
    downloadedAt: string,
  ): Promise<void> {
    await this.db.runTransaction(async () => {
      await this.db.execute(
        `UPDATE chapters
         SET body_html = ?, byte_size = ?, downloaded_at = ?
         WHERE novel_id = ? AND chapter_index = ?;`,
        [
          content.bodyHtml,
          content.byteSize,
          downloadedAt,
          novelId,
          chapterIndex,
        ],
      );

      await this.db.execute(
        `UPDATE novels
         SET
           cached_chapters = (SELECT COUNT(*) FROM chapters WHERE novel_id = ? AND body_html IS NOT NULL),
           total_byte_size = (SELECT COALESCE(SUM(byte_size), 0) FROM chapters WHERE novel_id = ? AND body_html IS NOT NULL),
           updated_at = ?
         WHERE id = ?;`,
        [novelId, novelId, downloadedAt, novelId],
      );
    });
  }

  async markChapterRead(
    novelId: string,
    chapterIndex: number,
    isRead: boolean,
  ): Promise<void> {
    await this.db.execute(
      "UPDATE chapters SET is_read = ? WHERE novel_id = ? AND chapter_index = ?;",
      [isRead ? 1 : 0, novelId, chapterIndex],
    );
  }

  async deleteCachedBodies(
    novelId: string,
    options?: { onlyRead?: boolean },
  ): Promise<number> {
    return await this.db.runTransaction(async () => {
      const condition = options?.onlyRead
        ? "novel_id = ? AND body_html IS NOT NULL AND is_read = 1"
        : "novel_id = ? AND body_html IS NOT NULL";

      const countRows = await this.db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM chapters WHERE ${condition};`,
        [novelId],
      );
      const count = countRows[0].count;

      await this.db.execute(
        `UPDATE chapters
         SET body_html = NULL, byte_size = 0, downloaded_at = NULL
         WHERE ${condition};`,
        [novelId],
      );

      const now = new Date().toISOString();
      await this.db.execute(
        `UPDATE novels
         SET
           cached_chapters = (SELECT COUNT(*) FROM chapters WHERE novel_id = ? AND body_html IS NOT NULL),
           total_byte_size = (SELECT COALESCE(SUM(byte_size), 0) FROM chapters WHERE novel_id = ? AND body_html IS NOT NULL),
           updated_at = ?
         WHERE id = ?;`,
        [novelId, novelId, now, novelId],
      );

      return count;
    });
  }
}

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
      const { bodyHtml: _bodyHtml, ...summary } = record;
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

  /**
   * 作品レコードのキャッシュ統計情報（cached_chapters, total_byte_size）を再計算して更新
   * （本文保存・キャッシュ削除ともにローカル端末のストレージ操作であり作品メタデータ不変のため、
   *   クラウド同期 LWW 判定保護のために novels.updated_at は更新しない: R1-01）
   * @param novelId 作品ID
   */
  private async recalculateNovelStats(novelId: string): Promise<void> {
    await this.db.execute(
      `UPDATE novels
       SET
         cached_chapters = (SELECT COUNT(*) FROM chapters WHERE novel_id = ? AND body_html IS NOT NULL),
         total_byte_size = (SELECT COALESCE(SUM(byte_size), 0) FROM chapters WHERE novel_id = ? AND body_html IS NOT NULL)
       WHERE id = ?;`,
      [novelId, novelId, novelId],
    );
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

      await this.recalculateNovelStats(novelId);
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

  /**
   * 指定作品の本文キャッシュを削除し、同時に download_queue の該当レコードもクリーンアップする（Issue #268）。
   * （クラウド同期 LWW タイムスタンプ保護規約 R1-01 に従い、novels.updated_at は更新しない）
   */
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
      if (count > 0) {
        await this.db.execute(
          `UPDATE chapters
           SET body_html = NULL, byte_size = 0, downloaded_at = NULL
           WHERE ${condition};`,
          [novelId],
        );

        // キャッシュ削除時は作品メタデータ不変のため updated_at を更新せず容量と話数のみ更新 (R1-01)
        await this.recalculateNovelStats(novelId);
      }

      if (options?.onlyRead) {
        await this.db.execute(
          `DELETE FROM download_queue
           WHERE novel_id = ? AND chapter_index IN (
             SELECT chapter_index FROM chapters WHERE novel_id = ? AND is_read = 1
           );`,
          [novelId, novelId],
        );
      } else {
        await this.db.execute(
          "DELETE FROM download_queue WHERE novel_id = ?;",
          [novelId],
        );
      }

      return count;
    });
  }

  async getStorageCacheSummary(): Promise<{
    totalCachedChapters: number;
    totalByteSize: number;
  }> {
    const rows = await this.db.query<{
      total_cached_chapters: number;
      total_byte_size: number;
    }>(
      `SELECT
        COUNT(*) AS total_cached_chapters,
        COALESCE(SUM(byte_size), 0) AS total_byte_size
      FROM chapters
      WHERE body_html IS NOT NULL;`,
    );

    const row = rows[0];
    return {
      totalCachedChapters: row.total_cached_chapters,
      totalByteSize: row.total_byte_size,
    };
  }

  /**
   * 全作品の本文キャッシュを一括削除し、同時に download_queue の該当レコードもクリーンアップする（Issue #268）。
   * （クラウド同期 LWW タイムスタンプ保護規約 R1-01 に従い、novels.updated_at は更新しない）
   */
  async deleteAllCachedBodies(options?: {
    onlyRead?: boolean;
  }): Promise<number> {
    return await this.db.runTransaction(async () => {
      const condition = options?.onlyRead
        ? "body_html IS NOT NULL AND is_read = 1"
        : "body_html IS NOT NULL";

      const countRows = await this.db.query<{ count: number }>(
        `SELECT COUNT(*) AS count FROM chapters WHERE ${condition};`,
      );
      const count = countRows[0].count;
      if (count > 0) {
        const novelRows = await this.db.query<{ novel_id: string }>(
          `SELECT DISTINCT novel_id FROM chapters WHERE ${condition};`,
        );

        await this.db.execute(
          `UPDATE chapters
           SET body_html = NULL, byte_size = 0, downloaded_at = NULL
           WHERE ${condition};`,
        );

        // キャッシュ削除時は作品メタデータ不変のため updated_at を更新せず容量と話数のみ更新 (R1-01)
        for (const row of novelRows) {
          await this.recalculateNovelStats(row.novel_id);
        }
      }

      if (options?.onlyRead) {
        await this.db.execute(
          `DELETE FROM download_queue
           WHERE EXISTS (
             SELECT 1 FROM chapters
             WHERE chapters.novel_id = download_queue.novel_id
               AND chapters.chapter_index = download_queue.chapter_index
               AND chapters.is_read = 1
           );`,
        );
      } else {
        await this.db.execute("DELETE FROM download_queue;");
      }

      return count;
    });
  }
}

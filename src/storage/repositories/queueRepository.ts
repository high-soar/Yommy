import type { DatabaseAdapter } from "../adapter/types";
import type {
  DownloadQueueItem,
  DownloadQueueStatus,
  EnqueueChapterInput,
  QueueRepository,
} from "../types";

/**
 * SQLite download_queue テーブルの行データ型（スネークケース）
 */
interface DownloadQueueRow {
  id: number;
  novel_id: string;
  chapter_index: number;
  target_url: string;
  status: DownloadQueueStatus;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * SQLite 永続ダウンロードキューリポジトリ実装（Issue #268）
 */
export class SqlQueueRepository implements QueueRepository {
  constructor(private db: DatabaseAdapter) {}

  private mapRowToItem(row: DownloadQueueRow): DownloadQueueItem {
    return {
      id: row.id,
      novelId: row.novel_id,
      chapterIndex: row.chapter_index,
      targetUrl: row.target_url,
      status: row.status,
      retryCount: row.retry_count,
      lastError: row.last_error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * 対象エピソード群をダウンロードキューへ一括登録（Upsert）する。
   * 既に同一 (novel_id, chapter_index) のレコードが存在する場合は、
   * target_url を更新し、status = 'pending', last_error = NULL, updated_at = nowIso にリセットする（retry_count は保持）。
   */
  async enqueueChapters(
    novelId: string,
    items: EnqueueChapterInput[],
    nowIso?: string,
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const timestamp = nowIso ?? new Date().toISOString();

    await this.db.runTransaction(async (tx) => {
      for (const item of items) {
        await tx.execute(
          `INSERT INTO download_queue (
            novel_id, chapter_index, target_url, status, retry_count, last_error, created_at, updated_at
          ) VALUES (?, ?, ?, 'pending', 0, NULL, ?, ?)
          ON CONFLICT(novel_id, chapter_index) DO UPDATE SET
            target_url = excluded.target_url,
            status = 'pending',
            last_error = NULL,
            updated_at = excluded.updated_at;`,
          [novelId, item.chapterIndex, item.targetUrl, timestamp, timestamp],
        );
      }
    });
  }

  /**
   * 指定作品のダウンロードキュー一覧を chapter_index 昇順で取得する。
   */
  async listByNovelId(novelId: string): Promise<DownloadQueueItem[]> {
    const rows = await this.db.query<DownloadQueueRow>(
      `SELECT
        id, novel_id, chapter_index, target_url, status, retry_count, last_error, created_at, updated_at
      FROM download_queue
      WHERE novel_id = ?
      ORDER BY chapter_index ASC;`,
      [novelId],
    );

    return rows.map((row) => this.mapRowToItem(row));
  }

  /**
   * 指定エピソードのキューステータスを更新する。
   * options.incrementRetry === true の場合は retry_count = retry_count + 1 に加算し、
   * options.lastError が指定された場合は last_error を更新する（status === 'completed' または 'pending' 時は省略時 NULL クリア）。
   */
  async updateStatus(
    novelId: string,
    chapterIndex: number,
    status: DownloadQueueStatus,
    options?: {
      lastError?: string | null;
      incrementRetry?: boolean;
      nowIso?: string;
    },
  ): Promise<void> {
    const timestamp = options?.nowIso ?? new Date().toISOString();

    let nextLastError: string | null | undefined;
    if (options?.lastError !== undefined) {
      nextLastError = options.lastError;
    } else if (status === "completed" || status === "pending") {
      nextLastError = null;
    } else {
      nextLastError = undefined;
    }

    const updates: string[] = ["status = ?", "updated_at = ?"];
    const params: (string | number | null)[] = [status, timestamp];

    if (options?.incrementRetry) {
      updates.push("retry_count = retry_count + 1");
    }

    if (nextLastError !== undefined) {
      updates.push("last_error = ?");
      params.push(nextLastError);
    }

    params.push(novelId, chapterIndex);

    await this.db.execute(
      `UPDATE download_queue
       SET ${updates.join(", ")}
       WHERE novel_id = ? AND chapter_index = ?;`,
      params,
    );
  }

  /**
   * 画面アンマウントやアプリ再起動時に残存している 'downloading' 状態のレコードを 'pending' に戻す。
   */
  async resetInterruptedToPending(
    novelId: string,
    nowIso?: string,
  ): Promise<void> {
    const timestamp = nowIso ?? new Date().toISOString();
    await this.db.execute(
      `UPDATE download_queue
       SET status = 'pending', updated_at = ?
       WHERE novel_id = ? AND status = 'downloading';`,
      [timestamp, novelId],
    );
  }

  /**
   * 指定作品の特定話数リストに該当するキューレコードを削除する（個別話閲覧・先読み完了時の整理用）。
   */
  async deleteByNovelAndChapters(
    novelId: string,
    chapterIndexes: number[],
  ): Promise<void> {
    if (chapterIndexes.length === 0) {
      return;
    }

    const placeholders = chapterIndexes.map(() => "?").join(", ");
    await this.db.execute(
      `DELETE FROM download_queue
       WHERE novel_id = ? AND chapter_index IN (${placeholders});`,
      [novelId, ...chapterIndexes],
    );
  }

  /**
   * 指定作品の全キューレコードを削除する（全話キャッシュ完了時・作品キャッシュ削除時用）。
   */
  async clearNovelQueue(novelId: string): Promise<void> {
    await this.db.execute("DELETE FROM download_queue WHERE novel_id = ?;", [
      novelId,
    ]);
  }

  /**
   * 全作品の全キューレコードを削除する（設定画面での全キャッシュ一括削除時用）。
   */
  async clearAllQueue(): Promise<void> {
    await this.db.execute("DELETE FROM download_queue;");
  }
}

/**
 * QueueRepository インスタンスのファクトリ関数
 */
export function createQueueRepository(db: DatabaseAdapter): QueueRepository {
  return new SqlQueueRepository(db);
}

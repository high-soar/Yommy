import type { DatabaseAdapter } from "../adapter/types";
import type {
  DownloadQueueItem,
  DownloadQueueStatus,
  EnqueueChapterInput,
  QueueRepository,
} from "../types";

export class SqlQueueRepository implements QueueRepository {
  constructor(private db: DatabaseAdapter) {
    void this.db;
  }

  async enqueueChapters(
    _novelId: string,
    _items: EnqueueChapterInput[],
    _nowIso?: string,
  ): Promise<void> {
    throw new Error("SqlQueueRepository.enqueueChapters is not implemented");
  }

  async listByNovelId(_novelId: string): Promise<DownloadQueueItem[]> {
    throw new Error("SqlQueueRepository.listByNovelId is not implemented");
  }

  async updateStatus(
    _novelId: string,
    _chapterIndex: number,
    _status: DownloadQueueStatus,
    _options?: {
      lastError?: string | null;
      incrementRetry?: boolean;
      nowIso?: string;
    },
  ): Promise<void> {
    throw new Error("SqlQueueRepository.updateStatus is not implemented");
  }

  async resetInterruptedToPending(
    _novelId: string,
    _nowIso?: string,
  ): Promise<void> {
    throw new Error(
      "SqlQueueRepository.resetInterruptedToPending is not implemented",
    );
  }

  async deleteByNovelAndChapters(
    _novelId: string,
    _chapterIndexes: number[],
  ): Promise<void> {
    throw new Error(
      "SqlQueueRepository.deleteByNovelAndChapters is not implemented",
    );
  }

  async clearNovelQueue(_novelId: string): Promise<void> {
    throw new Error("SqlQueueRepository.clearNovelQueue is not implemented");
  }

  async clearAllQueue(): Promise<void> {
    throw new Error("SqlQueueRepository.clearAllQueue is not implemented");
  }
}

export function createQueueRepository(db: DatabaseAdapter): QueueRepository {
  return new SqlQueueRepository(db);
}

import type { HttpClientBridge } from "../../bridges/http/types";
import type { ParserRegistry } from "../../parsers/parserRegistry";
import type {
  ChapterRepository,
  NovelRepository,
  QueueRepository,
} from "../../storage/types";

export type CachePriority = "high" | "medium" | "low";

export type CacheBatchStatus =
  "idle" | "running" | "preempted" | "paused" | "completed" | "cancelled";

export interface CacheNovelProgress {
  novelId: string;
  isBatchCaching: boolean;
  status: CacheBatchStatus;
  current: number;
  total: number;
  failedCount: number;
  failedChapterIndexes: number[];
  pausedReason: "none" | "preempted";
}

export interface CacheScheduler {
  /** 指定優先度（high: 0ms割り込み［既存キャッシュ無ければ失敗時reject］ / medium: 1.5s先読み［失敗時は警告ログのみでrejectしない］）で単話/複数話を取得する */
  enqueuePrefetch(options: {
    novelId: string;
    chapterIndexes: number[];
    priority: "high" | "medium";
    signal?: AbortSignal;
  }): Promise<void>;
  /** 作品の未取得話を low 優先度バッチとして download_queue 登録・スケジュールし、キュー投入完了時に即時 resolve する（全話完了までは待機しない） */
  enqueueBatchCache(novelId: string, chapterIndexes: number[]): Promise<void>;
  /** 一時停止（実行中の 'downloading' は retryCount 非増加で 'pending' に戻し、既存キュー行を保持） */
  pauseNovelTasks(novelId: string): Promise<void>;
  /** 指定作品のタスクを中断・完了待機する（clearQueue !== false で clearNovelQueue を実行） */
  cancelNovelTasks(
    novelId: string,
    options?: { clearQueue?: boolean },
  ): Promise<void>;
  /** 全作品の全タスクを中断・完了待機する（SCR-05 設定画面キャッシュ一括整理前等に実行、clearQueue !== false で clearAllQueue） */
  cancelAllTasks(options?: { clearQueue?: boolean }): Promise<void>;
  /** 対象作品で現在バックグラウンド一括キャッシュがアクティブか判定 */
  isNovelBatchCaching(novelId: string): boolean;
  /** 対象作品の現在の進捗スナップショットを取得 */
  getNovelProgress(novelId: string): CacheNovelProgress | null;
  /** 進捗更新・完了・失敗通知を購読（アンマウント時は購読解除のみ行いタスク継続） */
  subscribeProgress(
    novelId: string,
    listener: (progress: CacheNovelProgress) => void,
  ): () => void;
  /** DOMインポート等の外部保存後にキュー・進捗を再同期 */
  syncNovelProgress(novelId: string): Promise<void>;
  /** ServiceProvider アンマウント時に全メモリタイマー・コントローラを破棄 */
  dispose(): void;
}

export interface CacheSchedulerDeps {
  novelRepository: NovelRepository;
  chapterRepository: ChapterRepository;
  queueRepository: QueueRepository;
  httpClient: HttpClientBridge;
  parserRegistry: ParserRegistry;
  /** enqueueBatchCache で除外する累計失敗回数上限（未指定時は無制限で再試行対象に含める） */
  maxRetryCount?: number;
  prefetchIntervalMs?: number;
  timeoutMs?: number;
  shortTimeoutMs?: number;
}

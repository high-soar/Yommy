import {
  PREFETCH_INTERVAL_MS,
  SHORT_TIMEOUT_MS,
  STANDARD_TIMEOUT_MS,
} from "../../../shared/constants/cache";
import {
  delay,
  isChapterFresh,
  toErrorMessage,
} from "../../../shared/utils/cache";
import type { ChapterRecord, ChapterSummary } from "../../../storage/types";
import type {
  CacheBatchStatus,
  CacheNovelProgress,
  CacheScheduler,
  CacheSchedulerDeps,
} from "../types";

export const DEFAULT_MAX_RETRY_COUNT = 3;

type InternalAbortReason = "preempted" | "cancelled";

interface PrefetchTask {
  priority: "high" | "medium";
  novelId: string;
  chapterIndexes: number[];
  callerSignal?: AbortSignal;
  aborted: boolean;
  detachCallerSignal: () => void;
  resolve: () => void;
  reject: (err: unknown) => void;
}

interface NovelBatchState {
  novelId: string;
  total: number;
  current: number;
  remainingChapterIndexes: number[];
  failedChapterIndexes: Set<number>;
  status: CacheBatchStatus;
  isBatchCaching: boolean;
  pausedReason: "none" | "preempted";
  needsDelayBeforeNextFetch: boolean;
}

type WorkUnit =
  | { kind: "prefetch"; task: PrefetchTask }
  | { kind: "low"; batch: NovelBatchState };

function toProgressSnapshot(batch: NovelBatchState): CacheNovelProgress {
  const failedChapterIndexes = Array.from(batch.failedChapterIndexes).sort(
    (a, b) => a - b,
  );
  return {
    novelId: batch.novelId,
    isBatchCaching: batch.isBatchCaching,
    status: batch.status,
    current: batch.current,
    total: batch.total,
    failedCount: failedChapterIndexes.length,
    failedChapterIndexes,
    pausedReason: batch.pausedReason,
  };
}

export function createCacheScheduler(deps: CacheSchedulerDeps): CacheScheduler {
  const {
    chapterRepository,
    queueRepository,
    httpClient,
    parserRegistry,
    maxRetryCount = DEFAULT_MAX_RETRY_COUNT,
    prefetchIntervalMs = PREFETCH_INTERVAL_MS,
    timeoutMs = STANDARD_TIMEOUT_MS,
    shortTimeoutMs = SHORT_TIMEOUT_MS,
  } = deps;

  let disposed = false;
  let workerRunning = false;

  const highQueue: PrefetchTask[] = [];
  const mediumQueue: PrefetchTask[] = [];
  const batches = new Map<string, NovelBatchState>();
  const lowNovelOrder: string[] = [];
  const listenersByNovel = new Map<
    string,
    Set<(progress: CacheNovelProgress) => void>
  >();

  let activePrefetchTask: PrefetchTask | null = null;
  let activeLowNovelId: string | null = null;
  let activeLowSleeping = false;
  let activeAbortController: AbortController | null = null;
  let activeAbortReason: InternalAbortReason | null = null;
  let activeWorkPromise: Promise<void> | null = null;

  const emitProgress = (batch: NovelBatchState): void => {
    const listeners = listenersByNovel.get(batch.novelId);
    if (!listeners || listeners.size === 0) {
      return;
    }
    const snapshot = toProgressSnapshot(batch);
    for (const listener of Array.from(listeners)) {
      listener(snapshot);
    }
  };

  const hasHigherPriorityWork = (): boolean =>
    highQueue.length > 0 ||
    mediumQueue.length > 0 ||
    activePrefetchTask !== null;

  const syncActiveBatchesStatus = (preempted: boolean): void => {
    const nextStatus: CacheBatchStatus = preempted ? "preempted" : "running";
    const nextReason: "none" | "preempted" = preempted ? "preempted" : "none";
    for (const batch of batches.values()) {
      if (
        batch.isBatchCaching &&
        (batch.status !== nextStatus || batch.pausedReason !== nextReason)
      ) {
        batch.status = nextStatus;
        batch.pausedReason = nextReason;
        emitProgress(batch);
      }
    }
  };

  const removeFromLowOrder = (novelId: string): void => {
    const idx = lowNovelOrder.indexOf(novelId);
    if (idx >= 0) {
      lowNovelOrder.splice(idx, 1);
    }
  };

  const settlePrefetchTask = (task: PrefetchTask): void => {
    task.detachCallerSignal();
    task.resolve();
  };

  const rejectPrefetchTask = (task: PrefetchTask, err: unknown): void => {
    task.detachCallerSignal();
    task.reject(err);
  };

  const cancelQueuedPrefetches = (novelId?: string): void => {
    for (const queue of [highQueue, mediumQueue]) {
      for (let i = queue.length - 1; i >= 0; i--) {
        if (novelId === undefined || queue[i].novelId === novelId) {
          const [removed] = queue.splice(i, 1);
          removed.aborted = true;
          settlePrefetchTask(removed);
        }
      }
    }
  };

  const handleTombstoneDeletion = (novelId: string): void => {
    cancelQueuedPrefetches(novelId);

    const batch = batches.get(novelId);
    if (batch) {
      batch.remainingChapterIndexes = [];
      removeFromLowOrder(novelId);
      batch.status = "cancelled";
      batch.isBatchCaching = false;
      batch.pausedReason = "none";
      emitProgress(batch);
    }
  };

  const clearCompletedQueueRows = async (novelId: string): Promise<void> => {
    const remainingQueue = await queueRepository.listByNovelId(novelId);
    const nonFailedIndexes = remainingQueue
      .filter((item) => item.status !== "failed")
      .map((item) => item.chapterIndex);
    if (nonFailedIndexes.length === remainingQueue.length) {
      await queueRepository.clearNovelQueue(novelId);
    } else if (nonFailedIndexes.length > 0) {
      await queueRepository.deleteByNovelAndChapters(novelId, nonFailedIndexes);
    }
  };

  const finalizeBatchCompletedIfDone = async (
    batch: NovelBatchState,
  ): Promise<void> => {
    if (!batch.isBatchCaching || batch.remainingChapterIndexes.length > 0) {
      return;
    }
    removeFromLowOrder(batch.novelId);
    batch.status = "completed";
    batch.isBatchCaching = false;
    batch.pausedReason = "none";
    if (batch.failedChapterIndexes.size === 0) {
      await clearCompletedQueueRows(batch.novelId);
    }
  };

  const markChapterCompletedInBatch = async (
    novelId: string,
    chapterIndex: number,
  ): Promise<void> => {
    const batch = batches.get(novelId);
    if (!batch || !batch.isBatchCaching) {
      return;
    }
    const idx = batch.remainingChapterIndexes.indexOf(chapterIndex);
    if (idx >= 0) {
      batch.remainingChapterIndexes.splice(idx, 1);
      batch.current = Math.min(batch.total, batch.current + 1);
    }
    batch.failedChapterIndexes.delete(chapterIndex);
    await finalizeBatchCompletedIfDone(batch);
    emitProgress(batch);
  };

  const downloadAndPersistChapter = async (
    novelId: string,
    chapter: ChapterRecord,
    signal: AbortSignal,
  ): Promise<"saved" | "aborted" | "tombstone"> => {
    const hasExistingCache = chapter.bodyHtml !== null;
    const requestTimeoutMs = hasExistingCache ? shortTimeoutMs : timeoutMs;

    const response = await httpClient.getHtml({
      url: chapter.url,
      timeoutMs: requestTimeoutMs,
      signal,
    });

    if (signal.aborted) {
      return "aborted";
    }

    const postChapter = await chapterRepository.getChapter(
      novelId,
      chapter.chapterIndex,
    );
    if (signal.aborted) {
      return "aborted";
    }
    if (postChapter === null) {
      handleTombstoneDeletion(novelId);
      return "tombstone";
    }

    if (response.status >= 400) {
      throw new Error(
        `エピソードの取得に失敗しました (HTTP ${response.status})`,
      );
    }

    const parser = parserRegistry.requireParser(chapter.url);
    const parsed = parser.parseChapterContent(response.html, chapter.url);
    await chapterRepository.saveChapterBody(
      novelId,
      chapter.chapterIndex,
      parsed,
      new Date().toISOString(),
    );
    if (signal.aborted) {
      return "aborted";
    }
    await queueRepository.deleteByNovelAndChapters(novelId, [
      chapter.chapterIndex,
    ]);
    await markChapterCompletedInBatch(novelId, chapter.chapterIndex);
    return "saved";
  };

  const abortActiveIf = (
    reason: InternalAbortReason,
    predicate: () => boolean,
  ): void => {
    if (!activeAbortController || !predicate()) {
      return;
    }
    if (reason === "preempted" && activeAbortReason === "cancelled") {
      return;
    }
    activeAbortReason = reason;
    activeAbortController.abort();
  };

  const runPrefetchTask = async (task: PrefetchTask): Promise<void> => {
    if (task.aborted || task.callerSignal?.aborted) {
      settlePrefetchTask(task);
      return;
    }

    const controller = new AbortController();
    activePrefetchTask = task;
    activeAbortController = controller;
    activeAbortReason = null;

    const onTaskCallerAbort = () => {
      activeAbortReason = "cancelled";
      controller.abort();
    };
    task.callerSignal?.addEventListener("abort", onTaskCallerAbort, {
      once: true,
    });

    let hasFetchedAny = false;
    let currentIndexPosition = 0;
    let handledTerminalOutcome = false;

    try {
      try {
        if (task.priority === "medium") {
          await delay(prefetchIntervalMs, controller.signal);
        }

        for (
          ;
          currentIndexPosition < task.chapterIndexes.length;
          currentIndexPosition++
        ) {
          const chapterIndex = task.chapterIndexes[currentIndexPosition];

          if (task.priority === "medium" && hasFetchedAny) {
            await delay(prefetchIntervalMs, controller.signal);
          }

          const chapter = await chapterRepository.getChapter(
            task.novelId,
            chapterIndex,
          );
          if (controller.signal.aborted) {
            break;
          }
          if (chapter === null) {
            handleTombstoneDeletion(task.novelId);
            settlePrefetchTask(task);
            handledTerminalOutcome = true;
            break;
          }
          if (isChapterFresh(chapter)) {
            continue;
          }

          const hasExistingCache = chapter.bodyHtml !== null;
          if (task.priority === "medium") {
            hasFetchedAny = true;
          }

          try {
            const outcome = await downloadAndPersistChapter(
              task.novelId,
              chapter,
              controller.signal,
            );
            if (outcome === "tombstone") {
              settlePrefetchTask(task);
              handledTerminalOutcome = true;
              break;
            }
            if (outcome === "aborted") {
              break;
            }
          } catch (err: unknown) {
            if (controller.signal.aborted) {
              break;
            }

            const latestOnErr = await chapterRepository.getChapter(
              task.novelId,
              chapterIndex,
            );
            if (latestOnErr === null) {
              handleTombstoneDeletion(task.novelId);
              settlePrefetchTask(task);
              handledTerminalOutcome = true;
              break;
            }

            if (task.priority === "high") {
              if (hasExistingCache) {
                console.warn(
                  `[CacheScheduler] Stale chapter refresh failed for ${task.novelId}#${chapterIndex}, falling back to existing cache`,
                  err,
                );
              } else {
                rejectPrefetchTask(task, err);
                handledTerminalOutcome = true;
                break;
              }
            } else {
              console.warn(
                `[CacheScheduler] Medium prefetch failed for ${task.novelId}#${chapterIndex}`,
                err,
              );
            }
          }
        }
      } catch {
        // delay() rejects when aborted by preemption or cancellation
      }

      if (!handledTerminalOutcome) {
        if (
          task.priority === "medium" &&
          activeAbortReason === "preempted" &&
          !task.aborted &&
          !disposed &&
          currentIndexPosition < task.chapterIndexes.length
        ) {
          task.chapterIndexes = task.chapterIndexes.slice(currentIndexPosition);
          mediumQueue.unshift(task);
        } else {
          settlePrefetchTask(task);
        }
      }
    } finally {
      task.callerSignal?.removeEventListener("abort", onTaskCallerAbort);
      activePrefetchTask = null;
      activeAbortController = null;
      activeAbortReason = null;
    }
  };

  const runLowStep = async (batch: NovelBatchState): Promise<void> => {
    const chapterIndex = batch.remainingChapterIndexes[0];
    const controller = new AbortController();
    activeLowNovelId = batch.novelId;
    activeAbortController = controller;
    activeAbortReason = null;

    try {
      if (batch.needsDelayBeforeNextFetch) {
        activeLowSleeping = true;
        try {
          await delay(prefetchIntervalMs, controller.signal);
        } catch {
          return;
        } finally {
          activeLowSleeping = false;
        }
        batch.needsDelayBeforeNextFetch = false;
      }

      const chapter = await chapterRepository.getChapter(
        batch.novelId,
        chapterIndex,
      );
      if (controller.signal.aborted) {
        return;
      }
      if (chapter === null) {
        handleTombstoneDeletion(batch.novelId);
        return;
      }

      if (isChapterFresh(chapter)) {
        await queueRepository.deleteByNovelAndChapters(batch.novelId, [
          chapterIndex,
        ]);
        await markChapterCompletedInBatch(batch.novelId, chapterIndex);
        return;
      }

      await queueRepository.updateStatus(
        batch.novelId,
        chapterIndex,
        "downloading",
      );

      if (controller.signal.aborted) {
        await queueRepository.resetInterruptedToPending(batch.novelId);
        return;
      }

      const hasStaleCache = chapter.bodyHtml !== null;

      try {
        const outcome = await downloadAndPersistChapter(
          batch.novelId,
          chapter,
          controller.signal,
        );
        if (outcome === "aborted") {
          await queueRepository.resetInterruptedToPending(batch.novelId);
          return;
        }
        if (outcome === "tombstone") {
          return;
        }
        batch.needsDelayBeforeNextFetch =
          batch.remainingChapterIndexes.length > 0;
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          await queueRepository.resetInterruptedToPending(batch.novelId);
          return;
        }

        const latestOnErr = await chapterRepository.getChapter(
          batch.novelId,
          chapterIndex,
        );
        if (latestOnErr === null) {
          handleTombstoneDeletion(batch.novelId);
          return;
        }

        if (hasStaleCache) {
          await queueRepository.updateStatus(
            batch.novelId,
            chapterIndex,
            "completed",
          );
          batch.failedChapterIndexes.delete(chapterIndex);
        } else {
          const errorMessage = toErrorMessage(err, "通信エラー");
          await queueRepository.updateStatus(
            batch.novelId,
            chapterIndex,
            "failed",
            {
              lastError: errorMessage,
              incrementRetry: true,
            },
          );
          batch.failedChapterIndexes.add(chapterIndex);
        }

        if (controller.signal.aborted) {
          return;
        }
        const idx = batch.remainingChapterIndexes.indexOf(chapterIndex);
        if (idx >= 0) {
          batch.remainingChapterIndexes.splice(idx, 1);
          batch.current = Math.min(batch.total, batch.current + 1);
        }
        batch.needsDelayBeforeNextFetch =
          batch.remainingChapterIndexes.length > 0;
        await finalizeBatchCompletedIfDone(batch);
        emitProgress(batch);
      }
    } finally {
      activeLowNovelId = null;
      activeAbortController = null;
      activeAbortReason = null;
    }
  };

  const pickNextWork = (): WorkUnit | null => {
    if (highQueue.length > 0) {
      return { kind: "prefetch", task: highQueue.shift()! };
    }
    if (mediumQueue.length > 0) {
      return { kind: "prefetch", task: mediumQueue.shift()! };
    }
    if (lowNovelOrder.length > 0) {
      const batch = batches.get(lowNovelOrder[0])!;
      return { kind: "low", batch };
    }
    return null;
  };

  const kickWorker = (): void => {
    if (workerRunning) {
      return;
    }
    workerRunning = true;

    void (async () => {
      try {
        while (!disposed) {
          const next = pickNextWork();
          if (!next) {
            break;
          }

          if (next.kind === "prefetch") {
            syncActiveBatchesStatus(true);
            activeWorkPromise = runPrefetchTask(next.task);
            await activeWorkPromise;
            activeWorkPromise = null;
          } else {
            syncActiveBatchesStatus(false);
            activeWorkPromise = runLowStep(next.batch);
            await activeWorkPromise;
            activeWorkPromise = null;
          }
        }
      } finally {
        activeWorkPromise = null;
        workerRunning = false;
      }
    })();
  };

  const enqueuePrefetch: CacheScheduler["enqueuePrefetch"] = async (
    options,
  ) => {
    const { novelId, chapterIndexes, priority, signal } = options;
    if (disposed || chapterIndexes.length === 0 || signal?.aborted) {
      return;
    }

    return await new Promise<void>((resolve, reject) => {
      let detached = false;
      const task: PrefetchTask = {
        priority,
        novelId,
        chapterIndexes: [...chapterIndexes],
        callerSignal: signal,
        aborted: false,
        detachCallerSignal: () => {
          if (!detached && signal) {
            detached = true;
            signal.removeEventListener("abort", onSignalAbort);
          }
        },
        resolve,
        reject,
      };

      const onSignalAbort = () => {
        task.aborted = true;
        if (activePrefetchTask === task) {
          activeAbortReason = "cancelled";
          activeAbortController?.abort();
          return;
        }
        const targetQueue = priority === "high" ? highQueue : mediumQueue;
        const idx = targetQueue.indexOf(task);
        if (idx >= 0) {
          targetQueue.splice(idx, 1);
          settlePrefetchTask(task);
        }
      };

      signal?.addEventListener("abort", onSignalAbort, { once: true });

      if (priority === "high") {
        highQueue.push(task);
        abortActiveIf(
          "preempted",
          () =>
            activePrefetchTask?.priority === "medium" ||
            activeLowNovelId !== null,
        );
      } else {
        mediumQueue.push(task);
        abortActiveIf("preempted", () => activeLowSleeping);
      }

      syncActiveBatchesStatus(true);
      kickWorker();
    });
  };

  const enqueueBatchCache: CacheScheduler["enqueueBatchCache"] = async (
    novelId,
    chapterIndexes,
  ) => {
    if (disposed) {
      return;
    }
    const currentBatch = batches.get(novelId);
    if (currentBatch?.isBatchCaching) {
      return;
    }

    await queueRepository.resetInterruptedToPending(novelId);
    if (disposed) {
      return;
    }
    const [allChapters, existingQueue] = await Promise.all([
      chapterRepository.listChaptersByNovelId(novelId),
      queueRepository.listByNovelId(novelId),
    ]);
    if (disposed) {
      return;
    }

    const now = Date.now();
    const freshIndexes = allChapters
      .filter((ch) => isChapterFresh(ch, now))
      .map((ch) => ch.chapterIndex);
    if (freshIndexes.length > 0) {
      await queueRepository.deleteByNovelAndChapters(novelId, freshIndexes);
      if (disposed) {
        return;
      }
    }

    const chapterByIndex = new Map<number, ChapterSummary>(
      allChapters.map((ch) => [ch.chapterIndex, ch]),
    );
    const queueByIndex = new Map(
      existingQueue.map((item) => [item.chapterIndex, item]),
    );

    const uniqueSorted = Array.from(new Set(chapterIndexes)).sort(
      (a, b) => a - b,
    );
    const targets = uniqueSorted
      .map((idx) => chapterByIndex.get(idx))
      .filter((ch): ch is ChapterSummary => {
        if (!ch || isChapterFresh(ch, now)) {
          return false;
        }
        const queueItem = queueByIndex.get(ch.chapterIndex);
        return (queueItem?.retryCount ?? 0) < maxRetryCount;
      });

    if (targets.length === 0) {
      const freshSet = new Set(freshIndexes);
      const remainingFailed = existingQueue
        .filter(
          (item) =>
            item.status === "failed" && !freshSet.has(item.chapterIndex),
        )
        .map((item) => item.chapterIndex);

      if (remainingFailed.length === 0) {
        await queueRepository.clearNovelQueue(novelId);
        if (disposed) {
          return;
        }
      }

      const completedBatch: NovelBatchState = {
        novelId,
        total: 0,
        current: 0,
        remainingChapterIndexes: [],
        failedChapterIndexes: new Set(remainingFailed),
        status: "completed",
        isBatchCaching: false,
        pausedReason: "none",
        needsDelayBeforeNextFetch: false,
      };
      batches.set(novelId, completedBatch);
      emitProgress(completedBatch);
      return;
    }

    await queueRepository.enqueueChapters(
      novelId,
      targets.map((ch) => ({
        chapterIndex: ch.chapterIndex,
        targetUrl: ch.url,
      })),
    );
    if (disposed) {
      return;
    }

    const preempted = hasHigherPriorityWork();
    const batch: NovelBatchState = {
      novelId,
      total: targets.length,
      current: 0,
      remainingChapterIndexes: targets.map((ch) => ch.chapterIndex),
      failedChapterIndexes: new Set<number>(),
      status: preempted ? "preempted" : "running",
      isBatchCaching: true,
      pausedReason: preempted ? "preempted" : "none",
      needsDelayBeforeNextFetch: false,
    };

    batches.set(novelId, batch);
    removeFromLowOrder(novelId);
    lowNovelOrder.push(novelId);
    emitProgress(batch);
    kickWorker();
  };

  const pauseNovelTasks: CacheScheduler["pauseNovelTasks"] = async (
    novelId,
  ) => {
    const batch = batches.get(novelId);
    if (batch) {
      batch.remainingChapterIndexes = [];
      removeFromLowOrder(novelId);
      if (batch.isBatchCaching) {
        batch.status = "paused";
        batch.isBatchCaching = false;
        batch.pausedReason = "none";
      }
    }

    if (activeLowNovelId === novelId && activeWorkPromise) {
      abortActiveIf("cancelled", () => activeLowNovelId === novelId);
      await activeWorkPromise;
    }

    await queueRepository.resetInterruptedToPending(novelId);

    if (batch) {
      emitProgress(batch);
    }
  };

  const cancelNovelTasks: CacheScheduler["cancelNovelTasks"] = async (
    novelId,
    options,
  ) => {
    cancelQueuedPrefetches(novelId);

    const batch = batches.get(novelId);
    if (batch) {
      batch.remainingChapterIndexes = [];
      removeFromLowOrder(novelId);
      batch.status = "cancelled";
      batch.isBatchCaching = false;
      batch.pausedReason = "none";
    }

    if (activePrefetchTask && activePrefetchTask.novelId === novelId) {
      activePrefetchTask.aborted = true;
    }

    const isMatchingActive = (): boolean =>
      activeLowNovelId === novelId || activePrefetchTask?.novelId === novelId;

    if (isMatchingActive() && activeWorkPromise) {
      abortActiveIf("cancelled", isMatchingActive);
      await activeWorkPromise;
    }

    const shouldClearQueue = options?.clearQueue !== false;
    if (shouldClearQueue) {
      await queueRepository.clearNovelQueue(novelId);
      batch?.failedChapterIndexes.clear();
    } else {
      await queueRepository.resetInterruptedToPending(novelId);
    }

    if (batch) {
      emitProgress(batch);
    }
  };

  const cancelAllTasks: CacheScheduler["cancelAllTasks"] = async (options) => {
    cancelQueuedPrefetches();
    const batchNovelIds = Array.from(batches.keys());
    for (const batch of batches.values()) {
      batch.remainingChapterIndexes = [];
      batch.status = "cancelled";
      batch.isBatchCaching = false;
      batch.pausedReason = "none";
    }
    lowNovelOrder.length = 0;

    if (activePrefetchTask) {
      activePrefetchTask.aborted = true;
    }

    if (activeWorkPromise) {
      abortActiveIf("cancelled", () => true);
      await activeWorkPromise;
    }

    const shouldClearQueue = options?.clearQueue !== false;
    if (shouldClearQueue) {
      await queueRepository.clearAllQueue();
      for (const batch of batches.values()) {
        batch.failedChapterIndexes.clear();
      }
    } else {
      for (const id of batchNovelIds) {
        await queueRepository.resetInterruptedToPending(id);
      }
    }

    for (const batch of batches.values()) {
      emitProgress(batch);
    }
  };

  const syncNovelProgress: CacheScheduler["syncNovelProgress"] = async (
    novelId,
  ) => {
    const batch = batches.get(novelId);
    if (!batch) {
      return;
    }

    const [allChapters, queueItems] = await Promise.all([
      chapterRepository.listChaptersByNovelId(novelId),
      queueRepository.listByNovelId(novelId),
    ]);

    const now = Date.now();
    const freshIndexes = new Set(
      allChapters
        .filter((ch) => isChapterFresh(ch, now))
        .map((ch) => ch.chapterIndex),
    );
    const queueByIndex = new Map(
      queueItems.map((item) => [item.chapterIndex, item]),
    );

    for (const idx of Array.from(batch.failedChapterIndexes)) {
      if (freshIndexes.has(idx)) {
        batch.failedChapterIndexes.delete(idx);
      }
    }

    if (batch.isBatchCaching) {
      const nextRemaining = batch.remainingChapterIndexes.filter(
        (idx) => !freshIndexes.has(idx) && queueByIndex.has(idx),
      );
      const removedCount =
        batch.remainingChapterIndexes.length - nextRemaining.length;
      batch.remainingChapterIndexes = nextRemaining;
      if (removedCount > 0) {
        batch.current = Math.min(batch.total, batch.current + removedCount);
      }
      await finalizeBatchCompletedIfDone(batch);
    } else if (batch.status === "paused") {
      const activeQueueCount = queueItems.filter(
        (item) =>
          item.status !== "failed" && !freshIndexes.has(item.chapterIndex),
      ).length;
      const failedCount = batch.failedChapterIndexes.size;
      batch.current = Math.max(
        batch.current,
        Math.min(batch.total, batch.total - activeQueueCount - failedCount),
      );
      if (activeQueueCount === 0 && failedCount === 0) {
        batch.status = "completed";
        await clearCompletedQueueRows(novelId);
      }
    }

    emitProgress(batch);
  };

  const isNovelBatchCaching: CacheScheduler["isNovelBatchCaching"] = (
    novelId,
  ) => {
    const batch = batches.get(novelId);
    return batch?.isBatchCaching === true;
  };

  const getNovelProgress: CacheScheduler["getNovelProgress"] = (novelId) => {
    const batch = batches.get(novelId);
    return batch ? toProgressSnapshot(batch) : null;
  };

  const subscribeProgress: CacheScheduler["subscribeProgress"] = (
    novelId,
    listener,
  ) => {
    let set = listenersByNovel.get(novelId);
    if (!set) {
      set = new Set();
      listenersByNovel.set(novelId, set);
    }
    set.add(listener);
    return () => {
      const existing = listenersByNovel.get(novelId);
      if (!existing) {
        return;
      }
      existing.delete(listener);
      if (existing.size === 0) {
        listenersByNovel.delete(novelId);
      }
    };
  };

  const dispose: CacheScheduler["dispose"] = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    cancelQueuedPrefetches();
    for (const batch of batches.values()) {
      batch.remainingChapterIndexes = [];
      batch.isBatchCaching = false;
    }
    lowNovelOrder.length = 0;
    if (activePrefetchTask) {
      activePrefetchTask.aborted = true;
    }
    abortActiveIf("cancelled", () => true);
    listenersByNovel.clear();
  };

  return {
    enqueuePrefetch,
    enqueueBatchCache,
    pauseNovelTasks,
    cancelNovelTasks,
    cancelAllTasks,
    isNovelBatchCaching,
    getNovelProgress,
    subscribeProgress,
    syncNovelProgress,
    dispose,
  };
}

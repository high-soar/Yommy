import type { CacheScheduler, CacheSchedulerDeps } from "../types";

export const DEFAULT_MAX_RETRY_COUNT = 3;

export function createCacheScheduler(
  _deps: CacheSchedulerDeps,
): CacheScheduler {
  void _deps;
  return {
    async enqueuePrefetch() {
      throw new Error("Not implemented");
    },
    async enqueueBatchCache() {
      throw new Error("Not implemented");
    },
    async pauseNovelTasks() {
      throw new Error("Not implemented");
    },
    async cancelNovelTasks() {
      throw new Error("Not implemented");
    },
    async cancelAllTasks() {
      throw new Error("Not implemented");
    },
    isNovelBatchCaching() {
      return false;
    },
    getNovelProgress() {
      return null;
    },
    subscribeProgress() {
      return () => {};
    },
    async syncNovelProgress() {
      throw new Error("Not implemented");
    },
    dispose() {},
  };
}

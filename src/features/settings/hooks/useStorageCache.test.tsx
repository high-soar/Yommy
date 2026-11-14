import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ServiceContext,
  ServiceContextValue,
} from "../../../app/ServiceProvider";
import {
  ChapterRepository,
  NovelRepository,
  QueueRepository,
  SettingsRepository,
  AppSettingsRepository,
} from "../../../storage/types";
import { DatabaseAdapter } from "../../../storage/adapter/types";
import { HttpClientBridge } from "../../../bridges/http/types";
import { ParserRegistry } from "../../../parsers/parserRegistry";
import { MockAppBridge } from "../../../bridges/app";
import { MockCloudSyncBridge } from "../../../bridges/cloud-sync/mockCloudSyncBridge";
import { MockVolumeKeyBridge } from "../../../bridges/volume-key/mockVolumeKeyBridge";
import { MockWebViewDomBridge } from "../../../bridges/webview/mockWebViewDomBridge";
import type {
  PullMergeResult,
  SyncEngine,
} from "../../cloud-sync/services/syncEngine";
import type { CacheScheduler } from "../../cache/types";
import { useStorageCache } from "./useStorageCache";

function createMockServices(
  overrides?: Partial<ServiceContextValue> & {
    chapterRepoOverrides?: Partial<ChapterRepository>;
  },
): ServiceContextValue {
  const defaultChapterRepo: ChapterRepository = {
    listChaptersByNovelId: vi.fn(async () => []),
    getChapter: vi.fn(async () => null),
    saveChapterBody: vi.fn(async () => undefined),
    markChapterRead: vi.fn(async () => undefined),
    deleteCachedBodies: vi.fn(async () => 0),
    deleteAllCachedBodies: vi.fn(async () => 5),
    getStorageCacheSummary: vi.fn(async () => ({
      totalCachedChapters: 12,
      totalByteSize: 1048576,
    })),
    ...overrides?.chapterRepoOverrides,
  };

  return {
    httpClient: {} as HttpClientBridge,
    parserRegistry: {} as ParserRegistry,
    novelRepository: {} as NovelRepository,
    chapterRepository: defaultChapterRepo,
    queueRepository: (overrides?.queueRepository ?? {}) as QueueRepository,
    settingsRepository: {} as SettingsRepository,
    appSettingsRepository: {} as AppSettingsRepository,
    databaseAdapter: {} as DatabaseAdapter,
    appBridge: new MockAppBridge(),
    cloudSyncBridge: new MockCloudSyncBridge(),
    volumeKeyBridge: new MockVolumeKeyBridge(),
    webViewDomBridge: new MockWebViewDomBridge(),
    isReady: true,
    error: null,
    ...overrides,
  };
}

describe("useStorageCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("初期化時に chapterRepository.getStorageCacheSummary を呼び出してサマリーを取得すること (AC-ST-14)", async () => {
    const services = createMockServices({
      chapterRepoOverrides: {
        getStorageCacheSummary: vi.fn(async () => ({
          totalCachedChapters: 8,
          totalByteSize: 204800,
        })),
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    );

    const { result } = renderHook(() => useStorageCache(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary).toEqual({
      totalCachedChapters: 8,
      totalByteSize: 204800,
    });
    expect(
      services.chapterRepository.getStorageCacheSummary,
    ).toHaveBeenCalledTimes(1);
    expect(result.current.isClearing).toBe(false);
    expect(result.current.notice).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("isReady が false のときはサマリー取得を行わないこと", async () => {
    const services = createMockServices({
      isReady: false,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    );

    const { result } = renderHook(() => useStorageCache(), { wrapper });

    expect(
      services.chapterRepository.getStorageCacheSummary,
    ).not.toHaveBeenCalled();
    expect(result.current.summary).toEqual({
      totalCachedChapters: 0,
      totalByteSize: 0,
    });
  });

  it("getStorageCacheSummary が例外をスローした場合、前回のサマリーを維持し error を設定すること (R1-02)", async () => {
    let shouldFail = false;
    const services = createMockServices({
      chapterRepoOverrides: {
        getStorageCacheSummary: vi.fn(async () => {
          if (shouldFail) {
            throw new Error("DB 読み込みエラー");
          }
          return { totalCachedChapters: 5, totalByteSize: 5000 };
        }),
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    );

    const { result } = renderHook(() => useStorageCache(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.summary).toEqual({
      totalCachedChapters: 5,
      totalByteSize: 5000,
    });
    expect(result.current.error).toBeNull();

    // 再取得で失敗させる
    shouldFail = true;
    await act(async () => {
      await expect(result.current.refreshSummary()).rejects.toThrow(
        "DB 読み込みエラー",
      );
    });

    // R1-02: 取得失敗時も前回のサマリーを維持（0 B にリセットしない）
    expect(result.current.summary).toEqual({
      totalCachedChapters: 5,
      totalByteSize: 5000,
    });
    expect(result.current.error).toBe("DB 読み込みエラー");

    // 再取得成功でエラーが消去されること (R1-02)
    shouldFail = false;
    await act(async () => {
      await result.current.refreshSummary();
    });
    expect(result.current.error).toBeNull();
  });

  it("chapterRepository 自体が null の場合も安全にフォールバックすること", async () => {
    const services = createMockServices({
      chapterRepository: null as unknown as ChapterRepository,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    );

    const { result } = renderHook(() => useStorageCache(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary).toEqual({
      totalCachedChapters: 0,
      totalByteSize: 0,
    });
  });

  it("getStorageCacheSummary が例外をスローした場合、安全にフォールバックし error を設定すること", async () => {
    const services = createMockServices({
      chapterRepoOverrides: {
        getStorageCacheSummary: vi.fn(async () => {
          throw new Error("DB 読み込みエラー");
        }),
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    );

    const { result } = renderHook(() => useStorageCache(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary).toEqual({
      totalCachedChapters: 0,
      totalByteSize: 0,
    });
    expect(result.current.error).toBe("DB 読み込みエラー");
  });

  it("getStorageCacheSummary が Error 以外の例外をスローした場合、既定メッセージを設定すること", async () => {
    const services = createMockServices({
      chapterRepoOverrides: {
        getStorageCacheSummary: vi.fn(async () => {
          throw "不明なエラー";
        }),
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    );

    const { result } = renderHook(() => useStorageCache(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary).toEqual({
      totalCachedChapters: 0,
      totalByteSize: 0,
    });
    expect(result.current.error).toBe("キャッシュ情報の取得に失敗しました");
  });

  it("clearCache({ onlyRead: true }) で既読話キャッシュのみ削除し、再集計と通知が更新されること (AC-ST-15, AC-ST-16)", async () => {
    let summaryState = { totalCachedChapters: 10, totalByteSize: 500000 };
    const deleteAllCachedBodiesMock = vi.fn(
      async (options?: { onlyRead?: boolean }) => {
        expect(options?.onlyRead).toBe(true);
        summaryState = { totalCachedChapters: 6, totalByteSize: 300000 };
        return 4;
      },
    );

    const services = createMockServices({
      chapterRepoOverrides: {
        getStorageCacheSummary: vi.fn(async () => summaryState),
        deleteAllCachedBodies: deleteAllCachedBodiesMock,
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    );

    const { result } = renderHook(() => useStorageCache(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.summary.totalCachedChapters).toBe(10);

    let deletedCount = 0;
    await act(async () => {
      deletedCount = await result.current.clearCache({ onlyRead: true });
    });

    expect(deletedCount).toBe(4);
    expect(deleteAllCachedBodiesMock).toHaveBeenCalledWith({ onlyRead: true });
    expect(result.current.summary).toEqual({
      totalCachedChapters: 6,
      totalByteSize: 300000,
    });
    expect(result.current.notice).toBe(
      "本文キャッシュを一括削除しました（4話）",
    );
    expect(result.current.isClearing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("clearCache({ onlyRead: false }) ですべての本文キャッシュを削除すること (AC-ST-15, AC-ST-16)", async () => {
    let summaryState = { totalCachedChapters: 10, totalByteSize: 500000 };
    const deleteAllCachedBodiesMock = vi.fn(
      async (options?: { onlyRead?: boolean }) => {
        expect(options?.onlyRead).toBe(false);
        summaryState = { totalCachedChapters: 0, totalByteSize: 0 };
        return 10;
      },
    );

    const services = createMockServices({
      chapterRepoOverrides: {
        getStorageCacheSummary: vi.fn(async () => summaryState),
        deleteAllCachedBodies: deleteAllCachedBodiesMock,
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    );

    const { result } = renderHook(() => useStorageCache(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let deletedCount = 0;
    await act(async () => {
      deletedCount = await result.current.clearCache({ onlyRead: false });
    });

    expect(deletedCount).toBe(10);
    expect(deleteAllCachedBodiesMock).toHaveBeenCalledWith({ onlyRead: false });
    expect(result.current.summary).toEqual({
      totalCachedChapters: 0,
      totalByteSize: 0,
    });
    expect(result.current.notice).toBe(
      "本文キャッシュを一括削除しました（10話）",
    );
    expect(result.current.isClearing).toBe(false);
  });

  it("clearCache 内で refreshSummary が失敗した場合、完了通知を設定せず error を設定すること (R1-02)", async () => {
    let callCount = 0;
    const services = createMockServices({
      chapterRepoOverrides: {
        deleteAllCachedBodies: vi.fn(async () => 3),
        getStorageCacheSummary: vi.fn(async () => {
          callCount++;
          if (callCount > 1) {
            throw new Error("再集計エラー");
          }
          return { totalCachedChapters: 3, totalByteSize: 3000 };
        }),
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    );

    const { result } = renderHook(() => useStorageCache(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(
        result.current.clearCache({ onlyRead: false }),
      ).rejects.toThrow("再集計エラー");
    });

    // R1-02: 再取得失敗時は成功通知を設定せず、エラーを設定
    expect(result.current.notice).toBeNull();
    expect(result.current.error).toBe("再集計エラー");
    expect(result.current.isClearing).toBe(false);
  });

  it("アンマウント後に clearCache が完了しても state 更新を行わないこと (R1-21)", async () => {
    let resolveDelete!: (count: number) => void;
    const services = createMockServices({
      chapterRepoOverrides: {
        deleteAllCachedBodies: vi.fn(
          () =>
            new Promise<number>((resolve) => {
              resolveDelete = resolve;
            }),
        ),
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    );

    const { result, unmount } = renderHook(() => useStorageCache(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let clearPromise: Promise<number> | undefined;
    act(() => {
      clearPromise = result.current.clearCache({ onlyRead: false });
    });

    unmount();

    await act(async () => {
      resolveDelete(5);
      await clearPromise;
    });
  });

  it("chapterRepository 自体が null の状態で clearCache を呼び出した場合もエラーをスローすること", async () => {
    const services = createMockServices({
      chapterRepository: null as unknown as ChapterRepository,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    );

    const { result } = renderHook(() => useStorageCache(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(
        result.current.clearCache({ onlyRead: true }),
      ).rejects.toThrow("キャッシュ削除機能が利用できません");
    });

    expect(result.current.error).toBe("キャッシュ削除機能が利用できません");
    expect(result.current.isClearing).toBe(false);
  });

  it("deleteAllCachedBodies が例外をスローした場合は error を設定し isClearing を false に戻すこと", async () => {
    const services = createMockServices({
      chapterRepoOverrides: {
        deleteAllCachedBodies: vi.fn(async () => {
          throw new Error("削除トランザクション失敗");
        }),
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    );

    const { result } = renderHook(() => useStorageCache(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(
        result.current.clearCache({ onlyRead: false }),
      ).rejects.toThrow("削除トランザクション失敗");
    });

    expect(result.current.error).toBe("削除トランザクション失敗");
    expect(result.current.isClearing).toBe(false);
    expect(result.current.notice).toBeNull();
  });

  it("deleteAllCachedBodies で文字列以外の例外がスローされた場合、既定のエラーメッセージを設定すること", async () => {
    const services = createMockServices({
      chapterRepoOverrides: {
        deleteAllCachedBodies: vi.fn(async () => {
          throw "不明なエラー";
        }),
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    );

    const { result } = renderHook(() => useStorageCache(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.clearCache({ onlyRead: false })).rejects.toBe(
        "不明なエラー",
      );
    });

    expect(result.current.error).toBe("キャッシュの削除に失敗しました");
    expect(result.current.isClearing).toBe(false);
  });

  it("refreshSummary を手動で呼び出したときに最新のサマリーに更新されること", async () => {
    let count = 5;
    const services = createMockServices({
      chapterRepoOverrides: {
        getStorageCacheSummary: vi.fn(async () => ({
          totalCachedChapters: count,
          totalByteSize: count * 1000,
        })),
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    );

    const { result } = renderHook(() => useStorageCache(), { wrapper });

    await waitFor(() => {
      expect(result.current.summary.totalCachedChapters).toBe(5);
    });

    count = 15;
    await act(async () => {
      await result.current.refreshSummary();
    });

    expect(result.current.summary.totalCachedChapters).toBe(15);
  });

  it("アンマウント後に clearCache を呼び出した場合、早期リターンして 0 を返すこと", async () => {
    const services = createMockServices();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    );

    const { result, unmount } = renderHook(() => useStorageCache(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    unmount();

    let deleted = -1;
    await act(async () => {
      deleted = await result.current.clearCache({ onlyRead: false });
    });

    expect(deleted).toBe(0);
  });

  it("clearCache 実行中に再度呼び出された場合、早期リターンして多重実行が防止されること (R1-35)", async () => {
    let resolveDelete: () => void = () => {};
    const deletePromise = new Promise<number>((resolve) => {
      resolveDelete = () => resolve(5);
    });
    const deleteAllCachedBodiesMock = vi.fn().mockReturnValue(deletePromise);
    const services = createMockServices({
      chapterRepoOverrides: {
        deleteAllCachedBodies: deleteAllCachedBodiesMock,
      },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    );

    const { result } = renderHook(() => useStorageCache(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // 1回目実行（未完了）
    let promise1: Promise<number>;
    act(() => {
      promise1 = result.current.clearCache({ onlyRead: false });
    });

    // 2回目実行（排他ガードにより早期リターン）
    let promise2: Promise<number>;
    act(() => {
      promise2 = result.current.clearCache({ onlyRead: false });
    });

    const result2 = await promise2!;
    expect(result2).toBe(0);
    expect(deleteAllCachedBodiesMock).toHaveBeenCalledTimes(1);

    // 1回目を完了させる
    await act(async () => {
      resolveDelete();
      await promise1!;
    });
    expect(deleteAllCachedBodiesMock).toHaveBeenCalledTimes(1);
  });

  describe("サイレント再取得とバックグラウンドPull購読 (R1-23)", () => {
    it("refreshSummary({ silent: true }) は isLoading を true にせず、エラー時も error を上書きしないこと", async () => {
      let resolveSecondCall!: (val: {
        totalCachedChapters: number;
        totalByteSize: number;
      }) => void;
      let callCount = 0;

      const services = createMockServices({
        chapterRepoOverrides: {
          getStorageCacheSummary: vi.fn(() => {
            callCount += 1;
            if (callCount === 1) {
              return Promise.resolve({
                totalCachedChapters: 3,
                totalByteSize: 3000,
              });
            }
            if (callCount === 2) {
              return new Promise<{
                totalCachedChapters: number;
                totalByteSize: number;
              }>((resolve) => {
                resolveSecondCall = resolve;
              });
            }
            return Promise.reject(new Error("サイレント取得失敗"));
          }),
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ServiceContext.Provider value={services}>
          {children}
        </ServiceContext.Provider>
      );

      const observedLoadingAfterReady: boolean[] = [];
      const { result } = renderHook(
        () => {
          const hookResult = useStorageCache();
          if (callCount >= 2) {
            observedLoadingAfterReady.push(hookResult.isLoading);
          }
          return hookResult;
        },
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.summary.totalCachedChapters).toBe(3);
      });

      let silentPromise!: Promise<void>;
      act(() => {
        silentPromise = result.current.refreshSummary({ silent: true });
      });

      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        resolveSecondCall({ totalCachedChapters: 9, totalByteSize: 9000 });
        await silentPromise;
      });

      expect(observedLoadingAfterReady).not.toContain(true);
      expect(result.current.summary).toEqual({
        totalCachedChapters: 9,
        totalByteSize: 9000,
      });

      // silent: true でエラーが発生しても hook の error は設定されず既存サマリーが維持されること
      await act(async () => {
        await expect(
          result.current.refreshSummary({ silent: true }),
        ).rejects.toThrow("サイレント取得失敗");
      });
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.summary).toEqual({
        totalCachedChapters: 9,
        totalByteSize: 9000,
      });
    });

    it("subscribePullCompleted で pulled: true を受信したときサイレントに再集計し、アンマウント時に購読解除されること", async () => {
      let summaryCount = 2;
      let listener: ((result: PullMergeResult) => void) | null = null;
      const unsubscribeMock = vi.fn();
      const subscribePullCompletedMock = vi.fn(
        (cb: (result: PullMergeResult) => void) => {
          listener = cb;
          return unsubscribeMock;
        },
      );

      const getSummaryMock = vi.fn(async () => ({
        totalCachedChapters: summaryCount,
        totalByteSize: summaryCount * 1024,
      }));

      const services = createMockServices({
        chapterRepoOverrides: {
          getStorageCacheSummary: getSummaryMock,
        },
        syncEngine: {
          subscribePullCompleted: subscribePullCompletedMock,
        } as unknown as SyncEngine,
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ServiceContext.Provider value={services}>
          {children}
        </ServiceContext.Provider>
      );

      const { result, unmount } = renderHook(() => useStorageCache(), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.summary.totalCachedChapters).toBe(2);
      });
      expect(subscribePullCompletedMock).toHaveBeenCalledTimes(1);

      // pulled: false では再集計しない
      summaryCount = 10;
      await act(async () => {
        listener?.({ pulled: false, mergedNovels: 0 });
      });
      expect(getSummaryMock).toHaveBeenCalledTimes(1);
      expect(result.current.summary.totalCachedChapters).toBe(2);

      // pulled: true でサイレント再集計する
      await act(async () => {
        listener?.({ pulled: true, mergedNovels: 1 });
      });
      await waitFor(() => {
        expect(result.current.summary.totalCachedChapters).toBe(10);
      });
      expect(result.current.isLoading).toBe(false);

      // サイレント再集計が失敗しても error をセットせず unhandled rejection を起こさない
      getSummaryMock.mockRejectedValueOnce(
        new Error("バックグラウンド取得失敗"),
      );
      await act(async () => {
        listener?.({ pulled: true, mergedNovels: 1 });
      });
      expect(result.current.error).toBeNull();

      unmount();
      expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("CacheScheduler 連携による削除前停止制御 (Issue #344)", () => {
    const createMockCacheScheduler = (): CacheScheduler => ({
      enqueuePrefetch: vi.fn().mockResolvedValue(undefined),
      enqueueBatchCache: vi.fn().mockResolvedValue(undefined),
      pauseNovelTasks: vi.fn().mockResolvedValue(undefined),
      cancelNovelTasks: vi.fn().mockResolvedValue(undefined),
      cancelAllTasks: vi.fn().mockResolvedValue(undefined),
      syncNovelProgress: vi.fn().mockResolvedValue(null),
      getNovelProgress: vi.fn().mockReturnValue(null),
      isNovelBatchCaching: vi.fn().mockReturnValue(false),
      subscribeProgress: vi.fn().mockReturnValue(() => {}),
      dispose: vi.fn(),
    });

    it("onlyRead: false 時は deleteAllCachedBodies より前に cancelAllTasks({ clearQueue: true }) を待機実行すること", async () => {
      const callOrder: string[] = [];
      const mockScheduler = createMockCacheScheduler();
      vi.mocked(mockScheduler.cancelAllTasks).mockImplementation(async () => {
        callOrder.push("cancelAllTasks");
      });
      const deleteMock = vi.fn(async () => {
        callOrder.push("deleteAllCachedBodies");
        return 7;
      });

      const services = createMockServices({
        cacheScheduler: mockScheduler,
        chapterRepoOverrides: {
          deleteAllCachedBodies: deleteMock,
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ServiceContext.Provider value={services}>
          {children}
        </ServiceContext.Provider>
      );

      const { result } = renderHook(() => useStorageCache(), { wrapper });
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let deleted = 0;
      await act(async () => {
        deleted = await result.current.clearCache({ onlyRead: false });
      });

      expect(deleted).toBe(7);
      expect(mockScheduler.cancelAllTasks).toHaveBeenCalledWith({
        clearQueue: true,
      });
      expect(callOrder).toEqual(["cancelAllTasks", "deleteAllCachedBodies"]);
    });

    it("onlyRead: true 時は cancelAllTasks({ clearQueue: false }) を実行してから deleteAllCachedBodies を呼ぶこと", async () => {
      const mockScheduler = createMockCacheScheduler();
      const deleteMock = vi.fn(async () => 3);

      const services = createMockServices({
        cacheScheduler: mockScheduler,
        chapterRepoOverrides: {
          deleteAllCachedBodies: deleteMock,
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ServiceContext.Provider value={services}>
          {children}
        </ServiceContext.Provider>
      );

      const { result } = renderHook(() => useStorageCache(), { wrapper });
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let deleted = 0;
      await act(async () => {
        deleted = await result.current.clearCache({ onlyRead: true });
      });

      expect(deleted).toBe(3);
      expect(mockScheduler.cancelAllTasks).toHaveBeenCalledWith({
        clearQueue: false,
      });
      expect(deleteMock).toHaveBeenCalledWith({ onlyRead: true });
    });

    it("cancelAllTasks の完了待機中にアンマウントされた場合、deleteAllCachedBodies を呼ばず 0 を返して安全終了すること", async () => {
      const gate: { resolve: (() => void) | null } = { resolve: null };
      const mockScheduler = createMockCacheScheduler();
      vi.mocked(mockScheduler.cancelAllTasks).mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            gate.resolve = resolve;
          }),
      );
      const deleteMock = vi.fn(async () => 5);

      const services = createMockServices({
        cacheScheduler: mockScheduler,
        chapterRepoOverrides: {
          deleteAllCachedBodies: deleteMock,
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ServiceContext.Provider value={services}>
          {children}
        </ServiceContext.Provider>
      );

      const { result, unmount } = renderHook(() => useStorageCache(), {
        wrapper,
      });
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let clearPromise: Promise<number> | null = null;
      act(() => {
        clearPromise = result.current.clearCache({ onlyRead: false });
      });

      unmount();

      let deleted = -1;
      await act(async () => {
        gate.resolve?.();
        deleted = await clearPromise!;
      });

      expect(deleted).toBe(0);
      expect(deleteMock).not.toHaveBeenCalled();
    });
  });
});

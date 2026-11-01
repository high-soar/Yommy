import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ServiceContext,
  ServiceContextValue,
} from "../../../app/ServiceProvider";
import {
  ChapterRepository,
  NovelRepository,
  SettingsRepository,
  AppSettingsRepository,
} from "../../../storage/types";
import { DatabaseAdapter } from "../../../storage/adapter/types";
import { HttpClientBridge } from "../../../bridges/http/types";
import { ParserRegistry } from "../../../parsers/parserRegistry";
import { MockAppBridge } from "../../../bridges/app";
import { MockCloudSyncBridge } from "../../../bridges/cloud-sync/mockCloudSyncBridge";
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
    settingsRepository: {} as SettingsRepository,
    appSettingsRepository: {} as AppSettingsRepository,
    databaseAdapter: {} as DatabaseAdapter,
    appBridge: new MockAppBridge(),
    cloudSyncBridge: new MockCloudSyncBridge(),
    isReady: true,
    error: null,
    ...overrides,
  };
}

describe("useStorageCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("chapterRepository または getStorageCacheSummary が未定義の場合は安全にフォールバックすること", async () => {
    const services = createMockServices({
      chapterRepoOverrides: {
        getStorageCacheSummary: undefined,
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

  it("deleteAllCachedBodies が未定義の場合はエラーをセットして例外をスローすること", async () => {
    const services = createMockServices({
      chapterRepoOverrides: {
        deleteAllCachedBodies: undefined,
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
        result.current.clearCache({ onlyRead: true }),
      ).rejects.toThrow("キャッシュ削除機能が利用できません");
    });

    expect(result.current.error).toBe("キャッシュ削除機能が利用できません");
    expect(result.current.isClearing).toBe(false);
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
});

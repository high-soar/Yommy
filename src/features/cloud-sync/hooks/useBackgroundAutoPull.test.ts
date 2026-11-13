import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ServiceProvider } from "../../../app/ServiceProvider";
import type { CloudSyncBridge } from "../../../bridges/cloud-sync/types";
import type { SyncEngine } from "../services/syncEngine";
import {
  useBackgroundAutoPull,
  BACKGROUND_SYNC_THRESHOLD_MS,
} from "./useBackgroundAutoPull";

function setVisibilityState(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    writable: true,
    configurable: true,
  });
}

describe("useBackgroundAutoPull", () => {
  const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(
    document,
    "visibilityState",
  );

  beforeEach(() => {
    vi.clearAllMocks();
    setVisibilityState("visible");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalVisibilityDescriptor) {
      Object.defineProperty(
        document,
        "visibilityState",
        originalVisibilityDescriptor,
      );
    }
  });

  const createWrapper =
    (services?: React.ComponentProps<typeof ServiceProvider>["services"]) =>
    ({ children }: { children: React.ReactNode }) =>
      React.createElement(ServiceProvider, { services }, children);

  const createConnectedBridge = (): CloudSyncBridge => ({
    getAuthState: vi.fn().mockResolvedValue({
      status: "connected",
      email: "reader@example.com",
    }),
    signIn: vi.fn(),
    signOut: vi.fn(),
    pullFile: vi.fn(),
    pushFile: vi.fn(),
  });

  it("定数 BACKGROUND_SYNC_THRESHOLD_MS が 5分（300,000ms）であること", () => {
    expect(BACKGROUND_SYNC_THRESHOLD_MS).toBe(5 * 60 * 1000);
  });

  it("hidden から5分以上経過後に visible 復帰したとき、連携済みなら pullAndMerge が実行されること (AC-BS-13, AC-RD-32, AC-ND-28)", async () => {
    const mockSyncEngine = {
      pullAndMerge: vi
        .fn()
        .mockResolvedValue({ pulled: true, mergedNovels: 1 }),
    } as unknown as SyncEngine;
    const bridge = createConnectedBridge();

    renderHook(() => useBackgroundAutoPull(), {
      wrapper: createWrapper({
        syncEngine: mockSyncEngine,
        cloudSyncBridge: bridge,
      }),
    });

    const baseTime = 1_700_000_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(baseTime);

    act(() => {
      setVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    nowSpy.mockReturnValue(baseTime + BACKGROUND_SYNC_THRESHOLD_MS);
    act(() => {
      setVisibilityState("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(mockSyncEngine.pullAndMerge).toHaveBeenCalledTimes(1);
    });
  });

  it("hidden から5分未満で visible 復帰した場合は pullAndMerge が実行されないこと", () => {
    const mockSyncEngine = {
      pullAndMerge: vi
        .fn()
        .mockResolvedValue({ pulled: true, mergedNovels: 0 }),
    } as unknown as SyncEngine;
    const bridge = createConnectedBridge();

    renderHook(() => useBackgroundAutoPull(), {
      wrapper: createWrapper({
        syncEngine: mockSyncEngine,
        cloudSyncBridge: bridge,
      }),
    });

    const baseTime = 1_700_000_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(baseTime);

    act(() => {
      setVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    nowSpy.mockReturnValue(baseTime + BACKGROUND_SYNC_THRESHOLD_MS - 1);
    act(() => {
      setVisibilityState("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(mockSyncEngine.pullAndMerge).not.toHaveBeenCalled();
  });

  it("hidden を経由せず visible のみ発火した場合、および hidden/visible 以外の状態では pullAndMerge が呼ばれないこと", () => {
    const mockSyncEngine = {
      pullAndMerge: vi
        .fn()
        .mockResolvedValue({ pulled: true, mergedNovels: 0 }),
    } as unknown as SyncEngine;
    const bridge = createConnectedBridge();

    renderHook(() => useBackgroundAutoPull(), {
      wrapper: createWrapper({
        syncEngine: mockSyncEngine,
        cloudSyncBridge: bridge,
      }),
    });

    act(() => {
      setVisibilityState("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    act(() => {
      setVisibilityState("prerender" as DocumentVisibilityState);
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(mockSyncEngine.pullAndMerge).not.toHaveBeenCalled();
  });

  it("未連携（unlinked）状態の場合は5分以上経過しても pullAndMerge が実行されないこと", async () => {
    const mockSyncEngine = {
      pullAndMerge: vi
        .fn()
        .mockResolvedValue({ pulled: false, mergedNovels: 0 }),
    } as unknown as SyncEngine;
    const unlinkedBridge: CloudSyncBridge = {
      getAuthState: vi
        .fn()
        .mockResolvedValue({ status: "unlinked", email: null }),
      signIn: vi.fn(),
      signOut: vi.fn(),
      pullFile: vi.fn(),
      pushFile: vi.fn(),
    };

    renderHook(() => useBackgroundAutoPull(), {
      wrapper: createWrapper({
        syncEngine: mockSyncEngine,
        cloudSyncBridge: unlinkedBridge,
      }),
    });

    const baseTime = 1_700_000_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(baseTime);

    act(() => {
      setVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    nowSpy.mockReturnValue(baseTime + BACKGROUND_SYNC_THRESHOLD_MS + 1000);
    act(() => {
      setVisibilityState("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(unlinkedBridge.getAuthState).toHaveBeenCalledTimes(1);
    });
    expect(mockSyncEngine.pullAndMerge).not.toHaveBeenCalled();
  });

  it("pullAndMerge 実行中の多重起動を防ぎ、失敗してもクラッシュせず次回復帰で再実行できること", async () => {
    let rejectFirst: ((err: Error) => void) | null = null;
    const mockSyncEngine = {
      pullAndMerge: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              rejectFirst = reject;
            }),
        )
        .mockResolvedValueOnce({ pulled: true, mergedNovels: 2 }),
    } as unknown as SyncEngine;
    const bridge = createConnectedBridge();

    renderHook(() => useBackgroundAutoPull(), {
      wrapper: createWrapper({
        syncEngine: mockSyncEngine,
        cloudSyncBridge: bridge,
      }),
    });

    const baseTime = 1_700_000_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(baseTime);

    // 1回目復帰
    act(() => {
      setVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    nowSpy.mockReturnValue(baseTime + BACKGROUND_SYNC_THRESHOLD_MS);
    act(() => {
      setVisibilityState("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(mockSyncEngine.pullAndMerge).toHaveBeenCalledTimes(1);
    });

    // 実行中に再度 hidden -> 5分経過 visible になっても多重起動しない
    nowSpy.mockReturnValue(baseTime + BACKGROUND_SYNC_THRESHOLD_MS + 1000);
    act(() => {
      setVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    nowSpy.mockReturnValue(baseTime + 2 * BACKGROUND_SYNC_THRESHOLD_MS + 1000);
    act(() => {
      setVisibilityState("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(mockSyncEngine.pullAndMerge).toHaveBeenCalledTimes(1);

    // 1回目がエラーで終了してもクラッシュせず isPullingRef が解放される
    await act(async () => {
      rejectFirst?.(new Error("Network error"));
      await Promise.resolve();
    });

    // 次回復帰時は再実行できる
    nowSpy.mockReturnValue(baseTime + 2 * BACKGROUND_SYNC_THRESHOLD_MS + 2000);
    act(() => {
      setVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    nowSpy.mockReturnValue(baseTime + 3 * BACKGROUND_SYNC_THRESHOLD_MS + 2000);
    act(() => {
      setVisibilityState("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(mockSyncEngine.pullAndMerge).toHaveBeenCalledTimes(2);
    });
  });

  it("cloudSyncBridge が未提供でも syncEngine があれば pullAndMerge を実行し、syncEngine 未提供時は安全にスキップすること", async () => {
    const mockSyncEngine = {
      pullAndMerge: vi
        .fn()
        .mockResolvedValue({ pulled: true, mergedNovels: 0 }),
    } as unknown as SyncEngine;

    const { unmount } = renderHook(() => useBackgroundAutoPull(), {
      wrapper: createWrapper({
        syncEngine: mockSyncEngine,
        cloudSyncBridge: null as unknown as CloudSyncBridge,
      }),
    });

    const baseTime = 1_700_000_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(baseTime);

    act(() => {
      setVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    nowSpy.mockReturnValue(baseTime + BACKGROUND_SYNC_THRESHOLD_MS);
    act(() => {
      setVisibilityState("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(mockSyncEngine.pullAndMerge).toHaveBeenCalledTimes(1);
    });

    // アンマウント後はイベントを解除していること
    unmount();
    nowSpy.mockReturnValue(baseTime + 2 * BACKGROUND_SYNC_THRESHOLD_MS);
    act(() => {
      setVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    nowSpy.mockReturnValue(baseTime + 3 * BACKGROUND_SYNC_THRESHOLD_MS);
    act(() => {
      setVisibilityState("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(mockSyncEngine.pullAndMerge).toHaveBeenCalledTimes(1);

    // syncEngine 未提供時も安全にスキップされること
    renderHook(() => useBackgroundAutoPull(), {
      wrapper: createWrapper({
        syncEngine: null as unknown as SyncEngine,
      }),
    });
    act(() => {
      setVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    nowSpy.mockReturnValue(baseTime + 4 * BACKGROUND_SYNC_THRESHOLD_MS);
    act(() => {
      setVisibilityState("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
  });
});

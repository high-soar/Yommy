import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ServiceContext,
  ServiceContextValue,
} from "../../../app/ServiceProvider";
import {
  NovelRepository,
  ChapterRepository,
  SettingsRepository,
  ReaderSettings,
} from "../../../storage/types";
import { DatabaseAdapter } from "../../../storage/adapter/types";
import { HttpClientBridge } from "../../../bridges/http/types";
import { ParserRegistry } from "../../../parsers/parserRegistry";
import { useSettings } from "./useSettings";

function createMockServices(
  overrides?: Partial<ServiceContextValue> & {
    settingsRepoOverrides?: Partial<SettingsRepository>;
  },
): ServiceContextValue {
  let settingsState: ReaderSettings = {
    writingMode: "vertical-rl",
    theme: "light",
    fontFamily: "mincho",
    fontSizePx: 18,
    lineHeight: 1.8,
    pageMarginPx: 16,
    enableTapPaging: true,
    enableVolumeKeyPaging: false,
    updatedAt: "2026-10-27T00:00:00Z",
  };

  const defaultSettingsRepo: SettingsRepository = {
    getReaderSettings: vi.fn(async () => ({ ...settingsState })),
    updateReaderSettings: vi.fn(async (patch) => {
      settingsState = { ...settingsState, ...patch };
      return { ...settingsState };
    }),
    ...overrides?.settingsRepoOverrides,
  };

  return {
    httpClient: {} as HttpClientBridge,
    parserRegistry: {} as ParserRegistry,
    databaseAdapter: {} as DatabaseAdapter,
    novelRepository: {} as NovelRepository,
    chapterRepository: {} as ChapterRepository,
    settingsRepository: overrides?.settingsRepository ?? defaultSettingsRepo,
    isReady: overrides?.isReady ?? true,
    error: overrides?.error ?? null,
  };
}

function createWrapper(
  services: ServiceContextValue,
): React.FC<{ children: React.ReactNode }> {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    );
  };
}

describe("useSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("初期化と設定値復元", () => {
    it("isReady が true のとき、settingsRepository から保存済み設定が読み込まれること", async () => {
      const services = createMockServices({
        settingsRepoOverrides: {
          getReaderSettings: vi.fn().mockResolvedValue({
            writingMode: "horizontal-tb",
            theme: "sepia",
            fontFamily: "gothic",
            fontSizePx: 22,
            lineHeight: 2.0,
            pageMarginPx: 16,
            enableTapPaging: true,
            enableVolumeKeyPaging: false,
            updatedAt: "2026-10-27T10:00:00Z",
          }),
        },
      });

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(services),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.writingMode).toBe("horizontal-tb");
      expect(result.current.theme).toBe("sepia");
      expect(result.current.fontSizePx).toBe(22);
      expect(result.current.lineHeight).toBe(2.0);
      expect(result.current.error).toBeNull();
    });

    it("isReady が false の間は初期読み込みを行わずデフォルト値であること", () => {
      const getReaderSettings = vi.fn();
      const services = createMockServices({
        isReady: false,
        settingsRepoOverrides: { getReaderSettings },
      });

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(services),
      });

      expect(result.current.writingMode).toBe("vertical-rl");
      expect(result.current.theme).toBe("light");
      expect(result.current.fontSizePx).toBe(18);
      expect(result.current.lineHeight).toBe(1.8);
      expect(getReaderSettings).not.toHaveBeenCalled();
    });

    it("初期読み込みで getReaderSettings が例外をスローした場合でもデフォルト値を維持し、エラーは設定されないこと（または安全にハンドリングされること）", async () => {
      const services = createMockServices({
        settingsRepoOverrides: {
          getReaderSettings: vi
            .fn()
            .mockRejectedValue(new Error("DB read failed")),
        },
      });

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(services),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.writingMode).toBe("vertical-rl");
      expect(result.current.theme).toBe("light");
      expect(result.current.fontSizePx).toBe(18);
      expect(result.current.lineHeight).toBe(1.8);
      expect(result.current.error).toBeNull();
    });
  });

  describe("組み方向切替 (toggleWritingMode)", () => {
    it("vertical-rl と horizontal-tb を交互に切り替え、settingsRepository を更新すること", async () => {
      const updateReaderSettings = vi.fn().mockResolvedValue({});
      const services = createMockServices({
        settingsRepoOverrides: { updateReaderSettings },
      });

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(services),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.writingMode).toBe("vertical-rl");

      await act(async () => {
        await result.current.toggleWritingMode();
      });

      expect(result.current.writingMode).toBe("horizontal-tb");
      expect(updateReaderSettings).toHaveBeenCalledWith({
        writingMode: "horizontal-tb",
      });

      await act(async () => {
        await result.current.toggleWritingMode();
      });

      expect(result.current.writingMode).toBe("vertical-rl");
      expect(updateReaderSettings).toHaveBeenCalledWith({
        writingMode: "vertical-rl",
      });
    });
  });

  describe("カラーテーマ切替 (changeTheme)", () => {
    it("指定したカラーテーマに変更し、settingsRepository を更新すること", async () => {
      const updateReaderSettings = vi.fn().mockResolvedValue({});
      const services = createMockServices({
        settingsRepoOverrides: { updateReaderSettings },
      });

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(services),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.changeTheme("dark");
      });

      expect(result.current.theme).toBe("dark");
      expect(updateReaderSettings).toHaveBeenCalledWith({ theme: "dark" });

      await act(async () => {
        await result.current.changeTheme("black");
      });

      expect(result.current.theme).toBe("black");
      expect(updateReaderSettings).toHaveBeenCalledWith({ theme: "black" });
    });
  });

  describe("文字サイズ変更 (changeFontSize)", () => {
    it("12〜32pxの範囲内で更新し、範囲外の値は上下限値にクランプされること", async () => {
      const updateReaderSettings = vi.fn().mockResolvedValue({});
      const services = createMockServices({
        settingsRepoOverrides: { updateReaderSettings },
      });

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(services),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // 通常変更
      await act(async () => {
        await result.current.changeFontSize(24);
      });
      expect(result.current.fontSizePx).toBe(24);
      expect(updateReaderSettings).toHaveBeenCalledWith({ fontSizePx: 24 });

      // 下限クランプ (10 -> 12)
      await act(async () => {
        await result.current.changeFontSize(10);
      });
      expect(result.current.fontSizePx).toBe(12);
      expect(updateReaderSettings).toHaveBeenCalledWith({ fontSizePx: 12 });

      // 上限クランプ (40 -> 32)
      await act(async () => {
        await result.current.changeFontSize(40);
      });
      expect(result.current.fontSizePx).toBe(32);
      expect(updateReaderSettings).toHaveBeenCalledWith({ fontSizePx: 32 });
    });
  });

  describe("行間変更 (changeLineHeight)", () => {
    it("1.4〜2.4の範囲内で更新し、小数第1位に丸められ、範囲外の値はクランプされること", async () => {
      const updateReaderSettings = vi.fn().mockResolvedValue({});
      const services = createMockServices({
        settingsRepoOverrides: { updateReaderSettings },
      });

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(services),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // 丸め (1.78 -> 1.8)
      await act(async () => {
        await result.current.changeLineHeight(1.78);
      });
      expect(result.current.lineHeight).toBe(1.8);
      expect(updateReaderSettings).toHaveBeenCalledWith({ lineHeight: 1.8 });

      // 下限クランプ (1.2 -> 1.4)
      await act(async () => {
        await result.current.changeLineHeight(1.2);
      });
      expect(result.current.lineHeight).toBe(1.4);
      expect(updateReaderSettings).toHaveBeenCalledWith({ lineHeight: 1.4 });

      // 上限クランプ (3.0 -> 2.4)
      await act(async () => {
        await result.current.changeLineHeight(3.0);
      });
      expect(result.current.lineHeight).toBe(2.4);
      expect(updateReaderSettings).toHaveBeenCalledWith({ lineHeight: 2.4 });
    });
  });

  describe("エラーハンドリング", () => {
    it("設定保存時に settingsRepository が例外を投げた場合、error にエラーメッセージが設定されること", async () => {
      const updateReaderSettings = vi
        .fn()
        .mockRejectedValue(new Error("Storage write error"));
      const services = createMockServices({
        settingsRepoOverrides: { updateReaderSettings },
      });

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(services),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.toggleWritingMode();
      });

      expect(result.current.error).toBe("Storage write error");

      // 未知のエラー型ハンドリング
      updateReaderSettings.mockRejectedValue("String error");
      await act(async () => {
        await result.current.changeTheme("dark");
      });
      expect(result.current.error).toBe("String error");

      updateReaderSettings.mockRejectedValue(new Error("Font size error"));
      await act(async () => {
        await result.current.changeFontSize(20);
      });
      expect(result.current.error).toBe("Font size error");

      updateReaderSettings.mockRejectedValue(new Error("Line height error"));
      await act(async () => {
        await result.current.changeLineHeight(2.0);
      });
      expect(result.current.error).toBe("Line height error");
    });
  });
});

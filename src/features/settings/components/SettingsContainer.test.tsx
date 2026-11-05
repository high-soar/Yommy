import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SettingsContainer.stories";
import { SettingsContainer } from "./SettingsContainer";
import * as SettingsPageModule from "./SettingsPage";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import type { CloudSyncBridge } from "../../../bridges/cloud-sync/types";
import type { SyncEngine } from "../../cloud-sync/services/syncEngine";

const { Default, WithCustomClass } = composeStories(stories);

describe("SettingsContainer", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Default ストーリーで直接の子 SettingsPage に初期設定値とコールバック一式が渡され settings-page が描画されること (AC-ST-02〜05, AC-ST-17〜19, R1-23)", async () => {
      const pageSpy = vi.spyOn(SettingsPageModule, "SettingsPage");
      render(<Default />);

      await waitFor(() => {
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            writingMode: "vertical-rl",
            theme: "light",
            fontSizePx: 18,
            lineHeight: 1.8,
            fontFamily: "biz-ud-mincho",
            pageMarginPx: 20,
            pagingMode: "auto",
            enableVolumeKeyPaging: false,
            isLoading: false,
            error: null,
          }),
          undefined,
        );
      });
    });

    it("SettingsPage に渡された onToggleWritingMode 呼び出し時に writingMode が縦書きと横書きで相互に切り替わること (AC-ST-03, R1-23)", async () => {
      const pageSpy = vi.spyOn(SettingsPageModule, "SettingsPage");
      render(<Default />);

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            writingMode: "vertical-rl",
            isLoading: false,
          }),
          undefined,
        );
      });

      // 縦書き -> 横書き
      await act(async () => {
        await pageSpy.mock.calls.at(-1)?.[0].onToggleWritingMode();
      });
      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ writingMode: "horizontal-tb" }),
          undefined,
        );
      });

      // 横書き -> 縦書き
      await act(async () => {
        await pageSpy.mock.calls.at(-1)?.[0].onToggleWritingMode();
      });
      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ writingMode: "vertical-rl" }),
          undefined,
        );
      });
    });

    it("SettingsPage に渡された onChangeTheme 呼び出し時に theme が更新されること (AC-ST-04, R1-23)", async () => {
      const pageSpy = vi.spyOn(SettingsPageModule, "SettingsPage");
      render(<Default />);

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ theme: "light", isLoading: false }),
          undefined,
        );
      });

      await act(async () => {
        await pageSpy.mock.calls.at(-1)?.[0].onChangeTheme("sepia");
      });

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ theme: "sepia" }),
          undefined,
        );
      });
    });

    it("SettingsPage に渡された onChangeFontSize 呼び出し時に fontSizePx が更新されること (AC-ST-05, R1-23)", async () => {
      const pageSpy = vi.spyOn(SettingsPageModule, "SettingsPage");
      render(<Default />);

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ fontSizePx: 18, isLoading: false }),
          undefined,
        );
      });

      await act(async () => {
        await pageSpy.mock.calls.at(-1)?.[0].onChangeFontSize(20);
      });

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ fontSizePx: 20 }),
          undefined,
        );
      });
    });

    it("SettingsPage に渡された onChangeLineHeight 呼び出し時に lineHeight が更新されること (AC-ST-05, R1-23)", async () => {
      const pageSpy = vi.spyOn(SettingsPageModule, "SettingsPage");
      render(<Default />);

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ lineHeight: 1.8, isLoading: false }),
          undefined,
        );
      });

      await act(async () => {
        await pageSpy.mock.calls.at(-1)?.[0].onChangeLineHeight(2.0);
      });

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ lineHeight: 2.0 }),
          undefined,
        );
      });
    });

    it("SettingsPage に渡された onChangeFontFamily 呼び出し時に fontFamily が更新されること (AC-ST-17, R1-23)", async () => {
      const pageSpy = vi.spyOn(SettingsPageModule, "SettingsPage");
      render(<Default />);

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            fontFamily: "biz-ud-mincho",
            isLoading: false,
          }),
          undefined,
        );
      });

      await act(async () => {
        await pageSpy.mock.calls.at(-1)?.[0].onChangeFontFamily?.("klee");
      });

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ fontFamily: "klee" }),
          undefined,
        );
      });
    });

    it("SettingsPage に渡された onChangePageMargin 呼び出し時に pageMarginPx が更新されること (AC-ST-18, R1-23)", async () => {
      const pageSpy = vi.spyOn(SettingsPageModule, "SettingsPage");
      render(<Default />);

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ pageMarginPx: 20, isLoading: false }),
          undefined,
        );
      });

      await act(async () => {
        await pageSpy.mock.calls.at(-1)?.[0].onChangePageMargin?.(24);
      });

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ pageMarginPx: 24 }),
          undefined,
        );
      });
    });

    it("SettingsPage に渡された onChangePagingMode 呼び出し時に pagingMode が更新されること (AC-ST-13, R1-23)", async () => {
      const pageSpy = vi.spyOn(SettingsPageModule, "SettingsPage");
      render(<Default />);

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ pagingMode: "auto", isLoading: false }),
          undefined,
        );
      });

      await act(async () => {
        await pageSpy.mock.calls.at(-1)?.[0].onChangePagingMode?.("scroll");
      });

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ pagingMode: "scroll" }),
          undefined,
        );
      });
    });

    it("SettingsPage に渡された onToggleVolumeKeyPaging 呼び出し時に enableVolumeKeyPaging が切り替わること (AC-ST-19, R1-23)", async () => {
      const pageSpy = vi.spyOn(SettingsPageModule, "SettingsPage");
      render(<Default />);

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            enableVolumeKeyPaging: false,
            isLoading: false,
          }),
          undefined,
        );
      });

      await act(async () => {
        await pageSpy.mock.calls.at(-1)?.[0].onToggleVolumeKeyPaging?.();
      });

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ enableVolumeKeyPaging: true }),
          undefined,
        );
      });
    });

    it("WithCustomClass ストーリーで className が SettingsPage に渡されること (R1-23)", async () => {
      const pageSpy = vi.spyOn(SettingsPageModule, "SettingsPage");
      render(<WithCustomClass />);

      await waitFor(() => {
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            className: "custom-settings-container",
          }),
          undefined,
        );
      });
    });
  });

  describe("SettingsContainer 単体動作検証", () => {
    it("className が未指定でも SettingsPage に className=undefined が渡されエラーなく描画されること (R1-23)", async () => {
      const pageSpy = vi.spyOn(SettingsPageModule, "SettingsPage");
      render(
        <ServiceProvider
          services={{
            settingsRepository: stories.createMockSettingsRepository(),
          }}
        >
          <SettingsContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            className: undefined,
            isLoading: false,
          }),
          undefined,
        );
      });
    });

    it("設定保存が reject した場合、SettingsPage に error が伝播されること (R1-20, R1-23)", async () => {
      const pageSpy = vi.spyOn(SettingsPageModule, "SettingsPage");
      const mockRepo = stories.createMockSettingsRepository();
      mockRepo.updateReaderSettings = vi
        .fn()
        .mockRejectedValue(new Error("DB保存エラー"));

      render(
        <ServiceProvider
          services={{
            settingsRepository: mockRepo,
          }}
        >
          <SettingsContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            isLoading: false,
            isStorageCacheLoading: false,
            error: null,
          }),
          undefined,
        );
      });

      await act(async () => {
        await pageSpy.mock.calls.at(-1)?.[0].onToggleWritingMode();
      });

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ error: "DB保存エラー" }),
          undefined,
        );
      });
    });

    it("useCloudSync の状態とコールバックが SettingsPage に伝播され、onSyncNow 呼び出しで同期が実行されること (AC-ST-08〜12, R1-23)", async () => {
      const pageSpy = vi.spyOn(SettingsPageModule, "SettingsPage");
      const mockBridge = {
        getAuthState: vi.fn().mockResolvedValue({
          status: "connected",
          email: "container-user@example.com",
        }),
        signIn: vi.fn().mockResolvedValue({
          status: "connected",
          email: "container-user@example.com",
        }),
        signOut: vi.fn().mockResolvedValue(undefined),
        pullFile: vi.fn().mockResolvedValue(null),
        pushFile: vi.fn().mockResolvedValue(undefined),
      };

      const mockSyncEngine = {
        sync: vi.fn().mockResolvedValue({ pulled: true, mergedNovels: 0 }),
      };

      render(
        <ServiceProvider
          services={{
            cloudSyncBridge: mockBridge as unknown as CloudSyncBridge,
            syncEngine: mockSyncEngine as unknown as SyncEngine,
          }}
        >
          <SettingsContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            cloudSyncAuthState: {
              status: "connected",
              email: "container-user@example.com",
            },
          }),
          undefined,
        );
      });

      await act(async () => {
        await pageSpy.mock.calls.at(-1)?.[0].onSyncNow?.();
      });
      expect(mockSyncEngine.sync).toHaveBeenCalled();
    });

    it("useStorageCache の状態とコールバックが SettingsPage に伝播され、onClearStorageCache 呼び出しでキャッシュ削除が実行されること (AC-ST-14〜16, R1-23)", async () => {
      const pageSpy = vi.spyOn(SettingsPageModule, "SettingsPage");
      let summaryData = { totalCachedChapters: 8, totalByteSize: 204800 };
      const deleteAllCachedBodiesMock = vi.fn(async () => {
        summaryData = { totalCachedChapters: 0, totalByteSize: 0 };
        return 8;
      });

      const mockChapterRepo = {
        listChaptersByNovelId: vi.fn(async () => []),
        getChapter: vi.fn(async () => null),
        saveChapterBody: vi.fn(async () => undefined),
        markChapterRead: vi.fn(async () => undefined),
        deleteCachedBodies: vi.fn(async () => 0),
        deleteAllCachedBodies: deleteAllCachedBodiesMock,
        getStorageCacheSummary: vi.fn(async () => summaryData),
      };

      render(
        <ServiceProvider
          services={{
            chapterRepository: mockChapterRepo,
          }}
        >
          <SettingsContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            storageCacheSummary: {
              totalCachedChapters: 8,
              totalByteSize: 204800,
            },
          }),
          undefined,
        );
      });

      await act(async () => {
        await pageSpy.mock.calls
          .at(-1)?.[0]
          .onClearStorageCache?.({ onlyRead: false });
      });

      expect(deleteAllCachedBodiesMock).toHaveBeenCalledWith({
        onlyRead: false,
      });

      await waitFor(() => {
        expect(pageSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            storageCacheNotice: "本文キャッシュを一括削除しました（8話）",
            storageCacheSummary: {
              totalCachedChapters: 0,
              totalByteSize: 0,
            },
          }),
          undefined,
        );
      });
    });
  });
});

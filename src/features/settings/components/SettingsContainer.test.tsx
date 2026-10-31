import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SettingsContainer.stories";
import { SettingsContainer } from "./SettingsContainer";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import type { CloudSyncBridge } from "../../../bridges/cloud-sync/types";
import type { SyncEngine } from "../../cloud-sync/services/syncEngine";

const { Default, WithCustomClass } = composeStories(stories);

describe("SettingsContainer", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Default ストーリーで SettingsPage が初期設定値で描画されること (AC-ST-02, AC-ST-03, AC-ST-04, AC-ST-05)", async () => {
      render(<Default />);

      await waitFor(() => {
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
      });

      // 組み方向の初期値: vertical-rl (切替ボタンは「横書き表示に切替」)
      const toggleBtn = screen.getByTestId("toggle-orientation");
      expect(toggleBtn).toHaveTextContent("横書き表示に切替");

      // テーマの初期値: light
      expect(screen.getByTestId("theme-light")).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      // 文字サイズの初期値: 18px
      expect(screen.getByTestId("font-size-value")).toHaveTextContent("18px");

      // 行間の初期値: 1.8
      expect(screen.getByTestId("line-height-value")).toHaveTextContent("1.8");

      // サンプルプレビューへの初期値反映
      const preview = screen.getByTestId("sample-text-preview");
      expect(preview).toHaveAttribute("data-writing-mode", "vertical-rl");
      expect(preview).toHaveAttribute("data-theme", "light");
      expect(preview).toHaveAttribute("data-font-size", "18");
      expect(preview).toHaveAttribute("data-line-height", "1.8");
    });

    it("組み方向切替ボタンを操作したとき、縦書きと横書きが相互に切り替わること (AC-ST-03)", async () => {
      const user = userEvent.setup();
      render(<Default />);

      await waitFor(() => {
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
      });

      const toggleBtn = screen.getByTestId("toggle-orientation");
      expect(toggleBtn).toHaveTextContent("横書き表示に切替");

      // 縦書き -> 横書き
      await user.click(toggleBtn);
      await waitFor(() => {
        expect(screen.getByTestId("sample-text-preview")).toHaveAttribute(
          "data-writing-mode",
          "horizontal-tb",
        );
      });
      expect(toggleBtn).toHaveTextContent("縦書き表示に切替");

      // 横書き -> 縦書き
      await user.click(toggleBtn);
      await waitFor(() => {
        expect(screen.getByTestId("sample-text-preview")).toHaveAttribute(
          "data-writing-mode",
          "vertical-rl",
        );
      });
      expect(toggleBtn).toHaveTextContent("横書き表示に切替");
    });

    it("カラーテーマボタンを操作したとき、テーマが変更されること (AC-ST-04)", async () => {
      const user = userEvent.setup();
      render(<Default />);

      await waitFor(() => {
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
      });

      const sepiaBtn = screen.getByTestId("theme-sepia");
      await user.click(sepiaBtn);

      await waitFor(() => {
        expect(screen.getByTestId("sample-text-preview")).toHaveAttribute(
          "data-theme",
          "sepia",
        );
      });
      expect(sepiaBtn).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByTestId("theme-light")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("文字サイズステッパー操作時に文字サイズが更新されること (AC-ST-05)", async () => {
      const user = userEvent.setup();
      render(<Default />);

      await waitFor(() => {
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
      });

      // 拡大ボタン押下: 18 -> 20
      const increaseBtn = screen.getByTestId("font-size-increase");
      await user.click(increaseBtn);

      await waitFor(() => {
        expect(screen.getByTestId("font-size-value")).toHaveTextContent("20px");
      });
      expect(screen.getByTestId("sample-text-preview")).toHaveAttribute(
        "data-font-size",
        "20",
      );

      // 縮小ボタン押下: 20 -> 18
      const decreaseBtn = screen.getByTestId("font-size-decrease");
      await user.click(decreaseBtn);

      await waitFor(() => {
        expect(screen.getByTestId("font-size-value")).toHaveTextContent("18px");
      });
      expect(screen.getByTestId("sample-text-preview")).toHaveAttribute(
        "data-font-size",
        "18",
      );
    });

    it("行間ステッパー操作時に行間が更新されること (AC-ST-05)", async () => {
      const user = userEvent.setup();
      render(<Default />);

      await waitFor(() => {
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
      });

      // 拡大ボタン押下: 1.8 -> 2.0
      const increaseBtn = screen.getByTestId("line-height-increase");
      await user.click(increaseBtn);

      await waitFor(() => {
        expect(screen.getByTestId("line-height-value")).toHaveTextContent(
          "2.0",
        );
      });
      expect(screen.getByTestId("sample-text-preview")).toHaveAttribute(
        "data-line-height",
        "2",
      );

      // 縮小ボタン押下: 2.0 -> 1.8
      const decreaseBtn = screen.getByTestId("line-height-decrease");
      await user.click(decreaseBtn);

      await waitFor(() => {
        expect(screen.getByTestId("line-height-value")).toHaveTextContent(
          "1.8",
        );
      });
      expect(screen.getByTestId("sample-text-preview")).toHaveAttribute(
        "data-line-height",
        "1.8",
      );
    });

    it("WithCustomClass ストーリーでカスタムクラスがルート要素に渡されること", async () => {
      render(<WithCustomClass />);

      await waitFor(() => {
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
      });
      expect(screen.getByTestId("settings-page")).toHaveClass(
        "custom-settings-container",
      );
    });
  });

  describe("SettingsContainer 単体動作検証", () => {
    it("className が未指定でもエラーなく正しく描画されること", async () => {
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
      });
      expect(screen.getByTestId("settings-page")).toHaveClass(
        "h-full flex flex-col overflow-y-auto",
      );
    });

    it("設定保存が reject した場合、SettingsPage にエラーが伝播して role='alert' が表示されること（R1-20）", async () => {
      const user = userEvent.setup();
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
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
      });

      const toggleBtn = screen.getByTestId("toggle-orientation");
      await user.click(toggleBtn);

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent("DB保存エラー");
      });
    });

    it("クラウド同期セクションが描画され、連携および同期操作がコンテナ経由で実行できること (AC-ST-08〜12)", async () => {
      const user = userEvent.setup();
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
        expect(screen.getByTestId("cloud-sync-section")).toBeInTheDocument();
        expect(screen.getByTestId("cloud-sync-status")).toHaveTextContent(
          "連携中 (container-user@example.com)",
        );
      });

      const syncBtn = screen.getByTestId("cloud-sync-now-button");
      await user.click(syncBtn);
      expect(mockSyncEngine.sync).toHaveBeenCalled();
    });
  });
});

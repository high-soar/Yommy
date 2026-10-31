import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SettingsPage.stories";
import { SettingsPage } from "./SettingsPage";

const {
  Default,
  HorizontalSepia,
  MinBoundaries,
  MaxBoundaries,
  Loading,
  WithError,
  CloudSyncConnected,
} = composeStories(stories);

describe("SettingsPage", () => {
  describe("Storybook Stories 描画検証 (composeStories)", () => {
    it("Default: 縦書き・ライトテーマ、既定ステッパー値、およびプレビューが正しく描画されること (AC-ST-01, AC-ST-02)", () => {
      render(<Default />);

      // 画面ルート
      const page = screen.getByTestId("settings-page");
      expect(page).toBeInTheDocument();
      expect(page).toHaveClass("h-full", "flex", "flex-col", "overflow-y-auto");

      // ヘッダー
      const header = screen.getByTestId("settings-header");
      expect(header).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 1, name: "設定" }),
      ).toBeInTheDocument();

      // 組版設定セクション
      const typographySection = screen.getByTestId(
        "typography-settings-section",
      );
      expect(typographySection).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 2, name: "組版・表示設定" }),
      ).toBeInTheDocument();

      // 組み方向切替（vertical-rl 時は「横書き表示に切替」）
      const toggleButton = screen.getByTestId("toggle-orientation");
      expect(toggleButton).toHaveTextContent("横書き表示に切替");
      expect(toggleButton).toBeEnabled();

      // カラーテーマ選択（ライトが選択中）
      const lightThemeBtn = screen.getByTestId("theme-light");
      const sepiaThemeBtn = screen.getByTestId("theme-sepia");
      const darkThemeBtn = screen.getByTestId("theme-dark");
      const blackThemeBtn = screen.getByTestId("theme-black");

      expect(lightThemeBtn).toHaveAttribute("aria-pressed", "true");
      expect(sepiaThemeBtn).toHaveAttribute("aria-pressed", "false");
      expect(darkThemeBtn).toHaveAttribute("aria-pressed", "false");
      expect(blackThemeBtn).toHaveAttribute("aria-pressed", "false");

      // 文字サイズステッパー（18px）
      expect(screen.getByTestId("font-size-value")).toHaveTextContent("18px");
      expect(screen.getByTestId("font-size-decrease")).toBeEnabled();
      expect(screen.getByTestId("font-size-increase")).toBeEnabled();

      // 行間ステッパー（1.8）
      expect(screen.getByTestId("line-height-value")).toHaveTextContent("1.8");
      expect(screen.getByTestId("line-height-decrease")).toBeEnabled();
      expect(screen.getByTestId("line-height-increase")).toBeEnabled();

      // プレビューセクション
      const previewSection = screen.getByTestId("preview-section");
      expect(previewSection).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 2, name: "組版プレビュー" }),
      ).toBeInTheDocument();

      // SampleTextPreview の属性
      const preview = screen.getByTestId("sample-text-preview");
      expect(preview).toHaveAttribute("data-writing-mode", "vertical-rl");
      expect(preview).toHaveAttribute("data-theme", "light");
      expect(preview).toHaveAttribute("data-font-size", "18");
      expect(preview).toHaveAttribute("data-line-height", "1.8");
    });

    it("HorizontalSepia: 横書き・セピアテーマ表示が正しく反映されること (AC-ST-03, AC-ST-04)", () => {
      render(<HorizontalSepia />);

      // 組み方向切替（horizontal-tb 時は「縦書き表示に切替」）
      const toggleButton = screen.getByTestId("toggle-orientation");
      expect(toggleButton).toHaveTextContent("縦書き表示に切替");

      // セピアテーマが選択状態
      expect(screen.getByTestId("theme-sepia")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByTestId("theme-light")).toHaveAttribute(
        "aria-pressed",
        "false",
      );

      // プレビュー属性
      const preview = screen.getByTestId("sample-text-preview");
      expect(preview).toHaveAttribute("data-writing-mode", "horizontal-tb");
      expect(preview).toHaveAttribute("data-theme", "sepia");
    });

    it("MinBoundaries: 最小境界値（12px / 1.4）で縮小ボタンが無効化されること (AC-ST-05)", () => {
      render(<MinBoundaries />);

      // ダークテーマ選択
      expect(screen.getByTestId("theme-dark")).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      // 文字サイズ 12px: 縮小ボタン無効、拡大ボタン有効
      expect(screen.getByTestId("font-size-value")).toHaveTextContent("12px");
      expect(screen.getByTestId("font-size-decrease")).toBeDisabled();
      expect(screen.getByTestId("font-size-increase")).toBeEnabled();

      // 行間 1.4: 縮小ボタン無効、拡大ボタン有効
      expect(screen.getByTestId("line-height-value")).toHaveTextContent("1.4");
      expect(screen.getByTestId("line-height-decrease")).toBeDisabled();
      expect(screen.getByTestId("line-height-increase")).toBeEnabled();
    });

    it("MaxBoundaries: 最大境界値（32px / 2.4）で拡大ボタンが無効化されること (AC-ST-05)", () => {
      render(<MaxBoundaries />);

      // ブラックテーマ選択
      expect(screen.getByTestId("theme-black")).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      // 文字サイズ 32px: 縮小ボタン有効、拡大ボタン無効
      expect(screen.getByTestId("font-size-value")).toHaveTextContent("32px");
      expect(screen.getByTestId("font-size-decrease")).toBeEnabled();
      expect(screen.getByTestId("font-size-increase")).toBeDisabled();

      // 行間 2.4: 縮小ボタン有効、拡大ボタン無効
      expect(screen.getByTestId("line-height-value")).toHaveTextContent("2.4");
      expect(screen.getByTestId("line-height-decrease")).toBeEnabled();
      expect(screen.getByTestId("line-height-increase")).toBeDisabled();
    });

    it("Loading: isLoading が true のとき全操作ボタンが無効化されること", () => {
      render(<Loading />);

      // 組み方向切替
      expect(screen.getByTestId("toggle-orientation")).toBeDisabled();

      // 各テーマボタン
      expect(screen.getByTestId("theme-light")).toBeDisabled();
      expect(screen.getByTestId("theme-sepia")).toBeDisabled();
      expect(screen.getByTestId("theme-dark")).toBeDisabled();
      expect(screen.getByTestId("theme-black")).toBeDisabled();

      // 文字サイズステッパーボタン
      expect(screen.getByTestId("font-size-decrease")).toBeDisabled();
      expect(screen.getByTestId("font-size-increase")).toBeDisabled();

      // 行間ステッパーボタン
      expect(screen.getByTestId("line-height-decrease")).toBeDisabled();
      expect(screen.getByTestId("line-height-increase")).toBeDisabled();
    });
  });

  describe("ユーザー操作・イベント発火検証", () => {
    it("組み方向切替ボタン押下時に onToggleWritingMode が呼び出されること (AC-ST-03)", async () => {
      const user = userEvent.setup();
      const onToggleWritingMode = vi.fn();

      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          onToggleWritingMode={onToggleWritingMode}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
        />,
      );

      const button = screen.getByTestId("toggle-orientation");
      await user.click(button);

      expect(onToggleWritingMode).toHaveBeenCalledTimes(1);
    });

    it("各テーマボタン押下時に onChangeTheme が対応するテーマで呼び出されること (AC-ST-04)", async () => {
      const user = userEvent.setup();
      const onChangeTheme = vi.fn();

      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          onToggleWritingMode={vi.fn()}
          onChangeTheme={onChangeTheme}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("theme-sepia"));
      expect(onChangeTheme).toHaveBeenLastCalledWith("sepia");

      await user.click(screen.getByTestId("theme-dark"));
      expect(onChangeTheme).toHaveBeenLastCalledWith("dark");

      await user.click(screen.getByTestId("theme-black"));
      expect(onChangeTheme).toHaveBeenLastCalledWith("black");

      await user.click(screen.getByTestId("theme-light"));
      expect(onChangeTheme).toHaveBeenLastCalledWith("light");

      expect(onChangeTheme).toHaveBeenCalledTimes(4);
    });

    it("文字サイズステッパー押下時に step 刻みで onChangeFontSize が呼び出されること (AC-ST-05)", async () => {
      const user = userEvent.setup();
      const onChangeFontSize = vi.fn();

      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          fontSizePx={18}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={onChangeFontSize}
          onChangeLineHeight={vi.fn()}
        />,
      );

      // 縮小: 18 - 2 = 16
      await user.click(screen.getByTestId("font-size-decrease"));
      expect(onChangeFontSize).toHaveBeenLastCalledWith(16);

      // 拡大: 18 + 2 = 20
      await user.click(screen.getByTestId("font-size-increase"));
      expect(onChangeFontSize).toHaveBeenLastCalledWith(20);
    });

    it("文字サイズステッパーの境界クランプが安全に処理されること (AC-ST-05)", async () => {
      const user = userEvent.setup();
      const onChangeFontSize = vi.fn();

      const { rerender } = render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          fontSizePx={13}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={onChangeFontSize}
          onChangeLineHeight={vi.fn()}
        />,
      );

      // 13px から縮小 -> Math.max(12, 13 - 2) = 12
      await user.click(screen.getByTestId("font-size-decrease"));
      expect(onChangeFontSize).toHaveBeenLastCalledWith(12);

      // 31px から拡大 -> Math.min(32, 31 + 2) = 32
      rerender(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          fontSizePx={31}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={onChangeFontSize}
          onChangeLineHeight={vi.fn()}
        />,
      );
      await user.click(screen.getByTestId("font-size-increase"));
      expect(onChangeFontSize).toHaveBeenLastCalledWith(32);
    });

    it("行間ステッパー押下時に step 刻みで onChangeLineHeight が呼び出されること (AC-ST-05)", async () => {
      const user = userEvent.setup();
      const onChangeLineHeight = vi.fn();

      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          lineHeight={1.8}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={onChangeLineHeight}
        />,
      );

      // 縮小: 1.8 - 0.2 = 1.6
      await user.click(screen.getByTestId("line-height-decrease"));
      expect(onChangeLineHeight).toHaveBeenLastCalledWith(1.6);

      // 拡大: 1.8 + 0.2 = 2.0
      await user.click(screen.getByTestId("line-height-increase"));
      expect(onChangeLineHeight).toHaveBeenLastCalledWith(2.0);
    });

    it("行間ステッパーの境界クランプが安全に処理されること (AC-ST-05)", async () => {
      const user = userEvent.setup();
      const onChangeLineHeight = vi.fn();

      const { rerender } = render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          lineHeight={1.5}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={onChangeLineHeight}
        />,
      );

      // 1.5 から縮小 -> Math.max(1.4, 1.3) -> 1.4 ではなく 1.5 - 0.2 = 1.3 -> max で 1.4
      await user.click(screen.getByTestId("line-height-decrease"));
      expect(onChangeLineHeight).toHaveBeenLastCalledWith(1.4);

      // 2.3 から拡大 -> Math.min(2.4, 2.5) -> min で 2.4
      rerender(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          lineHeight={2.3}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={onChangeLineHeight}
        />,
      );
      await user.click(screen.getByTestId("line-height-increase"));
      expect(onChangeLineHeight).toHaveBeenLastCalledWith(2.4);
    });

    it("オプショナルプロパティ省略時にデフォルト値（18px, 1.8, isLoading: false）が適用されること", () => {
      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
        />,
      );

      expect(screen.getByTestId("font-size-value")).toHaveTextContent("18px");
      expect(screen.getByTestId("line-height-value")).toHaveTextContent("1.8");
      expect(screen.getByTestId("toggle-orientation")).toBeEnabled();
    });

    it("カスタム className がルートコンテナへ適用されること", () => {
      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          className="custom-test-class"
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
        />,
      );

      const page = screen.getByTestId("settings-page");
      expect(page).toHaveClass("custom-test-class");
    });

    it("WithError ストーリーでエラーアラートが role='alert' として表示されること（R1-20）", () => {
      render(<WithError />);

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute("data-testid", "settings-error-alert");
      expect(alert).toHaveTextContent(
        "設定の保存に失敗しました。時間をおいて再試行してください。",
      );
    });

    it("CloudSyncConnected: クラウド同期セクションが連携中状態で描画されること (AC-ST-08, AC-ST-09)", () => {
      render(<CloudSyncConnected />);

      expect(screen.getByTestId("cloud-sync-section")).toBeInTheDocument();
      expect(screen.getByTestId("cloud-sync-status")).toHaveTextContent(
        "連携中 (user@example.com)",
      );
      expect(screen.getByTestId("cloud-sync-now-button")).toBeInTheDocument();
      expect(
        screen.getByTestId("cloud-sync-disconnect-button"),
      ).toBeInTheDocument();
    });

    it("error が null または未指定の場合、エラーアラートが表示されないこと", () => {
      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          error={null}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
        />,
      );

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("settings-error-alert"),
      ).not.toBeInTheDocument();
    });

    it("クラウド同期セクションが統合され、連携・同期・解除コールバックが正しく呼び出されること (AC-ST-08〜12)", async () => {
      const onSignInGoogle = vi.fn().mockResolvedValue(undefined);
      const onSignOutGoogle = vi.fn().mockResolvedValue(undefined);
      const onSyncNow = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      // 未連携表示
      const { rerender } = render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          cloudSyncAuthState={{ status: "unlinked" }}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
          onSignInGoogle={onSignInGoogle}
          onSignOutGoogle={onSignOutGoogle}
          onSyncNow={onSyncNow}
        />,
      );

      expect(screen.getByTestId("cloud-sync-section")).toBeInTheDocument();
      const authBtn = screen.getByTestId("cloud-sync-auth-button");
      await user.click(authBtn);
      expect(onSignInGoogle).toHaveBeenCalledTimes(1);

      // 連携中表示
      rerender(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          cloudSyncAuthState={{
            status: "connected",
            email: "test@example.com",
          }}
          cloudSyncLastSyncedAt="2026-10-31T12:00:00.000Z"
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
          onSignInGoogle={onSignInGoogle}
          onSignOutGoogle={onSignOutGoogle}
          onSyncNow={onSyncNow}
        />,
      );

      const syncBtn = screen.getByTestId("cloud-sync-now-button");
      await user.click(syncBtn);
      expect(onSyncNow).toHaveBeenCalledTimes(1);

      const disconnectBtn = screen.getByTestId("cloud-sync-disconnect-button");
      await user.click(disconnectBtn);
      const confirmBtn = screen.getByTestId(
        "cloud-sync-disconnect-confirm-button",
      );
      await user.click(confirmBtn);
      expect(onSignOutGoogle).toHaveBeenCalledTimes(1);
    });
  });
});

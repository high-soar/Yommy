import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./CloudSyncSection.stories";
import { CloudSyncSection } from "./CloudSyncSection";

const { Unlinked, Connected, Syncing, SyncError, DisconnectConfirmDialog } =
  composeStories(stories);

describe("CloudSyncSection", () => {
  describe("Storybook Stories 描画検証 (composeStories)", () => {
    it("Unlinked: 未連携状態の文言、最終同期（未同期）、連携ボタンが正しく描画されること (AC-ST-08)", async () => {
      const onSignIn = vi.fn().mockResolvedValue(undefined);
      render(<Unlinked onSignIn={onSignIn} />);

      // セクションルート・見出し・説明文
      expect(screen.getByTestId("cloud-sync-section")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          level: 2,
          name: "クラウド同期 (Google Drive)",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Google Drive のアプリ専用領域に本棚・しおりを自動保存し、複数端末間で共有します。",
        ),
      ).toBeInTheDocument();

      // 状態表示と最終同期
      const statusEl = screen.getByTestId("cloud-sync-status");
      expect(statusEl).toHaveTextContent("未連携（端末内保存のみ）");

      const lastSyncedEl = screen.getByTestId("cloud-sync-last-synced-at");
      expect(lastSyncedEl).toHaveTextContent("最終同期: 未同期");

      // 連携ボタン
      const authBtn = screen.getByTestId("cloud-sync-auth-button");
      expect(authBtn).toBeInTheDocument();
      expect(authBtn).toHaveTextContent("Google アカウントと連携");
      expect(authBtn).toBeEnabled();

      // 連携中用ボタンは非表示
      expect(
        screen.queryByTestId("cloud-sync-now-button"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("cloud-sync-disconnect-button"),
      ).not.toBeInTheDocument();

      // ボタンクリックで onSignIn が発火
      const user = userEvent.setup();
      await user.click(authBtn);
      expect(onSignIn).toHaveBeenCalledTimes(1);
    });

    it("Connected: 連携中状態のメールアドレス、最終同期日時、今すぐ同期・連携解除ボタンが描画されること (AC-ST-08, AC-ST-09)", async () => {
      const onSyncNow = vi.fn().mockResolvedValue(undefined);
      const onSignOut = vi.fn().mockResolvedValue(undefined);
      render(<Connected onSyncNow={onSyncNow} onSignOut={onSignOut} />);

      // 状態表示
      const statusEl = screen.getByTestId("cloud-sync-status");
      expect(statusEl).toHaveTextContent("連携中 (user@example.com)");

      // 最終同期日時表示
      const lastSyncedEl = screen.getByTestId("cloud-sync-last-synced-at");
      expect(lastSyncedEl.textContent).toMatch(/最終同期: \d{4}\/\d{2}\/\d{2}/);

      // 今すぐ同期ボタン
      const syncBtn = screen.getByTestId("cloud-sync-now-button");
      expect(syncBtn).toBeInTheDocument();
      expect(syncBtn).toHaveTextContent("今すぐ同期");
      expect(syncBtn).toBeEnabled();

      // 連携解除ボタン
      const disconnectBtn = screen.getByTestId("cloud-sync-disconnect-button");
      expect(disconnectBtn).toBeInTheDocument();
      expect(disconnectBtn).toHaveTextContent("連携解除");
      expect(disconnectBtn).toBeEnabled();

      // 連携ボタンは非表示
      expect(
        screen.queryByTestId("cloud-sync-auth-button"),
      ).not.toBeInTheDocument();

      // 今すぐ同期クリック
      const user = userEvent.setup();
      await user.click(syncBtn);
      expect(onSyncNow).toHaveBeenCalledTimes(1);
    });

    it("Syncing: 同期実行中は同期ボタンが非活性かつ「同期中...」表示になり、解除ボタンも非活性となること (AC-ST-09)", () => {
      render(<Syncing />);

      const syncBtn = screen.getByTestId("cloud-sync-now-button");
      expect(syncBtn).toBeDisabled();
      expect(syncBtn).toHaveTextContent("同期中...");

      const disconnectBtn = screen.getByTestId("cloud-sync-disconnect-button");
      expect(disconnectBtn).toBeDisabled();
    });

    it("SyncError: 同期エラー時に role='alert' のエラー警告枠が表示されること (AC-ST-08, AC-ST-11)", () => {
      render(<SyncError />);

      const alertEl = screen.getByTestId("cloud-sync-error-alert");
      expect(alertEl).toBeInTheDocument();
      expect(alertEl).toHaveAttribute("role", "alert");
      expect(alertEl).toHaveTextContent(
        "Google Drive への通信に失敗しました (503 Service Unavailable)",
      );
    });

    it("DisconnectConfirmDialog: 解除確認ダイアログが表示され、キャンセルおよび解除操作が行えること (AC-ST-10)", async () => {
      const onSignOut = vi.fn().mockResolvedValue(undefined);
      render(<DisconnectConfirmDialog onSignOut={onSignOut} />);

      const dialog = screen.getByTestId("cloud-sync-disconnect-dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveTextContent(
        "端末内の本棚・しおりデータは消去されずそのまま保持されます",
      );

      const cancelBtn = screen.getByTestId(
        "cloud-sync-disconnect-cancel-button",
      );
      const confirmBtn = screen.getByTestId(
        "cloud-sync-disconnect-confirm-button",
      );
      expect(confirmBtn).toBeInTheDocument();

      const user = userEvent.setup();
      // キャンセルでダイアログが閉じる
      await user.click(cancelBtn);
      expect(
        screen.queryByTestId("cloud-sync-disconnect-dialog"),
      ).not.toBeInTheDocument();
      expect(onSignOut).not.toHaveBeenCalled();
    });
  });

  describe("コンポーネント単体インタラクション検証", () => {
    it("連携中状態から連携解除ボタンを押下すると確認ダイアログが表示され、解除実行で onSignOut が呼ばれること (AC-ST-10)", async () => {
      const onSignOut = vi.fn().mockResolvedValue(undefined);
      render(
        <CloudSyncSection
          authState={{ status: "connected", email: "user@example.com" }}
          lastSyncedAt="2026-10-31T12:00:00.000Z"
          isSyncing={false}
          onSignIn={vi.fn()}
          onSignOut={onSignOut}
          onSyncNow={vi.fn()}
        />,
      );

      expect(
        screen.queryByTestId("cloud-sync-disconnect-dialog"),
      ).not.toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(screen.getByTestId("cloud-sync-disconnect-button"));

      expect(
        screen.getByTestId("cloud-sync-disconnect-dialog"),
      ).toBeInTheDocument();

      await user.click(
        screen.getByTestId("cloud-sync-disconnect-confirm-button"),
      );

      expect(onSignOut).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByTestId("cloud-sync-disconnect-dialog"),
      ).not.toBeInTheDocument();
    });

    it("authState.status === 'authenticating' のとき、認証中表示となりボタンが無効化されること", () => {
      render(
        <CloudSyncSection
          authState={{ status: "authenticating" }}
          lastSyncedAt={null}
          isSyncing={false}
          onSignIn={vi.fn()}
          onSignOut={vi.fn()}
          onSyncNow={vi.fn()}
        />,
      );

      expect(screen.getByTestId("cloud-sync-status")).toHaveTextContent(
        "Google 認証中...",
      );
      const authBtn = screen.getByTestId("cloud-sync-auth-button");
      expect(authBtn).toBeDisabled();
      expect(authBtn).toHaveTextContent("Google 認証中...");
    });

    it("authState.status === 'error' のとき、認証エラー表示となり連携ボタンが操作可能であること", () => {
      render(
        <CloudSyncSection
          authState={{ status: "error", message: "認証に失敗しました" }}
          lastSyncedAt={null}
          isSyncing={false}
          onSignIn={vi.fn()}
          onSignOut={vi.fn()}
          onSyncNow={vi.fn()}
        />,
      );

      expect(screen.getByTestId("cloud-sync-status")).toHaveTextContent(
        "認証エラー",
      );
      const authBtn = screen.getByTestId("cloud-sync-auth-button");
      expect(authBtn).toBeEnabled();
      expect(authBtn).toHaveTextContent("Google アカウントと連携");
    });

    it("authState.status === 'connected' かつ email が未定義の場合でも正常に連携中表示されること", () => {
      render(
        <CloudSyncSection
          authState={{ status: "connected" }}
          lastSyncedAt={null}
          isSyncing={false}
          onSignIn={vi.fn()}
          onSignOut={vi.fn()}
          onSyncNow={vi.fn()}
        />,
      );

      expect(screen.getByTestId("cloud-sync-status")).toHaveTextContent(
        "連携中",
      );
    });

    it("不正な日付文字列が lastSyncedAt に渡された場合は「未同期」フォールバックされること", () => {
      render(
        <CloudSyncSection
          authState={{ status: "connected" }}
          lastSyncedAt="invalid-date"
          isSyncing={false}
          onSignIn={vi.fn()}
          onSignOut={vi.fn()}
          onSyncNow={vi.fn()}
        />,
      );

      expect(screen.getByTestId("cloud-sync-last-synced-at")).toHaveTextContent(
        "最終同期: 未同期",
      );
    });
  });
});

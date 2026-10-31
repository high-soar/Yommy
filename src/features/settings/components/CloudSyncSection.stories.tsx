import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { CloudSyncSection } from "./CloudSyncSection";

const meta: Meta<typeof CloudSyncSection> = {
  title: "Settings/CloudSyncSection",
  component: CloudSyncSection,
  args: {
    authState: { status: "unlinked" },
    lastSyncedAt: null,
    isSyncing: false,
    error: null,
    onSignIn: fn(),
    onSignOut: fn(),
    onSyncNow: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof CloudSyncSection>;

/**
 * 未連携状態（デフォルト）
 */
export const Unlinked: Story = {
  name: "未連携状態",
  args: {
    authState: { status: "unlinked" },
    lastSyncedAt: null,
    isSyncing: false,
    error: null,
  },
};

/**
 * 連携中状態（Google アカウント連携済み）
 */
export const Connected: Story = {
  name: "連携中状態",
  args: {
    authState: {
      status: "connected",
      email: "user@example.com",
    },
    lastSyncedAt: "2026-10-31T12:00:00.000Z",
    isSyncing: false,
    error: null,
  },
};

/**
 * 同期実行中状態（isSyncing: true）
 */
export const Syncing: Story = {
  name: "同期実行中状態",
  args: {
    authState: {
      status: "connected",
      email: "user@example.com",
    },
    lastSyncedAt: "2026-10-31T12:00:00.000Z",
    isSyncing: true,
    error: null,
  },
};

/**
 * 同期エラー状態（エラーメッセージ表示中）
 */
export const SyncError: Story = {
  name: "同期エラー状態",
  args: {
    authState: {
      status: "connected",
      email: "user@example.com",
    },
    lastSyncedAt: "2026-10-31T12:00:00.000Z",
    isSyncing: false,
    error: "Google Drive への通信に失敗しました (503 Service Unavailable)",
  },
};

/**
 * 連携解除確認ダイアログ表示状態
 */
export const DisconnectConfirmDialog: Story = {
  name: "連携解除確認ダイアログ表示",
  args: {
    authState: {
      status: "connected",
      email: "user@example.com",
    },
    lastSyncedAt: "2026-10-31T12:00:00.000Z",
    isSyncing: false,
    initialShowDisconnectDialog: true,
    error: null,
  },
};

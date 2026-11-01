import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./ClearCacheConfirmDialog.stories";
import { ClearCacheConfirmDialog } from "./ClearCacheConfirmDialog";

const { Default, Clearing, Closed } = composeStories(stories);

describe("ClearCacheConfirmDialog", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Closed ストーリーでダイアログ要素が一切描画されないこと", () => {
      render(<Closed />);
      expect(
        screen.queryByTestId("clear-cache-confirm-dialog"),
      ).not.toBeInTheDocument();
    });

    it("Default ストーリーでダイアログ・説明文・2段階削除ボタン群およびキャンセルが表示されること (AC-ND-21)", () => {
      render(<Default />);
      const dialog = screen.getByTestId("clear-cache-confirm-dialog");
      expect(dialog).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");

      const message = screen.getByTestId("clear-cache-confirm-message");
      expect(message).toBeInTheDocument();
      expect(message).toHaveTextContent("テスト対象小説のタイトル");
      expect(message).toHaveTextContent(
        "目次一覧、既読状態、しおり位置は保持され",
      );
      expect(message).toHaveTextContent("再度読む際は再取得できます");

      const readButton = screen.getByTestId("confirm-clear-read-cache-button");
      expect(readButton).toBeInTheDocument();
      expect(readButton).not.toBeDisabled();
      expect(readButton).toHaveTextContent("既読話の本文キャッシュのみ削除");

      const allButton = screen.getByTestId("confirm-clear-all-cache-button");
      expect(allButton).toBeInTheDocument();
      expect(allButton).not.toBeDisabled();
      expect(allButton).toHaveTextContent("すべての本文キャッシュを削除");

      const cancelButton = screen.getByTestId("cancel-clear-cache-button");
      expect(cancelButton).toBeInTheDocument();
      expect(cancelButton).not.toBeDisabled();
      expect(cancelButton).toHaveTextContent("キャンセル");
    });

    it("Clearing ストーリーで全ボタンが無効化され削除中状態になること (AC-ND-21)", () => {
      render(<Clearing />);
      const readButton = screen.getByTestId("confirm-clear-read-cache-button");
      expect(readButton).toBeDisabled();

      const allButton = screen.getByTestId("confirm-clear-all-cache-button");
      expect(allButton).toBeDisabled();

      const cancelButton = screen.getByTestId("cancel-clear-cache-button");
      expect(cancelButton).toBeDisabled();
    });
  });

  describe("ユーザーインタラクションの検証", () => {
    it("キャンセルボタンをクリックすると onClose が呼び出されること", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <ClearCacheConfirmDialog
          isOpen={true}
          novelTitle="小説タイトル"
          isClearing={false}
          onClose={onClose}
          onConfirm={onConfirm}
        />,
      );

      await user.click(screen.getByTestId("cancel-clear-cache-button"));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("既読話の本文キャッシュのみ削除ボタンをクリックすると onConfirm({ onlyRead: true }) が呼び出されること (AC-ND-21)", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <ClearCacheConfirmDialog
          isOpen={true}
          novelTitle="小説タイトル"
          isClearing={false}
          onClose={onClose}
          onConfirm={onConfirm}
        />,
      );

      await user.click(screen.getByTestId("confirm-clear-read-cache-button"));
      expect(onConfirm).toHaveBeenCalledWith({ onlyRead: true });
      expect(onClose).not.toHaveBeenCalled();
    });

    it("すべての本文キャッシュを削除ボタンをクリックすると onConfirm({ onlyRead: false }) が呼び出されること (AC-ND-21)", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <ClearCacheConfirmDialog
          isOpen={true}
          novelTitle="小説タイトル"
          isClearing={false}
          onClose={onClose}
          onConfirm={onConfirm}
        />,
      );

      await user.click(screen.getByTestId("confirm-clear-all-cache-button"));
      expect(onConfirm).toHaveBeenCalledWith({ onlyRead: false });
      expect(onClose).not.toHaveBeenCalled();
    });

    it("背景オーバーレイをクリックしたときに onClose が呼び出されること", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <ClearCacheConfirmDialog
          isOpen={true}
          novelTitle="小説タイトル"
          isClearing={false}
          onClose={onClose}
          onConfirm={vi.fn()}
        />,
      );

      await user.click(
        screen.getByTestId("clear-cache-confirm-dialog-backdrop"),
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("削除処理中（isClearing === true）のときは背景クリックでも onClose が呼ばれないこと", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <ClearCacheConfirmDialog
          isOpen={true}
          novelTitle="小説タイトル"
          isClearing={true}
          onClose={onClose}
          onConfirm={vi.fn()}
        />,
      );

      await user.click(
        screen.getByTestId("clear-cache-confirm-dialog-backdrop"),
      );
      expect(onClose).not.toHaveBeenCalled();
    });

    it("ダイアログ本体内部のクリックでは onClose が呼ばれないこと", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <ClearCacheConfirmDialog
          isOpen={true}
          novelTitle="小説タイトル"
          isClearing={false}
          onClose={onClose}
          onConfirm={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("clear-cache-confirm-dialog"));
      expect(onClose).not.toHaveBeenCalled();
    });

    it("Escapeキー押下で onClose が呼び出されること（非削除時のみ）", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      const { rerender } = render(
        <ClearCacheConfirmDialog
          isOpen={true}
          novelTitle="小説タイトル"
          isClearing={false}
          onClose={onClose}
          onConfirm={vi.fn()}
        />,
      );

      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(1);

      onClose.mockClear();
      rerender(
        <ClearCacheConfirmDialog
          isOpen={true}
          novelTitle="小説タイトル"
          isClearing={true}
          onClose={onClose}
          onConfirm={vi.fn()}
        />,
      );

      await user.keyboard("{Escape}");
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});

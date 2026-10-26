import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./DeleteConfirmDialog.stories";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

const { Default, Deleting, Closed } = composeStories(stories);

describe("DeleteConfirmDialog", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Closed ストーリーでダイアログ要素が一切描画されないこと", () => {
      render(<Closed />);
      expect(
        screen.queryByTestId("delete-confirm-dialog"),
      ).not.toBeInTheDocument();
    });

    it("Default ストーリーでダイアログ・確認メッセージ・有効なボタン群が表示されること (AC-ND-06)", () => {
      render(<Default />);
      const dialog = screen.getByTestId("delete-confirm-dialog");
      expect(dialog).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");

      const message = screen.getByTestId("delete-confirm-message");
      expect(message).toHaveTextContent(
        "「テスト対象小説のタイトル」を本棚から削除しますか？取得済みの本文データもすべて削除されます。",
      );

      const cancelButton = screen.getByTestId("cancel-delete-button");
      expect(cancelButton).toBeInTheDocument();
      expect(cancelButton).not.toBeDisabled();
      expect(cancelButton).toHaveTextContent("キャンセル");

      const confirmButton = screen.getByTestId("confirm-delete-button");
      expect(confirmButton).toBeInTheDocument();
      expect(confirmButton).not.toBeDisabled();
      expect(confirmButton).toHaveTextContent("削除する");
    });

    it("Deleting ストーリーで各ボタンが無効化され「削除中...」表示になること (AC-ND-06)", () => {
      render(<Deleting />);
      const cancelButton = screen.getByTestId("cancel-delete-button");
      expect(cancelButton).toBeDisabled();

      const confirmButton = screen.getByTestId("confirm-delete-button");
      expect(confirmButton).toBeDisabled();
      expect(confirmButton).toHaveTextContent("削除中...");
    });
  });

  describe("ユーザーインタラクションの検証", () => {
    it("キャンセルボタンをクリックすると onClose が呼び出されること", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <DeleteConfirmDialog
          isOpen={true}
          novelTitle="小説タイトル"
          isDeleting={false}
          onClose={onClose}
          onConfirm={onConfirm}
        />,
      );

      await user.click(screen.getByTestId("cancel-delete-button"));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("削除確定ボタンをクリックすると onConfirm が呼び出されること (AC-ND-06)", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <DeleteConfirmDialog
          isOpen={true}
          novelTitle="小説タイトル"
          isDeleting={false}
          onClose={onClose}
          onConfirm={onConfirm}
        />,
      );

      await user.click(screen.getByTestId("confirm-delete-button"));
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("背景オーバーレイをクリックしたときに onClose が呼び出されること", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <DeleteConfirmDialog
          isOpen={true}
          novelTitle="小説タイトル"
          isDeleting={false}
          onClose={onClose}
          onConfirm={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("delete-confirm-dialog-backdrop"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("削除処理中（isDeleting === true）のときは背景クリックでも onClose が呼ばれないこと", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <DeleteConfirmDialog
          isOpen={true}
          novelTitle="小説タイトル"
          isDeleting={true}
          onClose={onClose}
          onConfirm={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("delete-confirm-dialog-backdrop"));
      expect(onClose).not.toHaveBeenCalled();
    });

    it("ダイアログ本体内部のクリックでは onClose が呼ばれないこと", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <DeleteConfirmDialog
          isOpen={true}
          novelTitle="小説タイトル"
          isDeleting={false}
          onClose={onClose}
          onConfirm={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("delete-confirm-dialog"));
      expect(onClose).not.toHaveBeenCalled();
    });

    it("Escapeキー押下で onClose が呼び出されること（非削除時のみ）", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      const { rerender } = render(
        <DeleteConfirmDialog
          isOpen={true}
          novelTitle="小説タイトル"
          isDeleting={false}
          onClose={onClose}
          onConfirm={vi.fn()}
        />,
      );

      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(1);

      // 削除処理中はEscapeキーでも閉じない
      onClose.mockClear();
      rerender(
        <DeleteConfirmDialog
          isOpen={true}
          novelTitle="小説タイトル"
          isDeleting={true}
          onClose={onClose}
          onConfirm={vi.fn()}
        />,
      );

      await user.keyboard("{Escape}");
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});

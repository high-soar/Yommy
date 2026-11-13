import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./BookmarkConflictDialog.stories";
import { BookmarkConflictDialog } from "./BookmarkConflictDialog";

const { Default, Resolving, Closed } = composeStories(stories);

describe("BookmarkConflictDialog", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Closed ストーリーでダイアログ要素が一切描画されないこと", () => {
      render(<Closed />);
      expect(
        screen.queryByTestId("bookmark-conflict-dialog"),
      ).not.toBeInTheDocument();
    });

    it("Default ストーリーでタイトル・メッセージ・2択ボタンが表示されること", () => {
      render(<Default />);
      const dialog = screen.getByTestId("bookmark-conflict-dialog");
      expect(dialog).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
      expect(
        screen.getByText("他の端末で読書位置が更新されました"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("bookmark-conflict-message")).toHaveTextContent(
        "別の端末で第15話まで読み進められています（現在は第10話を表示中）。どちらの話から読みますか？",
      );

      const moveBtn = screen.getByTestId("bookmark-conflict-move-button");
      expect(moveBtn).toHaveTextContent("第15話へ移動する");
      expect(moveBtn).not.toBeDisabled();

      const keepBtn = screen.getByTestId("bookmark-conflict-keep-button");
      expect(keepBtn).toHaveTextContent("第10話のまま読む");
      expect(keepBtn).not.toBeDisabled();
    });

    it("Resolving ストーリーで両ボタンが無効化されること", () => {
      render(<Resolving />);
      expect(
        screen.getByTestId("bookmark-conflict-move-button"),
      ).toBeDisabled();
      expect(
        screen.getByTestId("bookmark-conflict-keep-button"),
      ).toBeDisabled();
    });
  });

  describe("ユーザーインタラクションおよび誤操作防止ガードの検証", () => {
    it("「第N話へ移動する」ボタン押下で onMoveToRemote が呼ばれること", async () => {
      const user = userEvent.setup();
      const onMoveToRemote = vi.fn();
      const onKeepCurrent = vi.fn();

      render(
        <BookmarkConflictDialog
          isOpen={true}
          currentChapterIndex={3}
          remoteChapterIndex={8}
          onMoveToRemote={onMoveToRemote}
          onKeepCurrent={onKeepCurrent}
        />,
      );

      await user.click(screen.getByTestId("bookmark-conflict-move-button"));
      expect(onMoveToRemote).toHaveBeenCalledTimes(1);
      expect(onKeepCurrent).not.toHaveBeenCalled();
    });

    it("「第N話のまま読む」ボタン押下で onKeepCurrent が呼ばれること", async () => {
      const user = userEvent.setup();
      const onMoveToRemote = vi.fn();
      const onKeepCurrent = vi.fn();

      render(
        <BookmarkConflictDialog
          isOpen={true}
          currentChapterIndex={3}
          remoteChapterIndex={8}
          onMoveToRemote={onMoveToRemote}
          onKeepCurrent={onKeepCurrent}
        />,
      );

      await user.click(screen.getByTestId("bookmark-conflict-keep-button"));
      expect(onKeepCurrent).toHaveBeenCalledTimes(1);
      expect(onMoveToRemote).not.toHaveBeenCalled();
    });

    it("バックドロップをクリックしてもダイアログが閉じずコールバックが呼ばれないこと", async () => {
      const user = userEvent.setup();
      const onMoveToRemote = vi.fn();
      const onKeepCurrent = vi.fn();

      render(
        <BookmarkConflictDialog
          isOpen={true}
          currentChapterIndex={3}
          remoteChapterIndex={8}
          onMoveToRemote={onMoveToRemote}
          onKeepCurrent={onKeepCurrent}
        />,
      );

      await user.click(screen.getByTestId("bookmark-conflict-backdrop"));
      expect(
        screen.getByTestId("bookmark-conflict-dialog"),
      ).toBeInTheDocument();
      expect(onMoveToRemote).not.toHaveBeenCalled();
      expect(onKeepCurrent).not.toHaveBeenCalled();
    });

    it("Escape キーを押下してもダイアログが閉じずコールバックが呼ばれないこと", () => {
      const onMoveToRemote = vi.fn();
      const onKeepCurrent = vi.fn();

      render(
        <BookmarkConflictDialog
          isOpen={true}
          currentChapterIndex={3}
          remoteChapterIndex={8}
          onMoveToRemote={onMoveToRemote}
          onKeepCurrent={onKeepCurrent}
        />,
      );

      fireEvent.keyDown(window, { key: "Escape" });
      expect(
        screen.getByTestId("bookmark-conflict-dialog"),
      ).toBeInTheDocument();
      expect(onMoveToRemote).not.toHaveBeenCalled();
      expect(onKeepCurrent).not.toHaveBeenCalled();
    });
  });
});

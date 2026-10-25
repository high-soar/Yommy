import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./AddNovelDialog.stories";
import { AddNovelDialog } from "./AddNovelDialog";

const { Default, WithError, Submitting, Closed } = composeStories(stories);

describe("AddNovelDialog", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Closed ストーリーでダイアログ要素が一切描画されないこと", () => {
      render(<Closed />);
      expect(screen.queryByTestId("add-novel-dialog")).not.toBeInTheDocument();
    });

    it("Default ストーリーでダイアログ・入力欄・サンプルURLボタン・無効化送信ボタンが表示されること (AC-BS-01, AC-BS-02)", () => {
      render(<Default />);
      expect(screen.getByTestId("add-novel-dialog")).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
      expect(screen.getByTestId("add-novel-url-input")).toHaveValue("");
      expect(screen.getByTestId("fill-sample-url-button")).toBeInTheDocument();
      expect(screen.getByTestId("add-novel-submit-button")).toBeDisabled();
      expect(screen.getByTestId("add-novel-cancel-button")).not.toBeDisabled();
      expect(screen.queryByTestId("add-novel-error")).not.toBeInTheDocument();
    });

    it("WithError ストーリーでエラーメッセージが表示されること (AC-BS-03)", () => {
      render(<WithError />);
      const errorElement = screen.getByTestId("add-novel-error");
      expect(errorElement).toBeInTheDocument();
      expect(errorElement).toHaveTextContent(
        "対応していないURLです。カクヨムの作品URLを入力してください。",
      );
    });

    it("Submitting ストーリーで入力欄・ボタンが無効化され「取得中...」表示になること", () => {
      render(<Submitting />);
      expect(screen.getByTestId("add-novel-url-input")).toBeDisabled();
      expect(screen.getByTestId("add-novel-cancel-button")).toBeDisabled();
      const submitButton = screen.getByTestId("add-novel-submit-button");
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent("取得中...");
    });
  });

  describe("ユーザーインタラクションの検証", () => {
    it("URLを入力すると送信ボタンが有効になり、送信時に onSubmit が呼び出されること (AC-BS-02)", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const onClose = vi.fn();

      render(
        <AddNovelDialog
          isOpen={true}
          isSubmitting={false}
          onClose={onClose}
          onSubmit={onSubmit}
        />,
      );

      const input = screen.getByTestId("add-novel-url-input");
      const submitButton = screen.getByTestId("add-novel-submit-button");

      expect(submitButton).toBeDisabled();

      // 空白のみでは有効化されない
      await user.type(input, "   ");
      expect(submitButton).toBeDisabled();

      // URL入力で有効化
      await user.clear(input);
      await user.type(input, "https://kakuyomu.jp/works/16817330658027210412");
      expect(submitButton).not.toBeDisabled();

      await user.click(submitButton);
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
    });

    it("サンプルURL補助ボタンをクリックするとURLが入力欄にセットされること", async () => {
      const user = userEvent.setup();
      render(
        <AddNovelDialog
          isOpen={true}
          isSubmitting={false}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );

      const sampleButton = screen.getByTestId("fill-sample-url-button");
      const input = screen.getByTestId("add-novel-url-input");
      const submitButton = screen.getByTestId("add-novel-submit-button");

      await user.click(sampleButton);
      expect(input).toHaveValue(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      expect(submitButton).not.toBeDisabled();
    });

    it("キャンセルボタンをクリックすると onClose が呼び出されること", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <AddNovelDialog
          isOpen={true}
          isSubmitting={false}
          onClose={onClose}
          onSubmit={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("add-novel-cancel-button"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("背景オーバーレイをクリックしたときに onClose が呼び出されること", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <AddNovelDialog
          isOpen={true}
          isSubmitting={false}
          onClose={onClose}
          onSubmit={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("add-novel-dialog-backdrop"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("処理中（isSubmitting === true）のときは背景クリックでも onClose が呼ばれないこと", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <AddNovelDialog
          isOpen={true}
          isSubmitting={true}
          onClose={onClose}
          onSubmit={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("add-novel-dialog-backdrop"));
      expect(onClose).not.toHaveBeenCalled();
    });

    it("Escapeキー押下で onClose が呼び出されること（非送信時のみ）", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      const { rerender } = render(
        <AddNovelDialog
          isOpen={true}
          isSubmitting={false}
          onClose={onClose}
          onSubmit={vi.fn()}
        />,
      );

      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(1);

      // 送信中はEscapeキーでも閉じない
      onClose.mockClear();
      rerender(
        <AddNovelDialog
          isOpen={true}
          isSubmitting={true}
          onClose={onClose}
          onSubmit={vi.fn()}
        />,
      );

      await user.keyboard("{Escape}");
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});

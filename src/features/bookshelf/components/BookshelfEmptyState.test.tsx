import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./BookshelfEmptyState.stories";
import { BookshelfEmptyState } from "./BookshelfEmptyState";

const { Default } = composeStories(stories);

describe("BookshelfEmptyState", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Default ストーリーで空状態の案内文と追加ボタンが表示されること (AC-BS-01)", () => {
      render(<Default />);
      expect(screen.getByTestId("bookshelf-empty")).toBeInTheDocument();
      expect(
        screen.getByText("本棚に作品が登録されていません"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("empty-add-novel-button")).toBeInTheDocument();
      expect(screen.getByTestId("empty-add-novel-button")).toHaveTextContent(
        "URLから作品を追加",
      );
    });
  });

  describe("ユーザーインタラクションの検証", () => {
    it("追加ボタンをクリックしたときに onOpenAdd が呼び出されること (AC-BS-01)", async () => {
      const user = userEvent.setup();
      const onOpenAdd = vi.fn();
      render(<BookshelfEmptyState onOpenAdd={onOpenAdd} />);

      const button = screen.getByTestId("empty-add-novel-button");
      await user.click(button);

      expect(onOpenAdd).toHaveBeenCalledTimes(1);
    });
  });
});

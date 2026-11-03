import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./ReaderTopOverlay.stories";
import { ReaderTopOverlay } from "./ReaderTopOverlay";

const { Default, Closed, LongTitle } = composeStories(stories);

describe("ReaderTopOverlay", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Default ストーリーでオーバーレイが展開表示され、作品名・サブタイトルと「← 目次」ボタンが表示されること (AC-RD-22, AC-RD-23)", () => {
      render(<Default />);
      const overlay = screen.getByTestId("reader-top-overlay");
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveAttribute("aria-hidden", "false");
      expect(overlay).toHaveClass("translate-y-0");
      expect(overlay).not.toHaveClass("-translate-y-full");
      expect(overlay).not.toHaveClass("pointer-events-none");

      // 目次ボタン
      const backButton = screen.getByTestId("reader-top-back-to-toc");
      expect(backButton).toBeInTheDocument();
      expect(backButton).toHaveTextContent("← 目次");
      expect(backButton).toHaveClass("shrink-0");

      // 作品タイトル
      const novelTitle = screen.getByTestId("reader-top-novel-title");
      expect(novelTitle).toBeInTheDocument();
      expect(novelTitle).toHaveTextContent(
        "無職転生 〜異世界行ったら本気だす〜",
      );
      expect(novelTitle).toHaveClass("truncate");

      // サブタイトル
      const chapterTitle = screen.getByTestId("reader-top-chapter-title");
      expect(chapterTitle).toBeInTheDocument();
      expect(chapterTitle).toHaveTextContent("第1話 異世界転生");
      expect(chapterTitle).toHaveClass("truncate");
    });

    it("Closed ストーリーでオーバーレイが画面外へ退避し非活性スタイルが付与されること (AC-RD-22)", () => {
      render(<Closed />);
      const overlay = screen.getByTestId("reader-top-overlay");
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveAttribute("aria-hidden", "true");
      expect(overlay).toHaveClass("-translate-y-full");
      expect(overlay).toHaveClass("pointer-events-none");
      expect(overlay).not.toHaveClass("translate-y-0");
    });

    it("LongTitle ストーリーで100文字超のタイトル・サブタイトルが1行省略スタイルで保護されること (AC-RD-24)", () => {
      render(<LongTitle />);
      const novelTitle = screen.getByTestId("reader-top-novel-title");
      const chapterTitle = screen.getByTestId("reader-top-chapter-title");

      expect(novelTitle).toHaveClass("truncate");
      expect(chapterTitle).toHaveClass("truncate");
      expect(novelTitle.textContent?.length).toBeGreaterThan(100);
      expect(chapterTitle.textContent?.length).toBeGreaterThan(100);
    });
  });

  describe("コンポーネント直接テスト・イベント検証", () => {
    it("「← 目次」ボタンをクリックすると onBackToToc コールバックが発火すること (AC-RD-23)", async () => {
      const user = userEvent.setup();
      const onBackToTocMock = vi.fn();

      render(
        <ReaderTopOverlay
          isOpen={true}
          novelTitle="テスト作品"
          chapterTitle="第1話 テストサブタイトル"
          onBackToToc={onBackToTocMock}
        />,
      );

      const backButton = screen.getByTestId("reader-top-back-to-toc");
      await user.click(backButton);

      expect(onBackToTocMock).toHaveBeenCalledTimes(1);
    });

    it("isOpen=false の場合、ルート要素に -translate-y-full pointer-events-none が適用され aria-hidden=true となること", () => {
      render(
        <ReaderTopOverlay
          isOpen={false}
          novelTitle="テスト作品"
          chapterTitle="第1話 テストサブタイトル"
          onBackToToc={vi.fn()}
        />,
      );

      const overlay = screen.getByTestId("reader-top-overlay");
      expect(overlay).toHaveAttribute("aria-hidden", "true");
      expect(overlay).toHaveClass("-translate-y-full");
      expect(overlay).toHaveClass("pointer-events-none");
    });
  });
});

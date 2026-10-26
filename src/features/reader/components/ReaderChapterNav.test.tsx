import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./ReaderChapterNav.stories";
import { ReaderChapterNav } from "./ReaderChapterNav";

const { FirstChapter, MiddleChapter, LastChapter, SingleChapter, Loading } =
  composeStories(stories);

describe("ReaderChapterNav", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("FirstChapter ストーリーで第1話インジケーターが表示され前の話へが無効化されること", () => {
      render(<FirstChapter />);
      expect(screen.getByTestId("reader-chapter-nav")).toBeInTheDocument();
      expect(screen.getByTestId("reader-chapter-indicator")).toHaveTextContent(
        "第 1 話 / 全 10 話",
      );
      expect(screen.getByTestId("reader-prev-chapter")).toBeDisabled();
      expect(screen.getByTestId("reader-next-chapter")).not.toBeDisabled();
    });

    it("MiddleChapter ストーリーで前後話ボタンが両方有効化されること", () => {
      render(<MiddleChapter />);
      expect(screen.getByTestId("reader-chapter-indicator")).toHaveTextContent(
        "第 5 話 / 全 10 話",
      );
      expect(screen.getByTestId("reader-prev-chapter")).not.toBeDisabled();
      expect(screen.getByTestId("reader-next-chapter")).not.toBeDisabled();
    });

    it("LastChapter ストーリーで最終話インジケーターが表示され次の話へが無効化されること", () => {
      render(<LastChapter />);
      expect(screen.getByTestId("reader-chapter-indicator")).toHaveTextContent(
        "第 10 話 / 全 10 話",
      );
      expect(screen.getByTestId("reader-prev-chapter")).not.toBeDisabled();
      expect(screen.getByTestId("reader-next-chapter")).toBeDisabled();
    });

    it("SingleChapter ストーリーで単一話作品の前後話ボタンが両方無効化されること", () => {
      render(<SingleChapter />);
      expect(screen.getByTestId("reader-chapter-indicator")).toHaveTextContent(
        "第 1 話 / 全 1 話",
      );
      expect(screen.getByTestId("reader-prev-chapter")).toBeDisabled();
      expect(screen.getByTestId("reader-next-chapter")).toBeDisabled();
    });

    it("Loading ストーリーで取得中は前後話ボタンが両方無効化されること", () => {
      render(<Loading />);
      expect(screen.getByTestId("reader-prev-chapter")).toBeDisabled();
      expect(screen.getByTestId("reader-next-chapter")).toBeDisabled();
    });
  });

  describe("ユーザーインタラクションおよび境界値の検証", () => {
    it("活性時の「前の話へ」ボタン押下で onPrevChapter が呼び出されること", async () => {
      const user = userEvent.setup();
      const onPrev = vi.fn();
      render(
        <ReaderChapterNav
          chapterIndex={2}
          totalChapters={5}
          onPrevChapter={onPrev}
          onNextChapter={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("reader-prev-chapter"));
      expect(onPrev).toHaveBeenCalledTimes(1);
    });

    it("活性時の「次の話へ」ボタン押下で onNextChapter が呼び出されること", async () => {
      const user = userEvent.setup();
      const onNext = vi.fn();
      render(
        <ReaderChapterNav
          chapterIndex={2}
          totalChapters={5}
          onPrevChapter={vi.fn()}
          onNextChapter={onNext}
        />,
      );

      await user.click(screen.getByTestId("reader-next-chapter"));
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("chapterIndex <= 0 または totalChapters <= 0 の境界でも適切に無効化されること", () => {
      const { rerender } = render(
        <ReaderChapterNav
          chapterIndex={0}
          totalChapters={0}
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
        />,
      );

      expect(screen.getByTestId("reader-prev-chapter")).toBeDisabled();
      expect(screen.getByTestId("reader-next-chapter")).toBeDisabled();

      rerender(
        <ReaderChapterNav
          chapterIndex={1}
          totalChapters={0}
          onPrevChapter={vi.fn()}
          onNextChapter={vi.fn()}
        />,
      );
      expect(screen.getByTestId("reader-next-chapter")).toBeDisabled();
    });
  });
});

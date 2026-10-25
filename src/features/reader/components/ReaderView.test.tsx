import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./ReaderView.stories";
import { ReaderView } from "./ReaderView";

const {
  VerticalLight,
  VerticalSepia,
  VerticalDark,
  VerticalBlack,
  HorizontalLight,
} = composeStories(stories);

describe("ReaderView", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("VerticalLight ストーリーで縦書きとライトテーマが適用されること", () => {
      render(<VerticalLight />);
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveClass("writing-vertical-rl");
      expect(container).toHaveClass("bg-[#fcfcfc]");
      expect(screen.getByTestId("reader-title")).toHaveTextContent(
        "境界迷宮と異界の魔術師",
      );
      expect(screen.getByTestId("reader-chapter-title")).toHaveTextContent(
        "第1話 見知らぬ空",
      );
    });

    it("VerticalSepia ストーリーでセピアテーマのスタイルが適用されること", () => {
      render(<VerticalSepia />);
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveClass("bg-[#fbf0d9]");
      expect(container).toHaveClass("text-[#5f4b32]");
    });

    it("VerticalDark ストーリーでダークテーマのスタイルが適用されること", () => {
      render(<VerticalDark />);
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveClass("bg-slate-900");
      expect(container).toHaveClass("text-slate-200");
    });

    it("VerticalBlack ストーリーで純黒テーマのスタイルが適用されること", () => {
      render(<VerticalBlack />);
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveClass("bg-black");
      expect(container).toHaveClass("text-slate-300");
    });

    it("HorizontalLight ストーリーで横書きが適用されること", () => {
      render(<HorizontalLight />);
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveClass("writing-horizontal-tb");
    });
  });

  describe("HTML 要素・ルビ・傍点描画の検証", () => {
    it("ルビ (<ruby><rt>) および傍点 (<em class='bouten'>) が正しくレンダリングされること", () => {
      const html =
        '<p>二つの<ruby><rb>太陽</rb><rt>たいよう</rt></ruby>と<em class="bouten">信じがたい</em>光景</p>';
      render(<ReaderView bodyHtml={html} />);
      const body = screen.getByTestId("reader-body");
      expect(body.querySelector("ruby")).toBeInTheDocument();
      expect(body.querySelector("rt")).toHaveTextContent("たいよう");
      expect(body.querySelector("em.bouten")).toHaveTextContent("信じがたい");
    });

    it("タイトル・章タイトルが省略された場合に要素がレンダリングされないこと", () => {
      render(<ReaderView bodyHtml="<p>本文のみ</p>" />);
      expect(screen.queryByTestId("reader-title")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("reader-chapter-title"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("reader-body")).toHaveTextContent("本文のみ");
    });
  });
});

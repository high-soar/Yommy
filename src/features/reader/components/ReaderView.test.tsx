import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./ReaderView.stories";
import { ReaderView } from "./ReaderView";

const {
  VerticalLight,
  VerticalSepia,
  VerticalDark,
  VerticalBlack,
  HorizontalLight,
  CustomTypography,
  WithInitialScrollProgress,
} = composeStories(stories);

/**
 * JSDOM 要素の寸法プロパティ（scrollHeight / clientHeight / scrollWidth / clientWidth）をモックするヘルパー
 */
function mockElementDimensions(
  element: HTMLElement,
  dimensions: {
    scrollHeight?: number;
    clientHeight?: number;
    scrollWidth?: number;
    clientWidth?: number;
  },
) {
  if (dimensions.scrollHeight !== undefined) {
    Object.defineProperty(element, "scrollHeight", {
      value: dimensions.scrollHeight,
      configurable: true,
      writable: true,
    });
  }
  if (dimensions.clientHeight !== undefined) {
    Object.defineProperty(element, "clientHeight", {
      value: dimensions.clientHeight,
      configurable: true,
      writable: true,
    });
  }
  if (dimensions.scrollWidth !== undefined) {
    Object.defineProperty(element, "scrollWidth", {
      value: dimensions.scrollWidth,
      configurable: true,
      writable: true,
    });
  }
  if (dimensions.clientWidth !== undefined) {
    Object.defineProperty(element, "clientWidth", {
      value: dimensions.clientWidth,
      configurable: true,
      writable: true,
    });
  }
}

describe("ReaderView", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("VerticalLight ストーリーで縦書きとライトテーマが適用されること", () => {
      render(<VerticalLight />);
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveClass("writing-vertical-rl");
      expect(container).toHaveClass("bg-[#fcfcfc]");
      expect(container).toHaveAttribute("data-writing-mode", "vertical-rl");
      expect(container).toHaveAttribute("data-theme", "light");
      expect(container).toHaveAttribute("data-font-size", "18");
      expect(container).toHaveAttribute("data-line-height", "1.8");
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
      expect(container).toHaveAttribute("data-theme", "sepia");
    });

    it("VerticalDark ストーリーでダークテーマのスタイルが適用されること", () => {
      render(<VerticalDark />);
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveClass("bg-slate-900");
      expect(container).toHaveClass("text-slate-200");
      expect(container).toHaveAttribute("data-theme", "dark");
    });

    it("VerticalBlack ストーリーで純黒テーマのスタイルが適用されること", () => {
      render(<VerticalBlack />);
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveClass("bg-black");
      expect(container).toHaveClass("text-slate-300");
      expect(container).toHaveAttribute("data-theme", "black");
    });

    it("HorizontalLight ストーリーで横書きが適用されること", () => {
      render(<HorizontalLight />);
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveClass("writing-horizontal-tb");
      expect(container).toHaveAttribute("data-writing-mode", "horizontal-tb");
    });

    it("CustomTypography ストーリーで文字サイズ24px・行間2.2が属性およびインラインスタイルに適用されること", () => {
      render(<CustomTypography />);
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveAttribute("data-font-size", "24");
      expect(container).toHaveAttribute("data-line-height", "2.2");
      expect(container).toHaveStyle({
        fontSize: "24px",
        lineHeight: "2.2",
      });
    });

    it("WithInitialScrollProgress ストーリーがエラーなく描画されること", () => {
      render(<WithInitialScrollProgress />);
      expect(screen.getByTestId("reader-view")).toBeInTheDocument();
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

    it("タイトル・章タイトルが省略された場合にヘッダー要素がレンダリングされないこと", () => {
      render(<ReaderView bodyHtml="<p>本文のみ</p>" />);
      expect(screen.queryByTestId("reader-title")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("reader-chapter-title"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("reader-body")).toHaveTextContent("本文のみ");
    });
  });

  describe("横書き（horizontal-tb）でのスクロール進捗率算出および位置復元の検証", () => {
    it("スクロール操作時に scrollTop / maxScroll から進捗率（0.0〜1.0）が算出され通知されること", () => {
      const onProgress = vi.fn();
      render(
        <ReaderView
          bodyHtml="<p>横書きスクロール本文</p>"
          writingMode="horizontal-tb"
          onScrollProgressChange={onProgress}
        />,
      );

      const container = screen.getByTestId("reader-view");
      mockElementDimensions(container, {
        scrollHeight: 1000,
        clientHeight: 400,
      }); // maxScroll = 600

      container.scrollTop = 300;
      fireEvent.scroll(container);
      expect(onProgress).toHaveBeenCalledWith(0.5);

      container.scrollTop = 0;
      fireEvent.scroll(container);
      expect(onProgress).toHaveBeenCalledWith(0);

      container.scrollTop = 900; // オーバースクロール
      fireEvent.scroll(container);
      expect(onProgress).toHaveBeenCalledWith(1);
    });

    it("maxScroll <= 0 （スクロール不要時）のゼロ除算ガードで 0 が通知されること", () => {
      const onProgress = vi.fn();
      render(
        <ReaderView
          bodyHtml="<p>短い本文</p>"
          writingMode="horizontal-tb"
          onScrollProgressChange={onProgress}
        />,
      );

      const container = screen.getByTestId("reader-view");
      mockElementDimensions(container, {
        scrollHeight: 300,
        clientHeight: 300,
      });

      container.scrollTop = 0;
      fireEvent.scroll(container);
      expect(onProgress).toHaveBeenCalledWith(0);
    });

    it("initialScrollProgress によりマウント時およびプロパティ変化時に scrollTop が復元されること", () => {
      const { rerender } = render(
        <ReaderView
          bodyHtml="<p>本文1</p>"
          writingMode="horizontal-tb"
          initialScrollProgress={0.4}
        />,
      );

      const container = screen.getByTestId("reader-view");
      mockElementDimensions(container, {
        scrollHeight: 1000,
        clientHeight: 500,
      }); // maxScroll = 500

      // bodyHtml 変化による位置復元トリガー
      rerender(
        <ReaderView
          bodyHtml="<p>本文2</p>"
          writingMode="horizontal-tb"
          initialScrollProgress={0.4}
        />,
      );
      expect(container.scrollTop).toBe(200);

      // initialScrollProgress 変化（上限クランプ）
      rerender(
        <ReaderView
          bodyHtml="<p>本文2</p>"
          writingMode="horizontal-tb"
          initialScrollProgress={1.5}
        />,
      );
      expect(container.scrollTop).toBe(500);

      // initialScrollProgress 変化（下限クランプ）
      rerender(
        <ReaderView
          bodyHtml="<p>本文2</p>"
          writingMode="horizontal-tb"
          initialScrollProgress={-0.5}
        />,
      );
      expect(container.scrollTop).toBe(0);

      // maxScroll <= 0 時
      mockElementDimensions(container, {
        scrollHeight: 500,
        clientHeight: 500,
      });
      rerender(
        <ReaderView
          bodyHtml="<p>本文3</p>"
          writingMode="horizontal-tb"
          initialScrollProgress={0.5}
        />,
      );
      expect(container.scrollTop).toBe(0);
    });
  });

  describe("縦書き（vertical-rl）でのスクロール進捗率算出および位置復元の検証", () => {
    it("スクロール操作時に Math.abs(scrollLeft) / maxScroll から進捗率（0.0〜1.0）が算出され通知されること", () => {
      const onProgress = vi.fn();
      render(
        <ReaderView
          bodyHtml="<p>縦書きスクロール本文</p>"
          writingMode="vertical-rl"
          onScrollProgressChange={onProgress}
        />,
      );

      const container = screen.getByTestId("reader-view");
      mockElementDimensions(container, {
        scrollWidth: 1200,
        clientWidth: 400,
      }); // maxScroll = 800

      // Chromium vertical-rl: 負の scrollLeft
      container.scrollLeft = -400;
      fireEvent.scroll(container);
      expect(onProgress).toHaveBeenCalledWith(0.5);

      container.scrollLeft = 0;
      fireEvent.scroll(container);
      expect(onProgress).toHaveBeenCalledWith(0);

      container.scrollLeft = -1000; // オーバースクロール
      fireEvent.scroll(container);
      expect(onProgress).toHaveBeenCalledWith(1);
    });

    it("縦書きで maxScroll <= 0 のときは 0 が通知されること", () => {
      const onProgress = vi.fn();
      render(
        <ReaderView
          bodyHtml="<p>短い本文</p>"
          writingMode="vertical-rl"
          onScrollProgressChange={onProgress}
        />,
      );

      const container = screen.getByTestId("reader-view");
      mockElementDimensions(container, {
        scrollWidth: 400,
        clientWidth: 400,
      });

      container.scrollLeft = 0;
      fireEvent.scroll(container);
      expect(onProgress).toHaveBeenCalledWith(0);
    });

    it("initialScrollProgress によりマウント時および組み方向切替時に負の scrollLeft が復元されること", () => {
      const { rerender } = render(
        <ReaderView
          bodyHtml="<p>縦書き本文1</p>"
          writingMode="vertical-rl"
          initialScrollProgress={0.75}
        />,
      );

      const container = screen.getByTestId("reader-view");
      mockElementDimensions(container, {
        scrollWidth: 1000,
        clientWidth: 200,
      }); // maxScroll = 800

      // writingMode 変化による復元トリガー
      rerender(
        <ReaderView
          bodyHtml="<p>縦書き本文1</p>"
          writingMode="horizontal-tb"
          initialScrollProgress={0.75}
        />,
      );
      mockElementDimensions(container, {
        scrollHeight: 1000,
        clientHeight: 200,
      });
      rerender(
        <ReaderView
          bodyHtml="<p>縦書き本文1</p>"
          writingMode="vertical-rl"
          initialScrollProgress={0.75}
        />,
      );
      mockElementDimensions(container, {
        scrollWidth: 1000,
        clientWidth: 200,
      });
      // 0.75 * 800 = 600 -> -600
      expect(container.scrollLeft).toBe(-600);

      // maxScroll <= 0 時
      mockElementDimensions(container, {
        scrollWidth: 200,
        clientWidth: 200,
      });
      rerender(
        <ReaderView
          bodyHtml="<p>短い縦書き本文</p>"
          writingMode="vertical-rl"
          initialScrollProgress={0.75}
        />,
      );
      expect(container.scrollLeft).toBe(0);
    });

    it("onScrollProgressChange が渡されていない場合にスクロールしてもクラッシュしないこと", () => {
      render(
        <ReaderView
          bodyHtml="<p>コールバックなし</p>"
          writingMode="vertical-rl"
        />,
      );
      const container = screen.getByTestId("reader-view");
      mockElementDimensions(container, {
        scrollWidth: 1000,
        clientWidth: 500,
      });
      container.scrollLeft = -250;
      expect(() => fireEvent.scroll(container)).not.toThrow();
    });
  });
});

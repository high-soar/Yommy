import React from "react";
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
  VerticalLongContent,
  VerticalPaged,
  HorizontalPaged,
  PageIndicator,
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
    it("VerticalLight ストーリーで縦書きとライトテーマが適用され、全画面スタイル（h-full w-full）でカード装飾・高さ制限が撤廃されていること", () => {
      render(<VerticalLight />);
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveClass("writing-vertical-rl");
      expect(container).toHaveClass("bg-[#fcfcfc]");
      expect(container).toHaveClass("h-full");
      expect(container).toHaveClass("w-full");
      expect(container).not.toHaveClass("rounded-lg");
      expect(container).not.toHaveClass("shadow-sm");
      expect(container).not.toHaveClass("border");
      expect(container).not.toHaveClass("h-[70vh]");
      expect(container).not.toHaveClass("md:h-[80vh]");
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

    it("HorizontalLight ストーリーで横書きが適用され、全画面高さ（h-full）が指定されていること", () => {
      render(<HorizontalLight />);
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveClass("writing-horizontal-tb");
      expect(container).toHaveClass("h-full");
      expect(container).toHaveClass("w-full");
      expect(container).not.toHaveClass("max-h-[70vh]");
      expect(container).not.toHaveClass("md:max-h-[80vh]");
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

    it("VerticalLongContent ストーリーで直交フロー時も親コンテナ幅に収まるクラス（w-full max-w-full）が付与され長文が描画されること", () => {
      render(<VerticalLongContent />);
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveClass("writing-vertical-rl");
      expect(container).toHaveClass("w-full");
      expect(container).toHaveClass("max-w-full");
      expect(screen.getByTestId("reader-body")).toHaveTextContent("第18段落");
    });

    it("VerticalPaged ストーリーで縦書き・ページめくり設定およびページインジケーター（1 / 5）が描画されること", () => {
      render(<VerticalPaged />);
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveAttribute("data-writing-mode", "vertical-rl");
      expect(container).toHaveAttribute("data-paging-mode", "paged");
      expect(container).toHaveAttribute("data-effective-paging-mode", "paged");
      expect(container).toHaveAttribute("data-current-page", "1");
      expect(container).toHaveAttribute("data-total-pages", "5");
      expect(container).toHaveClass("overflow-hidden");
      const indicator = screen.getByTestId("reader-page-indicator");
      expect(indicator).toHaveTextContent("1 / 5");
    });

    it("HorizontalPaged ストーリーで横書き・ページめくり設定およびページインジケーター（2 / 6）が描画されること", () => {
      render(<HorizontalPaged />);
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveAttribute("data-writing-mode", "horizontal-tb");
      expect(container).toHaveAttribute("data-paging-mode", "paged");
      expect(container).toHaveAttribute("data-effective-paging-mode", "paged");
      expect(container).toHaveAttribute("data-current-page", "2");
      expect(container).toHaveAttribute("data-total-pages", "6");
      expect(container).toHaveClass("overflow-hidden");
      const indicator = screen.getByTestId("reader-page-indicator");
      expect(indicator).toHaveTextContent("2 / 6");
    });

    it("PageIndicator ストーリーで指定された現在ページと総ページ数（3 / 12）が表示されること", () => {
      render(<PageIndicator />);
      const indicator = screen.getByTestId("reader-page-indicator");
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent("3 / 12");
      expect(indicator).toHaveClass("tabular-nums");
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
          pagingMode="scroll"
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
          pagingMode="scroll"
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
          pagingMode="scroll"
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
          pagingMode="scroll"
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
          pagingMode="scroll"
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
          pagingMode="scroll"
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
          pagingMode="scroll"
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

    it("containerRef.current が null の場合に位置復元処理が早期リターンされること", () => {
      const mockRef = {};
      Object.defineProperty(mockRef, "current", {
        get: () => null,
        set: () => {},
        configurable: true,
      });
      const useRefSpy = vi
        .spyOn(React, "useRef")
        .mockReturnValueOnce(
          mockRef as unknown as React.RefObject<HTMLDivElement | null>,
        );

      render(
        <ReaderView
          bodyHtml="<p>Ref が null のケース</p>"
          pagingMode="scroll"
          initialScrollProgress={0.5}
        />,
      );
      useRefSpy.mockRestore();
    });
  });

  describe("ページ送りモードと実効モード（effectivePagingMode）およびセマンティック属性の検証", () => {
    it("pagingMode='auto' かつ writingMode='vertical-rl' で実効モードが paged となり、data-current-page および data-total-pages が付与されること", () => {
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="auto"
          currentPage={1}
          totalPages={5}
        />,
      );
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveAttribute("data-paging-mode", "auto");
      expect(container).toHaveAttribute("data-effective-paging-mode", "paged");
      expect(container).toHaveAttribute("data-current-page", "1");
      expect(container).toHaveAttribute("data-total-pages", "5");
      expect(container).toHaveClass("overflow-hidden");
    });

    it("pagingMode='auto' かつ writingMode='horizontal-tb' で実効モードが scroll となり、ページ番号属性が付与されないこと", () => {
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="horizontal-tb"
          pagingMode="auto"
          currentPage={2}
          totalPages={5}
        />,
      );
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveAttribute("data-paging-mode", "auto");
      expect(container).toHaveAttribute("data-effective-paging-mode", "scroll");
      expect(container).not.toHaveAttribute("data-current-page");
      expect(container).not.toHaveAttribute("data-total-pages");
      expect(container).not.toHaveClass("overflow-hidden");
      expect(
        screen.queryByTestId("reader-page-indicator"),
      ).not.toBeInTheDocument();
    });

    it("pagingMode='scroll' のときは縦書きでも実効モードが scroll となること", () => {
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="scroll"
          currentPage={1}
          totalPages={5}
        />,
      );
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveAttribute("data-effective-paging-mode", "scroll");
      expect(container).not.toHaveAttribute("data-current-page");
      expect(container).not.toHaveAttribute("data-total-pages");
      expect(
        screen.queryByTestId("reader-page-indicator"),
      ).not.toBeInTheDocument();
    });

    it("pagingMode='paged' のときは横書きでも実効モードが paged となること", () => {
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="horizontal-tb"
          pagingMode="paged"
          currentPage={3}
          totalPages={8}
        />,
      );
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveAttribute("data-effective-paging-mode", "paged");
      expect(container).toHaveAttribute("data-current-page", "3");
      expect(container).toHaveAttribute("data-total-pages", "8");
      expect(screen.getByTestId("reader-page-indicator")).toHaveTextContent(
        "3 / 8",
      );
    });
  });

  describe("1ページ組版および横スライドアニメーション（実効 paged 時）の検証", () => {
    it("縦書き（vertical-rl）時、(currentPage - 1) * pageWidth + slideOffsetPx に基づく transform が設定されること", () => {
      const { rerender } = render(
        <ReaderView
          bodyHtml="<p>縦書き本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          currentPage={2}
          totalPages={4}
          slideOffsetPx={0}
        />,
      );

      const container = screen.getByTestId("reader-view");
      mockElementDimensions(container, { clientWidth: 400 });

      // clientWidth 反映のための再描画
      rerender(
        <ReaderView
          bodyHtml="<p>縦書き本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          currentPage={2}
          totalPages={4}
          slideOffsetPx={0}
        />,
      );

      const content = screen.getByTestId("reader-content");
      // (2 - 1) * 400 + 0 = 400px
      expect(content).toHaveStyle({
        transform: "translateX(400px)",
        transition: "transform 200ms ease-out",
      });

      // スワイプドラッグ中（slideOffsetPx !== 0）は transition が none
      rerender(
        <ReaderView
          bodyHtml="<p>縦書き本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          currentPage={2}
          totalPages={4}
          slideOffsetPx={-50}
        />,
      );
      // (2 - 1) * 400 + (-50) = 350px
      expect(content).toHaveStyle({
        transform: "translateX(350px)",
        transition: "none",
      });
    });

    it("横書き（horizontal-tb）時、-(currentPage - 1) * pageWidth + slideOffsetPx に基づく transform およびマルチカラム組版スタイルが設定されること", () => {
      const { rerender } = render(
        <ReaderView
          bodyHtml="<p>横書き本文</p>"
          writingMode="horizontal-tb"
          pagingMode="paged"
          currentPage={3}
          totalPages={5}
          slideOffsetPx={0}
        />,
      );

      const container = screen.getByTestId("reader-view");
      mockElementDimensions(container, { clientWidth: 500 });

      rerender(
        <ReaderView
          bodyHtml="<p>横書き本文</p>"
          writingMode="horizontal-tb"
          pagingMode="paged"
          currentPage={3}
          totalPages={5}
          slideOffsetPx={0}
        />,
      );

      const content = screen.getByTestId("reader-content");
      // -(3 - 1) * 500 + 0 = -1000px
      expect(content).toHaveStyle({
        transform: "translateX(-1000px)",
        transition: "transform 200ms ease-out",
        columnWidth: "100%",
        columnGap: "0px",
      });

      // スワイプドラッグ中
      rerender(
        <ReaderView
          bodyHtml="<p>横書き本文</p>"
          writingMode="horizontal-tb"
          pagingMode="paged"
          currentPage={3}
          totalPages={5}
          slideOffsetPx={60}
        />,
      );
      // -(3 - 1) * 500 + 60 = -940px
      expect(content).toHaveStyle({
        transform: "translateX(-940px)",
        transition: "none",
      });
    });

    it("pageWidth が取得できない（clientWidth = 0）場合は translateX(0px) となること", () => {
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          currentPage={2}
          totalPages={4}
        />,
      );

      const content = screen.getByTestId("reader-content");
      expect(content).toHaveStyle({
        transform: "translateX(0px)",
      });
    });
  });

  describe("DOM 寸法計測と総ページ数算出（onTotalPagesChange）の検証", () => {
    it("実効 paged 時、マウント時およびプロパティ変化時に scrollWidth と clientWidth から総ページ数が算出され通知されること", () => {
      const onTotalPagesChange = vi.fn();
      const { rerender } = render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          onTotalPagesChange={onTotalPagesChange}
        />,
      );

      const container = screen.getByTestId("reader-view");
      mockElementDimensions(container, {
        scrollWidth: 2000,
        clientWidth: 500,
      });

      // bodyHtml 変化による再計測
      rerender(
        <ReaderView
          bodyHtml="<p>長い本文2</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          onTotalPagesChange={onTotalPagesChange}
        />,
      );
      // Math.ceil(2000 / 500) = 4
      expect(onTotalPagesChange).toHaveBeenCalledWith(4);

      // 端数がある場合: Math.ceil(1300 / 500) = 3
      mockElementDimensions(container, {
        scrollWidth: 1300,
        clientWidth: 500,
      });
      rerender(
        <ReaderView
          bodyHtml="<p>長い本文3</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          fontSizePx={22}
          onTotalPagesChange={onTotalPagesChange}
        />,
      );
      expect(onTotalPagesChange).toHaveBeenCalledWith(3);
    });

    it("clientWidth が 0 のときはゼロ除算を回避して総ページ数 1 が通知されること", () => {
      const onTotalPagesChange = vi.fn();
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          onTotalPagesChange={onTotalPagesChange}
        />,
      );

      const container = screen.getByTestId("reader-view");
      mockElementDimensions(container, {
        scrollWidth: 1000,
        clientWidth: 0,
      });

      expect(onTotalPagesChange).toHaveBeenCalledWith(1);
    });

    it("実効 scroll モードのときは onTotalPagesChange が呼び出されないこと", () => {
      const onTotalPagesChange = vi.fn();
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="horizontal-tb"
          pagingMode="scroll"
          onTotalPagesChange={onTotalPagesChange}
        />,
      );

      expect(onTotalPagesChange).not.toHaveBeenCalled();
    });
  });

  describe("ページインジケーターの表示制御の検証", () => {
    it("実効 paged 時に reader-page-indicator が表示され、控えめな透過度・スタイルで現在ページと総ページ数が表示されること", () => {
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          currentPage={4}
          totalPages={10}
        />,
      );

      const indicator = screen.getByTestId("reader-page-indicator");
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent("4 / 10");
      expect(indicator).toHaveClass("opacity-60");
      expect(indicator).toHaveClass("tabular-nums");
      expect(indicator).toHaveClass("pointer-events-none");
    });

    it("実効 scroll 時に reader-page-indicator が描画されないこと", () => {
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="horizontal-tb"
          pagingMode="scroll"
          currentPage={1}
          totalPages={10}
        />,
      );

      expect(
        screen.queryByTestId("reader-page-indicator"),
      ).not.toBeInTheDocument();
    });
  });
});

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./ReaderView.stories";
import { ReaderView } from "./ReaderView";
import { FONT_FAMILY_STACKS } from "../../../shared/constants/typography";
import type { ReaderFontFamily } from "../../../storage/types";

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
  ScrollWithChapterButtons,
  ScrollFirstChapter,
  ScrollLastChapter,
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

    it("HorizontalPaged ストーリーで横書き・paged 設定時でも実効スクロールモード固定となること (v0.5 Issue #168, #173)", () => {
      render(<HorizontalPaged />);
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveAttribute("data-writing-mode", "horizontal-tb");
      expect(container).toHaveAttribute("data-paging-mode", "paged");
      expect(container).toHaveAttribute("data-effective-paging-mode", "scroll");
      expect(container).not.toHaveAttribute("data-current-page");
      expect(container).not.toHaveAttribute("data-total-pages");
      expect(container).toHaveClass("overflow-y-auto");
      expect(
        screen.queryByTestId("reader-page-indicator"),
      ).not.toBeInTheDocument();
    });

    it("PageIndicator ストーリーで指定された現在ページと総ページ数（3 / 12）が表示されること", () => {
      render(<PageIndicator />);
      const indicator = screen.getByTestId("reader-page-indicator");
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent("3 / 12");
      expect(indicator).toHaveClass("tabular-nums");
    });

    it("ScrollWithChapterButtons ストーリーで本文先頭・末尾の前後話ボタンが表示されること", () => {
      render(<ScrollWithChapterButtons />);
      const prevButton = screen.getByTestId("reader-scroll-prev-chapter");
      const nextButton = screen.getByTestId("reader-scroll-next-chapter");
      expect(prevButton).toBeInTheDocument();
      expect(prevButton).not.toBeDisabled();
      expect(nextButton).toBeInTheDocument();
      expect(nextButton).not.toBeDisabled();
    });

    it("ScrollFirstChapter ストーリーで第1話の前話ボタンが無効化されること", () => {
      render(<ScrollFirstChapter />);
      const prevButton = screen.getByTestId("reader-scroll-prev-chapter");
      const nextButton = screen.getByTestId("reader-scroll-next-chapter");
      expect(prevButton).toBeDisabled();
      expect(nextButton).not.toBeDisabled();
    });

    it("ScrollLastChapter ストーリーで最終話の次話ボタンが無効化されること", () => {
      render(<ScrollLastChapter />);
      const prevButton = screen.getByTestId("reader-scroll-prev-chapter");
      const nextButton = screen.getByTestId("reader-scroll-next-chapter");
      expect(prevButton).not.toBeDisabled();
      expect(nextButton).toBeDisabled();
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

    it("横書き（horizontal-tb）のときは pagingMode='paged' が指定されても実効モードが scroll 固定となること (v0.5 Issue #168, #173)", () => {
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
      expect(container).toHaveAttribute("data-effective-paging-mode", "scroll");
      expect(container).not.toHaveAttribute("data-current-page");
      expect(container).not.toHaveAttribute("data-total-pages");
      expect(
        screen.queryByTestId("reader-page-indicator"),
      ).not.toBeInTheDocument();
    });
  });

  describe("1ページ組版および横スライドアニメーション（実効 paged 時）の検証", () => {
    it("縦書き（vertical-rl）時、translateY(-(currentPage - 1) * pageHeight) に基づく transform およびマルチカラム組版スタイルが設定されること (AC-RD-15, AC-RD-16, v0.5 Issue #168, #174)", () => {
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
      mockElementDimensions(container, { clientWidth: 400, clientHeight: 600 });

      // clientDimensions 反映のための再描画
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
      // マルチカラムスタイル (AC-RD-15)
      expect(content.style.columns).toBe("1");
      expect(content.style.columnGap).toBe("48px");
      expect(content.style.columnFill).toBe("auto");
      expect(content.style.width).toBe("352px"); // 400 - 48
      expect(content.style.height).toBe("552px"); // 600 - 48

      // translateY によるページ位置確定 (AC-RD-16): -(2 - 1) * 600 = -600px
      expect(content).toHaveStyle({
        transform: "translateY(-600px)",
        transition: "transform 200ms ease-out",
      });

      // スワイプドラッグ中（slideOffsetPx !== 0）は translateX が付与され transition が none
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
      expect(content).toHaveStyle({
        transform: "translateY(-600px) translateX(-50px)",
        transition: "none",
      });
    });

    it("横書き（horizontal-tb）時は pagingMode='paged' が指定されても transform およびマルチカラム組版スタイルが適用されずスクロールモードとなること (v0.5 Issue #168, #173)", () => {
      render(
        <ReaderView
          bodyHtml="<p>横書き本文</p>"
          writingMode="horizontal-tb"
          pagingMode="paged"
          currentPage={3}
          totalPages={5}
          slideOffsetPx={60}
        />,
      );

      const content = screen.getByTestId("reader-content");
      // 実効 scroll モードのため transform や columnGap は適用されない
      expect(content.style.transform).toBe("");
      expect(content.style.columnGap).toBe("");
      expect(content.style.columns).toBe("");
    });

    it("pageHeight が取得できない（clientHeight = 0）場合は translateY(0px) となること", () => {
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
        transform: "translateY(0px)",
      });
    });

    it("ウィンドウリサイズ時にコンテナ高さが再追従され translateY が更新されること", () => {
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          currentPage={2}
          totalPages={4}
        />,
      );

      const container = screen.getByTestId("reader-view");
      mockElementDimensions(container, { clientWidth: 400, clientHeight: 700 });
      fireEvent(window, new Event("resize"));

      const content = screen.getByTestId("reader-content");
      // -(2 - 1) * 700 = -700px
      expect(content).toHaveStyle({
        transform: "translateY(-700px)",
      });
    });

    it("containerRef.current が null の状態でマウントされても早期リターンされること", () => {
      const mockRef = {};
      Object.defineProperty(mockRef, "current", {
        get: () => null,
        set: () => {},
        configurable: true,
      });

      // 1. 実効 paged
      const useRefSpy1 = vi
        .spyOn(React, "useRef")
        .mockReturnValueOnce(
          mockRef as unknown as React.RefObject<HTMLDivElement | null>,
        );
      expect(() => {
        render(
          <ReaderView
            bodyHtml="<p>本文</p>"
            writingMode="vertical-rl"
            pagingMode="paged"
          />,
        );
      }).not.toThrow();
      useRefSpy1.mockRestore();

      // 2. 実効 scroll
      const useRefSpy2 = vi
        .spyOn(React, "useRef")
        .mockReturnValueOnce(
          mockRef as unknown as React.RefObject<HTMLDivElement | null>,
        );
      expect(() => {
        render(
          <ReaderView
            bodyHtml="<p>本文</p>"
            writingMode="horizontal-tb"
            pagingMode="scroll"
          />,
        );
      }).not.toThrow();
      useRefSpy2.mockRestore();
    });

    it("handleScroll 実行時に containerRef.current が null の場合早期リターンされること", () => {
      const onProgress = vi.fn();
      const mockRef = {};
      Object.defineProperty(mockRef, "current", {
        get: () => null,
        set: () => {},
        configurable: true,
      });
      const useRefSpy = vi
        .spyOn(React, "useRef")
        .mockReturnValue(
          mockRef as unknown as React.RefObject<HTMLDivElement | null>,
        );

      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="horizontal-tb"
          pagingMode="scroll"
          onScrollProgressChange={onProgress}
        />,
      );

      const container = screen.getByTestId("reader-view");
      fireEvent.scroll(container);
      expect(onProgress).not.toHaveBeenCalled();

      useRefSpy.mockRestore();
    });
  });

  describe("DOM 寸法計測と総ページ数算出（onTotalPagesChange）の検証", () => {
    it("実効 paged 時、マウント時およびプロパティ変化時に scrollHeight と clientHeight から総ページ数が算出され通知されること (AC-RD-17, v0.5 Issue #168, #174)", () => {
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
      const content = screen.getByTestId("reader-content");
      mockElementDimensions(container, {
        clientHeight: 600,
        clientWidth: 400,
      });
      mockElementDimensions(content, {
        scrollHeight: 1152, // 2ページ分: (600 - 48) * 2 + 48 = 1152
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
      // Math.round((1152 + 48) / 600) = 2
      expect(onTotalPagesChange).toHaveBeenCalledWith(2);

      // 3ページ分の場合: (600 - 48) * 3 + 48 * 2 = 1752
      mockElementDimensions(content, {
        scrollHeight: 1752,
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

    it("clientHeight が 0 のときはゼロ除算を回避して総ページ数 1 が通知されること", () => {
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
        scrollHeight: 1000,
        clientHeight: 0,
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

    it("実効 paged モードであっても scroll イベントが発生した際に onScrollProgressChange が呼び出され進捗が通知されること", () => {
      const onProgress = vi.fn();
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          onScrollProgressChange={onProgress}
        />,
      );

      const container = screen.getByTestId("reader-view");
      mockElementDimensions(container, {
        scrollWidth: 1000,
        clientWidth: 500,
      });
      container.scrollLeft = -250;
      fireEvent.scroll(container);
      expect(onProgress).toHaveBeenCalledWith(0.5);
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
      expect(indicator).toHaveClass("[writing-mode:horizontal-tb]");
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

    it("横書き時は paged モード指定時でもマルチカラムインラインスタイルが適用されずスクロールモードとなること (R1-08, v0.5 Issue #168, #173)", () => {
      render(
        <ReaderView
          bodyHtml="<p>長文本文</p>"
          writingMode="horizontal-tb"
          pagingMode="paged"
          currentPage={2}
          totalPages={5}
        />,
      );

      const content = screen.getByTestId("reader-content");
      // 横書き時は実効 scroll モードのためマルチカラムスタイルは適用されない
      expect(content.style.columns).toBe("");
      expect(content.style.columnGap).toBe("");
    });

    it("画面リサイズ時に総ページ数が再計測され onTotalPagesChange が呼ばれること (R1-17)", async () => {
      const onTotalPagesChange = vi.fn();
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          currentPage={1}
          onTotalPagesChange={onTotalPagesChange}
        />,
      );

      onTotalPagesChange.mockClear();

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      expect(onTotalPagesChange).toHaveBeenCalled();
    });

    it("実効 paged モードで initialScrollProgress が指定されても scrollLeft は 0 にリセットされ二重変位が防止されること (R1-27)", () => {
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          currentPage={2}
          totalPages={3}
          initialScrollProgress={0.5}
        />,
      );

      const container = screen.getByTestId("reader-view");
      expect(container.scrollLeft).toBe(0);
      expect(container.scrollTop).toBe(0);
    });

    it("同一 bodyHtml であっても chapterTitle または initialScrollProgress が変化した際（前後話遷移時）に総ページ数が再計測され onTotalPagesChange が呼び出されること (R2-04, v0.5 Issue #168, #174)", () => {
      const onTotalPagesChange = vi.fn();
      const { rerender } = render(
        <ReaderView
          chapterTitle="第2話 見知らぬ空"
          bodyHtml="<p>共通本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          initialScrollProgress={0}
          onTotalPagesChange={onTotalPagesChange}
        />,
      );

      const container = screen.getByTestId("reader-view");
      const content = screen.getByTestId("reader-content");
      mockElementDimensions(container, {
        clientHeight: 500,
        clientWidth: 400,
      });
      mockElementDimensions(content, {
        scrollHeight: 952, // (500 - 48) * 2 + 48 = 952 => (952 + 48) / 500 = 2
      });
      onTotalPagesChange.mockClear();

      rerender(
        <ReaderView
          chapterTitle="プロローグ：目覚め"
          bodyHtml="<p>共通本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          initialScrollProgress={1}
          onTotalPagesChange={onTotalPagesChange}
        />,
      );

      expect(onTotalPagesChange).toHaveBeenCalledWith(2);
    });

    it("微小な余白や行の高さの端数（±20px）があっても round により安定してページ数が導出されること (AC-RD-17)", () => {
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
      const content = screen.getByTestId("reader-content");
      mockElementDimensions(container, {
        clientHeight: 600,
        clientWidth: 400,
      });

      // +8px の端数 (1160px) -> round((1160 + 48) / 600) = round(2.013) = 2
      mockElementDimensions(content, {
        scrollHeight: 1160,
      });
      rerender(
        <ReaderView
          bodyHtml="<p>本文1</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          onTotalPagesChange={onTotalPagesChange}
        />,
      );
      expect(onTotalPagesChange).toHaveBeenCalledWith(2);

      // -12px の端数 (1140px) -> round((1140 + 48) / 600) = round(1.98) = 2
      mockElementDimensions(content, {
        scrollHeight: 1140,
      });
      rerender(
        <ReaderView
          bodyHtml="<p>本文2</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          onTotalPagesChange={onTotalPagesChange}
        />,
      );
      expect(onTotalPagesChange).toHaveBeenCalledWith(2);
    });

    it("containerWidth や containerHeight が 48 以下の極小ビューポートでは width/height スタイルが付与されないこと", () => {
      const { rerender } = render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          currentPage={1}
          totalPages={1}
        />,
      );

      const container = screen.getByTestId("reader-view");
      mockElementDimensions(container, { clientWidth: 40, clientHeight: 40 });

      rerender(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          currentPage={1}
          totalPages={1}
        />,
      );

      const content = screen.getByTestId("reader-content");
      expect(content.style.width).toBe("");
      expect(content.style.height).toBe("");
      expect(content.style.columnWidth).toBe("");
      expect(content.style.columns).toBe("1");
      expect(content.style.columnGap).toBe("48px");
    });
  });

  describe("実機タッチ制御（touch-action: none / touch-none）の検証 (AC-RD-18, v0.5 Issue #168, #175)", () => {
    it("実効 paged モード時、ルート要素（reader-view）に touch-none クラスが付与されること", () => {
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          currentPage={1}
          totalPages={3}
        />,
      );
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveClass("touch-none");
    });

    it("実効 scroll モード時、ルート要素（reader-view）に touch-none クラスが付与されないこと", () => {
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="scroll"
        />,
      );
      const container = screen.getByTestId("reader-view");
      expect(container).not.toHaveClass("touch-none");
    });
  });

  describe("連続スクロールモードでの本文先頭・末尾前後話ボタン配置（AC-RD-19, v0.5 Issue #168, #175）", () => {
    it("実効 paged モード時は本文先頭・末尾の前後話ボタンが表示されないこと", () => {
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          chapterIndex={2}
          totalChapters={5}
        />,
      );
      expect(
        screen.queryByTestId("reader-scroll-prev-chapter"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("reader-scroll-next-chapter"),
      ).not.toBeInTheDocument();
    });

    it("実効 scroll モード時、本文先頭に「前の話へ」、末尾に「次の話へ」ボタンが表示されること", () => {
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="scroll"
          chapterIndex={2}
          totalChapters={5}
        />,
      );
      expect(
        screen.getByTestId("reader-scroll-prev-chapter"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("reader-scroll-next-chapter"),
      ).toBeInTheDocument();
    });

    it("第1話（chapterIndex=1）のとき、先頭の「前の話へ」ボタンが disabled となること", () => {
      const onPrevChapter = vi.fn();
      const onNextChapter = vi.fn();
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="scroll"
          chapterIndex={1}
          totalChapters={3}
          onPrevChapter={onPrevChapter}
          onNextChapter={onNextChapter}
        />,
      );
      const prevBtn = screen.getByTestId("reader-scroll-prev-chapter");
      const nextBtn = screen.getByTestId("reader-scroll-next-chapter");

      expect(prevBtn).toBeDisabled();
      expect(nextBtn).toBeEnabled();

      fireEvent.click(nextBtn);
      expect(onNextChapter).toHaveBeenCalledTimes(1);
    });

    it("最終話（chapterIndex=totalChapters）のとき、末尾の「次の話へ」ボタンが disabled となること", () => {
      const onPrevChapter = vi.fn();
      const onNextChapter = vi.fn();
      render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="scroll"
          chapterIndex={3}
          totalChapters={3}
          onPrevChapter={onPrevChapter}
          onNextChapter={onNextChapter}
        />,
      );
      const prevBtn = screen.getByTestId("reader-scroll-prev-chapter");
      const nextBtn = screen.getByTestId("reader-scroll-next-chapter");

      expect(prevBtn).toBeEnabled();
      expect(nextBtn).toBeDisabled();

      fireEvent.click(prevBtn);
      expect(onPrevChapter).toHaveBeenCalledTimes(1);
    });

    it("横書きスクロール時でも前後話ボタンが表示され、テーマに応じたスタイルが適用されること", () => {
      const { rerender } = render(
        <ReaderView
          bodyHtml="<p>横書き本文</p>"
          writingMode="horizontal-tb"
          pagingMode="scroll"
          theme="sepia"
          chapterIndex={2}
          totalChapters={4}
        />,
      );
      let prevBtn = screen.getByTestId("reader-scroll-prev-chapter");
      let nextBtn = screen.getByTestId("reader-scroll-next-chapter");
      expect(prevBtn).toHaveClass("bg-[#f0e4c8]");
      expect(nextBtn).toHaveClass("bg-[#f0e4c8]");

      // dark テーマ
      rerender(
        <ReaderView
          bodyHtml="<p>横書き本文</p>"
          writingMode="horizontal-tb"
          pagingMode="scroll"
          theme="dark"
          chapterIndex={2}
          totalChapters={4}
        />,
      );
      prevBtn = screen.getByTestId("reader-scroll-prev-chapter");
      nextBtn = screen.getByTestId("reader-scroll-next-chapter");
      expect(prevBtn).toHaveClass("bg-slate-800/80");
      expect(nextBtn).toHaveClass("bg-slate-800/80");

      // black テーマ
      rerender(
        <ReaderView
          bodyHtml="<p>横書き本文</p>"
          writingMode="horizontal-tb"
          pagingMode="scroll"
          theme="black"
          chapterIndex={2}
          totalChapters={4}
        />,
      );
      prevBtn = screen.getByTestId("reader-scroll-prev-chapter");
      nextBtn = screen.getByTestId("reader-scroll-next-chapter");
      expect(prevBtn).toHaveClass("bg-slate-800/80");
      expect(nextBtn).toHaveClass("bg-slate-800/80");

      // light テーマ
      rerender(
        <ReaderView
          bodyHtml="<p>横書き本文</p>"
          writingMode="horizontal-tb"
          pagingMode="scroll"
          theme="light"
          chapterIndex={2}
          totalChapters={4}
        />,
      );
      prevBtn = screen.getByTestId("reader-scroll-prev-chapter");
      nextBtn = screen.getByTestId("reader-scroll-next-chapter");
      expect(prevBtn).toHaveClass("bg-white");
      expect(nextBtn).toHaveClass("bg-white");
    });
  });

  describe("フォント種別と動的画面余白の組版反映の検証 (AC-RD-21, SYS-REQ-09, v0.5 Issue #169, #180)", () => {
    const fontFamilies: ReaderFontFamily[] = [
      "biz-ud-mincho",
      "mincho",
      "biz-ud-gothic",
      "gothic",
      "klee",
    ];

    it.each(fontFamilies)(
      "fontFamily='%s' 指定時に対応する CSS フォントスタックがインラインスタイルに適用され data-font-family 属性が付与されること",
      (family) => {
        render(<ReaderView bodyHtml="<p>本文</p>" fontFamily={family} />);
        const container = screen.getByTestId("reader-view");
        expect(container).toHaveAttribute("data-font-family", family);
        expect(container.style.fontFamily).toBe(FONT_FAMILY_STACKS[family]);
      },
    );

    it("fontFamily 省略時は既定値 'biz-ud-mincho' のフォントスタックが適用されること", () => {
      render(<ReaderView bodyHtml="<p>本文</p>" />);
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveAttribute("data-font-family", "biz-ud-mincho");
      expect(container.style.fontFamily).toBe(
        FONT_FAMILY_STACKS["biz-ud-mincho"],
      );
    });

    it("ハードコードされていた font-serif クラスが付与されていないこと", () => {
      render(<ReaderView bodyHtml="<p>本文</p>" />);
      const container = screen.getByTestId("reader-view");
      expect(container).not.toHaveClass("font-serif");
    });

    it("連続スクロール時（横書き）、動的画面余白 padding: ${pageMarginPx}px がインラインスタイルに適用され data-page-margin 属性が付与され p-6 クラスが付与されないこと", () => {
      render(
        <ReaderView
          bodyHtml="<p>横書き本文</p>"
          writingMode="horizontal-tb"
          pageMarginPx={32}
        />,
      );
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveAttribute("data-page-margin", "32");
      expect(container.style.padding).toBe("32px");
      expect(container).not.toHaveClass("p-6");
    });

    it("連続スクロール時（縦書き scroll）、動的画面余白 padding: ${pageMarginPx}px が適用されること", () => {
      render(
        <ReaderView
          bodyHtml="<p>縦書き本文</p>"
          writingMode="vertical-rl"
          pagingMode="scroll"
          pageMarginPx={12}
        />,
      );
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveAttribute("data-page-margin", "12");
      expect(container.style.padding).toBe("12px");
      expect(container).not.toHaveClass("p-6");
    });

    it("pageMarginPx 省略時は既定値 20px が適用されること", () => {
      render(
        <ReaderView bodyHtml="<p>横書き本文</p>" writingMode="horizontal-tb" />,
      );
      const container = screen.getByTestId("reader-view");
      expect(container).toHaveAttribute("data-page-margin", "20");
      expect(container.style.padding).toBe("20px");
    });

    it("縦書きマルチカラム組版時（実効 paged）、pageMarginPx に応じて columnGap・width・height が動的に算出されること", () => {
      const { rerender } = render(
        <ReaderView
          bodyHtml="<p>縦書き本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          pageMarginPx={16}
        />,
      );
      const container = screen.getByTestId("reader-view");
      mockElementDimensions(container, {
        clientWidth: 400,
        clientHeight: 600,
      });

      rerender(
        <ReaderView
          bodyHtml="<p>縦書き本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          pageMarginPx={16}
        />,
      );

      const content = screen.getByTestId("reader-content");
      // columnGap = 16 * 2 = 32px
      expect(content.style.columnGap).toBe("32px");
      // width = Math.max(1, 400 - 32) = 368px
      expect(content.style.width).toBe("368px");
      // height = Math.max(1, 600 - 32) = 568px
      expect(content.style.height).toBe("568px");
    });

    it("極小ビューポート（containerWidth <= pageMarginPx * 2）でも Math.max(1, ...) により 1px 以上が保証されること", () => {
      const { rerender } = render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          pageMarginPx={24}
        />,
      );
      const container = screen.getByTestId("reader-view");
      mockElementDimensions(container, {
        clientWidth: 30,
        clientHeight: 30,
      });

      rerender(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          pageMarginPx={24}
        />,
      );

      const content = screen.getByTestId("reader-content");
      expect(content.style.columnGap).toBe("48px");
      expect(content.style.width).toBe("1px");
      expect(content.style.height).toBe("1px");
    });

    it("pageMarginPx または fontFamily の変化により onTotalPagesChange が再発火し余白を考慮した総ページ数が算出されること", () => {
      const onTotalPagesChange = vi.fn();
      const { rerender } = render(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          pageMarginPx={20}
          fontFamily="biz-ud-mincho"
          onTotalPagesChange={onTotalPagesChange}
        />,
      );

      const container = screen.getByTestId("reader-view");
      const content = screen.getByTestId("reader-content");
      mockElementDimensions(container, {
        clientHeight: 600,
        clientWidth: 400,
      });
      // (1120 + 40 * 2) / 600 = 1200 / 600 = 2
      mockElementDimensions(content, {
        scrollHeight: 1120,
      });

      onTotalPagesChange.mockClear();

      // pageMarginPx を 40 に変更: (1120 + 40 * 2) / 600 = 1200 / 600 = 2
      rerender(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          pageMarginPx={40}
          fontFamily="biz-ud-mincho"
          onTotalPagesChange={onTotalPagesChange}
        />,
      );
      expect(onTotalPagesChange).toHaveBeenCalledWith(2);

      onTotalPagesChange.mockClear();

      // fontFamily を変更: 再評価が発火すること
      rerender(
        <ReaderView
          bodyHtml="<p>本文</p>"
          writingMode="vertical-rl"
          pagingMode="paged"
          pageMarginPx={40}
          fontFamily="klee"
          onTotalPagesChange={onTotalPagesChange}
        />,
      );
      expect(onTotalPagesChange).toHaveBeenCalledWith(2);
    });
  });
});

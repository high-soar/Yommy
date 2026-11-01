import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SampleTextPreview.stories";
import { SampleTextPreview } from "./SampleTextPreview";
import { FONT_FAMILY_STACKS } from "../../../shared/constants/typography";

const {
  VerticalLight,
  VerticalSepia,
  VerticalDark,
  VerticalBlack,
  HorizontalLight,
  CustomTypography,
  FontMincho,
  FontGothic,
  FontBizUdGothic,
  FontKlee,
  MarginMin,
  MarginMax,
} = composeStories(stories);

describe("SampleTextPreview", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("VerticalLight: 縦書き・ライトテーマのセマンティック属性、スタイル、およびルビ・傍点が正しく描画されること (AC-ST-02)", () => {
      render(<VerticalLight />);
      const preview = screen.getByTestId("sample-text-preview");

      // セマンティック属性
      expect(preview).toHaveAttribute("data-writing-mode", "vertical-rl");
      expect(preview).toHaveAttribute("data-theme", "light");
      expect(preview).toHaveAttribute("data-font-size", "18");
      expect(preview).toHaveAttribute("data-line-height", "1.8");
      expect(preview).toHaveAttribute("data-font-family", "biz-ud-mincho");
      expect(preview).toHaveAttribute("data-page-margin", "20");

      // 共通・外枠スタイル（ハードコード p-4/p-6, font-serif は廃止され動的スタイル化）
      expect(preview).toHaveClass(
        "rounded-xl",
        "border",
        "shadow-xs",
        "h-64",
        "w-full",
        "transition-colors",
        "duration-200",
        "select-none",
      );
      expect(preview).not.toHaveClass("font-serif");
      expect(preview).not.toHaveClass("p-4");

      // 縦書きスタイル
      expect(preview).toHaveClass(
        "writing-vertical-rl",
        "overflow-x-auto",
        "overflow-y-hidden",
        "leading-loose",
      );

      // ライトテーマスタイル
      expect(preview).toHaveClass(
        "bg-[#fcfcfc]",
        "text-slate-900",
        "border-slate-200",
      );

      // インラインスタイル（CSSフォントスタックおよび画面余白パディング）
      expect(preview).toHaveStyle({
        fontSize: "18px",
        lineHeight: "1.8",
        fontFamily: FONT_FAMILY_STACKS["biz-ud-mincho"],
        padding: "20px",
      });

      // 内部コンテンツのルビ・傍点
      const content = preview.querySelector(".novel-content");
      expect(content).not.toBeNull();

      const ruby = content?.querySelector("ruby");
      expect(ruby).not.toBeNull();
      expect(ruby?.querySelector("rt")?.textContent).toBe("ねこ");

      const bouten = content?.querySelector("em.bouten");
      expect(bouten).not.toBeNull();
      expect(bouten?.textContent).toBe("見当");

      expect(content?.textContent).toContain(
        "吾輩は猫（ねこ）である。名前はまだ無い。",
      );
      expect(content?.textContent).toContain(
        "どこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。",
      );
    });

    it("VerticalSepia: セピアテーマのスタイルクラスとセマンティック属性が適用されること (AC-ST-02)", () => {
      render(<VerticalSepia />);
      const preview = screen.getByTestId("sample-text-preview");

      expect(preview).toHaveAttribute("data-theme", "sepia");
      expect(preview).toHaveClass(
        "bg-[#fbf0d9]",
        "text-[#5f4b32]",
        "border-[#ebd9b9]",
      );
    });

    it("VerticalDark: ダークテーマのスタイルクラスとセマンティック属性が適用されること (AC-ST-02)", () => {
      render(<VerticalDark />);
      const preview = screen.getByTestId("sample-text-preview");

      expect(preview).toHaveAttribute("data-theme", "dark");
      expect(preview).toHaveClass(
        "bg-slate-900",
        "text-slate-200",
        "border-slate-800",
      );
    });

    it("VerticalBlack: ブラックテーマのスタイルクラスとセマンティック属性が適用されること (AC-ST-02)", () => {
      render(<VerticalBlack />);
      const preview = screen.getByTestId("sample-text-preview");

      expect(preview).toHaveAttribute("data-theme", "black");
      expect(preview).toHaveClass(
        "bg-black",
        "text-slate-300",
        "border-neutral-900",
      );
    });

    it("HorizontalLight: 横書き表示時の組み方向スタイルとセマンティック属性が適用されること (AC-ST-02)", () => {
      render(<HorizontalLight />);
      const preview = screen.getByTestId("sample-text-preview");

      expect(preview).toHaveAttribute("data-writing-mode", "horizontal-tb");
      expect(preview).toHaveClass(
        "writing-horizontal-tb",
        "overflow-y-auto",
        "overflow-x-hidden",
        "leading-relaxed",
      );
    });

    it("CustomTypography: カスタム文字サイズ（24px）および行間（2.2）が反映されること (AC-ST-02)", () => {
      render(<CustomTypography />);
      const preview = screen.getByTestId("sample-text-preview");

      expect(preview).toHaveAttribute("data-font-size", "24");
      expect(preview).toHaveAttribute("data-line-height", "2.2");
      expect(preview).toHaveStyle({
        fontSize: "24px",
        lineHeight: "2.2",
      });
    });

    it("FontMincho: 明朝体（標準）フォントスタックが適用されること (AC-ST-02, AC-ST-17)", () => {
      render(<FontMincho />);
      const preview = screen.getByTestId("sample-text-preview");

      expect(preview).toHaveAttribute("data-font-family", "mincho");
      expect(preview).toHaveStyle({
        fontFamily: FONT_FAMILY_STACKS.mincho,
      });
    });

    it("FontGothic: ゴシック体（標準）フォントスタックが適用されること (AC-ST-02, AC-ST-17)", () => {
      render(<FontGothic />);
      const preview = screen.getByTestId("sample-text-preview");

      expect(preview).toHaveAttribute("data-font-family", "gothic");
      expect(preview).toHaveStyle({
        fontFamily: FONT_FAMILY_STACKS.gothic,
      });
    });

    it("FontBizUdGothic: UDゴシックフォントスタックが適用されること (AC-ST-02, AC-ST-17)", () => {
      render(<FontBizUdGothic />);
      const preview = screen.getByTestId("sample-text-preview");

      expect(preview).toHaveAttribute("data-font-family", "biz-ud-gothic");
      expect(preview).toHaveStyle({
        fontFamily: FONT_FAMILY_STACKS["biz-ud-gothic"],
      });
    });

    it("FontKlee: 教科書体（Klee）フォントスタックが適用されること (AC-ST-02, AC-ST-17)", () => {
      render(<FontKlee />);
      const preview = screen.getByTestId("sample-text-preview");

      expect(preview).toHaveAttribute("data-font-family", "klee");
      expect(preview).toHaveStyle({
        fontFamily: FONT_FAMILY_STACKS.klee,
      });
    });

    it("MarginMin: 最小余白（8px）が padding および属性に反映されること (AC-ST-02, AC-ST-18)", () => {
      render(<MarginMin />);
      const preview = screen.getByTestId("sample-text-preview");

      expect(preview).toHaveAttribute("data-page-margin", "8");
      expect(preview).toHaveStyle({
        padding: "8px",
      });
    });

    it("MarginMax: 最大余白（48px）が padding および属性に反映されること (AC-ST-02, AC-ST-18)", () => {
      render(<MarginMax />);
      const preview = screen.getByTestId("sample-text-preview");

      expect(preview).toHaveAttribute("data-page-margin", "48");
      expect(preview).toHaveStyle({
        padding: "48px",
      });
    });
  });

  describe("直接 Props レンダリングとエッジケース検証", () => {
    it("fontFamily および pageMarginPx 省略時に既定値（'biz-ud-mincho', 20）が適用されること (AC-ST-02)", () => {
      render(
        <SampleTextPreview
          writingMode="vertical-rl"
          theme="light"
          fontSizePx={18}
          lineHeight={1.8}
        />,
      );
      const preview = screen.getByTestId("sample-text-preview");
      expect(preview).toHaveAttribute("data-font-family", "biz-ud-mincho");
      expect(preview).toHaveAttribute("data-page-margin", "20");
      expect(preview).toHaveStyle({
        fontFamily: FONT_FAMILY_STACKS["biz-ud-mincho"],
        padding: "20px",
      });
    });

    it("className が指定された場合、既存スタイルと正しくマージされること", () => {
      render(
        <SampleTextPreview
          writingMode="vertical-rl"
          theme="light"
          fontSizePx={16}
          lineHeight={1.6}
          className="custom-preview-class"
        />,
      );
      const preview = screen.getByTestId("sample-text-preview");
      expect(preview).toHaveClass("custom-preview-class");
      expect(preview).toHaveClass("rounded-xl");
    });

    it("className が未指定の場合でも、余分な空白なく基本クラスが適用されること", () => {
      render(
        <SampleTextPreview
          writingMode="horizontal-tb"
          theme="dark"
          fontSizePx={20}
          lineHeight={2.0}
        />,
      );
      const preview = screen.getByTestId("sample-text-preview");
      expect(preview).toHaveClass("rounded-xl");
      expect(preview.className).not.toContain("undefined");
    });
  });
});

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SampleTextPreview.stories";
import { SampleTextPreview } from "./SampleTextPreview";

const {
  VerticalLight,
  VerticalSepia,
  VerticalDark,
  VerticalBlack,
  HorizontalLight,
  CustomTypography,
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

      // 共通・外枠スタイル
      expect(preview).toHaveClass(
        "rounded-xl",
        "border",
        "shadow-xs",
        "h-64",
        "w-full",
        "p-4",
        "md:p-6",
        "font-serif",
        "transition-colors",
        "duration-200",
        "select-none",
      );

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

      // インラインスタイル
      expect(preview).toHaveStyle({
        fontSize: "18px",
        lineHeight: "1.8",
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
  });

  describe("直接 Props レンダリングとエッジケース検証", () => {
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

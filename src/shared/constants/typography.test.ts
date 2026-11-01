import { describe, expect, it } from "vitest";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_PAGE_MARGIN_PX,
  MIN_PAGE_MARGIN_PX,
  MAX_PAGE_MARGIN_PX,
  PAGE_MARGIN_STEP_PX,
  FONT_FAMILY_STACKS,
  FONT_FAMILY_OPTIONS,
  clampPageMargin,
} from "./typography";
import type { ReaderFontFamily } from "../../storage/types";

describe("typography 共通定数およびユーティリティ", () => {
  it("既定値および境界値定数が仕様通り定義されていること", () => {
    expect(DEFAULT_FONT_FAMILY).toBe("biz-ud-mincho");
    expect(DEFAULT_PAGE_MARGIN_PX).toBe(20);
    expect(MIN_PAGE_MARGIN_PX).toBe(8);
    expect(MAX_PAGE_MARGIN_PX).toBe(48);
    expect(PAGE_MARGIN_STEP_PX).toBe(4);
  });

  it("5種類のフォントスタックが正しく定義されていること", () => {
    const expectedKeys: ReaderFontFamily[] = [
      "biz-ud-mincho",
      "mincho",
      "biz-ud-gothic",
      "gothic",
      "klee",
    ];

    expect(Object.keys(FONT_FAMILY_STACKS)).toEqual(expectedKeys);
    expect(FONT_FAMILY_STACKS["biz-ud-mincho"]).toContain("BIZ UDMincho");
    expect(FONT_FAMILY_STACKS["mincho"]).toContain("Noto Serif CJK JP");
    expect(FONT_FAMILY_STACKS["biz-ud-gothic"]).toContain("BIZ UDGothic");
    expect(FONT_FAMILY_STACKS["gothic"]).toContain("Noto Sans CJK JP");
    expect(FONT_FAMILY_STACKS["klee"]).toContain("Klee One");
  });

  it("5種類のフォント選択肢リストが正しく定義されていること", () => {
    expect(FONT_FAMILY_OPTIONS).toHaveLength(5);
    expect(FONT_FAMILY_OPTIONS[0]).toEqual({
      value: "biz-ud-mincho",
      label: "UD明朝（BIZ UDMincho）",
    });
    expect(FONT_FAMILY_OPTIONS[1]).toEqual({
      value: "mincho",
      label: "明朝体（標準）",
    });
    expect(FONT_FAMILY_OPTIONS[2]).toEqual({
      value: "biz-ud-gothic",
      label: "UDゴシック（BIZ UDGothic）",
    });
    expect(FONT_FAMILY_OPTIONS[3]).toEqual({
      value: "gothic",
      label: "ゴシック体（標準）",
    });
    expect(FONT_FAMILY_OPTIONS[4]).toEqual({
      value: "klee",
      label: "教科書体（Klee）",
    });
  });

  describe("clampPageMargin", () => {
    it("正常範囲内の4px刻み値はそのまま返却されること", () => {
      expect(clampPageMargin(20)).toBe(20);
      expect(clampPageMargin(8)).toBe(8);
      expect(clampPageMargin(48)).toBe(48);
      expect(clampPageMargin(24)).toBe(24);
    });

    it("下限値未満の値は MIN_PAGE_MARGIN_PX (8) にクランプされること", () => {
      expect(clampPageMargin(0)).toBe(8);
      expect(clampPageMargin(-10)).toBe(8);
      expect(clampPageMargin(7)).toBe(8);
    });

    it("上限値超過の値は MAX_PAGE_MARGIN_PX (48) にクランプされること", () => {
      expect(clampPageMargin(50)).toBe(48);
      expect(clampPageMargin(100)).toBe(48);
    });

    it("4px 刻みから外れた端数は最も近い 4px 刻みに丸められること", () => {
      expect(clampPageMargin(9)).toBe(8);
      expect(clampPageMargin(11)).toBe(12);
      expect(clampPageMargin(21)).toBe(20);
      expect(clampPageMargin(23)).toBe(24);
    });
  });
});

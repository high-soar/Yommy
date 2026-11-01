import type { ReaderFontFamily } from "../../storage/types";

/**
 * 既定のフォント種別（SYS-REQ-09 / AC-ST-17: 'biz-ud-mincho'）
 */
export const DEFAULT_FONT_FAMILY: ReaderFontFamily = "biz-ud-mincho";

/**
 * 既定の画面余白 px（SYS-REQ-09 / AC-ST-18: 20px）
 */
export const DEFAULT_PAGE_MARGIN_PX = 20;

/**
 * 最小画面余白 px（AC-ST-18: 8px）
 */
export const MIN_PAGE_MARGIN_PX = 8;

/**
 * 最大画面余白 px（AC-ST-18: 48px）
 */
export const MAX_PAGE_MARGIN_PX = 48;

/**
 * 画面余白ステッパー刻み幅 px（AC-ST-18: 4px）
 */
export const PAGE_MARGIN_STEP_PX = 4;

/**
 * フォント種別ごとの CSS フォントスタック定義
 * DevContainer のインストールフォントおよび Android 実機環境に対応
 */
export const FONT_FAMILY_STACKS: Readonly<Record<ReaderFontFamily, string>> = {
  "biz-ud-mincho":
    "'BIZ UDMincho', 'Noto Serif CJK JP', 'Noto Serif JP', 'IPAexMincho', serif",
  mincho:
    "'Noto Serif CJK JP', 'Noto Serif JP', 'IPAexMincho', 'Hiragino Mincho ProN', 'Yu Mincho', serif",
  "biz-ud-gothic":
    "'BIZ UDGothic', 'Noto Sans CJK JP', 'Noto Sans JP', 'IPAexGothic', sans-serif",
  gothic:
    "'Noto Sans CJK JP', 'Noto Sans JP', 'IPAexGothic', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif",
  klee: "'Klee One', 'Klee', 'Noto Serif CJK JP', serif",
};

export interface FontFamilyOption {
  value: ReaderFontFamily;
  label: string;
}

/**
 * 設定画面のドロップダウンで表示する選択肢一覧（5種）
 */
export const FONT_FAMILY_OPTIONS: readonly FontFamilyOption[] = [
  { value: "biz-ud-mincho", label: "UD明朝（BIZ UDMincho）" },
  { value: "mincho", label: "明朝体（標準）" },
  { value: "biz-ud-gothic", label: "UDゴシック（BIZ UDGothic）" },
  { value: "gothic", label: "ゴシック体（標準）" },
  { value: "klee", label: "教科書体（Klee）" },
] as const;

/**
 * 画面余白を許容範囲 [8, 48] 内に制限し、4px 刻みに丸める
 */
export function clampPageMargin(marginPx: number): number {
  const clamped = Math.max(
    MIN_PAGE_MARGIN_PX,
    Math.min(MAX_PAGE_MARGIN_PX, marginPx),
  );
  const steps = Math.round(
    (clamped - MIN_PAGE_MARGIN_PX) / PAGE_MARGIN_STEP_PX,
  );
  return MIN_PAGE_MARGIN_PX + steps * PAGE_MARGIN_STEP_PX;
}

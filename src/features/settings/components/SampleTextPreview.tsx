import React from "react";
import type { WritingMode, ReaderTheme } from "../../../storage/types";

export interface SampleTextPreviewProps {
  /** 組み方向（'vertical-rl' または 'horizontal-tb'） */
  writingMode: WritingMode;
  /** カラーテーマ（'light' | 'sepia' | 'dark' | 'black'） */
  theme: ReaderTheme;
  /** 文字サイズ (px) */
  fontSizePx: number;
  /** 行間倍率 */
  lineHeight: number;
  /** 追加の CSS クラス（任意） */
  className?: string;
}

/**
 * 設定画面（SCR-05）において、組版・フォント・テーマ変更をリアルタイムに反映する
 * サンプル小説文プレビュー Presentational コンポーネント（スタブ）
 */
export const SampleTextPreview: React.FC<SampleTextPreviewProps> = () => {
  return null;
};

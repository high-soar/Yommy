import React from "react";
import type { WritingMode, ReaderTheme } from "../../../storage/types";

export interface SettingsPageProps {
  /** 現在の組み方向 */
  writingMode: WritingMode;
  /** 現在のカラーテーマ */
  theme: ReaderTheme;
  /** 現在の文字サイズ (px)（省略時: 18） */
  fontSizePx?: number;
  /** 現在の行間倍率（省略時: 1.8） */
  lineHeight?: number;
  /** 設定読み込み中フラグ（省略時: false） */
  isLoading?: boolean;
  /** 組み方向切替ボタン押下時のコールバック */
  onToggleWritingMode: () => void;
  /** テーマ選択ボタン押下時のコールバック */
  onChangeTheme: (theme: ReaderTheme) => void;
  /** 文字サイズ変更ボタン押下時のコールバック */
  onChangeFontSize: (nextSizePx: number) => void;
  /** 行間変更ボタン押下時のコールバック */
  onChangeLineHeight: (nextHeight: number) => void;
  /** 追加の CSS クラス（任意） */
  className?: string;
}

/**
 * 設定画面（SCR-05）の Presentational コンポーネント（スタブ）
 */
export const SettingsPage: React.FC<SettingsPageProps> = () => {
  return <div data-testid="settings-page">TODO</div>;
};

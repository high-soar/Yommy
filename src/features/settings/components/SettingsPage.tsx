import React from "react";
import type { WritingMode, ReaderTheme } from "../../../storage/types";
import { SampleTextPreview } from "./SampleTextPreview";

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

export const MIN_FONT_SIZE_PX = 12;
export const MAX_FONT_SIZE_PX = 32;
export const FONT_SIZE_STEP_PX = 2;

export const MIN_LINE_HEIGHT = 1.4;
export const MAX_LINE_HEIGHT = 2.4;
export const LINE_HEIGHT_STEP = 0.2;

interface ThemeOption {
  key: ReaderTheme;
  label: string;
  testId: string;
  colorClass: string;
}

const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    key: "light",
    label: "ライト",
    testId: "theme-light",
    colorClass:
      "bg-[#fcfcfc] text-slate-900 border-slate-300 dark:border-slate-600",
  },
  {
    key: "sepia",
    label: "セピア",
    testId: "theme-sepia",
    colorClass: "bg-[#fbf0d9] text-[#5f4b32] border-[#ebd9b9]",
  },
  {
    key: "dark",
    label: "ダーク",
    testId: "theme-dark",
    colorClass: "bg-slate-800 text-slate-100 border-slate-700",
  },
  {
    key: "black",
    label: "ブラック",
    testId: "theme-black",
    colorClass: "bg-black text-slate-200 border-neutral-800",
  },
];

/**
 * 設定画面（SCR-05）の Presentational コンポーネント（AC-ST-03, AC-ST-04, AC-ST-05）
 * ヘッダー、組版設定項目（組み方向・テーマ・文字サイズ・行間）、および組版プレビューを配置する
 */
export const SettingsPage: React.FC<SettingsPageProps> = ({
  writingMode,
  theme,
  fontSizePx = 18,
  lineHeight = 1.8,
  isLoading = false,
  onToggleWritingMode,
  onChangeTheme,
  onChangeFontSize,
  onChangeLineHeight,
  className,
}) => {
  const rootClasses =
    `h-full flex flex-col overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 ${className ?? ""}`.trim();

  const handleDecreaseFontSize = () => {
    onChangeFontSize(
      Math.max(MIN_FONT_SIZE_PX, fontSizePx - FONT_SIZE_STEP_PX),
    );
  };

  const handleIncreaseFontSize = () => {
    onChangeFontSize(
      Math.min(MAX_FONT_SIZE_PX, fontSizePx + FONT_SIZE_STEP_PX),
    );
  };

  const handleDecreaseLineHeight = () => {
    onChangeLineHeight(
      Math.max(
        MIN_LINE_HEIGHT,
        Math.round((lineHeight - LINE_HEIGHT_STEP) * 10) / 10,
      ),
    );
  };

  const handleIncreaseLineHeight = () => {
    onChangeLineHeight(
      Math.min(
        MAX_LINE_HEIGHT,
        Math.round((lineHeight + LINE_HEIGHT_STEP) * 10) / 10,
      ),
    );
  };

  return (
    <div data-testid="settings-page" className={rootClasses}>
      <div className="max-w-2xl mx-auto w-full p-4 md:p-6 pb-20">
        <header
          data-testid="settings-header"
          className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800"
        >
          <span className="text-2xl select-none" aria-hidden="true">
            ⚙️
          </span>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            設定
          </h1>
        </header>

        <section
          data-testid="typography-settings-section"
          aria-label="表示・組版設定"
          className="space-y-6 mb-8"
        >
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            組版・表示設定
          </h2>

          <div className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                組み方向
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                縦書きと横書きを切り替えます
              </p>
            </div>
            <button
              type="button"
              data-testid="toggle-orientation"
              disabled={isLoading}
              onClick={onToggleWritingMode}
              className="px-3.5 py-1.5 text-xs md:text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {writingMode === "vertical-rl"
                ? "横書き表示に切替"
                : "縦書き表示に切替"}
            </button>
          </div>

          <div className="py-3 border-b border-slate-200 dark:border-slate-800">
            <div className="mb-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                カラーテーマ
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                読書時の背景色と文字色を選択します
              </p>
            </div>
            <div
              role="group"
              aria-label="カラーテーマ選択"
              className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
            >
              {THEME_OPTIONS.map((opt) => {
                const isSelected = theme === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    data-testid={opt.testId}
                    aria-pressed={isSelected}
                    disabled={isLoading}
                    onClick={() => onChangeTheme(opt.key)}
                    className={`px-3 py-2.5 text-xs md:text-sm font-medium rounded-lg border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 ${opt.colorClass} ${
                      isSelected
                        ? "ring-2 ring-blue-500 ring-offset-1 font-semibold shadow-xs"
                        : "hover:opacity-90 opacity-80"
                    }`}
                  >
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                文字サイズ
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                12px 〜 32px（2px刻み）
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                data-testid="font-size-decrease"
                aria-label="文字サイズを縮小"
                disabled={isLoading || fontSizePx <= MIN_FONT_SIZE_PX}
                onClick={handleDecreaseFontSize}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                −
              </button>
              <span
                data-testid="font-size-value"
                className="w-12 text-center font-mono text-sm font-medium text-slate-900 dark:text-slate-100 select-none"
              >
                {fontSizePx}px
              </span>
              <button
                type="button"
                data-testid="font-size-increase"
                aria-label="文字サイズを拡大"
                disabled={isLoading || fontSizePx >= MAX_FONT_SIZE_PX}
                onClick={handleIncreaseFontSize}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                ＋
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                行間
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                1.4 〜 2.4（0.2刻み）
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                data-testid="line-height-decrease"
                aria-label="行間を縮小"
                disabled={isLoading || lineHeight <= MIN_LINE_HEIGHT}
                onClick={handleDecreaseLineHeight}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                −
              </button>
              <span
                data-testid="line-height-value"
                className="w-12 text-center font-mono text-sm font-medium text-slate-900 dark:text-slate-100 select-none"
              >
                {lineHeight.toFixed(1)}
              </span>
              <button
                type="button"
                data-testid="line-height-increase"
                aria-label="行間を拡大"
                disabled={isLoading || lineHeight >= MAX_LINE_HEIGHT}
                onClick={handleIncreaseLineHeight}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                ＋
              </button>
            </div>
          </div>
        </section>

        <section
          data-testid="preview-section"
          aria-label="組版プレビュー"
          className="space-y-4"
        >
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            組版プレビュー
          </h2>
          <SampleTextPreview
            writingMode={writingMode}
            theme={theme}
            fontSizePx={fontSizePx}
            lineHeight={lineHeight}
          />
        </section>
      </div>
    </div>
  );
};

import React from "react";
import type {
  WritingMode,
  ReaderTheme,
  ReaderFontFamily,
  ReaderPagingMode,
} from "../../../storage/types";
import type { CloudSyncAuthState } from "../../../bridges/cloud-sync/types";
import type { StorageCacheSummary } from "../hooks/useStorageCache";
import { SampleTextPreview } from "./SampleTextPreview";
import { CloudSyncSection } from "./CloudSyncSection";
import { StorageCacheSection } from "./StorageCacheSection";
import {
  FONT_FAMILY_OPTIONS,
  DEFAULT_FONT_FAMILY,
  DEFAULT_PAGE_MARGIN_PX,
  MIN_PAGE_MARGIN_PX,
  MAX_PAGE_MARGIN_PX,
  PAGE_MARGIN_STEP_PX,
  clampPageMargin,
} from "../../../shared/constants/typography";

export interface SettingsPageProps {
  /** 現在の組み方向 */
  writingMode: WritingMode;
  /** 現在のカラーテーマ */
  theme: ReaderTheme;
  /** 現在の文字サイズ (px)（省略時: 18） */
  fontSizePx?: number;
  /** 現在の行間倍率（省略時: 1.8） */
  lineHeight?: number;
  /** 現在のフォント種別（省略時: "biz-ud-mincho"、v0.5 Issue #169） */
  fontFamily?: ReaderFontFamily;
  /** 現在の画面余白 px（省略時: 20、v0.5 Issue #169） */
  pageMarginPx?: number;
  /** 現在のページ送りモード（省略時: "auto"、v0.4 Issue #122） */
  pagingMode?: ReaderPagingMode;
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
  /** フォント種別選択時のコールバック（v0.5 Issue #169） */
  onChangeFontFamily?: (family: ReaderFontFamily) => void;
  /** 画面余白変更ボタン押下時のコールバック（v0.5 Issue #169） */
  onChangePageMargin?: (marginPx: number) => void;
  /** ページ送りモード変更時のコールバック（v0.4 Issue #122） */
  onChangePagingMode?: (mode: ReaderPagingMode) => void;
  /** Google アカウント認証状態（v0.4） */
  cloudSyncAuthState?: CloudSyncAuthState;
  /** 最終同期完了日時（ISO 8601、v0.4） */
  cloudSyncLastSyncedAt?: string | null;
  /** クラウド同期処理中フラグ（v0.4） */
  isCloudSyncing?: boolean;
  /** クラウド同期エラーメッセージ（v0.4） */
  cloudSyncError?: string | null;
  /** Google 連携ボタン押下時のコールバック（v0.4） */
  onSignInGoogle?: () => Promise<void>;
  /** Google 連携解除ボタン押下時のコールバック（v0.4） */
  onSignOutGoogle?: () => Promise<void>;
  /** 今すぐ同期ボタン押下時のコールバック（v0.4） */
  onSyncNow?: () => Promise<void>;
  /** 全登録作品合計キャッシュ情報（省略時: { totalCachedChapters: 0, totalByteSize: 0 }、v0.5 Issue #170） */
  storageCacheSummary?: StorageCacheSummary;
  /** キャッシュ集計読込中フラグ（v0.5 Issue #170） */
  isStorageCacheLoading?: boolean;
  /** キャッシュ削除処理中フラグ（v0.5 Issue #170） */
  isStorageCacheClearing?: boolean;
  /** 一括削除完了通知メッセージ（v0.5 Issue #170） */
  storageCacheNotice?: string | null;
  /** キャッシュ操作エラーメッセージ（v0.5 Issue #170） */
  storageCacheError?: string | null;
  /** 一括削除確認ダイアログの初期表示状態（Storybook / テスト用、v0.5 Issue #170） */
  initialShowStorageCacheDialog?: boolean;
  /** 一括削除確定時のコールバック（v0.5 Issue #170） */
  onClearStorageCache?: (options: {
    onlyRead: boolean;
  }) => void | Promise<number>;
  /** エラーメッセージ（省略時: null） */
  error?: string | null;
  /** 追加の CSS クラス（任意） */
  className?: string;
}

export const MIN_FONT_SIZE_PX = 12;
export const MAX_FONT_SIZE_PX = 32;
export const FONT_SIZE_STEP_PX = 2;

export const MIN_LINE_HEIGHT = 1.4;
export const MAX_LINE_HEIGHT = 2.4;
export const LINE_HEIGHT_STEP = 0.2;

/**
 * 文字サイズを許容範囲 [12, 32] 内に制限する
 */
function clampFontSize(size: number): number {
  return Math.min(MAX_FONT_SIZE_PX, Math.max(MIN_FONT_SIZE_PX, size));
}

/**
 * 行間倍率を許容範囲 [1.4, 2.4] 内に制限し、小数第1位で丸める
 */
function clampLineHeight(height: number): number {
  return Math.min(
    MAX_LINE_HEIGHT,
    Math.max(MIN_LINE_HEIGHT, Math.round(height * 10) / 10),
  );
}

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

const STEPPER_BUTTON_BASE =
  "w-9 h-9 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs";

/**
 * 設定画面（SCR-05）の Presentational コンポーネント（AC-ST-03, AC-ST-04, AC-ST-05, AC-ST-13）
 * ヘッダー、組版設定項目（組み方向・ページ送り・テーマ・文字サイズ・行間）、および組版プレビューを配置する
 */
export const SettingsPage: React.FC<SettingsPageProps> = ({
  writingMode,
  theme,
  fontSizePx = 18,
  lineHeight = 1.8,
  fontFamily = DEFAULT_FONT_FAMILY,
  pageMarginPx = DEFAULT_PAGE_MARGIN_PX,
  pagingMode = "auto",
  isLoading = false,
  error = null,
  cloudSyncAuthState = { status: "unlinked" },
  cloudSyncLastSyncedAt = null,
  isCloudSyncing = false,
  cloudSyncError = null,
  onToggleWritingMode,
  onChangeTheme,
  onChangeFontSize,
  onChangeLineHeight,
  onChangeFontFamily,
  onChangePageMargin,
  onChangePagingMode,
  onSignInGoogle,
  onSignOutGoogle,
  onSyncNow,
  storageCacheSummary = { totalCachedChapters: 0, totalByteSize: 0 },
  isStorageCacheLoading = false,
  isStorageCacheClearing = false,
  storageCacheNotice = null,
  storageCacheError = null,
  initialShowStorageCacheDialog = false,
  onClearStorageCache,
  className,
}) => {
  const rootClasses =
    `h-full flex flex-col overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 ${className ?? ""}`.trim();

  const isMinFontSize = fontSizePx <= MIN_FONT_SIZE_PX;
  const isMaxFontSize = fontSizePx >= MAX_FONT_SIZE_PX;
  const isMinLineHeight = lineHeight <= MIN_LINE_HEIGHT;
  const isMaxLineHeight = lineHeight >= MAX_LINE_HEIGHT;
  const isMinPageMargin = pageMarginPx <= MIN_PAGE_MARGIN_PX;
  const isMaxPageMargin = pageMarginPx >= MAX_PAGE_MARGIN_PX;

  const handleDecreaseFontSize = () => {
    onChangeFontSize(clampFontSize(fontSizePx - FONT_SIZE_STEP_PX));
  };

  const handleIncreaseFontSize = () => {
    onChangeFontSize(clampFontSize(fontSizePx + FONT_SIZE_STEP_PX));
  };

  const handleDecreaseLineHeight = () => {
    onChangeLineHeight(clampLineHeight(lineHeight - LINE_HEIGHT_STEP));
  };

  const handleIncreaseLineHeight = () => {
    onChangeLineHeight(clampLineHeight(lineHeight + LINE_HEIGHT_STEP));
  };

  const handleDecreasePageMargin = () => {
    onChangePageMargin?.(clampPageMargin(pageMarginPx - PAGE_MARGIN_STEP_PX));
  };

  const handleIncreasePageMargin = () => {
    onChangePageMargin?.(clampPageMargin(pageMarginPx + PAGE_MARGIN_STEP_PX));
  };

  return (
    <div
      data-testid="settings-page"
      data-writing-mode={writingMode}
      data-theme={theme}
      data-font-size={fontSizePx}
      data-line-height={lineHeight}
      data-font-family={fontFamily}
      data-page-margin={pageMarginPx}
      data-paging-mode={pagingMode}
      data-cloud-sync-status={cloudSyncAuthState.status}
      data-is-loading={isLoading ? "true" : undefined}
      className={rootClasses}
    >
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

        {error && (
          <div
            role="alert"
            data-testid="settings-error-alert"
            className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2"
          >
            <span aria-hidden="true">⚠️</span>
            <span>{error}</span>
          </div>
        )}

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
            <div className="flex items-center justify-between">
              <div>
                <label
                  htmlFor="paging-mode-select"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  ページ送り
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  読書時のページ送り方法を設定します
                </p>
              </div>
              <select
                id="paging-mode-select"
                data-testid="paging-mode-select"
                disabled={isLoading || writingMode === "horizontal-tb"}
                value={pagingMode === "scroll" ? "scroll" : "paged"}
                onChange={(e) =>
                  onChangePagingMode?.(e.target.value as ReaderPagingMode)
                }
                className="text-xs md:text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                <option value="paged">ページめくり（縦書き時）</option>
                <option value="scroll">連続スクロール</option>
              </select>
            </div>
            {writingMode === "horizontal-tb" && (
              <p
                data-testid="paging-mode-note"
                className="mt-1.5 text-xs text-amber-600 dark:text-amber-400"
              >
                ※横書き表示時は連続スクロール固定となります
              </p>
            )}
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

          <div className="py-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <label
                  htmlFor="font-family-select"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  フォント種別
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  読書時のフォント（明朝/ゴシック/教科書体）を選択します
                </p>
              </div>
              <select
                id="font-family-select"
                data-testid="font-family-select"
                disabled={isLoading}
                value={fontFamily}
                onChange={(e) =>
                  onChangeFontFamily?.(e.target.value as ReaderFontFamily)
                }
                className="text-xs md:text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                {FONT_FAMILY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
                disabled={isLoading || isMinFontSize}
                onClick={handleDecreaseFontSize}
                className={STEPPER_BUTTON_BASE}
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
                disabled={isLoading || isMaxFontSize}
                onClick={handleIncreaseFontSize}
                className={STEPPER_BUTTON_BASE}
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
                disabled={isLoading || isMinLineHeight}
                onClick={handleDecreaseLineHeight}
                className={STEPPER_BUTTON_BASE}
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
                disabled={isLoading || isMaxLineHeight}
                onClick={handleIncreaseLineHeight}
                className={STEPPER_BUTTON_BASE}
              >
                ＋
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                画面余白
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                8px 〜 48px（4px刻み）
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                data-testid="page-margin-decrease"
                aria-label="画面余白を縮小"
                disabled={isLoading || isMinPageMargin}
                onClick={handleDecreasePageMargin}
                className={STEPPER_BUTTON_BASE}
              >
                −
              </button>
              <span
                data-testid="page-margin-value"
                className="w-12 text-center font-mono text-sm font-medium text-slate-900 dark:text-slate-100 select-none"
              >
                {pageMarginPx}px
              </span>
              <button
                type="button"
                data-testid="page-margin-increase"
                aria-label="画面余白を拡大"
                disabled={isLoading || isMaxPageMargin}
                onClick={handleIncreasePageMargin}
                className={STEPPER_BUTTON_BASE}
              >
                ＋
              </button>
            </div>
          </div>
        </section>

        <section
          data-testid="preview-section"
          aria-label="組版プレビュー"
          className="space-y-4 mb-8"
        >
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            組版プレビュー
          </h2>
          <SampleTextPreview
            writingMode={writingMode}
            theme={theme}
            fontSizePx={fontSizePx}
            lineHeight={lineHeight}
            fontFamily={fontFamily}
            pageMarginPx={pageMarginPx}
          />
        </section>

        <CloudSyncSection
          authState={cloudSyncAuthState}
          lastSyncedAt={cloudSyncLastSyncedAt}
          isSyncing={isCloudSyncing}
          error={cloudSyncError}
          onSignIn={onSignInGoogle}
          onSignOut={onSignOutGoogle}
          onSyncNow={onSyncNow}
        />

        <StorageCacheSection
          summary={storageCacheSummary}
          isLoading={isStorageCacheLoading}
          isClearing={isStorageCacheClearing}
          notice={storageCacheNotice}
          error={storageCacheError}
          initialShowDialog={initialShowStorageCacheDialog}
          onClearCache={onClearStorageCache}
        />
      </div>
    </div>
  );
};

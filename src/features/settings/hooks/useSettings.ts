import { useCallback, useEffect, useState } from "react";
import { useServices } from "../../../app/ServiceProvider";
import type {
  ReaderFontFamily,
  ReaderPagingMode,
  ReaderTheme,
  WritingMode,
} from "../../../storage/types";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_PAGE_MARGIN_PX,
  clampPageMargin,
} from "../../../shared/constants/typography";

export interface UseSettingsResult {
  writingMode: WritingMode;
  theme: ReaderTheme;
  fontFamily: ReaderFontFamily;
  fontSizePx: number;
  lineHeight: number;
  pageMarginPx: number;
  pagingMode: ReaderPagingMode;
  isLoading: boolean;
  error: string | null;
  toggleWritingMode: () => Promise<void>;
  changeTheme: (theme: ReaderTheme) => Promise<void>;
  changeFontFamily: (family: ReaderFontFamily) => Promise<void>;
  changeFontSize: (fontSizePx: number) => Promise<void>;
  changeLineHeight: (lineHeight: number) => Promise<void>;
  changePageMargin: (marginPx: number) => Promise<void>;
  changePagingMode: (pagingMode: ReaderPagingMode) => Promise<void>;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * リーダー設定の読み出し・更新・永続化を行うカスタムフック（SCR-05 / AC-ST-03〜05, AC-ST-07, AC-ST-13, AC-ST-17, AC-ST-18）
 */
export function useSettings(): UseSettingsResult {
  const { settingsRepository, isReady } = useServices();

  const [writingMode, setWritingMode] = useState<WritingMode>("vertical-rl");
  const [theme, setTheme] = useState<ReaderTheme>("light");
  const [fontFamily, setFontFamily] =
    useState<ReaderFontFamily>(DEFAULT_FONT_FAMILY);
  const [fontSizePx, setFontSizePx] = useState<number>(18);
  const [lineHeight, setLineHeight] = useState<number>(1.8);
  const [pageMarginPx, setPageMarginPx] = useState<number>(
    DEFAULT_PAGE_MARGIN_PX,
  );
  const [pagingMode, setPagingMode] = useState<ReaderPagingMode>("auto");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    async function loadSettings() {
      try {
        const settings = await settingsRepository.getReaderSettings();
        if (isMounted && settings) {
          setWritingMode(settings.writingMode);
          setTheme(settings.theme);
          if (settings.fontFamily) {
            setFontFamily(settings.fontFamily);
          }
          setFontSizePx(settings.fontSizePx);
          setLineHeight(settings.lineHeight);
          if (typeof settings.pageMarginPx === "number") {
            setPageMarginPx(settings.pageMarginPx);
          }
          if (settings.pagingMode) {
            setPagingMode(settings.pagingMode);
          }
        }
      } catch {
        // 初期読み込み失敗時は既定値を維持
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [isReady, settingsRepository]);

  const toggleWritingMode = useCallback(async (): Promise<void> => {
    const prevMode = writingMode;
    const nextMode: WritingMode =
      prevMode === "vertical-rl" ? "horizontal-tb" : "vertical-rl";
    setWritingMode(nextMode);
    try {
      await settingsRepository.updateReaderSettings({ writingMode: nextMode });
      setError(null);
    } catch (err: unknown) {
      setWritingMode(prevMode);
      setError(toErrorMessage(err));
    }
  }, [writingMode, settingsRepository]);

  const changeTheme = useCallback(
    async (nextTheme: ReaderTheme): Promise<void> => {
      const prevTheme = theme;
      setTheme(nextTheme);
      try {
        await settingsRepository.updateReaderSettings({ theme: nextTheme });
        setError(null);
      } catch (err: unknown) {
        setTheme(prevTheme);
        setError(toErrorMessage(err));
      }
    },
    [theme, settingsRepository],
  );

  const changeFontFamily = useCallback(
    async (nextFamily: ReaderFontFamily): Promise<void> => {
      const prevFamily = fontFamily;
      setFontFamily(nextFamily);
      try {
        await settingsRepository.updateReaderSettings({
          fontFamily: nextFamily,
        });
        setError(null);
      } catch (err: unknown) {
        setFontFamily(prevFamily);
        setError(toErrorMessage(err));
      }
    },
    [fontFamily, settingsRepository],
  );

  const changeFontSize = useCallback(
    async (nextFontSizePx: number): Promise<void> => {
      const prevFontSize = fontSizePx;
      const clamped = Math.max(12, Math.min(32, nextFontSizePx));
      setFontSizePx(clamped);
      try {
        await settingsRepository.updateReaderSettings({ fontSizePx: clamped });
        setError(null);
      } catch (err: unknown) {
        setFontSizePx(prevFontSize);
        setError(toErrorMessage(err));
      }
    },
    [fontSizePx, settingsRepository],
  );

  const changeLineHeight = useCallback(
    async (nextLineHeight: number): Promise<void> => {
      const prevLineHeight = lineHeight;
      const clamped =
        Math.round(Math.max(1.4, Math.min(2.4, nextLineHeight)) * 10) / 10;
      setLineHeight(clamped);
      try {
        await settingsRepository.updateReaderSettings({ lineHeight: clamped });
        setError(null);
      } catch (err: unknown) {
        setLineHeight(prevLineHeight);
        setError(toErrorMessage(err));
      }
    },
    [lineHeight, settingsRepository],
  );

  const changePageMargin = useCallback(
    async (nextMarginPx: number): Promise<void> => {
      const prevMargin = pageMarginPx;
      const clamped = clampPageMargin(nextMarginPx);
      setPageMarginPx(clamped);
      try {
        await settingsRepository.updateReaderSettings({
          pageMarginPx: clamped,
        });
        setError(null);
      } catch (err: unknown) {
        setPageMarginPx(prevMargin);
        setError(toErrorMessage(err));
      }
    },
    [pageMarginPx, settingsRepository],
  );

  const changePagingMode = useCallback(
    async (nextPagingMode: ReaderPagingMode): Promise<void> => {
      const prevPagingMode = pagingMode;
      setPagingMode(nextPagingMode);
      try {
        await settingsRepository.updateReaderSettings({
          pagingMode: nextPagingMode,
        });
        setError(null);
      } catch (err: unknown) {
        setPagingMode(prevPagingMode);
        setError(toErrorMessage(err));
      }
    },
    [pagingMode, settingsRepository],
  );

  return {
    writingMode,
    theme,
    fontFamily,
    fontSizePx,
    lineHeight,
    pageMarginPx,
    pagingMode,
    isLoading,
    error,
    toggleWritingMode,
    changeTheme,
    changeFontFamily,
    changeFontSize,
    changeLineHeight,
    changePageMargin,
    changePagingMode,
  };
}

import { useCallback, useEffect, useState } from "react";
import { useServices } from "../../../app/ServiceProvider";
import type { ReaderTheme, WritingMode } from "../../../storage/types";

export interface UseSettingsResult {
  writingMode: WritingMode;
  theme: ReaderTheme;
  fontSizePx: number;
  lineHeight: number;
  isLoading: boolean;
  error: string | null;
  toggleWritingMode: () => Promise<void>;
  changeTheme: (theme: ReaderTheme) => Promise<void>;
  changeFontSize: (fontSizePx: number) => Promise<void>;
  changeLineHeight: (lineHeight: number) => Promise<void>;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function useSettings(): UseSettingsResult {
  const { settingsRepository, isReady } = useServices();

  const [writingMode, setWritingMode] = useState<WritingMode>("vertical-rl");
  const [theme, setTheme] = useState<ReaderTheme>("light");
  const [fontSizePx, setFontSizePx] = useState<number>(18);
  const [lineHeight, setLineHeight] = useState<number>(1.8);
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
          setFontSizePx(settings.fontSizePx);
          setLineHeight(settings.lineHeight);
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
    const nextMode: WritingMode =
      writingMode === "vertical-rl" ? "horizontal-tb" : "vertical-rl";
    setWritingMode(nextMode);
    try {
      await settingsRepository.updateReaderSettings({ writingMode: nextMode });
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }, [writingMode, settingsRepository]);

  const changeTheme = useCallback(
    async (nextTheme: ReaderTheme): Promise<void> => {
      setTheme(nextTheme);
      try {
        await settingsRepository.updateReaderSettings({ theme: nextTheme });
      } catch (err: unknown) {
        setError(toErrorMessage(err));
      }
    },
    [settingsRepository],
  );

  const changeFontSize = useCallback(
    async (nextFontSizePx: number): Promise<void> => {
      const clamped = Math.max(12, Math.min(32, nextFontSizePx));
      setFontSizePx(clamped);
      try {
        await settingsRepository.updateReaderSettings({ fontSizePx: clamped });
      } catch (err: unknown) {
        setError(toErrorMessage(err));
      }
    },
    [settingsRepository],
  );

  const changeLineHeight = useCallback(
    async (nextLineHeight: number): Promise<void> => {
      const clamped =
        Math.round(Math.max(1.4, Math.min(2.4, nextLineHeight)) * 10) / 10;
      setLineHeight(clamped);
      try {
        await settingsRepository.updateReaderSettings({ lineHeight: clamped });
      } catch (err: unknown) {
        setError(toErrorMessage(err));
      }
    },
    [settingsRepository],
  );

  return {
    writingMode,
    theme,
    fontSizePx,
    lineHeight,
    isLoading,
    error,
    toggleWritingMode,
    changeTheme,
    changeFontSize,
    changeLineHeight,
  };
}

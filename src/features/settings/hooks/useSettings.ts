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

export function useSettings(): UseSettingsResult {
  throw new Error("Not implemented yet");
}

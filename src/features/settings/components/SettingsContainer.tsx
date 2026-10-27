import React from "react";
import { useSettings } from "../hooks/useSettings";
import { SettingsPage } from "./SettingsPage";

export interface SettingsContainerProps {
  /** テスト用または単体表示用のカスタムクラス（任意） */
  className?: string;
}

/**
 * 設定画面（SCR-05）の Container コンポーネント（AC-ST-03, AC-ST-04, AC-ST-05）
 *
 * useSettings フックを呼び出し、SettingsPage に組版設定（組み方向・テーマ・文字サイズ・行間）
 * および設定変更コールバックを注入する。
 *
 * @see docs/specs/features/settings.md §3.3
 */
export const SettingsContainer: React.FC<SettingsContainerProps> = ({
  className,
}) => {
  const {
    writingMode,
    theme,
    fontSizePx,
    lineHeight,
    isLoading,
    toggleWritingMode,
    changeTheme,
    changeFontSize,
    changeLineHeight,
  } = useSettings();

  return (
    <SettingsPage
      writingMode={writingMode}
      theme={theme}
      fontSizePx={fontSizePx}
      lineHeight={lineHeight}
      isLoading={isLoading}
      onToggleWritingMode={toggleWritingMode}
      onChangeTheme={changeTheme}
      onChangeFontSize={changeFontSize}
      onChangeLineHeight={changeLineHeight}
      className={className}
    />
  );
};

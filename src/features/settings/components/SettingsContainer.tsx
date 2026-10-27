import React from "react";

export interface SettingsContainerProps {
  /** テスト用または単体表示用のカスタムクラス（任意） */
  className?: string;
}

/**
 * 設定画面（SCR-05）の Container コンポーネント（スタブ）
 */
export const SettingsContainer: React.FC<SettingsContainerProps> = () => {
  return <div data-testid="settings-container-stub">TODO</div>;
};

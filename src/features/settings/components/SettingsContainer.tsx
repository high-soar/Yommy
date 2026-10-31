import React from "react";
import { useSettings } from "../hooks/useSettings";
import { useCloudSync } from "../hooks/useCloudSync";
import { SettingsPage } from "./SettingsPage";

export interface SettingsContainerProps {
  /** テスト用または単体表示用のカスタムクラス（任意） */
  className?: string;
}

/**
 * 設定画面（SCR-05）の Container コンポーネント（AC-ST-03, AC-ST-04, AC-ST-05, AC-ST-08〜12）
 *
 * useSettings および useCloudSync フックを呼び出し、SettingsPage に組版設定（組み方向・テーマ・文字サイズ・行間）
 * および Google Drive クラウド同期状態・操作コールバックを注入する。
 *
 * @see docs/specs/features/settings.md §3.4
 */
export const SettingsContainer: React.FC<SettingsContainerProps> = ({
  className,
}) => {
  const {
    writingMode,
    theme,
    fontSizePx,
    lineHeight,
    pagingMode,
    isLoading,
    error,
    toggleWritingMode,
    changeTheme,
    changeFontSize,
    changeLineHeight,
    changePagingMode,
  } = useSettings();

  const {
    authState: cloudSyncAuthState,
    lastSyncedAt: cloudSyncLastSyncedAt,
    isSyncing: isCloudSyncing,
    error: cloudSyncError,
    signIn: onSignInGoogle,
    signOut: onSignOutGoogle,
    syncNow: onSyncNow,
  } = useCloudSync();

  return (
    <SettingsPage
      writingMode={writingMode}
      theme={theme}
      fontSizePx={fontSizePx}
      lineHeight={lineHeight}
      pagingMode={pagingMode}
      isLoading={isLoading}
      error={error}
      cloudSyncAuthState={cloudSyncAuthState}
      cloudSyncLastSyncedAt={cloudSyncLastSyncedAt}
      isCloudSyncing={isCloudSyncing}
      cloudSyncError={cloudSyncError}
      onToggleWritingMode={toggleWritingMode}
      onChangeTheme={changeTheme}
      onChangeFontSize={changeFontSize}
      onChangeLineHeight={changeLineHeight}
      onChangePagingMode={changePagingMode}
      onSignInGoogle={onSignInGoogle}
      onSignOutGoogle={onSignOutGoogle}
      onSyncNow={onSyncNow}
      className={className}
    />
  );
};

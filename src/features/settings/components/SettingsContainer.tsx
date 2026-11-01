import React from "react";
import { useSettings } from "../hooks/useSettings";
import { useCloudSync } from "../hooks/useCloudSync";
import { useStorageCache } from "../hooks/useStorageCache";
import { SettingsPage } from "./SettingsPage";

export interface SettingsContainerProps {
  /** テスト用または単体表示用のカスタムクラス（任意） */
  className?: string;
}

/**
 * 設定画面（SCR-05）の Container コンポーネント（AC-ST-03, AC-ST-04, AC-ST-05, AC-ST-08〜13）
 *
 * useSettings および useCloudSync フックを呼び出し、SettingsPage に組版設定（組み方向・ページ送り・テーマ・文字サイズ・行間）
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
    fontFamily,
    pageMarginPx,
    pagingMode,
    isLoading,
    error,
    toggleWritingMode,
    changeTheme,
    changeFontSize,
    changeLineHeight,
    changeFontFamily,
    changePageMargin,
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

  const {
    summary: storageCacheSummary,
    isLoading: isStorageCacheLoading,
    isClearing: isStorageCacheClearing,
    notice: storageCacheNotice,
    error: storageCacheError,
    clearCache: onClearStorageCache,
  } = useStorageCache();

  return (
    <SettingsPage
      writingMode={writingMode}
      theme={theme}
      fontSizePx={fontSizePx}
      lineHeight={lineHeight}
      fontFamily={fontFamily}
      pageMarginPx={pageMarginPx}
      pagingMode={pagingMode}
      isLoading={isLoading}
      error={error}
      cloudSyncAuthState={cloudSyncAuthState}
      cloudSyncLastSyncedAt={cloudSyncLastSyncedAt}
      isCloudSyncing={isCloudSyncing}
      cloudSyncError={cloudSyncError}
      storageCacheSummary={storageCacheSummary}
      isStorageCacheLoading={isStorageCacheLoading}
      isStorageCacheClearing={isStorageCacheClearing}
      storageCacheNotice={storageCacheNotice}
      storageCacheError={storageCacheError}
      onToggleWritingMode={toggleWritingMode}
      onChangeTheme={changeTheme}
      onChangeFontSize={changeFontSize}
      onChangeLineHeight={changeLineHeight}
      onChangeFontFamily={changeFontFamily}
      onChangePageMargin={changePageMargin}
      onChangePagingMode={changePagingMode}
      onSignInGoogle={onSignInGoogle}
      onSignOutGoogle={onSignOutGoogle}
      onSyncNow={onSyncNow}
      onClearStorageCache={onClearStorageCache}
      className={className}
    />
  );
};

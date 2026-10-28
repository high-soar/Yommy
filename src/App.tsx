import React from "react";
import { ServiceProvider } from "./app/ServiceProvider";
import { RouterProvider, useRouter } from "./app/router";
import type { AppBridge } from "./bridges/app/types";
import { BookshelfContainer } from "./features/bookshelf/components/BookshelfContainer";
import { NovelDetailContainer } from "./features/novel-detail/components/NovelDetailContainer";
import { ReaderContainer } from "./features/reader/components/ReaderContainer";
import { SettingsContainer } from "./features/settings/components/SettingsContainer";
import { BottomTabBar } from "./shared/ui/BottomTabBar";

/**
 * App コンポーネントの Props
 */
export interface AppProps {
  /** 初期取得対象の作品 URL（省略時はデフォルトのカクヨム検証用作品URL） */
  initialWorkUrl?: string;
  /** 初期遷移パス（単体テスト・Storybook用、省略時は現在のURLまたは "/"） */
  initialPath?: string;
  /** 初期トースト表示フラグ（Storybook / テスト用、省略時は false） */
  initialShowExitToast?: boolean;
  /** テスト用のカスタム AppBridge（省略時は ServiceProvider のデフォルトを使用） */
  appBridge?: AppBridge;
}

interface AppContentProps {
  initialWorkUrl?: string;
}

/**
 * ルーター状態を購読し、全画面シェル（h-dvh）内で各画面（SCR-01 / SCR-02 / SCR-03 / SCR-05）
 * および下部ナビゲーション（BottomTabBar）を描画する内部コンポーネント
 */
const AppContent: React.FC<AppContentProps> = ({ initialWorkUrl }) => {
  const router = useRouter();
  const isReader = router.route.name === "reader";

  return (
    <div
      data-testid="app-root"
      className="h-dvh w-full overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
    >
      <main className="flex-1 min-h-0 w-full overflow-hidden relative">
        {router.route.name === "bookshelf" && <BookshelfContainer />}
        {router.route.name === "novel-detail" && (
          <NovelDetailContainer novelId={router.route.novelId} />
        )}
        {router.route.name === "reader" && (
          <ReaderContainer
            novelId={router.route.novelId}
            chapterIndex={router.route.chapterIndex}
            initialWorkUrl={initialWorkUrl}
          />
        )}
        {router.route.name === "settings" && <SettingsContainer />}
      </main>

      {!isReader && (
        <BottomTabBar
          activeTab={
            router.route.name === "settings" ? "settings" : "bookshelf"
          }
          onSelectBookshelf={router.navigateToBookshelf}
          onSelectSettings={router.navigateToSettings}
        />
      )}
    </div>
  );
};

/**
 * Yommy ルートアプリケーションコンポーネント
 *
 * ServiceProvider による依存性注入（DI）と、RouterProvider による画面ルーティング
 * （本棚 SCR-01、作品詳細・目次 SCR-02、リーダー SCR-03、設定 SCR-05）を統合管理する。
 */
export const App: React.FC<AppProps> = ({ initialWorkUrl, initialPath }) => {
  return (
    <ServiceProvider>
      <RouterProvider initialPath={initialPath}>
        <AppContent initialWorkUrl={initialWorkUrl} />
      </RouterProvider>
    </ServiceProvider>
  );
};

export default App;

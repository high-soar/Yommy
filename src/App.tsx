import React, { useEffect, useRef, useState } from "react";
import { ServiceProvider, useServices } from "./app/ServiceProvider";
import { RouterProvider, useRouter } from "./app/router";
import type { AppBridge } from "./bridges/app/types";
import { BookshelfContainer } from "./features/bookshelf/components/BookshelfContainer";
import { NovelDetailContainer } from "./features/novel-detail/components/NovelDetailContainer";
import { ReaderContainer } from "./features/reader/components/ReaderContainer";
import { SearchContainer } from "./features/search/components/SearchContainer";
import { SettingsContainer } from "./features/settings/components/SettingsContainer";
import { BottomTabBar, type BottomTab } from "./shared/ui/BottomTabBar";

/**
 * 現在のルート名および探索元からアクティブな下部タブを判定する
 */
export function getActiveTab(
  routeName: string,
  novelOrigin?: string | null,
): BottomTab {
  if (
    routeName === "settings" ||
    routeName === "search" ||
    routeName === "ranking"
  ) {
    return routeName;
  }
  if (routeName === "novel-detail" || routeName === "reader") {
    if (novelOrigin === "/search") {
      return "search";
    }
    if (novelOrigin === "/ranking") {
      return "ranking";
    }
    return "bookshelf";
  }
  return "bookshelf";
}

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
  initialShowExitToast?: boolean;
}

/**
 * ルーター状態を購読し、全画面シェル（h-dvh）内で各画面（SCR-01 / SCR-02 / SCR-03 / SCR-05）
 * および下部ナビゲーション（BottomTabBar）を描画する内部コンポーネント。
 * 実機システム戻るボタン（AppBridge）を購読し、論理階層遷移および本棚終了確認UXを提供する。
 */
export const AppContent: React.FC<AppContentProps> = ({
  initialWorkUrl,
  initialShowExitToast = false,
}) => {
  const router = useRouter();
  const { appBridge } = useServices();
  const isReader = router.route.name === "reader";
  const activeTab = getActiveTab(router.route.name, router.novelOrigin);

  const [showExitToast, setShowExitToast] = useState(initialShowExitToast);
  const lastBackPressTimeRef = useRef<number>(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearToastTimer = () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };

    const removeListener = appBridge.addBackButtonListener(async () => {
      // 本棚画面 (SCR-01: /): 2秒以内連続2回押下でアプリ終了、1回目は確認トースト表示 (TR-13)
      if (router.route.name === "bookshelf") {
        const now = Date.now();
        if (now - lastBackPressTimeRef.current <= 2000) {
          clearToastTimer();
          setShowExitToast(false);
          await appBridge.exitApp();
        } else {
          lastBackPressTimeRef.current = now;
          setShowExitToast(true);
          toastTimerRef.current = setTimeout(() => {
            setShowExitToast(false);
            toastTimerRef.current = null;
          }, 2000);
        }
        return;
      }

      // 他画面 (SCR-03 -> SCR-02, SCR-02 -> SCR-01, SCR-05 -> previousPath): 論理階層復帰
      clearToastTimer();
      setShowExitToast(false);
      router.back();
    });

    return () => {
      removeListener();
      clearToastTimer();
    };
  }, [appBridge, router]);

  return (
    <div
      data-testid="app-root"
      className="h-dvh w-full overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 relative"
    >
      <main className="flex-1 min-h-0 w-full overflow-hidden relative">
        {router.route.name === "bookshelf" && <BookshelfContainer />}
        {router.route.name === "search" && <SearchContainer />}
        {router.route.name === "ranking" && (
          <div
            data-testid="ranking-placeholder"
            className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500 dark:text-slate-400"
          >
            <span className="text-4xl mb-2" aria-hidden="true">
              🏆
            </span>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
              ランキング
            </p>
            <p className="text-sm">ランキング機能は現在準備中です。</p>
          </div>
        )}
        {router.route.name === "novel-detail" && (
          <NovelDetailContainer novelId={router.route.novelId} />
        )}
        {router.route.name === "reader" && (
          <ReaderContainer
            novelId={router.route.novelId}
            chapterIndex={router.route.chapterIndex}
            initialWorkUrl={initialWorkUrl}
            activeTab={activeTab}
          />
        )}
        {router.route.name === "settings" && <SettingsContainer />}
      </main>

      {showExitToast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="exit-app-toast"
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-800/90 text-white text-sm font-medium rounded-full shadow-lg pointer-events-none transition-opacity duration-200 text-center whitespace-nowrap"
        >
          もう一度バックボタンを押すと終了します
        </div>
      )}

      {!isReader && (
        <BottomTabBar
          activeTab={activeTab}
          onSelectBookshelf={router.navigateToBookshelf}
          onSelectSearch={router.navigateToSearch}
          onSelectRanking={router.navigateToRanking}
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
export const App: React.FC<AppProps> = ({
  initialWorkUrl,
  initialPath,
  initialShowExitToast,
  appBridge,
}) => {
  return (
    <ServiceProvider services={appBridge ? { appBridge } : undefined}>
      <RouterProvider initialPath={initialPath}>
        <AppContent
          initialWorkUrl={initialWorkUrl}
          initialShowExitToast={initialShowExitToast}
        />
      </RouterProvider>
    </ServiceProvider>
  );
};

export default App;

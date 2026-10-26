import React from "react";
import { ServiceProvider } from "./app/ServiceProvider";
import { RouterProvider, useRouter } from "./app/router";
import { BookshelfContainer } from "./features/bookshelf/components/BookshelfContainer";
import { NovelDetailPlaceholder } from "./features/novel-detail/components/NovelDetailPlaceholder";
import { PocReaderContainer } from "./features/reader/components/PocReaderContainer";

/**
 * App コンポーネントの Props
 */
export interface AppProps {
  /** アプリケーションのヘッダータイトル（デフォルト: "Yommy"） */
  title?: string;
  /** 初期取得対象の作品 URL（省略時はデフォルトのカクヨム検証用作品URL） */
  initialWorkUrl?: string;
  /** 初期遷移パス（単体テスト・Storybook用、省略時は現在のURLまたは "/"） */
  initialPath?: string;
}

interface AppContentProps {
  title: string;
  initialWorkUrl?: string;
}

/**
 * ルーター状態を購読し、ヘッダーと各画面コンポーネント（SCR-01 / SCR-02 / SCR-03）を切り替え描画する内部コンポーネント
 */
const AppContent: React.FC<AppContentProps> = ({ title, initialWorkUrl }) => {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="bg-emerald-700 text-white px-6 py-4 shadow-md flex items-center justify-between">
        <h1
          className="text-xl font-bold tracking-wide cursor-pointer select-none"
          data-testid="app-title"
          onClick={router.navigateToBookshelf}
        >
          {title}
        </h1>
      </header>

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full flex flex-col gap-6">
        {router.route.name === "bookshelf" && <BookshelfContainer />}
        {router.route.name === "novel-detail" && (
          <NovelDetailPlaceholder novelId={router.route.novelId} />
        )}
        {router.route.name === "reader" && (
          <PocReaderContainer
            novelId={router.route.novelId}
            chapterIndex={router.route.chapterIndex}
            initialWorkUrl={initialWorkUrl}
            onBackToBookshelf={router.navigateToBookshelf}
            onBackToDetail={(id) => router.navigateToNovelDetail(id)}
          />
        )}
      </main>
    </div>
  );
};

/**
 * Yommy ルートアプリケーションコンポーネント
 *
 * ServiceProvider による依存性注入（DI）と、RouterProvider による画面ルーティング
 * （本棚 SCR-01、作品詳細プレースホルダ SCR-02、リーダー SCR-03）を統合管理する。
 */
export const App: React.FC<AppProps> = ({
  title = "Yommy",
  initialWorkUrl,
  initialPath,
}) => {
  return (
    <ServiceProvider>
      <RouterProvider initialPath={initialPath}>
        <AppContent title={title} initialWorkUrl={initialWorkUrl} />
      </RouterProvider>
    </ServiceProvider>
  );
};

export default App;

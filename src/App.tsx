import React from "react";
import { ServiceProvider } from "./app/ServiceProvider";
import { PocReaderContainer } from "./features/reader/components/PocReaderContainer";

/**
 * App コンポーネントの Props
 */
export interface AppProps {
  /** アプリケーションのヘッダータイトル（デフォルト: "Yommy"） */
  title?: string;
  /** 初期取得対象の作品 URL（省略時はデフォルトのカクヨム検証用作品URL） */
  initialWorkUrl?: string;
}

/**
 * Yommy ルートアプリケーションコンポーネント
 *
 * ServiceProvider による依存性注入（DI）と、PocReaderContainer によるリーダー画面を表示する。
 * ブラウザリロード時のローカル永続化（localStorage バックアップ・リストア）にも対応する。
 */
export const App: React.FC<AppProps> = ({
  title = "Yommy",
  initialWorkUrl,
}) => {
  return (
    <ServiceProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        <header className="bg-emerald-700 text-white px-6 py-4 shadow-md flex items-center justify-between">
          <h1
            className="text-xl font-bold tracking-wide"
            data-testid="app-title"
          >
            {title}
          </h1>
        </header>

        <main className="flex-1 p-6 max-w-4xl mx-auto w-full flex flex-col gap-6">
          <PocReaderContainer initialWorkUrl={initialWorkUrl} />
        </main>
      </div>
    </ServiceProvider>
  );
};

export default App;

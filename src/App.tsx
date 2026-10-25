import React, { useState } from "react";

export interface AppProps {
  title?: string;
  initialOrientation?: "vertical" | "horizontal";
}

export const App: React.FC<AppProps> = ({
  title = "Yommy",
  initialOrientation = "horizontal",
}) => {
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">(
    initialOrientation,
  );

  const toggleOrientation = () => {
    setOrientation((prev) => (prev === "vertical" ? "horizontal" : "vertical"));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="bg-emerald-700 text-white px-6 py-4 shadow-md flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-wide" data-testid="app-title">
          {title}
        </h1>
        <button
          onClick={toggleOrientation}
          className="bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-medium px-3 py-1.5 rounded transition-colors"
          data-testid="toggle-orientation"
        >
          {orientation === "vertical" ? "横書き表示に切替" : "縦書き表示に切替"}
        </button>
      </header>

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full flex flex-col gap-6">
        <section className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold mb-2">
            Web小説リーダー Yommy 開発基盤
          </h2>
          <p className="text-slate-600 mb-4">
            Vite + React + TypeScript + Capacitor + Tailwind CSS
            による基盤が稼働中です。
          </p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
              React 19
            </span>
            <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
              TypeScript
            </span>
            <span className="bg-sky-100 text-sky-800 px-2.5 py-1 rounded-full">
              Tailwind CSS
            </span>
            <span className="bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full">
              Capacitor 8
            </span>
          </div>
        </section>

        <section className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 flex-1">
          <h3 className="text-md font-semibold mb-3">組版・ルビ表示サンプル</h3>
          <div
            className={`border rounded p-6 bg-amber-50/30 overflow-auto ${
              orientation === "vertical"
                ? "writing-vertical-rl h-72 w-full font-serif text-lg leading-loose"
                : "writing-horizontal-tb font-serif text-base leading-relaxed"
            }`}
            data-testid="novel-preview"
          >
            <p>
              吾輩は
              <ruby>
                猫<rt>ねこ</rt>
              </ruby>
              である。
              <ruby>
                名前<rt>なまえ</rt>
              </ruby>
              はまだ無い。
            </p>
            <p className="mt-4">
              どこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;

import React from "react";
import type {
  NovelRecord,
  ChapterRecord,
  WritingMode,
  ReaderTheme,
} from "../../../storage/types";
import { ReaderToolbar } from "./ReaderToolbar";
import { ReaderChapterNav } from "./ReaderChapterNav";
import { ReaderView } from "./ReaderView";

export interface ReaderPageProps {
  novel: NovelRecord | null;
  chapter: ChapterRecord | null;
  chapterIndex: number;
  totalChapters: number;
  writingMode: WritingMode;
  theme: ReaderTheme;
  fontSizePx: number;
  lineHeight: number;
  initialScrollProgress: number;
  isLoading: boolean;
  error?: string | null;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  onScrollProgressChange: (progress: number) => void;
  onSelectTab?: (tab: "bookshelf" | "settings") => void;
  initialOverlayOpen?: boolean;
  // 過渡的インターフェース（旧Props）
  onToggleWritingMode?: () => void;
  onChangeTheme?: (theme: ReaderTheme) => void;
  onChangeFontSize?: (sizePx: number) => void;
  onChangeLineHeight?: (height: number) => void;
  onBackToDetail?: () => void;
  onBackToBookshelf?: () => void;
  onFetchNovel?: () => void;
}

const pageBgStyles: Record<ReaderTheme, string> = {
  light: "bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100",
  sepia: "bg-[#f4ebd0] text-[#433523]",
  dark: "bg-slate-950 text-slate-100",
  black: "bg-black text-slate-200",
};

/**
 * 小説リーダー画面全体のレイアウト統合コンポーネント（Presentational）
 *
 * ReaderToolbar、ReaderChapterNav、およびメイン表示領域（ローディング・エラー・空状態・通常本文）の排他描画を制御する。
 */
export const ReaderPage: React.FC<ReaderPageProps> = ({
  novel,
  chapter,
  chapterIndex,
  totalChapters,
  writingMode,
  theme,
  fontSizePx,
  lineHeight,
  initialScrollProgress,
  isLoading,
  error,
  onToggleWritingMode = () => {},
  onChangeTheme = () => {},
  onChangeFontSize = () => {},
  onChangeLineHeight = () => {},
  onPrevChapter,
  onNextChapter,
  onScrollProgressChange,
  onBackToDetail,
  onBackToBookshelf,
  onFetchNovel,
}) => {
  const hasNovel = novel !== null;
  const hasChapterNav = hasNovel && totalChapters > 0;
  const hasBodyHtml = Boolean(chapter && chapter.bodyHtml !== null);

  return (
    <div
      data-testid="reader-page"
      className={`min-h-screen p-3 md:p-6 transition-colors duration-200 ${pageBgStyles[theme]}`}
    >
      <div className="max-w-5xl mx-auto flex flex-col gap-4">
        {/* 常時表示上部ツールバー */}
        <header>
          <ReaderToolbar
            writingMode={writingMode}
            theme={theme}
            fontSizePx={fontSizePx}
            lineHeight={lineHeight}
            onToggleWritingMode={onToggleWritingMode}
            onChangeTheme={onChangeTheme}
            onChangeFontSize={onChangeFontSize}
            onChangeLineHeight={onChangeLineHeight}
            onBackToDetail={onBackToDetail}
            onBackToBookshelf={onBackToBookshelf}
            onFetchNovel={onFetchNovel}
            isLoading={isLoading}
          />
        </header>

        {/* 前後エピソード連続遷移ナビゲーション（作品存在時） */}
        {hasChapterNav && (
          <ReaderChapterNav
            chapterIndex={chapterIndex}
            totalChapters={totalChapters}
            isLoading={isLoading}
            onPrevChapter={onPrevChapter}
            onNextChapter={onNextChapter}
          />
        )}

        {/* メイン本文領域（排他描画） */}
        <main className="w-full min-w-0">
          {error ? (
            <div
              role="alert"
              data-testid="reader-error"
              className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-lg text-sm shadow-xs"
            >
              <div className="font-semibold mb-1">エラー</div>
              <div>{error}</div>
            </div>
          ) : isLoading && !hasBodyHtml ? (
            <div
              role="status"
              data-testid="reader-loading"
              className="flex flex-col items-center justify-center py-24 text-slate-500 dark:text-slate-400"
            >
              <div
                aria-hidden="true"
                className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"
              />
              <p className="text-sm font-medium">エピソードを読み込み中...</p>
            </div>
          ) : !hasNovel || !chapter || chapter.bodyHtml === null ? (
            <div
              data-testid="reader-empty"
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-12 text-center text-slate-500 dark:text-slate-400"
            >
              <p className="text-base font-medium mb-1">
                作品またはエピソードが見つかりません。
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                作品が登録されていないか、エピソード本文がまだ取得されていません。
              </p>
            </div>
          ) : (
            <div className="h-[70vh] md:h-[80vh]">
              <ReaderView
                title={novel.title}
                chapterTitle={chapter.title}
                bodyHtml={chapter.bodyHtml}
                writingMode={writingMode}
                theme={theme}
                fontSizePx={fontSizePx}
                lineHeight={lineHeight}
                initialScrollProgress={initialScrollProgress}
                onScrollProgressChange={onScrollProgressChange}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

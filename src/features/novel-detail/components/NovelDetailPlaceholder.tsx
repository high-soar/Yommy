import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "../../../app/router";
import { useServices } from "../../../app/ServiceProvider";
import type { NovelRecord } from "../../../storage/types";

export interface NovelDetailPlaceholderProps {
  novelId: string;
  onBackToBookshelf?: () => void;
  onRead?: (novelId: string, chapterIndex: number) => void;
}

/**
 * 作品詳細・目次画面（SCR-02）の一時プレースホルダ画面コンポーネント
 *
 * Issue #13 での本格実装までの受け皿として、作品メタデータ（タイトル・著者・あらすじ）の表示、
 * しおり位置からの読書再開（TR-04）、および本棚へ戻る導線（TR-07）を提供する。
 */
export const NovelDetailPlaceholder: React.FC<NovelDetailPlaceholderProps> = ({
  novelId,
  onBackToBookshelf,
  onRead,
}) => {
  const router = useRouter();
  const { novelRepository, isReady } = useServices();

  const [novel, setNovel] = useState<NovelRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    novelRepository
      .getNovelById(novelId)
      .then((record) => {
        if (isMounted) {
          setNovel(record);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [novelId, isReady, novelRepository]);

  const handleBackToBookshelf = useCallback(() => {
    if (onBackToBookshelf) {
      onBackToBookshelf();
    } else {
      router.navigateToBookshelf();
    }
  }, [onBackToBookshelf, router]);

  const handleRead = useCallback(
    (targetNovel: NovelRecord) => {
      const targetChapter = targetNovel.bookmarkChapterIndex ?? 1;
      if (onRead) {
        onRead(targetNovel.id, targetChapter);
      } else {
        router.navigateToReader(targetNovel.id, targetChapter);
      }
    },
    [onRead, router],
  );

  return (
    <div
      data-testid="novel-detail-placeholder"
      className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 md:p-6 lg:p-8"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            data-testid="back-to-bookshelf-button"
            onClick={handleBackToBookshelf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <span aria-hidden="true">←</span>
            <span>本棚へ戻る</span>
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            SCR-02 (Placeholder)
          </span>
        </header>

        <main>
          {isLoading ? (
            <div
              data-testid="novel-detail-loading"
              className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400"
            >
              <div
                aria-hidden="true"
                className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"
              />
              <p className="text-sm font-medium">作品情報を読み込み中...</p>
            </div>
          ) : error ? (
            <div
              data-testid="novel-detail-error"
              className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-lg text-sm font-medium"
            >
              {error}
            </div>
          ) : !novel ? (
            <div
              data-testid="novel-detail-not-found"
              className="p-8 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2"
            >
              <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                作品が見つかりませんでした。
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                指定された作品は削除されたか、登録されていません。
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 md:p-8 space-y-6 shadow-xs">
              <div className="space-y-2">
                <h1
                  data-testid="novel-detail-title"
                  className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50"
                >
                  {novel.title}
                </h1>
                <p
                  data-testid="novel-detail-author"
                  className="text-sm font-medium text-slate-600 dark:text-slate-400"
                >
                  {novel.author || "著者不明"}
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  あらすじ
                </h2>
                <p
                  data-testid="novel-detail-synopsis"
                  className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed"
                >
                  {novel.synopsis || "あらすじはありません。"}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  全 {novel.totalChapters} 話（取得済み {novel.cachedChapters}{" "}
                  話）
                </div>
                <button
                  type="button"
                  data-testid="detail-read-button"
                  onClick={() => handleRead(novel)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <span>
                    {novel.bookmarkChapterIndex !== null
                      ? `第${novel.bookmarkChapterIndex}話から読む`
                      : "第1話から読む"}
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

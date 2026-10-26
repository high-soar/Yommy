import React, { useEffect, useState, useCallback } from "react";
import { useServices } from "../../../app/ServiceProvider";
import { ReaderView, type WritingMode, type ReaderTheme } from "./ReaderView";
import { ReaderToolbar } from "./ReaderToolbar";
import type { NovelRecord, ChapterRecord } from "../../../storage/types";

const DEFAULT_KAKUYOMU_URL = "https://kakuyomu.jp/works/16817330658027210412";

/**
 * 例外オブジェクトをユーザー表示用エラーメッセージ文字列へ変換する
 */
function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * PoC リーダーコンテナの Props
 */
export interface PocReaderContainerProps {
  /** 取得対象の作品 URL（デフォルト: カクヨムの検証用URL） */
  initialWorkUrl?: string;
  /** 表示対象の作品ID */
  novelId?: string;
  /** 表示対象のエピソード連番（1始まり、省略時は 1） */
  chapterIndex?: number;
  /** 「本棚へ戻る」タップ時のコールバック（指定時のみ reader-back-to-bookshelf ボタンを表示） */
  onBackToBookshelf?: () => void;
  /** 「作品詳細へ」タップ時のコールバック（指定時のみ reader-back-to-detail ボタンを表示） */
  onBackToDetail?: (novelId: string) => void;
}

/**
 * PoC リーダーコンテナコンポーネント
 *
 * ServiceProvider から DI されたリポジトリと HTTP クライアントを使用し、
 * 作品取得、SQLite DB 永続化、縦書き/横書きリーダー表示およびテーマ切り替えを統合管理する。
 */
export const PocReaderContainer: React.FC<PocReaderContainerProps> = ({
  initialWorkUrl = DEFAULT_KAKUYOMU_URL,
  novelId,
  chapterIndex,
  onBackToBookshelf,
  onBackToDetail,
}) => {
  const {
    httpClient,
    parserRegistry,
    novelRepository,
    chapterRepository,
    settingsRepository,
    isReady,
  } = useServices();

  const [novel, setNovel] = useState<NovelRecord | null>(null);
  const [chapter, setChapter] = useState<ChapterRecord | null>(null);
  const [writingMode, setWritingMode] = useState<WritingMode>("vertical-rl");
  const [theme, setTheme] = useState<ReaderTheme>("light");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 指定エピソードの本文をオンデマンドで取得・パースして DB に保存する共通関数
   */
  const fetchAndSaveChapterBody = useCallback(
    async (
      targetNovelId: string,
      targetChapterIndex: number,
      episodeUrl: string,
    ): Promise<ChapterRecord | null> => {
      const parser = parserRegistry.requireParser(episodeUrl);
      const chapterRes = await httpClient.getHtml({ url: episodeUrl });
      const parsedChapter = parser.parseChapterContent(
        chapterRes.html,
        episodeUrl,
      );
      await chapterRepository.saveChapterBody(
        targetNovelId,
        targetChapterIndex,
        parsedChapter,
        new Date().toISOString(),
      );
      return chapterRepository.getChapter(targetNovelId, targetChapterIndex);
    },
    [chapterRepository, httpClient, parserRegistry],
  );

  // 初回ロード / リロード復元 / ルート指定ロード
  useEffect(() => {
    if (!isReady) return;

    let isMounted = true;

    async function loadInitialData() {
      try {
        const settings = await settingsRepository.getReaderSettings();
        if (isMounted) {
          if (settings.writingMode === "horizontal-tb") {
            setWritingMode("horizontal-tb");
          }
          if (
            settings.theme === "sepia" ||
            settings.theme === "dark" ||
            settings.theme === "black"
          ) {
            setTheme(settings.theme);
          }
        }

        if (novelId) {
          const targetIndex = chapterIndex ?? 1;
          const targetNovel = await novelRepository.getNovelById(novelId);
          let targetChapter = await chapterRepository.getChapter(
            novelId,
            targetIndex,
          );

          // 未キャッシュ話のオンデマンド本文取得（TR-03 対応）
          if (targetNovel && targetChapter && targetChapter.bodyHtml === null) {
            if (isMounted) {
              setIsLoading(true);
            }
            try {
              targetChapter = await fetchAndSaveChapterBody(
                novelId,
                targetIndex,
                targetChapter.url,
              );
            } catch (fetchErr: unknown) {
              if (isMounted) {
                setError(toErrorMessage(fetchErr));
              }
            } finally {
              if (isMounted) {
                setIsLoading(false);
              }
            }
          }

          if (isMounted) {
            setNovel(targetNovel);
            setChapter(targetChapter);
          }
        } else {
          // novelId 未指定: 従来互換動作（DB内の先頭作品・第1話）
          const novels = await novelRepository.listNovels();
          if (novels.length > 0) {
            const firstNovel = await novelRepository.getNovelById(novels[0].id);
            const firstChapter = await chapterRepository.getChapter(
              novels[0].id,
              1,
            );
            if (isMounted) {
              setNovel(firstNovel);
              setChapter(firstChapter);
            }
          } else {
            if (isMounted) {
              setNovel(null);
              setChapter(null);
            }
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(toErrorMessage(err));
        }
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [
    isReady,
    novelId,
    chapterIndex,
    novelRepository,
    chapterRepository,
    settingsRepository,
    fetchAndSaveChapterBody,
  ]);

  // 作品取得操作
  const handleFetchNovel = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const targetUrl = novel?.canonicalUrl ?? initialWorkUrl;
      // 1. パーサー解決と作品URL正規化（未対応URLは通信前に拒絶）
      const parser = parserRegistry.requireParser(targetUrl);
      const normalizedWorkUrl = parser.normalizeWorkUrl(targetUrl);

      // 2. 作品トップHTML取得
      const indexRes = await httpClient.getHtml({ url: normalizedWorkUrl });
      const novelIndex = parser.parseNovelIndex(
        indexRes.html,
        normalizedWorkUrl,
      );

      // 3. DBへ作品と目次を保存
      const savedNovel = await novelRepository.upsertNovelWithToc(
        novelIndex,
        new Date().toISOString(),
      );

      // 4. 対象話エピソード本文取得
      if (novelIndex.chapters.length > 0) {
        const targetChapterIndex = chapterIndex ?? 1;
        const targetEpisodeToc =
          novelIndex.chapters.find(
            (ch) => ch.chapterIndex === targetChapterIndex,
          ) ?? novelIndex.chapters[0];

        const savedChapter = await fetchAndSaveChapterBody(
          savedNovel.id,
          targetEpisodeToc.chapterIndex,
          targetEpisodeToc.url,
        );

        setNovel(savedNovel);
        setChapter(savedChapter);
      } else {
        setNovel(savedNovel);
        setChapter(null);
      }
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [
    novel,
    initialWorkUrl,
    chapterIndex,
    httpClient,
    parserRegistry,
    novelRepository,
    fetchAndSaveChapterBody,
  ]);

  // 縦横切替
  const handleToggleWritingMode = useCallback(async () => {
    const nextMode =
      writingMode === "vertical-rl" ? "horizontal-tb" : "vertical-rl";
    setWritingMode(nextMode);
    await settingsRepository.updateReaderSettings({ writingMode: nextMode });
  }, [writingMode, settingsRepository]);

  // テーマ切替
  const handleChangeTheme = useCallback(
    async (nextTheme: ReaderTheme) => {
      setTheme(nextTheme);
      await settingsRepository.updateReaderSettings({ theme: nextTheme });
    },
    [settingsRepository],
  );

  const targetDetailId = novelId ?? novel?.id;

  return (
    <div className="flex flex-col gap-4 w-full">
      {(onBackToBookshelf || onBackToDetail) && (
        <nav
          data-testid="reader-nav"
          className="flex items-center justify-between gap-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 shadow-xs"
        >
          <div className="flex items-center gap-2">
            {onBackToBookshelf && (
              <button
                type="button"
                data-testid="reader-back-to-bookshelf"
                onClick={onBackToBookshelf}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <span aria-hidden="true">←</span>
                <span>本棚へ戻る</span>
              </button>
            )}
            {onBackToDetail && (
              <button
                type="button"
                data-testid="reader-back-to-detail"
                onClick={() => {
                  if (targetDetailId) {
                    onBackToDetail(targetDetailId);
                  }
                }}
                disabled={!targetDetailId}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <span>作品詳細へ</span>
                <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
        </nav>
      )}

      <ReaderToolbar
        writingMode={writingMode}
        theme={theme}
        onToggleWritingMode={handleToggleWritingMode}
        onChangeTheme={handleChangeTheme}
        onFetchNovel={handleFetchNovel}
        isLoading={isLoading}
      />

      {error && (
        <div
          data-testid="reader-error"
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm"
        >
          {error}
        </div>
      )}

      {novel ? (
        <ReaderView
          title={novel.title}
          chapterTitle={chapter?.title}
          bodyHtml={
            chapter?.bodyHtml ?? "<p>本文がまだ取得されていません。</p>"
          }
          writingMode={writingMode}
          theme={theme}
        />
      ) : (
        !isLoading && (
          <div
            data-testid="reader-empty"
            className="border-2 border-dashed border-slate-200 rounded-lg p-12 text-center text-slate-500"
          >
            <p className="text-base font-medium mb-1">
              作品がまだ登録されていません。
            </p>
            <p className="text-xs text-slate-400">
              右上の「作品を取得/更新」ボタンを押して作品を読み込んでください。
            </p>
          </div>
        )
      )}
    </div>
  );
};

import React, { useEffect, useState, useCallback } from "react";
import { useServices } from "../../../app/ServiceProvider";
import { ReaderView, type WritingMode, type ReaderTheme } from "./ReaderView";
import { ReaderToolbar } from "./ReaderToolbar";
import type { NovelRecord, ChapterRecord } from "../../../storage/types";

const DEFAULT_KAKUYOMU_URL = "https://kakuyomu.jp/works/1177354054881162325";

/**
 * PoC リーダーコンテナの Props
 */
export interface PocReaderContainerProps {
  /** 取得対象の作品 URL（デフォルト: カクヨムの検証用URL） */
  initialWorkUrl?: string;
}

/**
 * PoC リーダーコンテナコンポーネント
 *
 * ServiceProvider から DI されたリポジトリと HTTP クライアントを使用し、
 * 作品取得、SQLite DB 永続化、縦書き/横書きリーダー表示およびテーマ切り替えを統合管理する。
 */
export const PocReaderContainer: React.FC<PocReaderContainerProps> = ({
  initialWorkUrl = DEFAULT_KAKUYOMU_URL,
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

  // 初回ロード / リロード復元
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
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [isReady, novelRepository, chapterRepository, settingsRepository]);

  // 作品取得操作
  const handleFetchNovel = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. 作品トップHTML取得
      const indexRes = await httpClient.getHtml({ url: initialWorkUrl });
      const parser = parserRegistry.requireParser(initialWorkUrl);
      const novelIndex = parser.parseNovelIndex(indexRes.html, initialWorkUrl);

      // 2. DBへ作品と目次を保存
      const savedNovel = await novelRepository.upsertNovelWithToc(
        novelIndex,
        new Date().toISOString(),
      );

      // 3. 第1話エピソード本文取得
      if (novelIndex.chapters.length > 0) {
        const firstEpisodeToc = novelIndex.chapters[0];
        const chapterRes = await httpClient.getHtml({
          url: firstEpisodeToc.url,
        });
        const parsedChapter = parser.parseChapterContent(
          chapterRes.html,
          firstEpisodeToc.url,
        );

        await chapterRepository.saveChapterBody(
          savedNovel.id,
          1,
          parsedChapter,
          new Date().toISOString(),
        );

        const savedChapter = await chapterRepository.getChapter(
          savedNovel.id,
          1,
        );
        setNovel(savedNovel);
        setChapter(savedChapter);
      } else {
        setNovel(savedNovel);
        setChapter(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [
    initialWorkUrl,
    httpClient,
    parserRegistry,
    novelRepository,
    chapterRepository,
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

  return (
    <div className="flex flex-col gap-4 w-full">
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

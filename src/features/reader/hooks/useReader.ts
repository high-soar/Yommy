import { useState, useEffect, useCallback, useRef } from "react";
import { useServices } from "../../../app/ServiceProvider";
import type {
  NovelRecord,
  ChapterRecord,
  WritingMode,
  ReaderTheme,
} from "../../../storage/types";
import {
  SHORT_TIMEOUT_MS,
  STANDARD_TIMEOUT_MS,
  PREFETCH_INTERVAL_MS,
  PREFETCH_COUNT,
} from "../../../shared/constants/cache";
import {
  isChapterFresh,
  delay,
  toErrorMessage,
} from "../../../shared/utils/cache";

export { isChapterFresh, delay, toErrorMessage };

/**
 * デフォルトの検証用カクヨム作品URL
 */
export const DEFAULT_KAKUYOMU_URL =
  "https://kakuyomu.jp/works/16817330658027210412";

export interface UseReaderOptions {
  novelId?: string;
  chapterIndex?: number;
  initialWorkUrl?: string;
}

export interface UseReaderResult {
  novel: NovelRecord | null;
  chapter: ChapterRecord | null;
  chapterIndex: number;
  totalChapters: number;
  writingMode: WritingMode;
  theme: ReaderTheme;
  fontSizePx: number;
  lineHeight: number;
  initialScrollProgress: number;
  scrollProgress: number;
  isLoading: boolean;
  error: string | null;
  hasPrevChapter: boolean;
  hasNextChapter: boolean;
  toggleWritingMode: () => Promise<void>;
  changeTheme: (theme: ReaderTheme) => Promise<void>;
  changeFontSize: (fontSizePx: number) => Promise<void>;
  changeLineHeight: (lineHeight: number) => Promise<void>;
  updateScrollProgress: (progress: number) => Promise<void>;
  flushBookmark: () => Promise<void>;
  goToChapter: (targetChapterIndex: number) => Promise<boolean>;
  fetchNovelFromUrl: () => Promise<void>;
}

/**
 * 小説リーダー画面（SCR-03）の状態管理カスタムフック。
 *
 * 【提供機能】
 * 1. エピソード読み込みと未キャッシュ話オンデマンド取得（TR-03, TR-04, TR-05）
 * 2. 既読フラグ（is_read = 1）の自動更新（表示完了時および次話遷移時）
 * 3. しおり（bookmark_chapter_index）とスクロール進捗率（bookmark_scroll_progress）の復元・自動保存
 * 4. 組版設定（組み方向・4テーマ・文字サイズ・行間）の読み込み・変更・永続化
 * 5. 前後エピソード遷移（goToChapter）と境界制御
 * 6. 手動作品取得・更新パイプライン（fetchNovelFromUrl）
 * 7. 読書中5話自動先読みパイプライン（AC-RD-12: 1.5秒レートリミット・直列取得・AbortController制御）
 * 8. キャッシュ鮮度管理とフォールバック（AC-RD-13: TTL 7日・3秒短タイムアウト再取得・既存本文フォールバック）
 */
export function useReader(options: UseReaderOptions = {}): UseReaderResult {
  const {
    httpClient,
    parserRegistry,
    novelRepository,
    chapterRepository,
    settingsRepository,
    isReady,
  } = useServices();

  const {
    novelId,
    chapterIndex,
    initialWorkUrl = DEFAULT_KAKUYOMU_URL,
  } = options;

  const [novel, setNovel] = useState<NovelRecord | null>(null);
  const [chapter, setChapter] = useState<ChapterRecord | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(
    chapterIndex ?? 1,
  );
  const [writingMode, setWritingMode] = useState<WritingMode>("vertical-rl");
  const [theme, setTheme] = useState<ReaderTheme>("light");
  const [fontSizePx, setFontSizePx] = useState<number>(18);
  const [lineHeight, setLineHeight] = useState<number>(1.8);
  const [initialScrollProgress, setInitialScrollProgress] = useState<number>(0);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const novelRef = useRef<NovelRecord | null>(novel);
  const currentChapterIndexRef = useRef<number>(currentChapterIndex);
  const scrollProgressRef = useRef<number>(scrollProgress);
  const prefetchAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    novelRef.current = novel;
  }, [novel]);

  useEffect(() => {
    currentChapterIndexRef.current = currentChapterIndex;
  }, [currentChapterIndex]);

  useEffect(() => {
    scrollProgressRef.current = scrollProgress;
  }, [scrollProgress]);

  /**
   * 進行中の自動先読み処理を即座に中断する内部関数
   */
  const stopPrefetch = useCallback(() => {
    if (prefetchAbortControllerRef.current) {
      prefetchAbortControllerRef.current.abort();
      prefetchAbortControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPrefetch();
    };
  }, [stopPrefetch]);

  /**
   * 指定エピソードの本文をオンデマンドで取得・パースして DB に保存する共通関数
   */
  const fetchAndSaveChapterBody = useCallback(
    async (
      targetNovelId: string,
      targetChapterIndex: number,
      episodeUrl: string,
      timeoutMs: number = STANDARD_TIMEOUT_MS,
      signal?: AbortSignal,
    ): Promise<ChapterRecord | null> => {
      const parser = parserRegistry.requireParser(episodeUrl);
      const chapterRes = await httpClient.getHtml({
        url: episodeUrl,
        timeoutMs,
        signal,
      });
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

  /**
   * キャッシュ鮮度ルールに基づいて本文を解決する内部関数 (AC-RD-13)
   *
   * - 7日以内の新鮮なキャッシュ: 通信なしでそのまま返す
   * - 7日経過したキャッシュ: 3秒短タイムアウトで再取得を試行。失敗時は既存キャッシュ本文へフォールバック
   * - 未キャッシュ話: 10秒標準タイムアウトで取得試行
   */
  const resolveChapterBody = useCallback(
    async (
      targetNovelId: string,
      targetChapterIndex: number,
      initialChapter: ChapterRecord,
    ): Promise<ChapterRecord | null> => {
      let resolved: ChapterRecord | null = initialChapter;
      if (resolved.bodyHtml !== null) {
        if (!isChapterFresh(resolved)) {
          try {
            const refreshed = await fetchAndSaveChapterBody(
              targetNovelId,
              targetChapterIndex,
              resolved.url,
              SHORT_TIMEOUT_MS,
            );
            if (refreshed) {
              resolved = refreshed;
            }
          } catch (err: unknown) {
            console.warn(
              `[useReader] Stale chapter refresh failed for index ${targetChapterIndex}, falling back to existing cache`,
              err,
            );
          }
        }
      } else {
        resolved = await fetchAndSaveChapterBody(
          targetNovelId,
          targetChapterIndex,
          resolved.url,
          STANDARD_TIMEOUT_MS,
        );
      }
      return resolved;
    },
    [fetchAndSaveChapterBody],
  );

  /**
   * 読書中エピソードから最大5話の自動先読みを開始する関数 (AC-RD-12)
   *
   * - 1話ごとに 1.5秒レートリミットを設けて直列実行
   * - 7日以内キャッシュが存在する話数は通信スキップ
   * - 先読みエラー時は読書画面にエラーを出さず warning ログに留める
   * - 話数移動（goToChapter）またはアンマウント時は即時 Abort
   */
  const startPrefetch = useCallback(
    (
      targetNovelId: string,
      currentChapterIdx: number,
      totalChapterCount: number,
    ) => {
      stopPrefetch();

      if (totalChapterCount <= currentChapterIdx) {
        return;
      }

      const abortController = new AbortController();
      prefetchAbortControllerRef.current = abortController;
      const signal = abortController.signal;

      void (async () => {
        try {
          // 第 N 話表示完了後、初期インターバル 1.5秒待機
          await delay(PREFETCH_INTERVAL_MS, signal);

          const maxChapterIndex = Math.min(
            currentChapterIdx + PREFETCH_COUNT,
            totalChapterCount,
          );

          for (
            let targetIdx = currentChapterIdx + 1;
            targetIdx <= maxChapterIndex;
            targetIdx++
          ) {
            const targetChapter = await chapterRepository.getChapter(
              targetNovelId,
              targetIdx,
            );
            if (!targetChapter) continue;

            // 7日以内キャッシュが存在すれば通信スキップ
            if (isChapterFresh(targetChapter)) {
              continue;
            }

            const timeoutMs =
              targetChapter.bodyHtml !== null
                ? SHORT_TIMEOUT_MS
                : STANDARD_TIMEOUT_MS;

            try {
              await fetchAndSaveChapterBody(
                targetNovelId,
                targetIdx,
                targetChapter.url,
                timeoutMs,
                signal,
              );
            } catch (err: unknown) {
              if (signal.aborted) return;
              console.warn(
                `[useReader] Prefetch failed for chapter ${targetIdx}`,
                err,
              );
            }

            // 1話の取得完了ごとに 1.5秒ウェイト
            await delay(PREFETCH_INTERVAL_MS, signal);
          }
        } catch (err: unknown) {
          if (signal.aborted) return;
          console.warn(
            "[useReader] Prefetch loop terminated unexpectedly",
            err,
          );
        }
      })();
    },
    [chapterRepository, fetchAndSaveChapterBody, stopPrefetch],
  );

  // 初期ロードおよび options 変更時のデータ同期
  useEffect(() => {
    if (!isReady) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    async function loadInitialData() {
      try {
        // 設定読み出し
        try {
          const settings = await settingsRepository.getReaderSettings();
          if (settings) {
            setWritingMode(settings.writingMode);
            setTheme(settings.theme);
            setFontSizePx(settings.fontSizePx);
            setLineHeight(settings.lineHeight);
          }
        } catch {
          // 初期行取得に失敗した場合はデフォルト値維持
        }

        const targetIndex = chapterIndex ?? 1;

        let targetNovel: NovelRecord | null = null;
        if (novelId) {
          targetNovel = await novelRepository.getNovelById(novelId);
        } else {
          const novels = await novelRepository.listNovels();
          if (novels.length > 0) {
            targetNovel = await novelRepository.getNovelById(novels[0].id);
          }
        }

        if (!targetNovel) {
          if (isMounted) {
            setNovel(null);
            setChapter(null);
            setCurrentChapterIndex(targetIndex);
            setInitialScrollProgress(0);
            setScrollProgress(0);
          }
          return;
        }

        let targetChapter = await chapterRepository.getChapter(
          targetNovel.id,
          targetIndex,
        );

        // キャッシュ鮮度・オンデマンド本文取得
        if (targetChapter) {
          const resolved = await resolveChapterBody(
            targetNovel.id,
            targetIndex,
            targetChapter,
          );
          if (resolved) {
            targetChapter = resolved;
            const reloadedNovel = await novelRepository.getNovelById(
              targetNovel.id,
            );
            if (reloadedNovel) {
              targetNovel = reloadedNovel;
            }
          }
        }

        // 既読自動更新
        if (
          targetChapter &&
          targetChapter.bodyHtml !== null &&
          !targetChapter.isRead
        ) {
          await chapterRepository.markChapterRead(
            targetNovel.id,
            targetIndex,
            true,
          );
          targetChapter = { ...targetChapter, isRead: true };
        }

        // しおり・スクロール進捗率の復元・自動更新
        let nextInitialProgress = 0;
        let nextScrollProgress = 0;
        if (targetNovel.bookmarkChapterIndex === targetIndex) {
          nextInitialProgress = targetNovel.bookmarkScrollProgress;
          nextScrollProgress = targetNovel.bookmarkScrollProgress;
        } else {
          await novelRepository.updateBookmark(targetNovel.id, targetIndex, 0);
          targetNovel = {
            ...targetNovel,
            bookmarkChapterIndex: targetIndex,
            bookmarkScrollProgress: 0,
          };
        }

        if (!isMounted) return;

        setInitialScrollProgress(nextInitialProgress);
        setScrollProgress(nextScrollProgress);
        setNovel(targetNovel);
        setChapter(targetChapter);
        setCurrentChapterIndex(targetIndex);

        // 本文取得完了時に自動先読みを開始
        if (targetChapter && targetChapter.bodyHtml !== null) {
          startPrefetch(targetNovel.id, targetIndex, targetNovel.totalChapters);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(toErrorMessage(err));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
      stopPrefetch();
    };
  }, [
    isReady,
    novelId,
    chapterIndex,
    novelRepository,
    chapterRepository,
    settingsRepository,
    resolveChapterBody,
    startPrefetch,
    stopPrefetch,
  ]);

  // 縦書き・横書き組み方向切替
  const toggleWritingMode = useCallback(async (): Promise<void> => {
    const nextMode: WritingMode =
      writingMode === "vertical-rl" ? "horizontal-tb" : "vertical-rl";
    setWritingMode(nextMode);
    try {
      await settingsRepository.updateReaderSettings({ writingMode: nextMode });
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    }
  }, [writingMode, settingsRepository]);

  // カラーテーマ切替
  const changeTheme = useCallback(
    async (nextTheme: ReaderTheme): Promise<void> => {
      setTheme(nextTheme);
      try {
        await settingsRepository.updateReaderSettings({ theme: nextTheme });
      } catch (err: unknown) {
        setError(toErrorMessage(err));
      }
    },
    [settingsRepository],
  );

  // 文字サイズ変更（12〜32px クランプ）
  const changeFontSize = useCallback(
    async (nextFontSizePx: number): Promise<void> => {
      const clamped = Math.max(12, Math.min(32, nextFontSizePx));
      setFontSizePx(clamped);
      try {
        await settingsRepository.updateReaderSettings({ fontSizePx: clamped });
      } catch (err: unknown) {
        setError(toErrorMessage(err));
      }
    },
    [settingsRepository],
  );

  // 行間変更（1.4〜2.4 クランプ・小数第1位丸め）
  const changeLineHeight = useCallback(
    async (nextLineHeight: number): Promise<void> => {
      const clamped =
        Math.round(Math.max(1.4, Math.min(2.4, nextLineHeight)) * 10) / 10;
      setLineHeight(clamped);
      try {
        await settingsRepository.updateReaderSettings({ lineHeight: clamped });
      } catch (err: unknown) {
        setError(toErrorMessage(err));
      }
    },
    [settingsRepository],
  );

  // スクロール進捗率更新（0.0〜1.0 クランプ）および DB 自動保存
  const updateScrollProgress = useCallback(
    async (progress: number): Promise<void> => {
      const clamped = Math.max(
        0,
        Math.min(1, Number.isFinite(progress) ? progress : 0),
      );
      setScrollProgress(clamped);
      scrollProgressRef.current = clamped;
      if (novelRef.current) {
        try {
          await novelRepository.updateBookmark(
            novelRef.current.id,
            currentChapterIndexRef.current,
            clamped,
          );
          setNovel({
            ...novelRef.current,
            bookmarkChapterIndex: currentChapterIndexRef.current,
            bookmarkScrollProgress: clamped,
          });
        } catch (err: unknown) {
          setError(toErrorMessage(err));
        }
      }
    },
    [novelRepository],
  );

  // しおり最新値即時保存
  const flushBookmark = useCallback(async (): Promise<void> => {
    if (novelRef.current) {
      try {
        await novelRepository.updateBookmark(
          novelRef.current.id,
          currentChapterIndexRef.current,
          scrollProgressRef.current,
        );
      } catch (err: unknown) {
        setError(toErrorMessage(err));
      }
    }
  }, [novelRepository]);

  // 前後エピソード遷移
  const goToChapter = useCallback(
    async (targetChapterIndex: number): Promise<boolean> => {
      stopPrefetch();

      const currentNovel = novelRef.current;
      if (
        !currentNovel ||
        targetChapterIndex < 1 ||
        targetChapterIndex > currentNovel.totalChapters
      ) {
        return false;
      }

      let isSuccess = false;
      setIsLoading(true);
      setError(null);

      try {
        // 1. 遷移前の現在話に対して既読更新
        await chapterRepository.markChapterRead(
          currentNovel.id,
          currentChapterIndexRef.current,
          true,
        );

        // 2. 対象話エピソード取得
        let targetChapter = await chapterRepository.getChapter(
          currentNovel.id,
          targetChapterIndex,
        );

        // 3. キャッシュ鮮度・オンデマンド本文取得
        if (targetChapter) {
          const resolved = await resolveChapterBody(
            currentNovel.id,
            targetChapterIndex,
            targetChapter,
          );
          if (resolved) {
            targetChapter = resolved;
          }
        }

        // 4. 表示完了時の既読更新
        if (
          targetChapter &&
          targetChapter.bodyHtml !== null &&
          !targetChapter.isRead
        ) {
          await chapterRepository.markChapterRead(
            currentNovel.id,
            targetChapterIndex,
            true,
          );
          targetChapter = { ...targetChapter, isRead: true };
        }

        // 5. 新エピソード先頭へのしおり更新
        await novelRepository.updateBookmark(
          currentNovel.id,
          targetChapterIndex,
          0,
        );
        const reloadedNovel = await novelRepository.getNovelById(
          currentNovel.id,
        );

        // 6. State 更新
        setCurrentChapterIndex(targetChapterIndex);
        setChapter(targetChapter);
        setNovel(reloadedNovel);
        setInitialScrollProgress(0);
        setScrollProgress(0);
        isSuccess = true;

        if (targetChapter && targetChapter.bodyHtml !== null && reloadedNovel) {
          startPrefetch(
            reloadedNovel.id,
            targetChapterIndex,
            reloadedNovel.totalChapters,
          );
        }
      } catch (err: unknown) {
        setError(toErrorMessage(err));
        isSuccess = false;
      } finally {
        setIsLoading(false);
      }
      return isSuccess;
    },
    [
      chapterRepository,
      novelRepository,
      resolveChapterBody,
      startPrefetch,
      stopPrefetch,
    ],
  );

  // 手動作品取得・更新パイプライン
  const fetchNovelFromUrl = useCallback(async (): Promise<void> => {
    stopPrefetch();

    const targetUrl = novelRef.current?.canonicalUrl ?? initialWorkUrl;
    if (!targetUrl) {
      setError("対象作品のURLが指定されていません");
      return;
    }

    let parser;
    let normalizedWorkUrl: string;
    try {
      parser = parserRegistry.requireParser(targetUrl);
      normalizedWorkUrl = parser.normalizeWorkUrl(targetUrl);
    } catch (err: unknown) {
      setError(toErrorMessage(err));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const indexRes = await httpClient.getHtml({ url: normalizedWorkUrl });
      const novelIndex = parser.parseNovelIndex(
        indexRes.html,
        normalizedWorkUrl,
      );
      const savedNovel = await novelRepository.upsertNovelWithToc(
        novelIndex,
        new Date().toISOString(),
      );

      if (novelIndex.chapters.length > 0) {
        const targetIdx = currentChapterIndexRef.current;
        const targetEpisodeToc =
          novelIndex.chapters.find((ch) => ch.chapterIndex === targetIdx) ??
          novelIndex.chapters[0];
        const targetChapterIdx = targetEpisodeToc.chapterIndex;

        const savedChapter = await fetchAndSaveChapterBody(
          savedNovel.id,
          targetChapterIdx,
          targetEpisodeToc.url,
        );
        if (savedChapter) {
          await chapterRepository.markChapterRead(
            savedNovel.id,
            targetChapterIdx,
            true,
          );
        }
        await novelRepository.updateBookmark(
          savedNovel.id,
          targetChapterIdx,
          0,
        );

        const reloadedNovel = await novelRepository.getNovelById(savedNovel.id);

        setNovel(reloadedNovel);
        setChapter(savedChapter ? { ...savedChapter, isRead: true } : null);
        setCurrentChapterIndex(targetChapterIdx);
        setInitialScrollProgress(0);
        setScrollProgress(0);

        if (savedChapter && reloadedNovel) {
          startPrefetch(
            savedNovel.id,
            targetChapterIdx,
            reloadedNovel.totalChapters,
          );
        }
      } else {
        setNovel(savedNovel);
        setChapter(null);
        setInitialScrollProgress(0);
        setScrollProgress(0);
      }
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [
    initialWorkUrl,
    parserRegistry,
    httpClient,
    novelRepository,
    chapterRepository,
    fetchAndSaveChapterBody,
    startPrefetch,
    stopPrefetch,
  ]);

  const totalChapters = novel ? novel.totalChapters : 0;
  const hasPrevChapter = novel !== null && currentChapterIndex > 1;
  const hasNextChapter = novel !== null && currentChapterIndex < totalChapters;

  return {
    novel,
    chapter,
    chapterIndex: currentChapterIndex,
    totalChapters,
    writingMode,
    theme,
    fontSizePx,
    lineHeight,
    initialScrollProgress,
    scrollProgress,
    isLoading,
    error,
    hasPrevChapter,
    hasNextChapter,
    toggleWritingMode,
    changeTheme,
    changeFontSize,
    changeLineHeight,
    updateScrollProgress,
    flushBookmark,
    goToChapter,
    fetchNovelFromUrl,
  };
}

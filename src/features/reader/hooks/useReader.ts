import { useState, useEffect, useCallback, useRef } from "react";
import { useServices } from "../../../app/ServiceProvider";
import { fetchFullNovelIndex } from "../../../parsers/fetchFullNovelIndex";
import type {
  NovelRecord,
  ChapterRecord,
  WritingMode,
  ReaderTheme,
  ReaderPagingMode,
  ReaderFontFamily,
} from "../../../storage/types";
import {
  SHORT_TIMEOUT_MS,
  STANDARD_TIMEOUT_MS,
  PREFETCH_INTERVAL_MS,
  PREFETCH_COUNT,
} from "../../../shared/constants/cache";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_PAGE_MARGIN_PX,
} from "../../../shared/constants/typography";
import {
  isChapterFresh,
  delay,
  toErrorMessage,
} from "../../../shared/utils/cache";

export { isChapterFresh, delay, toErrorMessage };

/**
 * ページ送りモードと組み方向から実効動作モード（"paged" | "scroll"）を算出する純粋関数
 */
export function resolveEffectivePagingMode(
  pagingMode: ReaderPagingMode,
  writingMode: WritingMode,
): "paged" | "scroll" {
  if (writingMode === "horizontal-tb") {
    return "scroll";
  }
  return pagingMode === "scroll" ? "scroll" : "paged";
}

/**
 * 現在ページ番号と総ページ数から進捗率（0.0〜1.0）を算出する純粋関数
 */
export function calculateProgressFromPage(
  currentPage: number,
  totalPages: number,
): number {
  if (totalPages <= 1) return 0;
  const clampedPage = Math.max(
    1,
    Math.min(totalPages, Math.round(currentPage)),
  );
  return (clampedPage - 1) / (totalPages - 1);
}

/**
 * 保存された進捗率（0.0〜1.0）と総ページ数から復元ページ番号（1始まり）を算出する純粋関数
 */
export function calculatePageFromProgress(
  progress: number,
  totalPages: number,
): number {
  if (totalPages <= 1) return 1;
  const clampedProgress = Math.max(
    0,
    Math.min(1, Number.isFinite(progress) ? progress : 0),
  );
  return Math.min(
    totalPages,
    Math.max(1, Math.round(clampedProgress * (totalPages - 1)) + 1),
  );
}

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

export interface GoToChapterOptions {
  /** 遷移先エピソードの表示開始位置（"start": 先頭 0.0、"end": 末尾 1.0・最終ページ） */
  startAt?: "start" | "end";
  /** 遷移失敗時に現在表示中エピソードの本文・ページ番号・進捗を保持するか（しおり競合解決 "move" 用） */
  preserveChapterOnError?: boolean;
}

/**
 * クラウド同期によるしおり競合検知状態
 */
export interface BookmarkConflictState {
  currentChapterIndex: number;
  remoteChapterIndex: number;
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
  /** 現在のフォント種別（既定値: 'biz-ud-mincho'、v0.5 Issue #169） */
  fontFamily: ReaderFontFamily;
  /** 現在の画面余白 px（既定値: 20、v0.5 Issue #169） */
  pageMarginPx: number;
  initialScrollProgress: number;
  scrollProgress: number;
  pagingMode: ReaderPagingMode;
  effectivePagingMode: "paged" | "scroll";
  /** ハードウェア音量キーページ送り有効フラグ（既定値: false、v0.6 Issue #203） */
  enableVolumeKeyPaging: boolean;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  hasPrevChapter: boolean;
  hasNextChapter: boolean;
  toggleWritingMode: () => Promise<void>;
  changeTheme: (theme: ReaderTheme) => Promise<void>;
  changeFontSize: (fontSizePx: number) => Promise<void>;
  changeLineHeight: (lineHeight: number) => Promise<void>;
  changePagingMode: (pagingMode: ReaderPagingMode) => Promise<void>;
  goToPage: (targetPage: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setTotalPages: (total: number) => void;
  updateScrollProgress: (progress: number) => Promise<void>;
  flushBookmark: () => Promise<void>;
  goToChapter: (
    targetChapterIndex: number,
    options?: GoToChapterOptions,
  ) => Promise<boolean>;
  fetchNovelFromUrl: () => Promise<void>;
  /** クラウド同期によるしおり競合状態（競合なし時は null） */
  bookmarkConflict: BookmarkConflictState | null;
  /** しおり競合を解決する（"move": 他端末話へ移動、"keep": 現在話を維持して同期） */
  resolveBookmarkConflict: (action: "move" | "keep") => Promise<boolean>;
}

/**
 * 小説リーダー画面（SCR-03）の状態管理カスタムフック。
 *
 * 【提供機能】
 * 1. エピソード読み込みと未キャッシュ話オンデマンド取得（TR-03, TR-04, TR-05）
 * 2. 既読フラグ（is_read = 1）の自動更新（表示完了時および次話遷移時）
 * 3. しおり（bookmark_chapter_index）とスクロール進捗率（bookmark_scroll_progress）の復元・自動保存
 * 4. 組版設定（組み方向・4テーマ・文字サイズ・行間・フォント種別・画面余白）の読み込み・変更・永続化
 * 5. 前後エピソード遷移（goToChapter）と境界制御
 * 6. 手動作品取得・更新パイプライン（fetchNovelFromUrl）
 * 7. 読書中5話自動先読みパイプライン（AC-RD-12: 1.5秒レートリミット・直列取得・AbortController制御）
 * 8. キャッシュ鮮度管理とフォールバック（AC-RD-13: TTL 7日・3秒短タイムアウト再取得・既存本文フォールバック）
 * 9. ページ送りモード（auto / paged / scroll）と実効モード（effectivePagingMode）の算出・永続化（AC-RD-15）
 * 10. ページネーション状態管理（currentPage, totalPages, goToPage, nextPage, prevPage）としおり進捗率の相互変換・復元（AC-RD-20）
 */
export function useReader(options: UseReaderOptions = {}): UseReaderResult {
  const {
    httpClient,
    parserRegistry,
    novelRepository,
    chapterRepository,
    settingsRepository,
    syncEngine,
    cacheScheduler,
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
  const [fontFamily, setFontFamily] =
    useState<ReaderFontFamily>(DEFAULT_FONT_FAMILY);
  const [pageMarginPx, setPageMarginPx] = useState<number>(
    DEFAULT_PAGE_MARGIN_PX,
  );
  const [pagingMode, setPagingMode] = useState<ReaderPagingMode>("auto");
  const [enableVolumeKeyPaging, setEnableVolumeKeyPaging] =
    useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPagesState] = useState<number>(1);
  const [initialScrollProgress, setInitialScrollProgress] = useState<number>(0);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmarkConflict, setBookmarkConflict] =
    useState<BookmarkConflictState | null>(null);

  const novelRef = useRef<NovelRecord | null>(novel);
  const currentChapterIndexRef = useRef<number>(currentChapterIndex);
  const scrollProgressRef = useRef<number>(scrollProgress);
  const currentPageRef = useRef<number>(currentPage);
  const totalPagesRef = useRef<number>(totalPages);
  const initialScrollProgressRef = useRef<number>(initialScrollProgress);
  const hasUserChangedPageRef = useRef<boolean>(false);
  const hasPendingBookmarkRef = useRef<boolean>(false);
  const bookmarkConflictRef = useRef<BookmarkConflictState | null>(
    bookmarkConflict,
  );
  const prefetchAbortControllerRef = useRef<AbortController | null>(null);
  const chapterFetchAbortControllerRef = useRef<AbortController | null>(null);
  const activePrefetchPromiseRef = useRef<Promise<void> | null>(null);
  const lastGoToChapterIndexRef = useRef<number | null>(null);
  const bookmarkDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isNavigatingChapterRef = useRef<boolean>(false);
  const isResolvingConflictRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    novelRef.current = novel;
  }, [novel]);

  useEffect(() => {
    currentChapterIndexRef.current = currentChapterIndex;
  }, [currentChapterIndex]);

  useEffect(() => {
    scrollProgressRef.current = scrollProgress;
  }, [scrollProgress]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    totalPagesRef.current = totalPages;
  }, [totalPages]);

  useEffect(() => {
    initialScrollProgressRef.current = initialScrollProgress;
  }, [initialScrollProgress]);

  useEffect(() => {
    return () => {
      if (bookmarkDebounceTimerRef.current) {
        clearTimeout(bookmarkDebounceTimerRef.current);
        bookmarkDebounceTimerRef.current = null;
      }
    };
  }, []);

  const clearBookmarkDebounceTimer = useCallback(() => {
    if (bookmarkDebounceTimerRef.current) {
      clearTimeout(bookmarkDebounceTimerRef.current);
      bookmarkDebounceTimerRef.current = null;
    }
  }, []);

  /**
   * エピソード切替時または初期読み込み時にページネーション状態を初期化する内部関数
   */
  const resetPaginationState = useCallback(
    (initialProgress: number = 0, currentProgress: number = 0): void => {
      clearBookmarkDebounceTimer();
      setInitialScrollProgress(initialProgress);
      initialScrollProgressRef.current = initialProgress;
      setScrollProgress(currentProgress);
      scrollProgressRef.current = currentProgress;
      setCurrentPage(1);
      currentPageRef.current = 1;
      setTotalPagesState(1);
      totalPagesRef.current = 1;
      hasUserChangedPageRef.current = false;
      hasPendingBookmarkRef.current = false;
    },
    [clearBookmarkDebounceTimer],
  );

  /**
   * 進行中の自動先読み処理を即座に中断する内部関数
   */
  const stopPrefetch = useCallback(() => {
    if (prefetchAbortControllerRef.current) {
      prefetchAbortControllerRef.current.abort();
      prefetchAbortControllerRef.current = null;
    }
  }, []);

  /**
   * 進行中のオンデマンド本文取得（high優先度・直接取得）を即座に中断する内部関数
   */
  const stopChapterFetch = useCallback(() => {
    if (chapterFetchAbortControllerRef.current) {
      chapterFetchAbortControllerRef.current.abort();
      chapterFetchAbortControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopPrefetch();
      stopChapterFetch();
    };
  }, [stopChapterFetch, stopPrefetch]);

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
      if (signal?.aborted) {
        return null;
      }
      if (chapterRes.status >= 400) {
        throw new Error(
          `エピソードの取得に失敗しました (HTTP ${chapterRes.status})`,
        );
      }
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
      signal: AbortSignal,
    ): Promise<ChapterRecord | null> => {
      let resolved: ChapterRecord | null = initialChapter;
      if (cacheScheduler) {
        const isFresh = resolved.bodyHtml !== null && isChapterFresh(resolved);
        if (!isFresh) {
          const isStaleExisting = resolved.bodyHtml !== null;
          try {
            await cacheScheduler.enqueuePrefetch({
              novelId: targetNovelId,
              chapterIndexes: [targetChapterIndex],
              priority: "high",
              signal,
            });
            if (signal.aborted) {
              return null;
            }
            const refreshed = await chapterRepository.getChapter(
              targetNovelId,
              targetChapterIndex,
            );
            if (refreshed) {
              resolved = refreshed;
            }
          } catch (err: unknown) {
            if (!signal.aborted && isStaleExisting) {
              console.warn(
                `[useReader] Stale chapter refresh failed for index ${targetChapterIndex}, falling back to existing cache`,
                err,
              );
            } else {
              throw err;
            }
          }
        }
        return resolved;
      }

      if (resolved.bodyHtml !== null) {
        if (!isChapterFresh(resolved)) {
          try {
            const refreshed = await fetchAndSaveChapterBody(
              targetNovelId,
              targetChapterIndex,
              resolved.url,
              SHORT_TIMEOUT_MS,
              signal,
            );
            if (refreshed) {
              resolved = refreshed;
            }
          } catch (err: unknown) {
            if (signal.aborted) {
              throw err;
            }
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
          signal,
        );
      }
      return resolved;
    },
    [cacheScheduler, chapterRepository, fetchAndSaveChapterBody],
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
      const previousPromise = activePrefetchPromiseRef.current;
      stopPrefetch();

      if (totalChapterCount <= currentChapterIdx) {
        return;
      }

      const abortController = new AbortController();
      prefetchAbortControllerRef.current = abortController;
      const signal = abortController.signal;

      if (cacheScheduler) {
        const maxTargetIdx = Math.min(
          currentChapterIdx + PREFETCH_COUNT,
          totalChapterCount,
        );
        const chapterIndexes: number[] = [];
        for (let idx = currentChapterIdx + 1; idx <= maxTargetIdx; idx++) {
          chapterIndexes.push(idx);
        }

        const currentPromise = cacheScheduler
          .enqueuePrefetch({
            novelId: targetNovelId,
            chapterIndexes,
            priority: "medium",
            signal,
          })
          .catch((err: unknown) => {
            if (signal.aborted) return;
            console.warn(
              "[useReader] Prefetch loop terminated unexpectedly",
              err,
            );
          })
          .finally(() => {
            if (activePrefetchPromiseRef.current === currentPromise) {
              activePrefetchPromiseRef.current = null;
            }
          });

        activePrefetchPromiseRef.current = currentPromise;
        return;
      }

      const runPrefetch = async () => {
        try {
          // 先行先読みタスクの完了を待機（直列化保証: R1-29）
          if (previousPromise) {
            await previousPromise;
          }
          if (signal.aborted) return;

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
        } finally {
          if (activePrefetchPromiseRef.current === currentPromise) {
            activePrefetchPromiseRef.current = null;
          }
        }
      };

      const currentPromise = runPrefetch();
      activePrefetchPromiseRef.current = currentPromise;
    },
    [cacheScheduler, chapterRepository, fetchAndSaveChapterBody, stopPrefetch],
  );

  // 初期ロードおよび options 変更時のデータ同期
  useEffect(() => {
    if (!isReady) return;

    const skippedChapterIndex = lastGoToChapterIndexRef.current;
    lastGoToChapterIndexRef.current = null;
    if (skippedChapterIndex === (chapterIndex ?? 1)) {
      return;
    }

    let isMounted = true;
    stopPrefetch();
    stopChapterFetch();
    const fetchAbortController = new AbortController();
    chapterFetchAbortControllerRef.current = fetchAbortController;
    setIsLoading(true);
    setError(null);

    let targetNovel: NovelRecord | null = null;
    let targetChapter: ChapterRecord | null = null;

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
            if (settings.fontFamily) {
              setFontFamily(settings.fontFamily);
            }
            if (typeof settings.pageMarginPx === "number") {
              setPageMarginPx(settings.pageMarginPx);
            }
            if (settings.pagingMode) {
              setPagingMode(settings.pagingMode);
            }
            if (typeof settings.enableVolumeKeyPaging === "boolean") {
              setEnableVolumeKeyPaging(settings.enableVolumeKeyPaging);
            }
          }
        } catch {
          // 初期行取得に失敗した場合はデフォルト値維持
        }

        const targetIndex = chapterIndex ?? 1;

        if (novelId) {
          targetNovel = await novelRepository.getNovelById(novelId);
        } else {
          const novels = await novelRepository.listNovels();
          if (novels.length > 0) {
            targetNovel = await novelRepository.getNovelById(novels[0].id);
          }
        }
        if (!isMounted) return;

        if (!targetNovel) {
          setNovel(null);
          setChapter(null);
          setCurrentChapterIndex(targetIndex);
          resetPaginationState(0, 0);
          return;
        }

        // 新着更新フラグの自動解除 (AC-RD-11)
        if (targetNovel.hasNewUpdate) {
          await novelRepository.clearNewUpdate(targetNovel.id);
          targetNovel = {
            ...targetNovel,
            hasNewUpdate: false,
          };
        }

        targetChapter = await chapterRepository.getChapter(
          targetNovel.id,
          targetIndex,
        );

        // キャッシュ鮮度・オンデマンド本文取得
        if (targetChapter) {
          const resolved = await resolveChapterBody(
            targetNovel.id,
            targetIndex,
            targetChapter,
            fetchAbortController.signal,
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

        // R1-29 / R1-13: 初期通信（resolveChapterBody）完了・中断後にアンマウントまたは別取得へ切り替わっていた場合は DB 更新・同期をスキップ
        if (!isMounted || fetchAbortController.signal.aborted) return;

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
          if (syncEngine) {
            syncEngine.notifyChanged().catch(() => {});
          }
        }

        // しおり・スクロール進捗率の復元・自動更新
        let nextInitialProgress = 0;
        let nextScrollProgress = 0;
        if (targetNovel.bookmarkChapterIndex === targetIndex) {
          nextInitialProgress = targetNovel.bookmarkScrollProgress;
          nextScrollProgress = targetNovel.bookmarkScrollProgress;
        } else {
          await novelRepository.updateBookmark(targetNovel.id, targetIndex, 0);
          if (syncEngine) {
            syncEngine.notifyChanged().catch(() => {});
          }
          targetNovel = {
            ...targetNovel,
            bookmarkChapterIndex: targetIndex,
            bookmarkScrollProgress: 0,
          };
        }

        resetPaginationState(nextInitialProgress, nextScrollProgress);
        setNovel(targetNovel);
        novelRef.current = targetNovel;
        setChapter(targetChapter);
        setCurrentChapterIndex(targetIndex);
        currentChapterIndexRef.current = targetIndex;

        // 本文取得完了時に自動先読みを開始
        if (targetChapter && targetChapter.bodyHtml !== null) {
          startPrefetch(targetNovel.id, targetIndex, targetNovel.totalChapters);
        }
      } catch (err: unknown) {
        if (isMounted && !fetchAbortController.signal.aborted) {
          setError(toErrorMessage(err));
          // エラー時も内蔵ブラウザ連携 (TR-10) のために対象作品・対象話メタデータを設定
          if (targetNovel) {
            setNovel(targetNovel);
            novelRef.current = targetNovel;
          }
          if (targetChapter) {
            setChapter(targetChapter);
          }
        }
      } finally {
        if (chapterFetchAbortControllerRef.current === fetchAbortController) {
          chapterFetchAbortControllerRef.current = null;
        }
        if (isMounted && !fetchAbortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
      stopChapterFetch();
    };
  }, [
    isReady,
    novelId,
    chapterIndex,
    novelRepository,
    chapterRepository,
    settingsRepository,
    resolveChapterBody,
    resetPaginationState,
    startPrefetch,
    stopChapterFetch,
    stopPrefetch,
    syncEngine,
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

  // ページ送りモード変更
  const changePagingMode = useCallback(
    async (nextPagingMode: ReaderPagingMode): Promise<void> => {
      setPagingMode(nextPagingMode);
      try {
        await settingsRepository.updateReaderSettings({
          pagingMode: nextPagingMode,
        });
      } catch (err: unknown) {
        setError(toErrorMessage(err));
      }
    },
    [settingsRepository],
  );

  // 総ページ数設定および初期復元／クランプ
  const setTotalPages = useCallback((total: number): void => {
    const validTotal = Math.max(
      1,
      Math.floor(Number.isFinite(total) ? total : 1),
    );
    setTotalPagesState(validTotal);
    totalPagesRef.current = validTotal;

    if (!hasUserChangedPageRef.current) {
      if (initialScrollProgressRef.current > 0) {
        const restoredPage = calculatePageFromProgress(
          initialScrollProgressRef.current,
          validTotal,
        );
        setCurrentPage(restoredPage);
        currentPageRef.current = restoredPage;
        return;
      }
    }

    setCurrentPage((prevPage) => {
      if (prevPage > validTotal) {
        currentPageRef.current = validTotal;
        return validTotal;
      }
      return prevPage;
    });
  }, []);

  // しおり永続化・メモリ状態同期・クラウド同期通知の共通ヘルパー
  const persistBookmark = useCallback(
    async (
      targetNovel: NovelRecord | null,
      chapterIdx: number,
      progress: number,
    ): Promise<boolean> => {
      if (!targetNovel) {
        return false;
      }
      try {
        await novelRepository.updateBookmark(
          targetNovel.id,
          chapterIdx,
          progress,
        );
        hasPendingBookmarkRef.current = false;
        const updatedNovel: NovelRecord = {
          ...targetNovel,
          bookmarkChapterIndex: chapterIdx,
          bookmarkScrollProgress: progress,
        };
        setNovel(updatedNovel);
        novelRef.current = updatedNovel;
        if (syncEngine) {
          syncEngine.notifyChanged().catch(() => {});
        }
        return true;
      } catch (err: unknown) {
        setError(toErrorMessage(err));
        return false;
      }
    },
    [novelRepository, syncEngine],
  );

  // スクロール進捗率更新（0.0〜1.0 クランプ）および DB 自動保存（300ms デバウンス: R1-12）
  const updateScrollProgress = useCallback(
    async (progress: number): Promise<void> => {
      if (bookmarkConflictRef.current !== null) {
        clearBookmarkDebounceTimer();
        return;
      }
      const clamped = Math.max(
        0,
        Math.min(1, Number.isFinite(progress) ? progress : 0),
      );
      hasPendingBookmarkRef.current = true;
      setScrollProgress(clamped);
      scrollProgressRef.current = clamped;

      clearBookmarkDebounceTimer();

      bookmarkDebounceTimerRef.current = setTimeout(() => {
        bookmarkDebounceTimerRef.current = null;
        void persistBookmark(
          novelRef.current,
          currentChapterIndexRef.current,
          clamped,
        );
      }, 300);
    },
    [clearBookmarkDebounceTimer, persistBookmark],
  );

  // 指定ページへの遷移およびしおり自動保存
  const goToPage = useCallback(
    (targetPage: number): void => {
      hasUserChangedPageRef.current = true;
      const total = totalPagesRef.current;
      const rawTarget = Number.isFinite(targetPage)
        ? Math.round(targetPage)
        : 1;
      const clampedPage = Math.max(1, Math.min(total, rawTarget));

      setCurrentPage(clampedPage);
      currentPageRef.current = clampedPage;

      const progress = calculateProgressFromPage(clampedPage, total);
      void updateScrollProgress(progress);
    },
    [updateScrollProgress],
  );

  // 次のページへ遷移
  const nextPage = useCallback((): void => {
    goToPage(currentPageRef.current + 1);
  }, [goToPage]);

  // 前のページへ遷移
  const prevPage = useCallback((): void => {
    goToPage(currentPageRef.current - 1);
  }, [goToPage]);

  // しおり最新値即時保存（未変更時は書き込まず保護: Issue #342、ref 安定化: R1-12）
  const flushBookmark = useCallback(async (): Promise<void> => {
    clearBookmarkDebounceTimer();
    if (bookmarkConflictRef.current !== null) {
      return;
    }
    if (!hasPendingBookmarkRef.current) {
      return;
    }
    await persistBookmark(
      novelRef.current,
      currentChapterIndexRef.current,
      scrollProgressRef.current,
    );
  }, [clearBookmarkDebounceTimer, persistBookmark]);

  // 画面ロック・バックグラウンド移行時に未保存進捗を即時フラッシュ (Issue #342)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (bookmarkConflictRef.current !== null) {
          clearBookmarkDebounceTimer();
          return;
        }
        if (hasPendingBookmarkRef.current) {
          void flushBookmark();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearBookmarkDebounceTimer, flushBookmark]);

  // クラウド同期 Pull 完了時のしおり競合検知 (Issue #342)
  useEffect(() => {
    if (!syncEngine?.subscribePullCompleted) {
      return;
    }
    return syncEngine.subscribePullCompleted((result) => {
      if (!result.pulled || !novelRef.current) {
        return;
      }
      const targetNovelId = novelRef.current.id;
      void (async () => {
        try {
          const latestNovel = await novelRepository.getNovelById(targetNovelId);
          if (!isMountedRef.current || !latestNovel) {
            return;
          }
          if (
            latestNovel.bookmarkChapterIndex !== null &&
            latestNovel.bookmarkChapterIndex >= 1 &&
            latestNovel.bookmarkChapterIndex <= latestNovel.totalChapters
          ) {
            if (
              latestNovel.bookmarkChapterIndex !==
              currentChapterIndexRef.current
            ) {
              clearBookmarkDebounceTimer();
              hasPendingBookmarkRef.current = false;
              const nextConflict: BookmarkConflictState = {
                currentChapterIndex: currentChapterIndexRef.current,
                remoteChapterIndex: latestNovel.bookmarkChapterIndex,
              };
              bookmarkConflictRef.current = nextConflict;
              setBookmarkConflict(nextConflict);
            } else {
              bookmarkConflictRef.current = null;
              setBookmarkConflict(null);
            }
          }
        } catch {
          // 競合検知用 DB 読み取り失敗時は既存表示を維持
        }
      })();
    });
  }, [clearBookmarkDebounceTimer, novelRepository, syncEngine]);

  // 前後エピソード遷移
  const goToChapter = useCallback(
    async (
      targetChapterIndex: number,
      options?: GoToChapterOptions,
    ): Promise<boolean> => {
      // 多重遷移防止ガード (AC-RD-06)
      if (isNavigatingChapterRef.current) {
        return false;
      }

      const currentNovel = novelRef.current;
      if (
        !currentNovel ||
        targetChapterIndex < 1 ||
        targetChapterIndex > currentNovel.totalChapters
      ) {
        return false;
      }

      stopPrefetch();
      stopChapterFetch();

      const fetchAbortController = new AbortController();
      chapterFetchAbortControllerRef.current = fetchAbortController;
      const { signal } = fetchAbortController;

      let isSuccess = false;
      isNavigatingChapterRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        // R1-17 / R1-18: 遷移前の未保存タイマーを停止し、競合未発生時のみ旧話の未保存進捗をフラッシュ
        clearBookmarkDebounceTimer();
        if (
          hasPendingBookmarkRef.current &&
          bookmarkConflictRef.current === null
        ) {
          await flushBookmark();
          if (!isMountedRef.current) return false;
        }
        hasPendingBookmarkRef.current = false;

        // 1. 遷移前の現在話に対して既読更新
        await chapterRepository.markChapterRead(
          currentNovel.id,
          currentChapterIndexRef.current,
          true,
        );
        if (!isMountedRef.current) return false;

        // 2. 対象話エピソード取得
        let targetChapter = await chapterRepository.getChapter(
          currentNovel.id,
          targetChapterIndex,
        );
        if (!isMountedRef.current) return false;

        // 3. キャッシュ鮮度・オンデマンド本文取得
        if (targetChapter) {
          // 未キャッシュ話への遷移時は通信開始前に本文をクリアして中央ローディング表示 (AC-RD-06, AC-RD-28)
          // R1-01: preserveChapterOnError 指定時は失敗後のフォールバック継続のため現話表示を保持
          if (
            targetChapter.bodyHtml === null &&
            !options?.preserveChapterOnError
          ) {
            setChapter(null);
          }
          try {
            const resolved = await resolveChapterBody(
              currentNovel.id,
              targetChapterIndex,
              targetChapter,
              signal,
            );
            if (!isMountedRef.current || signal.aborted) return false;
            if (resolved) {
              targetChapter = resolved;
            }
          } catch (fetchErr) {
            // エラー時も内蔵ブラウザ連携 (TR-10) のために対象話メタデータ・目標話数を保持 (R1-27)
            // R2-01: 旧話のスクロール進捗が残ったまま新話のしおりへ誤保存されないようリセット
            if (
              isMountedRef.current &&
              !signal.aborted &&
              !options?.preserveChapterOnError
            ) {
              setChapter(targetChapter);
              setCurrentChapterIndex(targetChapterIndex);
              currentChapterIndexRef.current = targetChapterIndex;
              resetPaginationState(0, 0);
            }
            throw fetchErr;
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
          if (!isMountedRef.current) return false;
          targetChapter = { ...targetChapter, isRead: true };
        }

        // 5. 新エピソードへのしおり更新（R1-07: startAt === "end" の場合は末尾進捗 1.0）
        const nextProgress = options?.startAt === "end" ? 1.0 : 0.0;
        await novelRepository.updateBookmark(
          currentNovel.id,
          targetChapterIndex,
          nextProgress,
        );
        if (!isMountedRef.current) return false;

        const reloadedNovel = await novelRepository.getNovelById(
          currentNovel.id,
        );
        if (!isMountedRef.current) return false;

        if (syncEngine) {
          syncEngine.notifyChanged().catch(() => {});
        }

        // 6. State 更新
        lastGoToChapterIndexRef.current = targetChapterIndex;
        setCurrentChapterIndex(targetChapterIndex);
        currentChapterIndexRef.current = targetChapterIndex;
        setChapter(targetChapter);
        setNovel(reloadedNovel);
        novelRef.current = reloadedNovel;
        resetPaginationState(nextProgress, nextProgress);
        isSuccess = true;

        if (targetChapter && targetChapter.bodyHtml !== null && reloadedNovel) {
          startPrefetch(
            reloadedNovel.id,
            targetChapterIndex,
            reloadedNovel.totalChapters,
          );
        }
      } catch (err: unknown) {
        if (isMountedRef.current && !signal.aborted) {
          setError(toErrorMessage(err));
          if (!options?.preserveChapterOnError) {
            // R1-27: 取得失敗時でも目標話数 index を保持して表示・遷移パラメータが食い違わないよう是正
            // R2-01: 話移動失敗時に旧話のスクロール進捗が新話しおりへ保存されないようリセット
            setCurrentChapterIndex(targetChapterIndex);
            currentChapterIndexRef.current = targetChapterIndex;
            resetPaginationState(0, 0);
          }
        }
        isSuccess = false;
      } finally {
        isNavigatingChapterRef.current = false;
        if (chapterFetchAbortControllerRef.current === fetchAbortController) {
          chapterFetchAbortControllerRef.current = null;
        }
        if (isMountedRef.current && !signal.aborted) {
          setIsLoading(false);
        }
      }
      return isSuccess;
    },
    [
      chapterRepository,
      clearBookmarkDebounceTimer,
      flushBookmark,
      novelRepository,
      resetPaginationState,
      resolveChapterBody,
      startPrefetch,
      stopChapterFetch,
      stopPrefetch,
      syncEngine,
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
      const novelIndex = await fetchFullNovelIndex(
        httpClient,
        parser,
        normalizedWorkUrl,
      );
      if (!isMountedRef.current) return;

      const savedNovel = await novelRepository.upsertNovelWithToc(
        novelIndex,
        new Date().toISOString(),
      );
      if (!isMountedRef.current) return;

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
        if (!isMountedRef.current) return;

        if (savedChapter) {
          await chapterRepository.markChapterRead(
            savedNovel.id,
            targetChapterIdx,
            true,
          );
          if (!isMountedRef.current) return;
        }
        await novelRepository.updateBookmark(
          savedNovel.id,
          targetChapterIdx,
          0,
        );
        if (!isMountedRef.current) return;
        if (syncEngine) {
          syncEngine.notifyChanged().catch(() => {});
        }

        const reloadedNovel = await novelRepository.getNovelById(savedNovel.id);
        if (!isMountedRef.current) return;

        setNovel(reloadedNovel);
        novelRef.current = reloadedNovel;
        setChapter(savedChapter ? { ...savedChapter, isRead: true } : null);
        setCurrentChapterIndex(targetChapterIdx);
        currentChapterIndexRef.current = targetChapterIdx;
        resetPaginationState(0, 0);

        if (savedChapter && reloadedNovel) {
          startPrefetch(
            savedNovel.id,
            targetChapterIdx,
            reloadedNovel.totalChapters,
          );
        }
      } else {
        setNovel(savedNovel);
        novelRef.current = savedNovel;
        setChapter(null);
        resetPaginationState(0, 0);
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setError(toErrorMessage(err));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    initialWorkUrl,
    parserRegistry,
    httpClient,
    novelRepository,
    chapterRepository,
    fetchAndSaveChapterBody,
    resetPaginationState,
    startPrefetch,
    stopPrefetch,
    syncEngine,
  ]);

  const totalChapters = novel ? novel.totalChapters : 0;
  const hasPrevChapter = novel !== null && currentChapterIndex > 1;
  const hasNextChapter = novel !== null && currentChapterIndex < totalChapters;
  const effectivePagingMode = resolveEffectivePagingMode(
    pagingMode,
    writingMode,
  );

  // しおり競合解決（"move": リモート話へ移動、"keep": 現在話を明示保存して同期通知、R1-01）
  const resolveBookmarkConflict = useCallback(
    async (action: "move" | "keep"): Promise<boolean> => {
      if (isResolvingConflictRef.current) {
        return false;
      }
      const conflict = bookmarkConflictRef.current;
      if (!conflict) {
        return false;
      }

      isResolvingConflictRef.current = true;
      try {
        clearBookmarkDebounceTimer();
        hasPendingBookmarkRef.current = false;

        const ok =
          action === "move"
            ? await goToChapter(conflict.remoteChapterIndex, {
                preserveChapterOnError: true,
              })
            : await persistBookmark(
                novelRef.current,
                currentChapterIndexRef.current,
                scrollProgressRef.current,
              );

        if (ok) {
          setError(null);
          bookmarkConflictRef.current = null;
          setBookmarkConflict(null);
        }
        return ok;
      } finally {
        isResolvingConflictRef.current = false;
      }
    },
    [clearBookmarkDebounceTimer, goToChapter, persistBookmark],
  );

  return {
    novel,
    chapter,
    chapterIndex: currentChapterIndex,
    totalChapters,
    writingMode,
    theme,
    fontSizePx,
    lineHeight,
    fontFamily,
    pageMarginPx,
    initialScrollProgress,
    scrollProgress,
    pagingMode,
    effectivePagingMode,
    enableVolumeKeyPaging,
    currentPage,
    totalPages,
    isLoading,
    error,
    hasPrevChapter,
    hasNextChapter,
    toggleWritingMode,
    changeTheme,
    changeFontSize,
    changeLineHeight,
    changePagingMode,
    goToPage,
    nextPage,
    prevPage,
    setTotalPages,
    updateScrollProgress,
    flushBookmark,
    goToChapter,
    fetchNovelFromUrl,
    bookmarkConflict,
    resolveBookmarkConflict,
  };
}

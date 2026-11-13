import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useContext,
} from "react";
import type {
  NovelRecord,
  ChapterRecord,
  WritingMode,
  ReaderTheme,
  ReaderPagingMode,
  ReaderFontFamily,
} from "../../../storage/types";
import type { BottomTab } from "../../../shared/ui/BottomTabBar";
import type { VolumeKeyBridge } from "../../../bridges/volume-key/types";
import { ServiceContext } from "../../../app/ServiceProvider";
import { ReaderView } from "./ReaderView";
import { ReaderTopOverlay } from "./ReaderTopOverlay";
import { ReaderBottomOverlay } from "./ReaderBottomOverlay";
import { useReaderGestures } from "../hooks/useReaderGestures";
import {
  resolveEffectivePagingMode,
  type BookmarkConflictState,
} from "../hooks/useReader";
import { BookmarkConflictDialog } from "./BookmarkConflictDialog";

export interface ReaderPageProps {
  /** 対象作品レコード（未登録時は null） */
  novel: NovelRecord | null;
  /** 対象エピソードレコード（未取得時は null） */
  chapter: ChapterRecord | null;
  /** 現在表示中のエピソード連番（1始まり） */
  chapterIndex: number;
  /** 作品の全エピソード数 */
  totalChapters: number;
  /** 組み方向（縦書き: vertical-rl, 横書き: horizontal-tb） */
  writingMode: WritingMode;
  /** カラーテーマ（light, sepia, dark, black） */
  theme: ReaderTheme;
  /** 文字サイズ（px） */
  fontSizePx: number;
  /** 行間倍率 */
  lineHeight: number;
  /** フォント種別（省略時: 'biz-ud-mincho'、v0.5 Issue #169） */
  fontFamily?: ReaderFontFamily;
  /** 画面余白 px（省略時: 20、v0.5 Issue #169） */
  pageMarginPx?: number;
  /** 初期復元する進捗率（0.0 〜 1.0） */
  initialScrollProgress: number;
  /** ページ送りモード（auto / paged / scroll、省略時: 'auto'） */
  pagingMode?: ReaderPagingMode;
  /** ハードウェア音量キー送り有効フラグ（省略時: false、v0.6 Issue #203） */
  enableVolumeKeyPaging?: boolean;
  /** 音量キーブリッジ（省略時: ServiceContext より取得、v0.6 Issue #203） */
  volumeKeyBridge?: VolumeKeyBridge;
  /** ページめくり表示時の現在ページ番号（省略時: 1） */
  currentPage?: number;
  /** ページめくり表示時の総ページ数（省略時: 1） */
  totalPages?: number;
  /** エピソード読み込み中フラグ */
  isLoading: boolean;
  /** エラーメッセージ文字列（null時はエラーなし） */
  error?: string | null;
  /** リーダー画面のアクティブタブ（省略時: "bookshelf"） */
  activeTab?: BottomTab;
  /** 「前の話へ」ボタン押下時のコールバック */
  onPrevChapter: () => void;
  /** 「次の話へ」ボタン押下時のコールバック */
  onNextChapter: () => void;
  /** ページ送り確定時のコールバック */
  onPageChange?: (targetPage: number) => void;
  /** DOM寸法計測により総ページ数が変化した際のコールバック */
  onTotalPagesChange?: (totalPages: number) => void;
  /** 本文スクロール／ページ進捗変化時のコールバック */
  onScrollProgressChange: (progress: number) => void;
  /** 下部タブ押下時のコールバック */
  onSelectTab?: (tab: BottomTab) => void;
  /** 上部オーバーレイ「← 目次」ボタン押下時のコールバック（TR-06、v0.6 Issue #202） */
  onBackToToc?: () => void;
  /** エラー画面内「内蔵ブラウザで開いて取り込む」押下時コールバック（TR-10、v0.9 Issue #269） */
  onOpenWebView?: () => void;
  /** 下部オーバーレイの初期展開フラグ（省略時はエラー/空状態時に true） */
  initialOverlayOpen?: boolean;
  /** 初期スライド変位量（px、Storybook/VRT/テスト用） */
  initialSlideOffsetPx?: number;
  /** 初期境界案内ヒントメッセージ（Storybook/VRT/テスト用） */
  initialBoundaryHint?: string | null;
  /** しおり競合確認ダイアログの表示状態（競合なし時は null） */
  bookmarkConflict?: BookmarkConflictState | null;
  /** しおり競合解決処理中フラグ */
  isResolvingBookmarkConflict?: boolean;
  /** しおり競合時に他端末の話へ移動するコールバック */
  onResolveBookmarkConflictMove?: () => void;
  /** しおり競合時に現在話を維持して読むコールバック */
  onResolveBookmarkConflictKeep?: () => void;
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
 * 全画面本文（ReaderView）と上下連動オーバーレイ（上部 ReaderTopOverlay、下部 ReaderBottomOverlay）、
 * 最下部タッチゾーン、Kindle様式のジェスチャー操作、および状態別表示（ローディング・エラー・空状態）を統合する。
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
  fontFamily,
  pageMarginPx,
  initialScrollProgress,
  pagingMode = "auto",
  enableVolumeKeyPaging = false,
  volumeKeyBridge: propsVolumeKeyBridge,
  currentPage = 1,
  totalPages = 1,
  isLoading,
  error,
  activeTab = "bookshelf",
  onPrevChapter,
  onNextChapter,
  onPageChange,
  onTotalPagesChange,
  onScrollProgressChange,
  onSelectTab,
  onBackToToc,
  onOpenWebView,
  initialOverlayOpen,
  initialSlideOffsetPx,
  initialBoundaryHint,
  bookmarkConflict = null,
  isResolvingBookmarkConflict = false,
  onResolveBookmarkConflictMove,
  onResolveBookmarkConflictKeep,
}) => {
  const hasNovel = novel !== null;
  const hasBodyHtml = Boolean(chapter && chapter.bodyHtml !== null);
  const isInitialOpen =
    initialOverlayOpen ??
    Boolean(error || (!isLoading && (!hasNovel || !hasBodyHtml)));

  const serviceContext = useContext(ServiceContext);
  const volumeKeyBridge =
    propsVolumeKeyBridge ?? serviceContext?.volumeKeyBridge;

  const [isOpen, setIsOpen] = useState(isInitialOpen);
  const mainRef = useRef<HTMLElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );

  useEffect(() => {
    if (initialOverlayOpen !== undefined) {
      setIsOpen(initialOverlayOpen);
    }
  }, [initialOverlayOpen]);

  useEffect(() => {
    if (
      initialOverlayOpen === undefined &&
      !isLoading &&
      (error || !hasNovel || !hasBodyHtml)
    ) {
      setIsOpen(true);
    }
  }, [error, isLoading, hasNovel, hasBodyHtml, initialOverlayOpen]);

  // 前話遷移（遷移と同時にオーバーレイ自動非表示）
  const handlePrevChapter = useCallback(() => {
    setIsOpen(false);
    onPrevChapter();
  }, [onPrevChapter]);

  // 次話遷移（遷移と同時にオーバーレイ自動非表示）
  const handleNextChapter = useCallback(() => {
    setIsOpen(false);
    onNextChapter();
  }, [onNextChapter]);

  const handleToggleOverlay = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleCloseOverlay = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleScrollProgressWithOverlayClose = useCallback(
    (progress: number) => {
      setIsOpen(false);
      onScrollProgressChange(progress);
    },
    [onScrollProgressChange],
  );

  // シークバー操作時（オーバーレイを開いたまま維持してページ変更、AC-RD-25, §3.6）
  const handleSeekbarPageChange = useCallback(
    (targetPage: number) => {
      setIsOpen(true);
      onPageChange?.(targetPage);
    },
    [onPageChange],
  );

  const {
    slideOffsetPx,
    isAnimating,
    boundaryHint,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    handleMainClick,
    handleWheel,
    handleScrollProgressChange,
    handleVolumeKey,
  } = useReaderGestures({
    writingMode,
    pagingMode,
    currentPage,
    totalPages,
    chapterIndex,
    totalChapters,
    isOverlayOpen: isOpen,
    onToggleOverlay: handleToggleOverlay,
    onCloseOverlay: handleCloseOverlay,
    onPageChange,
    onPrevChapter: handlePrevChapter,
    onNextChapter: handleNextChapter,
    onScrollProgressChange: handleScrollProgressWithOverlayClose,
    containerRef: mainRef,
    initialSlideOffsetPx,
    initialBoundaryHint,
  });

  const handleVolumeKeyRef = useRef(handleVolumeKey);
  useEffect(() => {
    handleVolumeKeyRef.current = handleVolumeKey;
  }, [handleVolumeKey]);

  const isConflictModalOpenRef = useRef(Boolean(bookmarkConflict));
  useEffect(() => {
    isConflictModalOpenRef.current = Boolean(bookmarkConflict);
  }, [bookmarkConflict]);

  // ハードウェア音量キーイベント購読およびライフサイクル管理（AC-RD-26, AC-RD-27, Issue #203）
  useEffect(() => {
    if (!volumeKeyBridge || !enableVolumeKeyPaging) {
      return;
    }

    const removeListener = volumeKeyBridge.addVolumeKeyListener((event) => {
      if (isConflictModalOpenRef.current) {
        return;
      }
      handleVolumeKeyRef.current(event.direction);
    });
    void volumeKeyBridge.setVolumeKeyPagingEnabled(true).catch(() => {});

    return () => {
      removeListener();
      void volumeKeyBridge.setVolumeKeyPagingEnabled(false).catch(() => {});
    };
  }, [enableVolumeKeyPaging, volumeKeyBridge]);

  // 最下部タッチゾーン: ポインター押下
  const handleTouchZonePointerDown = useCallback((e: React.PointerEvent) => {
    touchStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };
  }, []);

  // 最下部タッチゾーン: ポインター離上（スワイプ誤検知防止: 移動10px未満かつ500ms未満）
  const handleTouchZonePointerUp = useCallback((e: React.PointerEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.clientX - touchStartRef.current.x;
    const dy = e.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    const distance = Math.hypot(dx, dy);
    if (distance < 10 && dt < 500) {
      setIsOpen((prev) => !prev);
    }
  }, []);

  // 最下部タッチゾーン: ポインターキャンセル
  const handleTouchZonePointerCancel = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  // 最下部タッチゾーン: キーボード操作
  const handleTouchZoneKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
  }, []);

  const effectivePagingMode = resolveEffectivePagingMode(
    pagingMode,
    writingMode,
  );
  const touchZonePositionClass =
    effectivePagingMode === "paged"
      ? "left-[20%] right-[20%]"
      : "left-0 right-0";

  return (
    <div
      data-testid="reader-page"
      className={`h-dvh w-full overflow-hidden relative select-none transition-colors duration-200 ${pageBgStyles[theme]}`}
    >
      {/* メイン本文領域（排他描画） */}
      <main
        ref={mainRef}
        className={`w-full h-full min-w-0 ${
          effectivePagingMode === "paged" ? "touch-none" : ""
        }`}
        onClick={handleMainClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onWheel={handleWheel}
      >
        {error ? (
          <div className="flex items-center justify-center h-full p-6">
            <div
              role="alert"
              data-testid="reader-error"
              className="max-w-md w-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-lg text-sm shadow-xs"
            >
              <div className="font-semibold mb-1">エラー</div>
              <div className="mb-3">{error}</div>
              <button
                type="button"
                data-testid="reader-open-webview-button"
                onClick={onOpenWebView}
                className="w-full py-2 px-3 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-center cursor-pointer"
              >
                内蔵ブラウザで開いて取り込む
              </button>
            </div>
          </div>
        ) : isLoading && !hasBodyHtml ? (
          <div
            role="status"
            data-testid="reader-loading"
            className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400"
          >
            <div
              aria-hidden="true"
              className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"
            ></div>
            <p className="text-sm font-medium">エピソードを読み込み中...</p>
          </div>
        ) : !hasNovel || !chapter || chapter.bodyHtml === null ? (
          <div className="flex items-center justify-center h-full p-6">
            <div
              data-testid="reader-empty"
              className="max-w-md w-full border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-12 text-center text-slate-500 dark:text-slate-400"
            >
              <p className="text-base font-medium mb-1">
                作品またはエピソードが見つかりません。
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                作品が登録されていないか、エピソード本文がまだ取得されていません。
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full w-full">
            <ReaderView
              title={novel.title}
              chapterTitle={chapter.title}
              bodyHtml={chapter.bodyHtml}
              writingMode={writingMode}
              theme={theme}
              fontSizePx={fontSizePx}
              lineHeight={lineHeight}
              fontFamily={fontFamily}
              pageMarginPx={pageMarginPx}
              initialScrollProgress={initialScrollProgress}
              onScrollProgressChange={handleScrollProgressChange}
              pagingMode={pagingMode}
              currentPage={currentPage}
              totalPages={totalPages}
              slideOffsetPx={slideOffsetPx}
              isAnimating={isAnimating}
              onTotalPagesChange={onTotalPagesChange}
              chapterIndex={chapterIndex}
              totalChapters={totalChapters}
              onPrevChapter={handlePrevChapter}
              onNextChapter={handleNextChapter}
            />
          </div>
        )}
      </main>

      {/* 上部オーバーレイ（作品名・サブタイトル1行省略・目次導線、AC-RD-22〜24） */}
      <ReaderTopOverlay
        isOpen={isOpen}
        novelTitle={novel?.title ?? ""}
        chapterTitle={chapter?.title ?? ""}
        onBackToToc={onBackToToc ?? (() => {})}
      />

      {/* エピソード境界案内ヒントバッジ */}
      {boundaryHint && (
        <div
          data-testid="reader-episode-boundary-hint"
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-4 py-2 rounded-full bg-slate-900/90 text-white text-sm font-medium shadow-lg pointer-events-none transition-opacity duration-150"
          role="status"
        >
          {boundaryHint}
        </div>
      )}

      {/* 最下部タッチゾーン（下端約 72px） */}
      <div
        data-testid="reader-bottom-touch-zone"
        className={`absolute bottom-0 ${touchZonePositionClass} h-[72px] z-30 pointer-events-auto cursor-pointer`}
        onPointerDown={handleTouchZonePointerDown}
        onPointerUp={handleTouchZonePointerUp}
        onPointerCancel={handleTouchZonePointerCancel}
        onKeyDown={handleTouchZoneKeyDown}
        aria-label="下部ナビゲーション表示"
        aria-expanded={isOpen}
        role="button"
        tabIndex={0}
      />

      {/* 下部オーバーレイ（シークバー＋前後話ナビ＋下部タブ、AC-RD-22, 25） */}
      <ReaderBottomOverlay
        isOpen={isOpen}
        chapterIndex={chapterIndex}
        totalChapters={totalChapters}
        isLoading={isLoading}
        activeTab={activeTab}
        effectivePagingMode={effectivePagingMode}
        currentPage={currentPage}
        totalPages={totalPages}
        onPrevChapter={handlePrevChapter}
        onNextChapter={handleNextChapter}
        onPageChange={handleSeekbarPageChange}
        onSelectTab={onSelectTab}
      />

      {/* クラウド同期しおり競合確認モーダルダイアログ (Issue #342) */}
      <BookmarkConflictDialog
        isOpen={Boolean(bookmarkConflict)}
        currentChapterIndex={
          bookmarkConflict?.currentChapterIndex ?? chapterIndex
        }
        remoteChapterIndex={
          bookmarkConflict?.remoteChapterIndex ?? chapterIndex
        }
        isResolving={isResolvingBookmarkConflict}
        onMoveToRemote={onResolveBookmarkConflictMove}
        onKeepCurrent={onResolveBookmarkConflictKeep}
      />
    </div>
  );
};

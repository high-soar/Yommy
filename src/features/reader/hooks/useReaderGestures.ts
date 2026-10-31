import { useState, useRef, useCallback } from "react";
import type { WritingMode, ReaderPagingMode } from "../../../storage/types";
import { resolveEffectivePagingMode } from "./useReader";

export interface UseReaderGesturesOptions {
  /** 組み方向（縦書き: vertical-rl, 横書き: horizontal-tb） */
  writingMode: WritingMode;
  /** ページ送りモード（auto / paged / scroll、省略時: 'auto'） */
  pagingMode?: ReaderPagingMode;
  /** ページめくり表示時の現在ページ番号（省略時: 1） */
  currentPage?: number;
  /** ページめくり表示時の総ページ数（省略時: 1） */
  totalPages?: number;
  /** 現在のエピソード連番（1始まり） */
  chapterIndex: number;
  /** 作品の全エピソード数 */
  totalChapters: number;
  /** オーバーレイ開閉状態 */
  isOverlayOpen: boolean;
  /** オーバーレイ開閉トグル */
  onToggleOverlay: () => void;
  /** オーバーレイ閉じる */
  onCloseOverlay: () => void;
  /** ページ変更コールバック */
  onPageChange?: (targetPage: number) => void;
  /** 前話遷移コールバック */
  onPrevChapter: () => void;
  /** 次話遷移コールバック */
  onNextChapter: () => void;
  /** スクロール進捗変更コールバック */
  onScrollProgressChange?: (progress: number) => void;
  /** コンテナ要素参照 */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** 初期スライド変位量（Storybook/VRT/テスト用） */
  initialSlideOffsetPx?: number;
  /** 初期境界ヒント（Storybook/VRT/テスト用） */
  initialBoundaryHint?: string | null;
}

export interface UseReaderGesturesResult {
  /** スワイプドラッグ中のリアルタイムスライド変位量 (px) */
  slideOffsetPx: number;
  /** ページ遷移アニメーション中フラグ */
  isAnimating: boolean;
  /** エピソード境界案内ヒントメッセージ（非表示時は null） */
  boundaryHint: string | null;
  /** コンテナ pointerdown ハンドラー */
  handlePointerDown: (e: React.PointerEvent) => void;
  /** コンテナ pointermove ハンドラー */
  handlePointerMove: (e: React.PointerEvent) => void;
  /** コンテナ pointerup ハンドラー */
  handlePointerUp: (e: React.PointerEvent) => void;
  /** コンテナ pointercancel ハンドラー */
  handlePointerCancel: () => void;
  /** コンテナ click ハンドラー（タップ後の誤トグル防止付き） */
  handleMainClick: () => void;
  /** 連続スクロール用 wheel ハンドラー */
  handleWheel: (e: React.WheelEvent) => void;
  /** 連続スクロール用進捗通知ハンドラー（2段階判定トラッキング） */
  handleScrollProgressChange: (progress: number) => void;
}

/**
 * Kindle様式ジェスチャー（リアルタイム指追従・30%規定値・スナップバック・左右端タップ・中央タップ・
 * ラバーバンド・境界案内バッジ・前後話シームレス遷移・連続スクロール2段階遷移）を管理するカスタムフック
 */
export function useReaderGestures({
  writingMode,
  pagingMode = "auto",
  currentPage = 1,
  totalPages = 1,
  chapterIndex,
  totalChapters,
  isOverlayOpen,
  onToggleOverlay,
  onCloseOverlay,
  onPageChange,
  onPrevChapter,
  onNextChapter,
  onScrollProgressChange,
  containerRef,
  initialSlideOffsetPx = 0,
  initialBoundaryHint = null,
}: UseReaderGesturesOptions): UseReaderGesturesResult {
  const isVertical = writingMode === "vertical-rl";
  const effectivePagingMode = resolveEffectivePagingMode(
    pagingMode,
    writingMode,
  );
  const isPaged = effectivePagingMode === "paged";

  const [slideOffsetPx, setSlideOffsetPx] = useState(initialSlideOffsetPx);
  const [isAnimating, setIsAnimating] = useState(false);
  const [boundaryHint, setBoundaryHint] = useState<string | null>(
    initialBoundaryHint,
  );

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  const isDraggingRef = useRef(false);
  const hasHandledTapRef = useRef(false);

  // 連続スクロールモード用の端到達フラグ（2段階操作用）
  const reachedEndRef = useRef(false);
  const reachedStartRef = useRef(false);
  const wasAtEndOnDownRef = useRef(false);
  const wasAtStartOnDownRef = useRef(false);

  const getContainerWidth = useCallback((): number => {
    return containerRef?.current?.clientWidth || window.innerWidth;
  }, [containerRef]);

  // Pointer Down
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      touchStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        time: Date.now(),
      };
      isDraggingRef.current = false;

      if (!isPaged) {
        wasAtEndOnDownRef.current = reachedEndRef.current;
        wasAtStartOnDownRef.current = reachedStartRef.current;
      }
    },
    [isPaged],
  );

  // Pointer Move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!touchStartRef.current) return;

      const dx = e.clientX - touchStartRef.current.x;
      const dy = e.clientY - touchStartRef.current.y;

      if (!isPaged) {
        // 連続スクロールモード時の2段階スワイプ判定
        if (wasAtEndOnDownRef.current) {
          const isNextSwipe = isVertical ? dx < -30 : dy < -30;
          if (isNextSwipe) {
            wasAtEndOnDownRef.current = false;
            reachedEndRef.current = false;
            if (chapterIndex < totalChapters) {
              onNextChapter();
            }
          }
        } else if (wasAtStartOnDownRef.current) {
          const isPrevSwipe = isVertical ? dx > 30 : dy > 30;
          if (isPrevSwipe) {
            wasAtStartOnDownRef.current = false;
            reachedStartRef.current = false;
            if (chapterIndex > 1) {
              onPrevChapter();
            }
          }
        }
        return;
      }

      // ページめくりモード
      const distance = Math.hypot(dx, dy);
      if (distance >= 10) {
        isDraggingRef.current = true;
      }

      if (!isDraggingRef.current) return;

      // 境界判定
      const isNextBoundary =
        currentPage >= totalPages && (isVertical ? dx > 0 : dx < 0);
      const isPrevBoundary = currentPage <= 1 && (isVertical ? dx < 0 : dx > 0);

      // ラバーバンド減衰（0.3倍）
      let effectiveOffset = dx;
      if (isNextBoundary || isPrevBoundary) {
        effectiveOffset = dx * 0.3;
      }
      setSlideOffsetPx(effectiveOffset);

      // 案内バッジ表示判定（30% 以上のドラッグ）
      const width = getContainerWidth();
      const threshold = width * 0.3;

      if (Math.abs(dx) >= threshold) {
        if (isNextBoundary && chapterIndex < totalChapters) {
          setBoundaryHint("指を離して次の話へ");
        } else if (isPrevBoundary && chapterIndex > 1) {
          setBoundaryHint("指を離して前の話へ");
        } else {
          setBoundaryHint(null);
        }
      } else {
        setBoundaryHint(null);
      }
    },
    [
      isPaged,
      isVertical,
      currentPage,
      totalPages,
      chapterIndex,
      totalChapters,
      getContainerWidth,
      onNextChapter,
      onPrevChapter,
    ],
  );

  // Pointer Up
  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!touchStartRef.current) return;

      const dx = e.clientX - touchStartRef.current.x;
      const dy = e.clientY - touchStartRef.current.y;
      const dt = Date.now() - touchStartRef.current.time;
      const distance = Math.hypot(dx, dy);
      const velocity = dt > 0 ? Math.abs(dx) / dt : 0;
      const width = getContainerWidth();

      touchStartRef.current = null;

      if (!isPaged) {
        wasAtEndOnDownRef.current = false;
        wasAtStartOnDownRef.current = false;
        return;
      }

      // 1. タップ判定（10px 未満 かつ 300ms 未満）
      if (distance < 10 && dt < 300) {
        hasHandledTapRef.current = true;
        setTimeout(() => {
          hasHandledTapRef.current = false;
        }, 100);
        setSlideOffsetPx(0);
        setBoundaryHint(null);

        // オーバーレイ表示中はどの位置のタップでも閉じる
        if (isOverlayOpen) {
          onCloseOverlay();
          return;
        }

        // タップ位置に応じた処理
        const containerRect = containerRef?.current?.getBoundingClientRect();
        const relativeX = containerRect
          ? e.clientX - containerRect.left
          : e.clientX;
        const ratio = relativeX / width;

        if (ratio < 0.2) {
          // 左端（幅約20%）: 縦書きなら次、横書きなら前
          if (isVertical) {
            if (currentPage < totalPages) {
              onPageChange?.(currentPage + 1);
            }
          } else {
            if (currentPage > 1) {
              onPageChange?.(currentPage - 1);
            }
          }
          onCloseOverlay();
        } else if (ratio > 0.8) {
          // 右端（幅約20%）: 縦書きなら前、横書きなら次
          if (isVertical) {
            if (currentPage > 1) {
              onPageChange?.(currentPage - 1);
            }
          } else {
            if (currentPage < totalPages) {
              onPageChange?.(currentPage + 1);
            }
          }
          onCloseOverlay();
        } else {
          // 中央（幅約60%）: オーバーレイ開閉トグル
          onToggleOverlay();
        }
        return;
      }

      // 2. ドラッグ離上判定
      const isNextBoundary =
        currentPage >= totalPages && (isVertical ? dx > 0 : dx < 0);
      const isPrevBoundary = currentPage <= 1 && (isVertical ? dx < 0 : dx > 0);

      // エピソード境界
      if (isNextBoundary || isPrevBoundary) {
        if (Math.abs(dx) >= width * 0.3) {
          if (isNextBoundary && chapterIndex < totalChapters) {
            onNextChapter();
            onCloseOverlay();
          } else if (isPrevBoundary && chapterIndex > 1) {
            onPrevChapter();
            onCloseOverlay();
          }
        }
        setSlideOffsetPx(0);
        setBoundaryHint(null);
        return;
      }

      // エピソード内ページめくり（30% 規定値またはフリック速度判定）
      const isThresholdMet = Math.abs(dx) >= width * 0.3 || velocity > 0.5;

      if (isThresholdMet) {
        const isNextPage = isVertical ? dx > 0 : dx < 0;
        if (isNextPage) {
          if (currentPage < totalPages) {
            onPageChange?.(currentPage + 1);
            onCloseOverlay();
            setIsAnimating(true);
            setTimeout(() => setIsAnimating(false), 200);
          }
        } else {
          if (currentPage > 1) {
            onPageChange?.(currentPage - 1);
            onCloseOverlay();
            setIsAnimating(true);
            setTimeout(() => setIsAnimating(false), 200);
          }
        }
      } else {
        // スナップバック
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 200);
      }

      setSlideOffsetPx(0);
      setBoundaryHint(null);
    },
    [
      isPaged,
      isVertical,
      currentPage,
      totalPages,
      chapterIndex,
      totalChapters,
      isOverlayOpen,
      containerRef,
      getContainerWidth,
      onCloseOverlay,
      onToggleOverlay,
      onPageChange,
      onNextChapter,
      onPrevChapter,
    ],
  );

  // Pointer Cancel
  const handlePointerCancel = useCallback(() => {
    touchStartRef.current = null;
    isDraggingRef.current = false;
    setSlideOffsetPx(0);
    setBoundaryHint(null);
    if (!isPaged) {
      wasAtEndOnDownRef.current = false;
      wasAtStartOnDownRef.current = false;
    }
  }, [isPaged]);

  // Wheel（連続スクロールモード時の2段階操作）
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (isPaged) return;

      const isNextWheel = isVertical
        ? e.deltaX < 0 || e.deltaY > 0
        : e.deltaY > 0;
      const isPrevWheel = isVertical
        ? e.deltaX > 0 || e.deltaY < 0
        : e.deltaY < 0;

      if (reachedEndRef.current && isNextWheel) {
        reachedEndRef.current = false;
        if (chapterIndex < totalChapters) {
          onNextChapter();
        }
      } else if (reachedStartRef.current && isPrevWheel) {
        reachedStartRef.current = false;
        if (chapterIndex > 1) {
          onPrevChapter();
        }
      }
    },
    [
      isPaged,
      isVertical,
      chapterIndex,
      totalChapters,
      onNextChapter,
      onPrevChapter,
    ],
  );

  // Scroll Progress（連続スクロールモードの端到達判定トラッキング）
  const handleScrollProgressChange = useCallback(
    (progress: number) => {
      onScrollProgressChange?.(progress);

      if (!isPaged) {
        if (progress >= 0.99) {
          reachedEndRef.current = true;
          reachedStartRef.current = false;
        } else if (progress <= 0.01) {
          reachedStartRef.current = true;
          reachedEndRef.current = false;
        } else {
          reachedEndRef.current = false;
          reachedStartRef.current = false;
        }
      }
    },
    [isPaged, onScrollProgressChange],
  );

  // Main クリックハンドラー（タップによる直後の誤閉会を防止）
  const handleMainClick = useCallback(() => {
    if (hasHandledTapRef.current) return;
    onCloseOverlay();
  }, [onCloseOverlay]);

  return {
    slideOffsetPx,
    isAnimating,
    boundaryHint,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleMainClick,
    handleWheel,
    handleScrollProgressChange,
  };
}

import { useState, useRef, useCallback, useEffect } from "react";
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
  /** コンテナ touchstart ハンドラー */
  handleTouchStart?: (e: React.TouchEvent) => void;
  /** コンテナ touchmove ハンドラー */
  handleTouchMove?: (e: React.TouchEvent) => void;
  /** コンテナ touchend ハンドラー */
  handleTouchEnd?: (e?: React.TouchEvent) => void;
  /** コンテナ touchcancel ハンドラー */
  handleTouchCancel?: (e?: React.TouchEvent) => void;
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

  // ポインターイベント用座標保持（R1-27: TouchEvent と分離し pointercancel による破棄を防止）
  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  // タッチイベント用座標保持（実機 WebView でのネイティブスクロール共存・境界スワイプ用）
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  const isDraggingRef = useRef(false);
  const hasHandledTapRef = useRef(false);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 端ページ2段階タップ用（AC-RD-18）
  const pendingBoundaryTapRef = useRef<"next" | "prev" | null>(null);
  const boundaryTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // 連続スクロール端2段階スワイプ/ホイール用（AC-RD-19）
  const pendingScrollSwipeRef = useRef<"next" | "prev" | null>(null);
  const scrollSwipeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const hasTriggeredInGestureRef = useRef(false);

  const clearBoundaryTap = useCallback(() => {
    if (boundaryTapTimerRef.current) {
      clearTimeout(boundaryTapTimerRef.current);
      boundaryTapTimerRef.current = null;
    }
    pendingBoundaryTapRef.current = null;
    setBoundaryHint(null);
  }, []);

  const clearScrollSwipe = useCallback(() => {
    if (scrollSwipeTimerRef.current) {
      clearTimeout(scrollSwipeTimerRef.current);
      scrollSwipeTimerRef.current = null;
    }
    pendingScrollSwipeRef.current = null;
    setBoundaryHint(null);
  }, []);

  // アンマウント時にタイマーを確実にクリーンアップ (R1-25(7))
  useEffect(() => {
    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
      }
      clearBoundaryTap();
      clearScrollSwipe();
    };
  }, [clearBoundaryTap, clearScrollSwipe]);

  // 連続スクロールモード用の端到達フラグ（2段階操作用）
  const reachedEndRef = useRef(false);
  const reachedStartRef = useRef(false);
  const wasAtEndOnDownRef = useRef(false);
  const wasAtStartOnDownRef = useRef(false);

  const getContainerWidth = useCallback((): number => {
    return containerRef?.current?.clientWidth || window.innerWidth;
  }, [containerRef]);

  // 連続スクロール端2段階アクション発火ヘルパー（AC-RD-19）
  const triggerScrollBoundaryAction = useCallback(
    (direction: "next" | "prev") => {
      if (direction === "next") {
        if (chapterIndex >= totalChapters) return;
        if (pendingScrollSwipeRef.current === "next") {
          clearScrollSwipe();
          wasAtEndOnDownRef.current = false;
          reachedEndRef.current = false;
          onNextChapter();
        } else {
          clearScrollSwipe();
          pendingScrollSwipeRef.current = "next";
          setBoundaryHint("もう一度スワイプで次の話へ");
          scrollSwipeTimerRef.current = setTimeout(() => {
            clearScrollSwipe();
          }, 2500);
        }
      } else {
        if (chapterIndex <= 1) return;
        if (pendingScrollSwipeRef.current === "prev") {
          clearScrollSwipe();
          wasAtStartOnDownRef.current = false;
          reachedStartRef.current = false;
          onPrevChapter();
        } else {
          clearScrollSwipe();
          pendingScrollSwipeRef.current = "prev";
          setBoundaryHint("もう一度スワイプで前の話へ");
          scrollSwipeTimerRef.current = setTimeout(() => {
            clearScrollSwipe();
          }, 2500);
        }
      }
    },
    [
      chapterIndex,
      totalChapters,
      onNextChapter,
      onPrevChapter,
      clearScrollSwipe,
    ],
  );

  // Pointer Down
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      pointerStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        time: Date.now(),
      };
      isDraggingRef.current = false;
      hasTriggeredInGestureRef.current = false;

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
      if (!pointerStartRef.current) return;

      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;

      if (!isPaged) {
        // 連続スクロールモード時の2段階スワイプ判定
        if (hasTriggeredInGestureRef.current) return;
        if (wasAtEndOnDownRef.current) {
          const isNextSwipe = isVertical ? dx < -30 : dy < -30;
          if (isNextSwipe) {
            hasTriggeredInGestureRef.current = true;
            triggerScrollBoundaryAction("next");
          }
        } else if (wasAtStartOnDownRef.current) {
          const isPrevSwipe = isVertical ? dx > 30 : dy > 30;
          if (isPrevSwipe) {
            hasTriggeredInGestureRef.current = true;
            triggerScrollBoundaryAction("prev");
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

      // 境界判定（紙の本に即した右綴じ: 左から右ドラッグ dx > 0 で次話、右から左ドラッグ dx < 0 で前話）
      const isNextBoundary = currentPage >= totalPages && dx > 0;
      const isPrevBoundary = currentPage <= 1 && dx < 0;

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
      triggerScrollBoundaryAction,
    ],
  );

  // Pointer Up
  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerStartRef.current) return;

      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const dt = Date.now() - pointerStartRef.current.time;
      const distance = Math.hypot(dx, dy);
      const velocity = dt > 0 ? Math.abs(dx) / dt : 0;
      const width = getContainerWidth();

      pointerStartRef.current = null;
      hasTriggeredInGestureRef.current = false;

      if (!isPaged) {
        wasAtEndOnDownRef.current = false;
        wasAtStartOnDownRef.current = false;
        return;
      }

      // 1. タップ判定（10px 未満 かつ 300ms 未満）
      if (distance < 10 && dt < 300) {
        hasHandledTapRef.current = true;
        if (tapTimerRef.current) {
          clearTimeout(tapTimerRef.current);
        }
        tapTimerRef.current = setTimeout(() => {
          hasHandledTapRef.current = false;
          tapTimerRef.current = null;
        }, 100);
        setSlideOffsetPx(0);

        // オーバーレイ表示中はどの位置のタップでも閉じる
        if (isOverlayOpen) {
          clearBoundaryTap();
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
          // 左端（幅約20%）: 縦書き時は次ページ（左開き）
          if (currentPage < totalPages) {
            clearBoundaryTap();
            onPageChange?.(currentPage + 1);
            onCloseOverlay();
          } else {
            // 最終ページ到達時の次話遷移判定（2段階タップ: AC-RD-18）
            if (chapterIndex < totalChapters) {
              if (pendingBoundaryTapRef.current === "next") {
                clearBoundaryTap();
                onNextChapter();
                onCloseOverlay();
              } else {
                clearBoundaryTap();
                pendingBoundaryTapRef.current = "next";
                setBoundaryHint("もう一度タップで次の話へ");
                boundaryTapTimerRef.current = setTimeout(() => {
                  clearBoundaryTap();
                }, 2500);
              }
            } else {
              clearBoundaryTap();
            }
          }
        } else if (ratio > 0.8) {
          // 右端（幅約20%）: 縦書き時は前ページ
          if (currentPage > 1) {
            clearBoundaryTap();
            onPageChange?.(currentPage - 1);
            onCloseOverlay();
          } else {
            // 第1ページ到達時の前話遷移判定（2段階タップ: AC-RD-18）
            if (chapterIndex > 1) {
              if (pendingBoundaryTapRef.current === "prev") {
                clearBoundaryTap();
                onPrevChapter();
                onCloseOverlay();
              } else {
                clearBoundaryTap();
                pendingBoundaryTapRef.current = "prev";
                setBoundaryHint("もう一度タップで前の話へ");
                boundaryTapTimerRef.current = setTimeout(() => {
                  clearBoundaryTap();
                }, 2500);
              }
            } else {
              clearBoundaryTap();
            }
          }
        } else {
          // 中央（幅約60%）: オーバーレイ開閉トグル
          clearBoundaryTap();
          onToggleOverlay();
        }
        return;
      }

      // 2. ドラッグ離上判定（右綴じ書籍: dx > 0 で次話・次ページ、dx < 0 で前話・前ページ）
      const isNextBoundary = currentPage >= totalPages && dx > 0;
      const isPrevBoundary = currentPage <= 1 && dx < 0;

      const triggerAnimationEnd = () => {
        setIsAnimating(true);
        if (animationTimerRef.current) {
          clearTimeout(animationTimerRef.current);
        }
        animationTimerRef.current = setTimeout(() => {
          setIsAnimating(false);
          animationTimerRef.current = null;
        }, 200);
      };

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
        const isNextPage = dx > 0; // 紙の本と同じように左から右スワイプで次ページへ（右綴じ）
        if (isNextPage) {
          if (currentPage < totalPages) {
            onPageChange?.(currentPage + 1);
            onCloseOverlay();
            triggerAnimationEnd();
          }
        } else {
          if (currentPage > 1) {
            onPageChange?.(currentPage - 1);
            onCloseOverlay();
            triggerAnimationEnd();
          }
        }
      } else {
        // スナップバック
        triggerAnimationEnd();
      }

      setSlideOffsetPx(0);
      setBoundaryHint(null);
    },
    [
      isPaged,
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
      clearBoundaryTap,
    ],
  );

  // Pointer Cancel（R1-27: pointerStartRef のみをリセットし、touchStartRef の境界スワイプ追跡を維持）
  const handlePointerCancel = useCallback(() => {
    pointerStartRef.current = null;
    isDraggingRef.current = false;
    hasTriggeredInGestureRef.current = false;
    if (isPaged) {
      setSlideOffsetPx(0);
      setBoundaryHint(null);
    }
  }, [isPaged]);

  // Touch Event ハンドラー（実機 WebView での pointercancel 発火防止・ネイティブスクロール共存: AC-RD-18, AC-RD-19）
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 0) return;
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
      hasTriggeredInGestureRef.current = false;
      if (!isPaged) {
        wasAtEndOnDownRef.current = reachedEndRef.current;
        wasAtStartOnDownRef.current = reachedStartRef.current;
      }
    },
    [isPaged],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isPaged || !touchStartRef.current || e.touches.length === 0) return;
      if (hasTriggeredInGestureRef.current) return;

      const touch = e.touches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;

      if (wasAtEndOnDownRef.current) {
        const isNextSwipe = isVertical ? dx < -30 : dy < -30;
        if (isNextSwipe) {
          hasTriggeredInGestureRef.current = true;
          triggerScrollBoundaryAction("next");
        }
      } else if (wasAtStartOnDownRef.current) {
        const isPrevSwipe = isVertical ? dx > 30 : dy > 30;
        if (isPrevSwipe) {
          hasTriggeredInGestureRef.current = true;
          triggerScrollBoundaryAction("prev");
        }
      }
    },
    [isPaged, isVertical, triggerScrollBoundaryAction],
  );

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
    hasTriggeredInGestureRef.current = false;
  }, []);

  const handleTouchCancel = useCallback(() => {
    touchStartRef.current = null;
    hasTriggeredInGestureRef.current = false;
  }, []);

  // Wheel（連続スクロールモード時の2段階操作: AC-RD-19）
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
        triggerScrollBoundaryAction("next");
      } else if (reachedStartRef.current && isPrevWheel) {
        triggerScrollBoundaryAction("prev");
      }
    },
    [isPaged, isVertical, triggerScrollBoundaryAction],
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
          if (pendingScrollSwipeRef.current !== null) {
            if (scrollSwipeTimerRef.current) {
              clearTimeout(scrollSwipeTimerRef.current);
              scrollSwipeTimerRef.current = null;
            }
            pendingScrollSwipeRef.current = null;
            setBoundaryHint(null);
          }
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
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    handleMainClick,
    handleWheel,
    handleScrollProgressChange,
  };
}

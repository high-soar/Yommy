import { useState, useRef, useCallback, useEffect } from "react";
import type { WritingMode, ReaderPagingMode } from "../../../storage/types";
import type { VolumeKeyDirection } from "../../../bridges/volume-key/types";
import { resolveEffectivePagingMode } from "./useReader";

// 音量キーによる連続スクロール時の移動割合（ビューポート寸法の約85%）
const VOLUME_KEY_SCROLL_RATIO = 0.85;
// 音量キーによる境界2段階操作のリセット待機時間（ミリ秒）
const VOLUME_KEY_BOUNDARY_TIMEOUT_MS = 2500;

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
  /** ハードウェア音量キー操作ハンドラー（AC-RD-26, AC-RD-27, Issue #203） */
  handleVolumeKey: (direction: VolumeKeyDirection) => void;
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

  // 水平スライドアニメーション・連打即時確定用（AC-RD-17, Issue #201）
  const pendingTargetPageRef = useRef<number | null>(null);
  const lastTargetPageRef = useRef<number | null>(null);

  // props の currentPage が更新されたら直前の連打確定キャッシュをクリア
  useEffect(() => {
    lastTargetPageRef.current = null;
  }, [currentPage]);

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

  // ハードウェア音量キー2段階操作用（AC-RD-27, Issue #203）
  const pendingVolumeKeyBoundaryRef = useRef<"next" | "prev" | null>(null);
  const volumeKeyBoundaryTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

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

  const clearVolumeKeyBoundary = useCallback(() => {
    if (volumeKeyBoundaryTimerRef.current) {
      clearTimeout(volumeKeyBoundaryTimerRef.current);
      volumeKeyBoundaryTimerRef.current = null;
    }
    pendingVolumeKeyBoundaryRef.current = null;
    setBoundaryHint(null);
  }, []);

  // 保留中スライドアニメーションの即時確定処理（高速連打・連続操作時: AC-RD-17c）
  const flushPendingAnimation = useCallback(() => {
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
    if (pendingTargetPageRef.current !== null) {
      const committedPage = pendingTargetPageRef.current;
      pendingTargetPageRef.current = null;
      lastTargetPageRef.current = committedPage;
      onPageChange?.(committedPage);
    }
    setIsAnimating(false);
    setSlideOffsetPx(0);
  }, [onPageChange]);

  // 目標ページへのスライドアニメーション開始ヘルパー（AC-RD-17a, 17b）
  const startSlideAnimation = useCallback(
    (targetPage: number, targetOffset: number) => {
      pendingTargetPageRef.current = targetPage;
      setIsAnimating(true);
      setSlideOffsetPx(targetOffset);
      onCloseOverlay();

      animationTimerRef.current = setTimeout(() => {
        pendingTargetPageRef.current = null;
        lastTargetPageRef.current = null;
        setIsAnimating(false);
        setSlideOffsetPx(0);
        animationTimerRef.current = null;
        onPageChange?.(targetPage);
      }, 200);
    },
    [onCloseOverlay, onPageChange],
  );

  // スナップバックアニメーション開始ヘルパー
  const startSnapbackAnimation = useCallback(() => {
    pendingTargetPageRef.current = null;
    setIsAnimating(true);
    setSlideOffsetPx(0);

    animationTimerRef.current = setTimeout(() => {
      setIsAnimating(false);
      animationTimerRef.current = null;
    }, 200);
  }, []);

  // アンマウント時にタイマーを確実にクリーンアップ (R1-25(7))
  useEffect(() => {
    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
      pendingTargetPageRef.current = null;
      lastTargetPageRef.current = null;
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      clearBoundaryTap();
      clearScrollSwipe();
      clearVolumeKeyBoundary();
    };
  }, [clearBoundaryTap, clearScrollSwipe, clearVolumeKeyBoundary]);

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
      // 進行中のスライドアニメーションがあれば即時確定（高速連打・連続操作対応: AC-RD-17c）
      if (isPaged && (isAnimating || pendingTargetPageRef.current !== null)) {
        flushPendingAnimation();
      }

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
    [isPaged, isAnimating, flushPendingAnimation],
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
      const basePage =
        pendingTargetPageRef.current ??
        lastTargetPageRef.current ??
        currentPage;
      const isNextBoundary = basePage >= totalPages && dx > 0;
      const isPrevBoundary = basePage <= 1 && dx < 0;

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

        const basePage =
          pendingTargetPageRef.current ??
          lastTargetPageRef.current ??
          currentPage;

        if (ratio < 0.2) {
          // 左端（幅約20%）: 縦書き時は次ページ（左開き）
          if (basePage < totalPages) {
            clearBoundaryTap();
            startSlideAnimation(basePage + 1, width);
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
          if (basePage > 1) {
            clearBoundaryTap();
            startSlideAnimation(basePage - 1, -width);
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
      const basePage =
        pendingTargetPageRef.current ??
        lastTargetPageRef.current ??
        currentPage;

      const isNextBoundary = basePage >= totalPages && dx > 0;
      const isPrevBoundary = basePage <= 1 && dx < 0;

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
          if (basePage < totalPages) {
            startSlideAnimation(basePage + 1, width);
          }
        } else {
          if (basePage > 1) {
            startSlideAnimation(basePage - 1, -width);
          }
        }
      } else {
        // スナップバック
        startSnapbackAnimation();
      }

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
      clearBoundaryTap,
      startSlideAnimation,
      startSnapbackAnimation,
      onNextChapter,
      onPrevChapter,
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
          if (pendingVolumeKeyBoundaryRef.current !== null) {
            clearVolumeKeyBoundary();
          }
        }
      }
    },
    [isPaged, onScrollProgressChange, clearVolumeKeyBoundary],
  );

  // Main クリックハンドラー（タップによる直後の誤閉会を防止）
  const handleMainClick = useCallback(() => {
    if (hasHandledTapRef.current) return;
    onCloseOverlay();
  }, [onCloseOverlay]);

  const getScrollElement = useCallback((): HTMLElement | null => {
    if (!containerRef?.current) return null;
    const viewEl = containerRef.current.querySelector<HTMLElement>(
      '[data-testid="reader-view"]',
    );
    return viewEl ?? containerRef.current;
  }, [containerRef]);

  // 音量キーによる境界2段階操作ハンドラー
  const triggerVolumeKeyBoundary = useCallback(
    (direction: "next" | "prev", onTrigger: () => void, hintText: string) => {
      if (pendingVolumeKeyBoundaryRef.current === direction) {
        clearVolumeKeyBoundary();
        onTrigger();
      } else {
        clearVolumeKeyBoundary();
        pendingVolumeKeyBoundaryRef.current = direction;
        setBoundaryHint(hintText);
        volumeKeyBoundaryTimerRef.current = setTimeout(() => {
          clearVolumeKeyBoundary();
        }, VOLUME_KEY_BOUNDARY_TIMEOUT_MS);
      }
    },
    [clearVolumeKeyBoundary],
  );

  // 連続スクロールモードでの音量キースクロール実行ハンドラー
  const scrollContinuously = useCallback(
    (direction: VolumeKeyDirection, el: HTMLElement | null) => {
      clearVolumeKeyBoundary();
      if (!el) return;

      const isForward = direction === "down";
      if (isVertical) {
        const delta = Math.round(
          (el.clientWidth || getContainerWidth()) * VOLUME_KEY_SCROLL_RATIO,
        );
        const scrollDelta = isForward ? -delta : delta;
        if (typeof el.scrollBy === "function") {
          el.scrollBy({ left: scrollDelta, behavior: "smooth" });
        } else {
          el.scrollLeft += scrollDelta;
        }
      } else {
        const delta = Math.round(
          (el.clientHeight || window.innerHeight) * VOLUME_KEY_SCROLL_RATIO,
        );
        const scrollDelta = isForward ? delta : -delta;
        if (typeof el.scrollBy === "function") {
          el.scrollBy({ top: scrollDelta, behavior: "smooth" });
        } else {
          el.scrollTop += scrollDelta;
        }
      }
    },
    [clearVolumeKeyBoundary, getContainerWidth, isVertical],
  );

  // ハードウェア音量キー操作ハンドラー（AC-RD-26, AC-RD-27, Issue #203）
  const handleVolumeKey = useCallback(
    (direction: VolumeKeyDirection) => {
      if (isPaged) {
        // 縦書きページめくりモード
        if (isAnimating || pendingTargetPageRef.current !== null) {
          flushPendingAnimation();
        }

        const basePage =
          pendingTargetPageRef.current ??
          lastTargetPageRef.current ??
          currentPage;
        const width = getContainerWidth();

        if (direction === "down") {
          // 音量［ー］: 次ページ進行（水平スライドアニメーション）
          if (basePage < totalPages) {
            clearVolumeKeyBoundary();
            clearBoundaryTap();
            // startSlideAnimation 内で onCloseOverlay() が実行される
            startSlideAnimation(basePage + 1, width);
          } else {
            onCloseOverlay();
            // 最終ページ到達時: 2段階操作で次話遷移
            if (chapterIndex < totalChapters) {
              triggerVolumeKeyBoundary(
                "next",
                onNextChapter,
                "もう一度操作で次の話へ",
              );
            } else {
              clearVolumeKeyBoundary();
            }
          }
        } else {
          // 音量［＋］: 前ページ進行（水平スライドアニメーション）
          if (basePage > 1) {
            clearVolumeKeyBoundary();
            clearBoundaryTap();
            // startSlideAnimation 内で onCloseOverlay() が実行される
            startSlideAnimation(basePage - 1, -width);
          } else {
            onCloseOverlay();
            // 第1ページ到達時: 2段階操作で前話遷移
            if (chapterIndex > 1) {
              triggerVolumeKeyBoundary(
                "prev",
                onPrevChapter,
                "もう一度操作で前の話へ",
              );
            } else {
              clearVolumeKeyBoundary();
            }
          }
        }
      } else {
        // 連続スクロールモード
        onCloseOverlay();
        const el = getScrollElement();

        if (direction === "down") {
          // 音量［ー］: 約85% 順方向スクロール
          if (reachedEndRef.current) {
            // スクロール末尾到達時: 2段階操作で次話遷移
            if (chapterIndex < totalChapters) {
              triggerVolumeKeyBoundary(
                "next",
                onNextChapter,
                "もう一度操作で次の話へ",
              );
            } else {
              clearVolumeKeyBoundary();
            }
          } else {
            scrollContinuously(direction, el);
          }
        } else {
          // 音量［＋］: 約85% 逆方向スクロール
          if (reachedStartRef.current) {
            // スクロール先頭到達時: 2段階操作で前話遷移
            if (chapterIndex > 1) {
              triggerVolumeKeyBoundary(
                "prev",
                onPrevChapter,
                "もう一度操作で前の話へ",
              );
            } else {
              clearVolumeKeyBoundary();
            }
          } else {
            scrollContinuously(direction, el);
          }
        }
      }
    },
    [
      isPaged,
      isAnimating,
      flushPendingAnimation,
      currentPage,
      totalPages,
      getContainerWidth,
      clearVolumeKeyBoundary,
      clearBoundaryTap,
      startSlideAnimation,
      onCloseOverlay,
      chapterIndex,
      totalChapters,
      triggerVolumeKeyBoundary,
      onNextChapter,
      onPrevChapter,
      getScrollElement,
      scrollContinuously,
    ],
  );

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
    handleVolumeKey,
  };
}

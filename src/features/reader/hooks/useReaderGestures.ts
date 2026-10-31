import { useState, useCallback } from "react";
import type { WritingMode, ReaderPagingMode } from "../../../storage/types";

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
  /** 連続スクロール用 wheel ハンドラー */
  handleWheel: (e: React.WheelEvent) => void;
  /** 連続スクロール用進捗通知ハンドラー（2段階判定トラッキング） */
  handleScrollProgressChange: (progress: number) => void;
}

/**
 * Kindle様式ジェスチャー（リアルタイム指追従・30%規定値・スナップバック・左右端タップ・中央タップ・
 * ラバーバンド・境界案内バッジ・前後話シームレス遷移・連続スクロール2段階遷移）を管理するカスタムフック（Stub）
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
  void writingMode;
  void pagingMode;
  void currentPage;
  void totalPages;
  void chapterIndex;
  void totalChapters;
  void isOverlayOpen;
  void onToggleOverlay;
  void onCloseOverlay;
  void onPageChange;
  void onPrevChapter;
  void onNextChapter;
  void onScrollProgressChange;
  void containerRef;

  const [slideOffsetPx] = useState(initialSlideOffsetPx);
  const [isAnimating] = useState(false);
  const [boundaryHint] = useState<string | null>(initialBoundaryHint);

  const handlePointerDown = useCallback((_e: React.PointerEvent) => {}, []);
  const handlePointerMove = useCallback((_e: React.PointerEvent) => {}, []);
  const handlePointerUp = useCallback((_e: React.PointerEvent) => {}, []);
  const handlePointerCancel = useCallback(() => {}, []);
  const handleWheel = useCallback((_e: React.WheelEvent) => {}, []);
  const handleScrollProgressChange = useCallback((_progress: number) => {}, []);

  return {
    slideOffsetPx,
    isAnimating,
    boundaryHint,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleWheel,
    handleScrollProgressChange,
  };
}

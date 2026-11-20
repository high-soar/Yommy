/**
 * しおり末尾到達判定および連続スクロール端丸めに関する共通定数・判定ヘルパー
 * (docs/specs/architecture.md §3.4, docs/specs/changes/archive/issue-375-bookmark-advance-on-update.md §2.1)
 */

/** しおりがエピソード末尾（読み終わり）に到達していると判定する進捗率の下限閾値（既存 DB レコード互換） */
export const BOOKMARK_END_PROGRESS_THRESHOLD = 0.99;

/** 連続スクロールモードで最下部到達を 1.0 に丸めるサブピクセル誤差許容幅（px） */
export const SCROLL_END_SNAP_TOLERANCE_PX = 5;

/** しおり進捗率がエピソード末尾到達状態かを判定する */
export function isBookmarkAtEnd(progress: number): boolean {
  return (
    Number.isFinite(progress) && progress >= BOOKMARK_END_PROGRESS_THRESHOLD
  );
}

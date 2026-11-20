/**
 * しおり末尾到達判定および連続スクロール端丸めに関する共通定数・判定ヘルパー
 * (docs/specs/architecture.md §3.4, docs/specs/changes/issue-375-bookmark-advance-on-update.md §2.1)
 */

export const BOOKMARK_END_PROGRESS_THRESHOLD = 0;

export const SCROLL_END_SNAP_TOLERANCE_PX = 0;

export function isBookmarkAtEnd(_progress: number): boolean {
  return false;
}

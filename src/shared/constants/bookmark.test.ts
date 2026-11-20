import { describe, it, expect } from "vitest";
import {
  BOOKMARK_END_PROGRESS_THRESHOLD,
  SCROLL_END_SNAP_TOLERANCE_PX,
  isBookmarkAtEnd,
} from "./bookmark";

describe("shared/constants/bookmark (architecture.md §3.4 / Issue #375)", () => {
  it("しおり末尾判定および連続スクロール端丸めの共通定数が設計値通り定義されていること", () => {
    expect(BOOKMARK_END_PROGRESS_THRESHOLD).toBe(0.99);
    expect(SCROLL_END_SNAP_TOLERANCE_PX).toBe(5);
  });

  it("進捗率が 0.99 未満または非有限数の場合は isBookmarkAtEnd が false を返すこと", () => {
    expect(isBookmarkAtEnd(0)).toBe(false);
    expect(isBookmarkAtEnd(0.5)).toBe(false);
    expect(isBookmarkAtEnd(0.989)).toBe(false);
    expect(isBookmarkAtEnd(-0.5)).toBe(false);
    expect(isBookmarkAtEnd(NaN)).toBe(false);
    expect(isBookmarkAtEnd(Infinity)).toBe(false);
    expect(isBookmarkAtEnd(-Infinity)).toBe(false);
  });

  it("進捗率が 0.99 以上 1.0 以下の有限数の場合は isBookmarkAtEnd が true を返すこと", () => {
    expect(isBookmarkAtEnd(0.99)).toBe(true);
    expect(isBookmarkAtEnd(0.995)).toBe(true);
    expect(isBookmarkAtEnd(1.0)).toBe(true);
  });
});

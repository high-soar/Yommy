import { describe, it, expect, vi } from "vitest";
import { isChapterFresh, delay, toErrorMessage } from "./cache";
import { CACHE_TTL_MS } from "../constants/cache";

describe("cache utils", () => {
  describe("isChapterFresh", () => {
    it("chapter が null / undefined の場合 false を返すこと", () => {
      expect(isChapterFresh(null)).toBe(false);
      expect(isChapterFresh(undefined)).toBe(false);
    });

    it("downloadedAt が null の場合 false を返すこと", () => {
      expect(isChapterFresh({ downloadedAt: null })).toBe(false);
    });

    it("bodyHtml が null の場合 false を返すこと", () => {
      expect(
        isChapterFresh({
          downloadedAt: new Date().toISOString(),
          bodyHtml: null,
        }),
      ).toBe(false);
    });

    it("downloadedAt が不正な日付文字列の場合 false を返すこと", () => {
      expect(isChapterFresh({ downloadedAt: "invalid-date" })).toBe(false);
    });

    it("downloadedAt から 7日以内の場合 true を返すこと", () => {
      const now = Date.now();
      const freshDate = new Date(now - CACHE_TTL_MS + 1000).toISOString();
      expect(isChapterFresh({ downloadedAt: freshDate }, now)).toBe(true);
      expect(
        isChapterFresh(
          { downloadedAt: freshDate, bodyHtml: "<p>本文</p>" },
          now,
        ),
      ).toBe(true);
    });

    it("downloadedAt から 7日以上経過している場合 false を返すこと", () => {
      const now = Date.now();
      const staleDate = new Date(now - CACHE_TTL_MS - 1000).toISOString();
      expect(isChapterFresh({ downloadedAt: staleDate }, now)).toBe(false);
    });
  });

  describe("delay", () => {
    it("指定時間経過後に正常解決すること", async () => {
      vi.useFakeTimers();
      const promise = delay(100);
      vi.advanceTimersByTime(100);
      await expect(promise).resolves.toBeUndefined();
      vi.useRealTimers();
    });

    it("signal ありでタイマー満了時にイベントリスナーが解除され resolve すること", async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const promise = delay(100, controller.signal);
      vi.advanceTimersByTime(100);
      await expect(promise).resolves.toBeUndefined();
      vi.useRealTimers();
    });

    it("既に aborted な signal が渡された場合、即座に reject されること", async () => {
      const controller = new AbortController();
      controller.abort(new Error("Pre-aborted"));
      await expect(delay(100, controller.signal)).rejects.toThrow(
        "Pre-aborted",
      );

      const defaultController = new AbortController();
      defaultController.abort();
      await expect(delay(100, defaultController.signal)).rejects.toThrow(
        /abort/i,
      );
    });

    it("待機中に abort された場合、タイマーが解除され reject されること", async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const promise = delay(1000, controller.signal);

      controller.abort(new Error("Cancelled"));
      await expect(promise).rejects.toThrow("Cancelled");
      vi.useRealTimers();
    });

    it("待機中に reason なしで abort された場合、デフォルトのエラーで reject されること", async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const promise = delay(1000, controller.signal);

      controller.abort();
      await expect(promise).rejects.toThrow(/abort/i);
      vi.useRealTimers();
    });
  });

  describe("toErrorMessage", () => {
    it("Error インスタンスで非空 message の場合その message を返すこと", () => {
      expect(toErrorMessage(new Error("カスタムエラー"))).toBe(
        "カスタムエラー",
      );
    });

    it("文字列の場合その文字列を返すこと", () => {
      expect(toErrorMessage("文字列エラー")).toBe("文字列エラー");
    });

    it("Error インスタンスで空 message の場合 defaultMessage を返すこと", () => {
      expect(toErrorMessage(new Error(""), "フォールバック")).toBe(
        "フォールバック",
      );
    });

    it("その他の型の場合 defaultMessage を返すこと", () => {
      expect(toErrorMessage(12345, "デフォルト")).toBe("デフォルト");
      expect(toErrorMessage(null)).toBe("エラーが発生しました");
    });
  });
});

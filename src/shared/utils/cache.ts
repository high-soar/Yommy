import { CACHE_TTL_MS } from "../constants/cache";

/**
 * キャッシュが7日以内（CACHE_TTL_MS）の新鮮な状態かを判定する（AC-RD-13, AC-ND-13）。
 *
 * @param chapter 対象エピソードのレコードまたはサマリー（null/undefined 可）
 * @param now 判定基準となるエポックミリ秒（デフォルト: Date.now()）
 * @returns 本文情報（downloadedAt）が存在し、かつ downloadedAt から 7日以内の場合 true、それ以外は false
 */
export function isChapterFresh<
  T extends { downloadedAt: string | null; bodyHtml?: string | null },
>(chapter: T | null | undefined, now: number = Date.now()): boolean {
  if (!chapter || !chapter.downloadedAt) {
    return false;
  }
  if ("bodyHtml" in chapter && chapter.bodyHtml === null) {
    return false;
  }
  const downloadedTime = new Date(chapter.downloadedAt).getTime();
  if (Number.isNaN(downloadedTime)) {
    return false;
  }
  return now - downloadedTime < CACHE_TTL_MS;
}

/**
 * 指定ミリ秒待機するヘルパー関数（AbortSignal による即時中断対応）。
 *
 * @param ms 待機するミリ秒数
 * @param signal 中断通知を受け取る AbortSignal（省略可）
 * @returns 待機完了時に resolve する Promise。中断時は signal.reason で reject される。
 */
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * 例外オブジェクトからユーザー向けエラーメッセージを安全に抽出する。
 */
export function toErrorMessage(
  err: unknown,
  defaultMessage = "エラーが発生しました",
): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return typeof err === "string" ? err : defaultMessage;
}

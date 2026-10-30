/**
 * キャッシュ鮮度・先読み・タイムアウトに関する共通定数定義
 * (docs/specs/architecture.md §3.6)
 */

/**
 * キャッシュの有効期限 (TTL: 7日間 = 604,800,000 ms)
 */
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 既存キャッシュ存在時の短縮タイムアウト (3秒 = 3,000 ms)
 */
export const SHORT_TIMEOUT_MS = 3000;

/**
 * 未キャッシュ話等の標準タイムアウト (10秒 = 10,000 ms)
 */
export const STANDARD_TIMEOUT_MS = 10000;

/**
 * 先読み・一括キャッシュのレートリミットウェイト間隔 (1.5秒 = 1,500 ms)
 */
export const PREFETCH_INTERVAL_MS = 1500;

/**
 * 読書中の自動先読み話数 (5話)
 */
export const PREFETCH_COUNT = 5;

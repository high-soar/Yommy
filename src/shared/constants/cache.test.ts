import { describe, it, expect } from "vitest";
import {
  CACHE_TTL_MS,
  SHORT_TIMEOUT_MS,
  STANDARD_TIMEOUT_MS,
  PREFETCH_INTERVAL_MS,
  PREFETCH_COUNT,
} from "./cache";

describe("shared/constants/cache (architecture.md §3.6)", () => {
  it("キャッシュ・先読み・タイムアウトの共通定数が設計値通り定義されていること", () => {
    // 7日間 = 7 * 24 * 60 * 60 * 1000 = 604,800,000 ms
    expect(CACHE_TTL_MS).toBe(604800000);
    // 既存キャッシュ存在時の短縮タイムアウト = 3,000 ms
    expect(SHORT_TIMEOUT_MS).toBe(3000);
    // 未キャッシュ話等の標準タイムアウト = 10,000 ms
    expect(STANDARD_TIMEOUT_MS).toBe(10000);
    // 先読み・一括キャッシュのレートリミットウェイト間隔 = 1,500 ms
    expect(PREFETCH_INTERVAL_MS).toBe(1500);
    // 読書中の自動先読み話数 = 5話
    expect(PREFETCH_COUNT).toBe(5);
  });

  it("短縮タイムアウトが標準タイムアウトより小さく、先読み間隔が正の数であること", () => {
    expect(SHORT_TIMEOUT_MS).toBeLessThan(STANDARD_TIMEOUT_MS);
    expect(PREFETCH_INTERVAL_MS).toBeGreaterThan(0);
    expect(PREFETCH_COUNT).toBeGreaterThan(0);
  });
});

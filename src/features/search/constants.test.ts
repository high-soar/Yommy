import { describe, expect, it } from "vitest";
import {
  SEARCH_GENRES,
  SEARCH_ORDERS,
  SEARCH_SERIAL_STATUSES,
  SEARCH_SITES,
} from "./constants";

describe("search constants", () => {
  it("SEARCH_SITES がカクヨムおよびなろうを定義していること", () => {
    expect(SEARCH_SITES).toHaveLength(2);
    expect(SEARCH_SITES[0]).toEqual({
      siteType: "kakuyomu",
      label: "カクヨム",
      isAvailable: true,
    });
    expect(SEARCH_SITES[1]).toEqual({
      siteType: "narou",
      label: "小説家になろう",
      isAvailable: true,
    });
  });

  it("SEARCH_ORDERS が4種の並び順を定義していること", () => {
    expect(SEARCH_ORDERS).toHaveLength(4);
    expect(SEARCH_ORDERS.map((o) => o.value)).toEqual([
      "weekly_ranking",
      "popular",
      "last_episode_published_at",
      "published_at",
    ]);
  });

  it("SEARCH_SERIAL_STATUSES が4種の連載状況を定義していること", () => {
    expect(SEARCH_SERIAL_STATUSES).toHaveLength(4);
    expect(SEARCH_SERIAL_STATUSES.map((s) => s.value)).toEqual([
      "all",
      "running",
      "completed",
      "short",
    ]);
  });

  it("SEARCH_GENRES がすべておよび12ジャンルを定義していること", () => {
    expect(SEARCH_GENRES).toHaveLength(13);
    expect(SEARCH_GENRES[0]).toEqual({ id: undefined, label: "すべて" });
    expect(SEARCH_GENRES.slice(1).every((g) => typeof g.id === "string")).toBe(
      true,
    );
  });
});

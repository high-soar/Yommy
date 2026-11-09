import { describe, expect, it } from "vitest";
import {
  RANKING_GENRES,
  RANKING_PERIODS,
  RANKING_SITES,
  RANKING_WORK_VARIATIONS,
} from "./constants";

describe("ranking constants", () => {
  it("RANKING_SITES がカクヨムおよびなろうを定義していること", () => {
    expect(RANKING_SITES).toHaveLength(2);
    expect(RANKING_SITES[0]).toEqual({
      siteType: "kakuyomu",
      label: "カクヨム",
      isAvailable: true,
    });
    expect(RANKING_SITES[1]).toEqual({
      siteType: "narou",
      label: "小説家になろう",
      isAvailable: true,
    });
  });

  it("RANKING_PERIODS が4種の集計期間を定義していること", () => {
    expect(RANKING_PERIODS).toHaveLength(4);
    expect(RANKING_PERIODS.map((p) => p.value)).toEqual([
      "daily",
      "weekly",
      "monthly",
      "entire",
    ]);
  });

  it("RANKING_WORK_VARIATIONS が3種の作品種別を定義していること", () => {
    expect(RANKING_WORK_VARIATIONS).toHaveLength(3);
    expect(RANKING_WORK_VARIATIONS.map((w) => w.value)).toEqual([
      "all",
      "long",
      "short",
    ]);
  });

  it("RANKING_GENRES が総合および12ジャンルを定義していること", () => {
    expect(RANKING_GENRES).toHaveLength(13);
    expect(RANKING_GENRES[0]).toEqual({ id: undefined, label: "総合" });
    expect(RANKING_GENRES.slice(1).every((g) => typeof g.id === "string")).toBe(
      true,
    );
  });
});

import { describe, it, expect } from "vitest";
import {
  NAROU_GENRES,
  NAROU_GENRE_MAP,
  NAROU_GENRE_LABELS,
  getNarouGenreLabel,
  NAROU_SEARCH_GENRES,
  NAROU_RANKING_GENRES,
} from "./genres";

describe("genres (なろう公式小ジャンル定義)", () => {
  it("公式小ジャンル21種が正しく定義されていること", () => {
    expect(NAROU_GENRES).toHaveLength(21);

    const ids = NAROU_GENRES.map((g) => g.id);
    expect(new Set(ids).size).toBe(21);

    // 主なジャンルが含まれること
    expect(ids).toContain("201"); // ハイファンタジー
    expect(ids).toContain("202"); // ローファンタジー
    expect(ids).toContain("101"); // 異世界〔恋愛〕
    expect(ids).toContain("102"); // 現実世界〔恋愛〕
    expect(ids).toContain("9801"); // ノンジャンル
  });

  it("NAROU_GENRE_MAP が全21種の id をキーとして保持していること", () => {
    expect(Object.keys(NAROU_GENRE_MAP)).toHaveLength(21);
    expect(NAROU_GENRE_MAP["201"]).toEqual({
      id: "201",
      label: "ハイファンタジー",
      category: "ファンタジー",
    });
    expect(NAROU_GENRE_MAP["9801"]).toEqual({
      id: "9801",
      label: "ノンジャンル",
      category: "ノンジャンル",
    });
  });

  it("NAROU_GENRE_LABELS が全21種の id とラベルの対応を保持していること", () => {
    expect(Object.keys(NAROU_GENRE_LABELS)).toHaveLength(21);
    expect(NAROU_GENRE_LABELS["201"]).toBe("ハイファンタジー");
    expect(NAROU_GENRE_LABELS["101"]).toBe("異世界〔恋愛〕");
    expect(NAROU_GENRE_LABELS["301"]).toBe("純文学");
    expect(NAROU_GENRE_LABELS["401"]).toBe("VRゲーム");
    expect(NAROU_GENRE_LABELS["9901"]).toBe("童話");
  });

  it("getNarouGenreLabel が文字列または数値のコードに対応するラベルを返却すること", () => {
    expect(getNarouGenreLabel("201")).toBe("ハイファンタジー");
    expect(getNarouGenreLabel(201)).toBe("ハイファンタジー");
    expect(getNarouGenreLabel("101")).toBe("異世界〔恋愛〕");
    expect(getNarouGenreLabel(101)).toBe("異世界〔恋愛〕");
  });

  it("getNarouGenreLabel が未知のコードや未指定時に「その他」を返却すること", () => {
    expect(getNarouGenreLabel("99999")).toBe("その他");
    expect(getNarouGenreLabel(undefined)).toBe("その他");
    expect(getNarouGenreLabel(null)).toBe("その他");
    expect(getNarouGenreLabel("")).toBe("その他");
    expect(getNarouGenreLabel("   ")).toBe("その他");
  });

  it("NAROU_SEARCH_GENRES が先頭に「すべて」を含み全22件であること", () => {
    expect(NAROU_SEARCH_GENRES).toHaveLength(22);
    expect(NAROU_SEARCH_GENRES[0]).toEqual({
      id: undefined,
      label: "すべて",
    });
    expect(NAROU_SEARCH_GENRES[1]).toEqual({
      id: "201",
      label: "ハイファンタジー",
    });
  });

  it("NAROU_RANKING_GENRES が先頭に「総合」を含み全22件であること", () => {
    expect(NAROU_RANKING_GENRES).toHaveLength(22);
    expect(NAROU_RANKING_GENRES[0]).toEqual({
      id: undefined,
      label: "総合",
    });
    expect(NAROU_RANKING_GENRES[1]).toEqual({
      id: "201",
      label: "ハイファンタジー",
    });
  });
});

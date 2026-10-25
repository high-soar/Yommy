import { describe, it, expect, beforeEach } from "vitest";
import { ParserRegistry, createDefaultParserRegistry } from "./parserRegistry";
import type { NovelParser, NovelSiteType } from "./types";

class DummyParser implements NovelParser {
  readonly siteType: NovelSiteType;
  private readonly matchPattern: string;

  constructor(siteType: NovelSiteType, matchPattern: string) {
    this.siteType = siteType;
    this.matchPattern = matchPattern;
  }

  canParse(url: string): boolean {
    return url.includes(this.matchPattern);
  }

  normalizeWorkUrl(url: string): string {
    return url;
  }

  parseNovelIndex() {
    return {
      siteType: this.siteType,
      remoteWorkId: "dummy",
      canonicalUrl: "https://example.com/novel/dummy",
      title: "ダミー作品",
      author: "ダミー作者",
      synopsis: "ダミーあらすじ",
      chapters: [],
      nextTocPageUrl: null,
    };
  }

  parseChapterContent() {
    return {
      remoteChapterId: "dummy-ep",
      title: "ダミーエピソード",
      bodyHtml: "<p>ダミー本文</p>",
      byteSize: 10,
      prevChapterUrl: null,
      nextChapterUrl: null,
    };
  }
}

describe("ParserRegistry", () => {
  let registry: ParserRegistry;

  beforeEach(() => {
    registry = new ParserRegistry();
  });

  describe("パーサーの登録と取得", () => {
    it("パーサーを登録し、対応する URL から取得できること", () => {
      const kakuyomuDummy = new DummyParser("kakuyomu", "kakuyomu.jp");
      registry.register(kakuyomuDummy);

      const found = registry.getParser("https://kakuyomu.jp/works/123");
      expect(found).toBe(kakuyomuDummy);
    });

    it("対応するパーサーが存在しない URL の場合は undefined を返すこと", () => {
      const kakuyomuDummy = new DummyParser("kakuyomu", "kakuyomu.jp");
      registry.register(kakuyomuDummy);

      const found = registry.getParser("https://example.com/novel/123");
      expect(found).toBeUndefined();
    });

    it("同一 siteType のパーサーを再登録した場合に上書き更新されること", () => {
      const dummy1 = new DummyParser("kakuyomu", "kakuyomu.jp");
      const dummy2 = new DummyParser("kakuyomu", "kakuyomu.jp");
      registry.register(dummy1);
      registry.register(dummy2);

      expect(registry.getAll()).toHaveLength(1);
      expect(registry.getParser("https://kakuyomu.jp/works/123")).toBe(dummy2);
    });
  });

  describe("requireParser", () => {
    it("マッチするパーサーが存在する場合はそれを返すこと", () => {
      const dummy = new DummyParser("kakuyomu", "kakuyomu.jp");
      registry.register(dummy);

      expect(registry.requireParser("https://kakuyomu.jp/works/123")).toBe(
        dummy,
      );
    });

    it("マッチするパーサーが存在しない場合はエラーを送出すること", () => {
      expect(() => registry.requireParser("https://unknown.com/novel")).toThrow(
        "No parser registered for URL: https://unknown.com/novel",
      );
    });
  });

  describe("getAll", () => {
    it("登録されているすべてのパーサーの配列を返すこと", () => {
      expect(registry.getAll()).toEqual([]);

      const p1 = new DummyParser("kakuyomu", "kakuyomu.jp");
      const p2 = new DummyParser("narou", "syosetu.com");
      registry.register(p1);
      registry.register(p2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(p1);
      expect(all).toContain(p2);
    });
  });

  describe("createDefaultParserRegistry", () => {
    it("デフォルトで KakuyomuParser が登録されたインスタンスを生成すること", () => {
      const defaultRegistry = createDefaultParserRegistry();
      const all = defaultRegistry.getAll();

      expect(all.length).toBeGreaterThanOrEqual(1);
      expect(all.some((p) => p.siteType === "kakuyomu")).toBe(true);
      expect(
        defaultRegistry.getParser(
          "https://kakuyomu.jp/works/1177354054881162325",
        ),
      ).toBeDefined();
    });
  });
});

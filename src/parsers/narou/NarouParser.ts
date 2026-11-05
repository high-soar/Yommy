import type {
  NovelParser,
  NovelSiteType,
  ParsedChapterContent,
  ParsedNovelIndex,
} from "../types";

/**
 * 小説家になろう（ncode.syosetu.com）向け小説パーサー（未実装スタブ）
 */
export class NarouParser implements NovelParser {
  readonly siteType: NovelSiteType = "narou";

  canParse(_url: string): boolean {
    return false;
  }

  normalizeWorkUrl(_url: string): string {
    throw new Error("Not implemented");
  }

  parseNovelIndex(_html: string, _pageUrl: string): ParsedNovelIndex {
    throw new Error("Not implemented");
  }

  parseChapterContent(_html: string, _pageUrl: string): ParsedChapterContent {
    throw new Error("Not implemented");
  }
}

import type { NovelParser } from "./types";
import { KakuyomuParser } from "./kakuyomu/KakuyomuParser";

/**
 * サイト別小説パーサーの管理・解決を行うレジストリクラス
 */
export class ParserRegistry {
  private parsers: NovelParser[] = [];

  /**
   * パーサーを登録する。同一 siteType が既に存在する場合は上書き更新する。
   *
   * @param parser 登録する NovelParser インスタンス
   */
  register(parser: NovelParser): void {
    const existingIndex = this.parsers.findIndex(
      (p) => p.siteType === parser.siteType,
    );
    if (existingIndex >= 0) {
      this.parsers[existingIndex] = parser;
    } else {
      this.parsers.push(parser);
    }
  }

  /**
   * 指定された URL を解析可能なパーサーを取得する。
   *
   * @param url 対象 URL
   * @returns マッチした NovelParser、見つからない場合は undefined
   */
  getParser(url: string): NovelParser | undefined {
    return this.parsers.find((p) => p.canParse(url));
  }

  /**
   * 指定された URL を解析可能なパーサーを取得する。見つからない場合は例外を送出する。
   *
   * @param url 対象 URL
   * @returns マッチした NovelParser
   * @throws URL に対応するパーサーが登録されていない場合のエラー
   */
  requireParser(url: string): NovelParser {
    const parser = this.getParser(url);
    if (!parser) {
      throw new Error(`No parser registered for URL: ${url}`);
    }
    return parser;
  }

  /**
   * 登録済みの全パーサーを取得する。
   *
   * @returns 登録済み NovelParser の配列
   */
  getAll(): NovelParser[] {
    return [...this.parsers];
  }
}

/**
 * デフォルトのパーサー群（KakuyomuParser 等）が事前登録された ParserRegistry を生成する
 *
 * @returns デフォルト登録済み ParserRegistry インスタンス
 */
export function createDefaultParserRegistry(): ParserRegistry {
  const registry = new ParserRegistry();
  registry.register(new KakuyomuParser());
  return registry;
}

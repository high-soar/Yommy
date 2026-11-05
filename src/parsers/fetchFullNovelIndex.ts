import type { HttpClientBridge } from "../bridges/http/types";
import type { NovelParser, ParsedNovelIndex } from "./types";

export const DEFAULT_TOC_PAGE_INTERVAL_MS = 500;
export const MAX_TOC_PAGES = 100;

export interface FetchFullNovelIndexOptions {
  /** 2ページ目以降の取得間隔ウェイト（ミリ秒、既定値: 500ms） */
  intervalMs?: number;
  /** 最大取得ページ数上限（既定値: 100ページ = 最大10,000話） */
  maxPages?: number;
  /** 中断シグナル */
  signal?: AbortSignal;
}

/**
 * 作品トップから次ページ目次（nextTocPageUrl）が存在する限り連続取得・結合する共通パイプライン（スタブ）
 */
export async function fetchFullNovelIndex(
  _httpClient: HttpClientBridge,
  _parser: NovelParser,
  _workUrl: string,
  _options?: FetchFullNovelIndexOptions,
): Promise<ParsedNovelIndex> {
  throw new Error("fetchFullNovelIndex: Not implemented");
}

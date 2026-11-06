import type { HttpClientBridge } from "../bridges/http/types";
import type { NovelParser, ParsedNovelIndex, ParsedTocItem } from "./types";

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

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw (
      signal.reason ??
      new DOMException("This operation was aborted", "AbortError")
    );
  }
}

function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      try {
        checkAbort(signal);
      } catch (err) {
        reject(err);
      }
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * 作品トップから次ページ目次（nextTocPageUrl）が存在する限り連続取得・結合する共通パイプライン
 *
 * 1. 初期URL正規化（parser.normalizeWorkUrl）
 * 2. 1ページ目取得・パース
 * 3. nextTocPageUrl が存在する間、SSRF検証（httpsスキーム・canParse・同一作品）・循環検出・上限ガード・ウェイト制御を行いつつ順次取得
 * 4. ページ跨ぎ時の章見出し（partTitle）引き継ぎ
 * 5. 全エピソードの chapterIndex を 1..N に再採番し、nextTocPageUrl: null で返却
 * 6. 2ページ目以降のエラー時は例外を再送出して全体中断（不完全データ保存防止）
 */
export async function fetchFullNovelIndex(
  httpClient: HttpClientBridge,
  parser: NovelParser,
  workUrl: string,
  options?: FetchFullNovelIndexOptions,
): Promise<ParsedNovelIndex> {
  const signal = options?.signal;
  checkAbort(signal);

  const intervalMs = options?.intervalMs ?? DEFAULT_TOC_PAGE_INTERVAL_MS;
  const maxPages = options?.maxPages ?? MAX_TOC_PAGES;

  const canonicalUrl = parser.normalizeWorkUrl(workUrl);

  // 1ページ目の取得・パース
  const firstRes = await httpClient.getHtml({ url: canonicalUrl, signal });
  checkAbort(signal);

  const firstIndex = parser.parseNovelIndex(firstRes.html, canonicalUrl);

  const allChapters: ParsedTocItem[] = [...firstIndex.chapters];
  let currentPartTitle: string | null = null;
  if (firstIndex.chapters.length > 0) {
    currentPartTitle =
      firstIndex.chapters[firstIndex.chapters.length - 1].partTitle ?? null;
  }

  const visitedUrls = new Set<string>([canonicalUrl]);
  let pageCount = 1;
  let nextUrl = firstIndex.nextTocPageUrl;

  while (nextUrl !== null) {
    checkAbort(signal);

    // maxPages 上限ガード
    if (pageCount >= maxPages) {
      console.warn(
        `[fetchFullNovelIndex] Reached maxPages (${maxPages}) limit for ${canonicalUrl}`,
      );
      break;
    }

    // 同一URL再訪（循環参照）防止
    if (visitedUrls.has(nextUrl)) {
      console.warn(
        `[fetchFullNovelIndex] Circular reference detected for ${nextUrl} in ${canonicalUrl}`,
      );
      break;
    }

    // SSRF・同一作品検証
    if (!nextUrl.startsWith("https:") || !parser.canParse(nextUrl)) {
      console.warn(
        `[fetchFullNovelIndex] Invalid nextTocPageUrl scheme or unsupported parser: ${nextUrl}`,
      );
      break;
    }
    let normalizedNext: string;
    try {
      normalizedNext = parser.normalizeWorkUrl(nextUrl);
    } catch {
      console.warn(
        `[fetchFullNovelIndex] Failed to normalize nextTocPageUrl: ${nextUrl}`,
      );
      break;
    }
    if (normalizedNext !== canonicalUrl) {
      console.warn(
        `[fetchFullNovelIndex] nextTocPageUrl points to different work: ${nextUrl} !== ${canonicalUrl}`,
      );
      break;
    }

    visitedUrls.add(nextUrl);

    // 2ページ目以降のレートリミット待機
    if (intervalMs > 0) {
      await sleepWithSignal(intervalMs, signal);
    }
    checkAbort(signal);

    // 次ページの取得・パース（通信/パースエラー時はそのまま例外送出）
    const pageRes = await httpClient.getHtml({ url: nextUrl, signal });
    checkAbort(signal);

    const pageIndex = parser.parseNovelIndex(pageRes.html, nextUrl);

    // ページ跨ぎ時の partTitle 引き継ぎ
    for (const ch of pageIndex.chapters) {
      if (ch.partTitle !== null) {
        currentPartTitle = ch.partTitle;
      }
      allChapters.push({
        ...ch,
        partTitle: ch.partTitle ?? currentPartTitle,
      });
    }

    pageCount++;
    nextUrl = pageIndex.nextTocPageUrl;
  }

  // 全エピソードの chapterIndex を 1..N に再採番
  const reindexedChapters = allChapters.map((ch, idx) => ({
    ...ch,
    chapterIndex: idx + 1,
  }));

  return {
    ...firstIndex,
    chapters: reindexedChapters,
    nextTocPageUrl: null,
  };
}

import type {
  NovelParser,
  NovelSiteType,
  ParsedChapterContent,
  ParsedNovelIndex,
  ParsedTocItem,
} from "../types";
import { sanitizeChapterHtml } from "../sanitizer";

/**
 * カクヨム DOM セレクタ定数（優先順位リスト）
 */
const SELECTORS = {
  workTitle: ["#workTitle a", "#workTitle", "#catchphrase-and-title h1"],
  workAuthor: [
    "#workAuthor-activityName a",
    "#workAuthor-activityName",
    '[href^="/users/"]',
  ],
  workSynopsis: ["#introduction", ".widget-work-introduction", "#description"],
  canonicalLink: 'link[rel="canonical"]',
  tocElements:
    '[class*="widget-toc-chapter"], [class*="widget-toc-section"], [class*="widget-toc-episode"]',
  episodeTitle: [".widget-episodeTitle", "header h1", ".episode-title"],
  episodeBody: [".widget-episodeBody", ".js-episode-body"],
  prevEpisode: ["a#contentMain-previousEpisode", 'a[rel="prev"]'],
  nextEpisode: ["a#contentMain-nextEpisode", 'a[rel="next"]'],
} as const;

/**
 * 優先順位リスト順に DOM を探索し、最初に見つかった要素を返却する
 */
function queryFirst<T extends Element = Element>(
  root: ParentNode,
  selectors: readonly string[],
): T | null {
  for (const selector of selectors) {
    const el = root.querySelector<T>(selector);
    if (el) {
      return el;
    }
  }
  return null;
}

/**
 * URL 抽出用正規表現
 */
const WORK_ID_REGEX = /\/works\/([0-9]+)/;
const EPISODE_ID_REGEX = /\/episodes\/([0-9]+)/;

/**
 * カクヨム（kakuyomu.jp）向け小説パーサー
 * DOMParser を用いた決定論的 DOM トラバーサル処理（外部ネットワーク通信なし）
 */
export class KakuyomuParser implements NovelParser {
  readonly siteType: NovelSiteType = "kakuyomu";

  /**
   * 指定された URL がカクヨムの作品またはエピソード URL か判定する
   *
   * @param url 検証対象の URL 文字列
   * @returns カクヨム作品 URL の場合 true
   */
  canParse(url: string): boolean {
    try {
      const parsed = new URL(url);
      const isKakuyomuHost =
        parsed.hostname === "kakuyomu.jp" ||
        parsed.hostname.endsWith(".kakuyomu.jp");
      return isKakuyomuHost && parsed.pathname.startsWith("/works/");
    } catch {
      return false;
    }
  }

  /**
   * 作品トップ URL、エピソード URL、クエリ付き URL から作品トップの正規化 URL を生成する
   *
   * @param url 対象 URL
   * @returns 正規化された作品トップ URL (https://kakuyomu.jp/works/{workId})
   */
  normalizeWorkUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(WORK_ID_REGEX);
      if (!match) {
        throw new Error("Invalid Kakuyomu work URL");
      }
      return `https://kakuyomu.jp/works/${match[1]}`;
    } catch {
      throw new Error("Invalid Kakuyomu work URL");
    }
  }

  /**
   * 作品トップ HTML からメタデータおよびエピソード目次リストを抽出する
   *
   * @param html 作品トップの HTML 文字列
   * @param pageUrl 取得元ページ URL
   * @returns 作品メタデータと目次一覧
   */
  parseNovelIndex(html: string, pageUrl: string): ParsedNovelIndex {
    const doc = new DOMParser().parseFromString(html, "text/html");

    const urlMatch = pageUrl.match(WORK_ID_REGEX);
    let remoteWorkId = urlMatch ? urlMatch[1] : "";

    if (!remoteWorkId) {
      const canonical = doc
        .querySelector<HTMLLinkElement>(SELECTORS.canonicalLink)
        ?.getAttribute("href");
      const canonicalMatch = canonical?.match(WORK_ID_REGEX);
      if (canonicalMatch) {
        remoteWorkId = canonicalMatch[1];
      }
    }

    if (!remoteWorkId) {
      throw new Error("Cannot extract remoteWorkId from URL or HTML");
    }

    const canonicalUrl = `https://kakuyomu.jp/works/${remoteWorkId}`;

    const titleEl = queryFirst(doc, SELECTORS.workTitle);
    const title = titleEl?.textContent?.trim() || "";

    const authorEl = queryFirst(doc, SELECTORS.workAuthor);
    const author = authorEl?.textContent?.trim() || "";

    const synopsisEl = queryFirst(doc, SELECTORS.workSynopsis);
    const synopsis = synopsisEl?.textContent?.trim() || "";

    const elements = doc.querySelectorAll(SELECTORS.tocElements);

    let currentPartTitle: string | null = null;
    const chapters: ParsedTocItem[] = [];
    let chapterIndex = 1;

    for (const el of Array.from(elements)) {
      const className = el.className;
      if (
        className.includes("widget-toc-chapter") ||
        className.includes("widget-toc-section")
      ) {
        currentPartTitle = el.textContent?.trim() || null;
      } else if (className.includes("widget-toc-episode")) {
        const link = el.querySelector<HTMLAnchorElement>("a");
        if (!link) {
          continue;
        }
        const href = link.getAttribute("href");
        if (!href) {
          continue;
        }
        const match = href.match(EPISODE_ID_REGEX);
        if (!match) {
          continue;
        }
        const remoteChapterId = match[1];
        const chapterTitle = link.textContent?.trim() || "";
        const chapterUrl = `https://kakuyomu.jp/works/${remoteWorkId}/episodes/${remoteChapterId}`;
        const timeEl = el.querySelector("time");
        const publishedAt =
          timeEl?.getAttribute("datetime") ||
          timeEl?.textContent?.trim() ||
          null;

        chapters.push({
          chapterIndex: chapterIndex++,
          remoteChapterId,
          partTitle: currentPartTitle,
          title: chapterTitle,
          url: chapterUrl,
          publishedAt,
        });
      }
    }

    return {
      siteType: "kakuyomu",
      remoteWorkId,
      canonicalUrl,
      title,
      author,
      synopsis,
      chapters,
      nextTocPageUrl: null,
    };
  }

  /**
   * 各話 HTML から整形・サニタイズ済み本文および前後の移動リンクを抽出する
   *
   * @param html 各話の HTML 文字列
   * @param pageUrl 取得元ページ URL
   * @returns サニタイズ済み本文データ
   */
  parseChapterContent(html: string, pageUrl: string): ParsedChapterContent {
    const doc = new DOMParser().parseFromString(html, "text/html");

    const chapterIdMatch = pageUrl.match(EPISODE_ID_REGEX);
    const remoteChapterId = chapterIdMatch ? chapterIdMatch[1] : "";

    const titleEl = queryFirst(doc, SELECTORS.episodeTitle);
    const title = titleEl?.textContent?.trim() || "";

    const bodyEl = queryFirst(doc, SELECTORS.episodeBody);
    const bodyHtml = bodyEl ? sanitizeChapterHtml(bodyEl.innerHTML) : "";
    const byteSize = new TextEncoder().encode(bodyHtml).length;

    const prevEl = queryFirst<HTMLAnchorElement>(doc, SELECTORS.prevEpisode);
    const prevHref = prevEl?.getAttribute("href");
    const prevChapterUrl = prevHref ? new URL(prevHref, pageUrl).href : null;

    const nextEl = queryFirst<HTMLAnchorElement>(doc, SELECTORS.nextEpisode);
    const nextHref = nextEl?.getAttribute("href");
    const nextChapterUrl = nextHref ? new URL(nextHref, pageUrl).href : null;

    return {
      remoteChapterId,
      title,
      bodyHtml,
      byteSize,
      prevChapterUrl,
      nextChapterUrl,
    };
  }
}

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
  workTitle: [
    "#workTitle a",
    "#workTitle",
    "#catchphrase-and-title h1",
    "header h1",
    "h1",
  ],
  workAuthor: [
    "#workAuthor-activityName a",
    "#workAuthor-activityName",
    ".partialGiftWidgetActivityName a",
    '[href^="/users/"]',
    'a[href*="/users/"]',
  ],
  workSynopsis: [
    "#introduction",
    ".widget-work-introduction",
    "#description",
    '[class*="IntroductionBox"]',
    '[class*="introduction"]',
  ],
  canonicalLink: 'link[rel="canonical"]',
  tocElements:
    '[class*="widget-toc-chapter"], [class*="widget-toc-section"], [class*="widget-toc-episode"]',
  modernTocElements:
    '[class*="WorkToc"] [class*="ChapterTitle"], [class*="WorkToc"] [class*="chapterTitle"], [class*="WorkToc"] a[href*="/episodes/"]',
  episodeTitle: [".widget-episodeTitle", ".episode-title", "header h1"],
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

interface ApolloRef {
  __ref: string;
}

interface ApolloWork {
  title?: string;
  alternateAuthorName?: string;
  author?: ApolloRef;
  introduction?: string;
  catchphrase?: string;
  tableOfContentsV2?: ApolloRef[];
  tableOfContents?: ApolloRef[];
}

interface ApolloUserAccount {
  activityName?: string;
  name?: string;
}

interface ApolloTableOfContentsChapter {
  chapter?: ApolloRef | null;
  episodeUnions?: ApolloRef[];
}

interface ApolloChapter {
  title?: string;
}

interface ApolloEpisode {
  id?: string;
  title?: string;
  publishedAt?: unknown;
}

type ApolloState = Record<string, unknown>;

/**
 * Next.js の <script id="__NEXT_DATA__"> から __APOLLO_STATE__ 辞書を安全に取得する
 */
function parseApolloState(doc: Document): ApolloState | null {
  const scriptContent = doc.querySelector("script#__NEXT_DATA__")?.textContent;
  if (!scriptContent) {
    return null;
  }
  try {
    const parsed = JSON.parse(scriptContent) as {
      props?: { pageProps?: { __APOLLO_STATE__?: ApolloState } };
    };
    const apolloState = parsed.props?.pageProps?.__APOLLO_STATE__;
    if (apolloState && typeof apolloState === "object") {
      return apolloState;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * __APOLLO_STATE__ からメタデータおよび全エピソード・全章目次を抽出する
 */
function extractFromApolloState(
  apolloState: ApolloState,
  remoteWorkId: string,
): {
  title: string;
  author: string;
  synopsis: string;
  chapters: ParsedTocItem[];
} | null {
  const work = apolloState[`Work:${remoteWorkId}`] as ApolloWork | undefined;
  if (!work) {
    return null;
  }

  const title = typeof work.title === "string" ? work.title.trim() : "";

  const authorRef = work.author?.__ref;
  const userAccount = authorRef
    ? (apolloState[authorRef] as ApolloUserAccount | undefined)
    : undefined;
  const rawAuthor =
    userAccount?.activityName ||
    work.alternateAuthorName ||
    userAccount?.name ||
    "";
  const author = rawAuthor.trim();

  const rawSynopsis = work.introduction || work.catchphrase || "";
  const synopsis = rawSynopsis.trim();

  const tocRefs = work.tableOfContentsV2 ?? work.tableOfContents ?? [];
  const chapters: ParsedTocItem[] = [];
  let chapterIndex = 1;

  for (const tocRef of tocRefs) {
    const tocChapter = apolloState[tocRef.__ref] as
      ApolloTableOfContentsChapter | undefined;
    if (!tocChapter) {
      continue;
    }

    let partTitle: string | null = null;
    if (tocChapter.chapter?.__ref) {
      const chObj = apolloState[tocChapter.chapter.__ref] as
        ApolloChapter | undefined;
      partTitle = chObj?.title?.trim() || null;
    }

    const episodeUnions = tocChapter.episodeUnions ?? [];
    for (const epRef of episodeUnions) {
      const ep = apolloState[epRef.__ref] as ApolloEpisode | undefined;
      if (!ep || !ep.id || !ep.title) {
        continue;
      }
      const epId = String(ep.id);
      chapters.push({
        chapterIndex: chapterIndex++,
        remoteChapterId: epId,
        partTitle,
        title: String(ep.title).trim(),
        url: `https://kakuyomu.jp/works/${remoteWorkId}/episodes/${epId}`,
        publishedAt: typeof ep.publishedAt === "string" ? ep.publishedAt : null,
      });
    }
  }

  return { title, author, synopsis, chapters };
}

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
    if (!this.canParse(url)) {
      throw new Error("Invalid Kakuyomu work URL");
    }
    const parsed = new URL(url);
    const match = parsed.pathname.match(WORK_ID_REGEX);
    if (!match) {
      throw new Error("Invalid Kakuyomu work URL");
    }
    return `https://kakuyomu.jp/works/${match[1]}`;
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
    let title = titleEl?.textContent?.trim() || "";

    const authorEl = queryFirst(doc, SELECTORS.workAuthor);
    let author = authorEl?.textContent?.trim() || "";

    const synopsisEl = queryFirst(doc, SELECTORS.workSynopsis);
    let synopsis = synopsisEl?.textContent?.trim() || "";

    const chapters: ParsedTocItem[] = [];
    let chapterIndex = 1;

    // 1. Next.js (__NEXT_DATA__ -> __APOLLO_STATE__) からの優先抽出・メタデータ補完
    const apolloState = parseApolloState(doc);
    if (apolloState) {
      const apolloExtracted = extractFromApolloState(apolloState, remoteWorkId);
      if (apolloExtracted) {
        if (!title) {
          title = apolloExtracted.title;
        }
        if (!author) {
          author = apolloExtracted.author;
        }
        if (!synopsis) {
          synopsis = apolloExtracted.synopsis;
        }
        if (apolloExtracted.chapters.length > 0) {
          chapters.push(...apolloExtracted.chapters);
          chapterIndex += apolloExtracted.chapters.length;
        }
      }
    }

    // 2. レガシー DOM（.widget-toc-*）からのフォールバック抽出
    if (chapters.length === 0) {
      const elements = doc.querySelectorAll(SELECTORS.tocElements);
      let currentPartTitle: string | null = null;

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
    }

    // 3. 現行 DOM（[class*="WorkToc"] 内の章見出し・エピソードリンク）へのフォールバック抽出
    if (chapters.length === 0) {
      const modernElements = doc.querySelectorAll(SELECTORS.modernTocElements);
      let currentPartTitle: string | null = null;

      for (const el of Array.from(modernElements)) {
        if (el.tagName.toLowerCase() === "a") {
          const href = el.getAttribute("href")!;
          const match = href.match(EPISODE_ID_REGEX);
          if (match) {
            const remoteChapterId = match[1];
            const titleEl = el.querySelector('[class*="title"]');
            const rawTitle = (titleEl ?? el).textContent!;
            const trimmed = rawTitle.trim();
            const chapterTitle =
              trimmed.replace(/\d{4}年\d{1,2}月\d{1,2}日.*$/, "").trim() ||
              trimmed;
            const chapterUrl = `https://kakuyomu.jp/works/${remoteWorkId}/episodes/${remoteChapterId}`;
            const timeEl = el.querySelector("time");
            const publishedAt = timeEl ? timeEl.getAttribute("datetime") : null;

            chapters.push({
              chapterIndex: chapterIndex++,
              remoteChapterId,
              partTitle: currentPartTitle,
              title: chapterTitle,
              url: chapterUrl,
              publishedAt,
            });
          }
        } else {
          currentPartTitle = el.textContent?.trim() || null;
        }
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

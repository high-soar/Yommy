import type {
  NovelParser,
  NovelRankingOptions,
  NovelRankingResultItem,
  NovelSearchOptions,
  NovelSearchResultItem,
  NovelSiteType,
  ParsedChapterContent,
  ParsedNovelIndex,
  ParsedRankingResult,
  ParsedSearchResult,
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
 * カクヨム ジャンルスラッグ・表示名マップ
 */
const GENRE_MAP: Record<string, { genre: string; genreLabel: string }> = {
  fantasy: { genre: "fantasy", genreLabel: "異世界ファンタジー" },
  異世界ファンタジー: { genre: "fantasy", genreLabel: "異世界ファンタジー" },
  action: { genre: "action", genreLabel: "現代ファンタジー" },
  現代ファンタジー: { genre: "action", genreLabel: "現代ファンタジー" },
  sf: { genre: "sf", genreLabel: "SF" },
  love_story: { genre: "love_story", genreLabel: "恋愛" },
  恋愛: { genre: "love_story", genreLabel: "恋愛" },
  romance: { genre: "romance", genreLabel: "ラブコメ" },
  ラブコメ: { genre: "romance", genreLabel: "ラブコメ" },
  drama: { genre: "drama", genreLabel: "現代ドラマ" },
  現代ドラマ: { genre: "drama", genreLabel: "現代ドラマ" },
  horror: { genre: "horror", genreLabel: "ホラー" },
  ホラー: { genre: "horror", genreLabel: "ホラー" },
  mystery: { genre: "mystery", genreLabel: "ミステリー" },
  ミステリー: { genre: "mystery", genreLabel: "ミステリー" },
  nonfiction: { genre: "nonfiction", genreLabel: "エッセイ・ノンフィクション" },
  "エッセイ・ノンフィクション": {
    genre: "nonfiction",
    genreLabel: "エッセイ・ノンフィクション",
  },
  history: { genre: "history", genreLabel: "歴史・時代・伝奇" },
  "歴史・時代・伝奇": { genre: "history", genreLabel: "歴史・時代・伝奇" },
  criticism: { genre: "criticism", genreLabel: "創作論・評論" },
  "創作論・評論": { genre: "criticism", genreLabel: "創作論・評論" },
  others: { genre: "others", genreLabel: "詩・童話・その他" },
  "詩・童話・その他": { genre: "others", genreLabel: "詩・童話・その他" },
};

/**
 * ジャンル文字列を正規化しスラッグと日本語ラベルを返却する
 */
function parseGenre(raw?: string | null): {
  genre: string;
  genreLabel: string;
} {
  if (!raw) {
    return { genre: "", genreLabel: "" };
  }
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (GENRE_MAP[lower]) {
    return GENRE_MAP[lower];
  }
  return { genre: lower, genreLabel: trimmed };
}

/**
 * 連載状況文字列を正規化する
 */
function parseSerialStatus(raw?: string | null): {
  serialStatus: "running" | "completed";
  serialStatusLabel: string;
} {
  if (!raw) {
    return { serialStatus: "running", serialStatusLabel: "連載中" };
  }
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "completed" || trimmed.includes("完結")) {
    return { serialStatus: "completed", serialStatusLabel: "完結済" };
  }
  return { serialStatus: "running", serialStatusLabel: "連載中" };
}

/**
 * ページ URL のクエリパラメータから現在のページ番号を抽出する
 */
function extractCurrentPage(pageUrl: string): number {
  try {
    const url = new URL(pageUrl, "https://kakuyomu.jp");
    const pageStr = url.searchParams.get("page");
    if (pageStr) {
      const p = parseInt(pageStr, 10);
      if (!isNaN(p) && p >= 1) {
        return p;
      }
    }
  } catch {
    // URL 解析失敗時はデフォルト 1
  }
  return 1;
}

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

interface ApolloSearchResultWork {
  id?: string;
  title?: string;
  author?: ApolloRef;
  alternateAuthorName?: string;
  introduction?: string;
  catchphrase?: string;
  genre?: string;
  serialStatus?: string;
  publicEpisodeCount?: number;
  totalCharacterCount?: number;
  tagLabels?: string[];
  totalReviewPoint?: number;
  lastEpisodePublishedAt?: string | null;
}

interface ApolloConnection {
  nodes?: Array<ApolloRef | ApolloSearchResultWork>;
  pageInfo?: {
    hasNextPage?: boolean;
  };
  totalCount?: number;
}

type ApolloState = Record<string, unknown>;

/**
 * Apollo State 内の Connection オブジェクト（参照解決含む）を取得する
 */
function resolveApolloConnection(
  apolloState: ApolloState,
  rawConn: unknown,
): ApolloConnection | null {
  if (!rawConn || typeof rawConn !== "object") {
    return null;
  }
  if ("__ref" in rawConn) {
    const ref = (rawConn as ApolloRef).__ref;
    const resolved = apolloState[ref];
    return resolved && typeof resolved === "object"
      ? (resolved as ApolloConnection)
      : null;
  }
  return rawConn as ApolloConnection;
}

/**
 * Apollo Connection から作品リストを一括抽出する
 */
function extractWorksFromApolloConnection(
  apolloState: ApolloState,
  conn: ApolloConnection,
): NovelSearchResultItem[] {
  const items: NovelSearchResultItem[] = [];
  const nodes = conn.nodes ?? [];
  for (const node of nodes) {
    const workObj =
      typeof node === "object" && node !== null && "__ref" in node
        ? (apolloState[(node as ApolloRef).__ref] as
            ApolloSearchResultWork | undefined)
        : (node as ApolloSearchResultWork | undefined);
    if (workObj) {
      const item = extractWorkFromApollo(apolloState, workObj);
      if (item) {
        items.push(item);
      }
    }
  }
  return items;
}

/**
 * Apollo State から検索・ランキング用の作品エンティティを抽出する
 */
function extractWorkFromApollo(
  apolloState: ApolloState,
  work: ApolloSearchResultWork,
): NovelSearchResultItem | null {
  if (!work.id) {
    return null;
  }
  const remoteWorkId = String(work.id);
  const title = typeof work.title === "string" ? work.title.trim() : "";

  let author = "";
  if (work.author?.__ref) {
    const user = apolloState[work.author.__ref] as
      ApolloUserAccount | undefined;
    author = user?.activityName || work.alternateAuthorName || user?.name || "";
  } else if (work.alternateAuthorName) {
    author = work.alternateAuthorName;
  }
  author = author.trim();

  const synopsis = (work.introduction || work.catchphrase || "").trim();
  const { genre, genreLabel } = parseGenre(work.genre);
  const { serialStatus, serialStatusLabel } = parseSerialStatus(
    work.serialStatus,
  );
  const episodeCount =
    typeof work.publicEpisodeCount === "number" ? work.publicEpisodeCount : 0;
  const characterCount =
    typeof work.totalCharacterCount === "number" ? work.totalCharacterCount : 0;
  const tags = Array.isArray(work.tagLabels) ? work.tagLabels.map(String) : [];
  const reviewPoints =
    typeof work.totalReviewPoint === "number" ? work.totalReviewPoint : 0;
  const lastEpisodePublishedAt =
    typeof work.lastEpisodePublishedAt === "string"
      ? work.lastEpisodePublishedAt
      : null;
  const workUrl = `https://kakuyomu.jp/works/${remoteWorkId}`;

  return {
    remoteWorkId,
    title,
    author,
    synopsis,
    genre,
    genreLabel,
    serialStatus,
    serialStatusLabel,
    episodeCount,
    characterCount,
    tags,
    reviewPoints,
    lastEpisodePublishedAt,
    workUrl,
  };
}

/**
 * 静的 DOM カード要素から作品エンティティを抽出する（フォールバック用）
 */
function extractWorkFromDomCard(card: Element): NovelSearchResultItem | null {
  const link = card.querySelector<HTMLAnchorElement>('a[href*="/works/"]');
  if (!link) {
    return null;
  }
  const match = link.getAttribute("href")?.match(WORK_ID_REGEX);
  if (!match) {
    return null;
  }
  const remoteWorkId = match[1];
  const title = link.textContent!.trim();

  const authorEl = card.querySelector(
    'a[href*="/users/"], [class*="author"], [class*="activityName"]',
  );
  const author = authorEl?.textContent?.trim() || "";

  const synopsisEl = card.querySelector(
    '[class*="introduction"], [class*="synopsis"], [class*="description"], p',
  );
  const synopsis = synopsisEl?.textContent?.trim() || "";

  const genreEl = card.querySelector('[class*="genre"]');
  const { genre, genreLabel } = parseGenre(genreEl?.textContent);

  const statusEl = card.querySelector('[class*="serial"], [class*="status"]');
  const { serialStatus, serialStatusLabel } = parseSerialStatus(
    statusEl?.textContent,
  );

  const cardText = card.textContent!;
  const epMatch = cardText.match(/(\d+)話/);
  const episodeCount = epMatch ? parseInt(epMatch[1], 10) : 0;

  const charMatch = cardText.match(/([\d,]+)文字/);
  const characterCount = charMatch
    ? parseInt(charMatch[1].replace(/,/g, ""), 10)
    : 0;

  const reviewMatch = cardText.match(/★\s*([\d,]+)/);
  const reviewPoints = reviewMatch
    ? parseInt(reviewMatch[1].replace(/,/g, ""), 10)
    : 0;

  const tagElements = card.querySelectorAll(
    'a[href*="/tags/"], [class*="tag"]',
  );
  const tags: string[] = [];
  for (const tagEl of Array.from(tagElements)) {
    // 子要素を持つコンテナタグ（ul等）は除外し、末端要素のテキストのみを採用する
    if (tagEl.childElementCount > 0) {
      continue;
    }
    const text = tagEl.textContent?.trim();
    if (text && !tags.includes(text)) {
      tags.push(text);
    }
  }

  const timeEl = card.querySelector("time");
  const lastEpisodePublishedAt = timeEl?.getAttribute("datetime") || null;
  const workUrl = `https://kakuyomu.jp/works/${remoteWorkId}`;

  return {
    remoteWorkId,
    title,
    author,
    synopsis,
    genre,
    genreLabel,
    serialStatus,
    serialStatusLabel,
    episodeCount,
    characterCount,
    tags,
    reviewPoints,
    lastEpisodePublishedAt,
    workUrl,
  };
}

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

  /**
   * 検索 URL を構築する（純粋関数）
   */
  buildSearchUrl(query: string, options?: NovelSearchOptions): string {
    const url = new URL("https://kakuyomu.jp/search");
    url.searchParams.set("q", query.trim());
    url.searchParams.set("order", options?.order ?? "weekly_ranking");
    if (
      options?.serialStatus === "running" ||
      options?.serialStatus === "completed"
    ) {
      url.searchParams.set("serial_status", options.serialStatus);
    }
    if (options?.genre) {
      url.searchParams.set("genre_name", options.genre.toLowerCase());
    }
    if (options?.page !== undefined && options.page >= 2) {
      url.searchParams.set("page", String(options.page));
    }
    return url.toString();
  }

  /**
   * 検索結果 HTML から作品一覧とページ情報を抽出する（純粋関数）
   */
  searchNovels(html: string, pageUrl: string): ParsedSearchResult {
    const currentPage = extractCurrentPage(pageUrl);
    const doc = new DOMParser().parseFromString(html, "text/html");

    // 1. Apollo State からの優先抽出
    const apolloState = parseApolloState(doc);
    if (apolloState) {
      const rootQuery = apolloState["ROOT_QUERY"] as
        Record<string, unknown> | undefined;
      if (rootQuery) {
        const searchKey = Object.keys(rootQuery).find((k) =>
          k.startsWith("searchWorks"),
        );
        if (searchKey) {
          const conn = resolveApolloConnection(
            apolloState,
            rootQuery[searchKey],
          );
          if (conn) {
            const items = extractWorksFromApolloConnection(apolloState, conn);
            const hasNextPage = Boolean(conn.pageInfo?.hasNextPage);
            const totalCount =
              typeof conn.totalCount === "number" ? conn.totalCount : undefined;
            return {
              items,
              pageInfo: {
                currentPage,
                hasNextPage,
                totalCount,
              },
            };
          }
        }
      }
    }

    // 2. DOM フォールバック抽出
    const cards = doc.querySelectorAll(
      '.widget-work, [class*="WorkBox"], [class*="searchResult"], [class*="SearchResult"], [class*="workCard"], article',
    );
    const items: NovelSearchResultItem[] = [];
    const seenIds = new Set<string>();

    for (const card of Array.from(cards)) {
      const item = extractWorkFromDomCard(card);
      if (item && !seenIds.has(item.remoteWorkId)) {
        seenIds.add(item.remoteWorkId);
        items.push(item);
      }
    }

    const hasNextPage = Boolean(
      doc.querySelector(
        'a[rel="next"], [class*="pager"] a, [class*="pagination"] [class*="next"]',
      ),
    );

    return {
      items,
      pageInfo: {
        currentPage,
        hasNextPage,
      },
    };
  }

  /**
   * ランキング URL を構築する（純粋関数）
   */
  buildRankingUrl(options?: NovelRankingOptions): string {
    const genre =
      options?.genre && options.genre !== "all"
        ? options.genre.toLowerCase()
        : "all";
    const period = options?.period ?? "weekly";
    const url = new URL(`https://kakuyomu.jp/rankings/${genre}/${period}`);
    url.searchParams.set("work_variation", "long");
    if (options?.page !== undefined && options.page >= 2) {
      url.searchParams.set("page", String(options.page));
    }
    return url.toString();
  }

  /**
   * ランキング HTML から作品一覧と順位を抽出する（純粋関数）
   */
  getRanking(html: string, pageUrl: string): ParsedRankingResult {
    const currentPage = extractCurrentPage(pageUrl);
    const doc = new DOMParser().parseFromString(html, "text/html");

    // 1. Apollo State からの優先抽出
    const apolloState = parseApolloState(doc);
    if (apolloState) {
      const rootQuery = apolloState["ROOT_QUERY"] as
        Record<string, unknown> | undefined;
      if (rootQuery) {
        const rankingKey = Object.keys(rootQuery).find((k) =>
          k.startsWith("rankedWorks"),
        );
        if (rankingKey) {
          const conn = resolveApolloConnection(
            apolloState,
            rootQuery[rankingKey],
          );
          if (conn) {
            const baseItems = extractWorksFromApolloConnection(
              apolloState,
              conn,
            );
            const items: NovelRankingResultItem[] = baseItems.map(
              (item, idx) => ({
                ...item,
                rank: (currentPage - 1) * 100 + (idx + 1),
              }),
            );
            const hasNextPage = Boolean(conn.pageInfo?.hasNextPage);
            return {
              items,
              pageInfo: {
                currentPage,
                hasNextPage,
              },
            };
          }
        }
      }
    }

    // 2. DOM フォールバック抽出
    const cards = doc.querySelectorAll(
      '.RankingWorkBox, [class*="RankingWork"], [class*="rankingWork"], .widget-work, article',
    );
    const items: NovelRankingResultItem[] = [];
    const seenIds = new Set<string>();
    let idx = 0;

    for (const card of Array.from(cards)) {
      const baseItem = extractWorkFromDomCard(card);
      if (baseItem && !seenIds.has(baseItem.remoteWorkId)) {
        seenIds.add(baseItem.remoteWorkId);
        const rankEl = card.querySelector('[class*="rank"], [class*="Rank"]');
        const rankText = rankEl?.textContent?.replace(/[^0-9]/g, "");
        const parsedRank = rankText ? parseInt(rankText, 10) : NaN;
        const rank =
          !isNaN(parsedRank) && parsedRank > 0
            ? parsedRank
            : (currentPage - 1) * 100 + (idx + 1);
        items.push({ ...baseItem, rank });
        idx++;
      }
    }

    const hasNextPage = Boolean(
      doc.querySelector(
        'a[rel="next"], [class*="pager"] a, [class*="pagination"] [class*="next"]',
      ),
    );

    return {
      items,
      pageInfo: {
        currentPage,
        hasNextPage,
      },
    };
  }
}

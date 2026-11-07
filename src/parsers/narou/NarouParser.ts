import type {
  NovelParser,
  NovelRankingOptions,
  NovelRankingPeriod,
  NovelRankingResultItem,
  NovelSearchOptions,
  NovelSearchOrder,
  NovelSearchResultItem,
  NovelSiteType,
  ParsedChapterContent,
  ParsedNovelIndex,
  ParsedRankingResult,
  ParsedSearchResult,
  ParsedTocItem,
} from "../types";
import { sanitizeChapterHtml } from "../sanitizer";
import { getNarouGenreLabel } from "./genres";

/**
 * なろう DOM セレクタ定数（優先順位リスト）
 * docs/specs/parsers/narou.md §3.1, §4.1 に準拠
 */
const SELECTORS = {
  canonicalLink: 'link[rel="canonical"]',
  ogUrl: 'meta[property="og:url"]',
  title: [
    ".p-novel__title",
    ".novel_title",
    'meta[property="og:title"]',
    "title",
  ],
  author: [
    ".p-novel__author a",
    ".p-novel__author",
    ".novel_writername a",
    ".novel_writername",
    'meta[name="twitter:creator"]',
  ],
  synopsis: ["#novel_ex", ".p-novel__summary", 'meta[name="description"]'],
  nextTocPage: [
    ".c-pager .c-pager__item--next[href]",
    ".novelview_pager-next[href]",
    "a.c-pager__item--next[href]",
  ],
  chapterTitle: [
    ".p-novel__subtitle-episode",
    ".p-novel__title--rensai",
    ".novel_subtitle",
    ".p-novel__title",
    ".novel_title",
  ],
  preface: [".p-novel__text.p-novel__text--preface", "#novel_p"],
  mainBody: [
    ".p-novel__text:not(.p-novel__text--preface):not(.p-novel__text--afterword)",
    "#novel_honbun",
  ],
  afterword: [".p-novel__text.p-novel__text--afterword", "#novel_a"],
  prevChapter: [
    ".c-pager__item--before[href]",
    '.novel_bn a[rel="prev"]',
    'a[rel="prev"][href]',
  ],
  nextChapter: [
    ".c-pager__item--next[href]",
    '.novel_bn a[rel="next"]',
    'a[rel="next"][href]',
  ],
} as const;

/** 先頭パスが ncode 形式（n + 数字）にマッチする正規表現 */
const NCODE_PATH_REGEX = /^\/(n\d+[a-z0-9]*)(?:\/|$)/i;
/** URL やパス内の任意の ncode 形式にマッチする正規表現 */
const NCODE_ANY_REGEX = /\/(n\d+[a-z0-9]*)(?:\/|$)/i;
/** エピソード URL パスから話数識別子を抽出する正規表現 */
const CHAPTER_ID_REGEX = /\/n\d+[a-z0-9]*\/(\d+)(?:\/|$)/i;
/** 連載エピソードの初回公開日時（YYYY/MM/DD HH:mm または YYYY/MM/DD） */
const DATE_REGEX = /(\d{4}\/\d{2}\/\d{2}(?:\s+\d{2}:\d{2})?)/;
/** 短編小説の掲載日（YYYY年MM月DD日 または YYYY/MM/DD） */
const JP_DATE_REGEX = /(\d{4})[年/](\d{1,2})[月/](\d{1,2})/;
/** 傍点記号（中黒・丸・ゴマ点等）のみで構成される rt テキスト */
const BOUTEN_RT_REGEX = /^[・﹅●]+$/;

/** 前書き・本編・後書きの結合区切り段落 */
const CHAPTER_SEPARATOR = "<p><br></p><p>────────────</p><p><br></p>";

/** なろう小説 API のベース URL */
const API_BASE_URL = "https://api.syosetu.com/novelapi/api/";
/** なろう小説 API の 1 ページあたり取得件数 */
const API_PAGE_LIMIT = 20;
/** なろう小説 API の開始位置上限 (st <= 2000) */
const API_MAX_START_OFFSET = 2000;

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
 * 要素内の <br> を改行文字に置換してテキストを抽出する（あらすじ整形用）
 */
function extractTextWithNewlines(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  const brs = clone.querySelectorAll("br");
  for (const br of Array.from(brs)) {
    br.replaceWith("\n");
  }
  return clone.textContent!.trim();
}

/**
 * <ruby> 内の傍点記号（・、●、﹅）を <em class="bouten"> に正規化する（AC-NR-07）
 */
function normalizeBouten(container: Element): void {
  const rubies = container.querySelectorAll("ruby");
  for (const ruby of Array.from(rubies)) {
    const rt = ruby.querySelector("rt");
    if (!rt) {
      continue;
    }
    const rtText = rt.textContent!.trim();
    if (BOUTEN_RT_REGEX.test(rtText)) {
      const rb = ruby.querySelector("rb");
      let baseText = "";
      if (rb) {
        baseText = rb.textContent!;
      } else {
        for (const child of Array.from(ruby.childNodes)) {
          if (
            child.nodeType === Node.ELEMENT_NODE &&
            ((child as Element).tagName.toLowerCase() === "rt" ||
              (child as Element).tagName.toLowerCase() === "rp")
          ) {
            continue;
          }
          if (child.textContent) {
            baseText += child.textContent;
          }
        }
      }
      baseText = baseText.trim();
      if (baseText.length > 0) {
        const em = ruby.ownerDocument.createElement("em");
        em.className = "bouten";
        em.textContent = baseText;
        ruby.replaceWith(em);
      }
    }
  }
}

/**
 * セクション（前書き・本編・後書き）の HTML を抽出・傍点正規化する
 */
function extractSectionHtml(
  doc: Document,
  selectors: readonly string[],
): string | null {
  const el = queryFirst(doc, selectors);
  if (!el) {
    return null;
  }
  const text = el.textContent!.trim();
  if (text.length === 0) {
    return null;
  }
  const clone = el.cloneNode(true) as Element;
  normalizeBouten(clone);
  return clone.innerHTML.trim();
}

/**
 * アンカー要素から絶対 URL を安全に抽出する
 */
function extractAbsoluteUrl(
  doc: Document,
  selectors: readonly string[],
  baseUrl: string,
): string | null {
  const el = queryFirst<HTMLAnchorElement>(doc, selectors);
  const href = el?.getAttribute("href");
  if (!href) {
    return null;
  }
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * pageUrl から開始位置 st、現在ページ番号 currentPage、および order を算出する
 */
function parseApiUrlParams(pageUrl: string): {
  st: number;
  currentPage: number;
  order: string;
} {
  let st = 1;
  let currentPage = 1;
  let order = "weeklypoint";
  try {
    const url = new URL(pageUrl, API_BASE_URL);
    order = url.searchParams.get("order") ?? "weeklypoint";
    const stParam = url.searchParams.get("st");
    if (stParam) {
      const parsed = parseInt(stParam, 10);
      if (!Number.isNaN(parsed) && parsed >= 1) {
        st = parsed;
        currentPage = Math.floor((st - 1) / API_PAGE_LIMIT) + 1;
      }
    } else {
      const pageParam = url.searchParams.get("page");
      if (pageParam) {
        const parsed = parseInt(pageParam, 10);
        if (!Number.isNaN(parsed) && parsed >= 1) {
          currentPage = parsed;
          st = (currentPage - 1) * API_PAGE_LIMIT + 1;
        }
      }
    }
  } catch {
    // fallback to default
  }
  return { st, currentPage, order };
}

/**
 * なろう小説 API の1作品エントリを共通オブジェクトに変換する
 */
function parseNovelEntry(
  entry: unknown,
  order?: string,
): NovelSearchResultItem | null {
  if (!entry || typeof entry !== "object" || !("ncode" in entry)) {
    return null;
  }
  const rec = entry as Record<string, unknown>;
  if (typeof rec.ncode !== "string" && typeof rec.ncode !== "number") {
    return null;
  }
  const rawNcode = String(rec.ncode).trim();
  if (!rawNcode) {
    return null;
  }

  const remoteWorkId = rawNcode.toLowerCase();
  const title = String(rec.title ?? "").trim();
  const author = String(rec.writer ?? "").trim();
  const synopsis = String(rec.story ?? "").trim();
  const genre = String(rec.genre ?? "");
  const genreLabel = getNarouGenreLabel(genre);

  let serialStatus: "running" | "completed";
  let serialStatusLabel: string;
  if (rec.end === 1) {
    serialStatus = "running";
    serialStatusLabel = "連載中";
  } else if (rec.end === 0 && rec.novel_type === 2) {
    serialStatus = "completed";
    serialStatusLabel = "短編";
  } else {
    serialStatus = "completed";
    serialStatusLabel = "完結済";
  }

  const episodeCount = Number(rec.general_all_no) || 1;
  const characterCount = Number(rec.length) || 0;
  const rawKeyword = String(rec.keyword ?? "").trim();
  const tags = rawKeyword ? rawKeyword.split(/\s+/).filter(Boolean) : [];

  let periodPoint: unknown;
  if (order === "dailypoint") {
    periodPoint = rec.daily_point;
  } else if (order === "weeklypoint") {
    periodPoint = rec.weekly_point;
  } else if (order === "monthlypoint") {
    periodPoint = rec.monthly_point;
  }

  const reviewPoints = Number(periodPoint ?? rec.global_point) || 0;

  const lastEpisodePublishedAt =
    typeof rec.general_lastup === "string" && rec.general_lastup.trim()
      ? rec.general_lastup.trim()
      : null;
  const workUrl = `https://ncode.syosetu.com/${remoteWorkId}/`;

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
 * 除外キーワード文字列をトークン分割し、先頭ハイフンを除去・正規化する (v0.8 Issue #264)
 */
function parseExcludeTokens(excludeKeyword?: string): string[] {
  if (!excludeKeyword) {
    return [];
  }
  return excludeKeyword
    .split(/\s+/)
    .map((token) => token.replace(/^-+/, "").trim())
    .filter(Boolean);
}

/**
 * なろう用の検索小ジャンルコード配列を解決する（genres 優先、genre フォールバック、重複排除） (v0.8 Issue #264)
 */
function resolveNarouGenres(options?: NovelSearchOptions): string[] {
  if (options?.genres !== undefined) {
    return Array.from(
      new Set(options.genres.map((g) => g.trim()).filter(Boolean)),
    );
  }
  if (options?.genre && options.genre.trim()) {
    return [options.genre.trim()];
  }
  return [];
}

/**
 * 小説家になろう（ncode.syosetu.com）向け小説パーサー
 * DOMParser を用いた決定論的 DOM トラバーサル処理（外部ネットワーク通信なし）
 */
export class NarouParser implements NovelParser {
  readonly siteType: NovelSiteType = "narou";

  /**
   * 指定された URL が小説家になろう（ncode.syosetu.com）の対象 URL か判定する (AC-NR-01)
   *
   * @param url 検証対象の URL 文字列
   * @returns なろう作品またはエピソード URL の場合 true
   */
  canParse(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return false;
      }
      if (parsed.hostname.toLowerCase() !== "ncode.syosetu.com") {
        return false;
      }
      if (parsed.pathname.toLowerCase().startsWith("/novelview/")) {
        return false;
      }
      return NCODE_PATH_REGEX.test(parsed.pathname);
    } catch {
      return false;
    }
  }

  /**
   * 作品トップ URL、エピソード URL 等から小文字 ncode ＋ 末尾スラッシュの正規化 URL を生成する (AC-NR-01)
   *
   * @param url 対象 URL
   * @returns 正規化された作品トップ URL (https://ncode.syosetu.com/{ncode}/)
   * @throws 対象外 URL の場合に Error("Invalid Narou work URL")
   */
  normalizeWorkUrl(url: string): string {
    if (!this.canParse(url)) {
      throw new Error("Invalid Narou work URL");
    }
    const parsed = new URL(url);
    const match = parsed.pathname.match(NCODE_PATH_REGEX)!;
    const ncode = match[1].toLowerCase();
    return `https://ncode.syosetu.com/${ncode}/`;
  }

  /**
   * 作品トップ HTML からメタデータおよびエピソード目次リストを抽出する (AC-NR-02〜05)
   *
   * @param html 作品トップの HTML 文字列
   * @param pageUrl 取得元ページ URL
   * @returns 作品メタデータ、目次一覧、および次ページ目次 URL
   * @throws remoteWorkId が特定できない場合のエラー
   */
  parseNovelIndex(html: string, pageUrl: string): ParsedNovelIndex {
    const doc = new DOMParser().parseFromString(html, "text/html");

    // 1. remoteWorkId 抽出（pageUrl -> canonical -> og:url）
    let remoteWorkId = pageUrl.match(NCODE_ANY_REGEX)?.[1]?.toLowerCase() ?? "";

    if (!remoteWorkId) {
      const canonical = doc
        .querySelector<HTMLLinkElement>(SELECTORS.canonicalLink)
        ?.getAttribute("href");
      remoteWorkId =
        canonical?.match(NCODE_ANY_REGEX)?.[1]?.toLowerCase() ?? "";
    }

    if (!remoteWorkId) {
      const ogUrl = doc
        .querySelector<HTMLMetaElement>(SELECTORS.ogUrl)
        ?.getAttribute("content");
      remoteWorkId = ogUrl?.match(NCODE_ANY_REGEX)?.[1]?.toLowerCase() ?? "";
    }

    if (!remoteWorkId) {
      throw new Error("Cannot extract remoteWorkId from URL or HTML");
    }

    const canonicalUrl = `https://ncode.syosetu.com/${remoteWorkId}/`;

    // 2. タイトル抽出
    const titleEl = queryFirst(doc, SELECTORS.title);
    let title = "";
    if (titleEl) {
      if (titleEl.tagName.toLowerCase() === "meta") {
        title = (titleEl.getAttribute("content") ?? "").trim();
      } else {
        title = titleEl.textContent!.trim();
      }
    }

    // 3. 著者名抽出（「作者：」プレフィックス除去）
    const authorEl = queryFirst(doc, SELECTORS.author);
    let author = "";
    if (authorEl) {
      const rawAuthor =
        authorEl.tagName.toLowerCase() === "meta"
          ? (authorEl.getAttribute("content") ?? "")
          : authorEl.textContent!;
      author = rawAuthor.replace(/^作者[：:]\s*/, "").trim();
    }

    // 4. あらすじ抽出（<br> -> \n 置換、description 末尾の共通文言除去）
    const synopsisEl = queryFirst(doc, SELECTORS.synopsis);
    let synopsis = "";
    if (synopsisEl) {
      if (synopsisEl.tagName.toLowerCase() === "meta") {
        const rawContent = synopsisEl.getAttribute("content") ?? "";
        synopsis = rawContent
          .replace(/\s*\/\/\s*無料オンライン小説です.*$/, "")
          .trim();
      } else {
        synopsis = extractTextWithNewlines(synopsisEl);
      }
    }

    // 5. 次ページ目次 URL (nextTocPageUrl) 抽出と同一作品・プロトコル検証 (AC-NR-04)
    let nextTocPageUrl: string | null = null;
    const resolvedNextUrl = extractAbsoluteUrl(
      doc,
      SELECTORS.nextTocPage,
      pageUrl,
    );
    if (
      resolvedNextUrl &&
      resolvedNextUrl.startsWith("https:") &&
      this.canParse(resolvedNextUrl) &&
      this.normalizeWorkUrl(resolvedNextUrl) === canonicalUrl
    ) {
      nextTocPageUrl = resolvedNextUrl;
    }

    // 6. 目次エピソードリスト走査（章見出し PartTitle 紐付け・初回公開日時抽出）
    const chapters: ParsedTocItem[] = [];
    let chapterIndex = 1;
    const tocContainer = doc.querySelector(".p-eplist, .index_box");

    if (tocContainer) {
      const items = tocContainer.querySelectorAll(
        ".p-eplist__chapter-title, .p-eplist__sublist, .chapter_title, .novel_sublist2",
      );
      let currentPartTitle: string | null = null;

      for (const item of Array.from(items)) {
        const isChapterTitle =
          item.classList.contains("p-eplist__chapter-title") ||
          item.classList.contains("chapter_title");

        if (isChapterTitle) {
          const text = item.textContent!.trim();
          currentPartTitle = text.length > 0 ? text : null;
        } else {
          const link = item.querySelector<HTMLAnchorElement>(
            "a.p-eplist__subtitle, .subtitle a, a",
          );
          if (!link) {
            continue;
          }
          const href = link.getAttribute("href") ?? "";
          const chapterMatch = href.match(CHAPTER_ID_REGEX);
          const remoteChapterId = chapterMatch ? chapterMatch[1] : "";
          const chapterTitle = link.textContent!.trim();
          const chapterUrl = `https://ncode.syosetu.com/${remoteWorkId}/${remoteChapterId}/`;

          const updateEl = item.querySelector(
            ".p-eplist__update, .long_update",
          );
          const dateMatch = updateEl?.textContent?.match(DATE_REGEX);
          const publishedAt = dateMatch ? dateMatch[1] : null;

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

    // 7. 短編作品（1話完結）判定と擬似1話目次生成 (AC-NR-05)
    if (chapters.length === 0) {
      const hasBody = Boolean(
        doc.querySelector(".p-novel__body, #novel_honbun"),
      );
      if (hasBody) {
        let publishedAt: string | null = null;
        const datePublishedEl = doc.querySelector(".p-novel__date-published");
        const dateMatch = datePublishedEl?.textContent?.match(JP_DATE_REGEX);
        if (dateMatch) {
          const y = dateMatch[1];
          const m = dateMatch[2].padStart(2, "0");
          const d = dateMatch[3].padStart(2, "0");
          publishedAt = `${y}/${m}/${d}`;
        }

        chapters.push({
          chapterIndex: 1,
          remoteChapterId: "1",
          partTitle: null,
          title,
          url: canonicalUrl,
          publishedAt,
        });
        nextTocPageUrl = null;
      }
    }

    return {
      siteType: "narou",
      remoteWorkId,
      canonicalUrl,
      title,
      author,
      synopsis,
      chapters,
      nextTocPageUrl,
    };
  }

  /**
   * 各話 HTML から整形・サニタイズ済み本文および前後の移動リンクを抽出する (AC-NR-06〜09)
   *
   * @param html 各話 HTML 文字列
   * @param pageUrl 取得元ページ URL
   * @returns サニタイズ済み本文データ
   */
  parseChapterContent(html: string, pageUrl: string): ParsedChapterContent {
    const doc = new DOMParser().parseFromString(html, "text/html");

    // 1. remoteChapterId 抽出（各話エピソード番号または短編トップ "1"）
    let remoteChapterId = "";
    const epMatch = pageUrl.match(CHAPTER_ID_REGEX);
    if (epMatch) {
      remoteChapterId = epMatch[1];
    } else {
      const workMatch = pageUrl.match(NCODE_ANY_REGEX);
      if (workMatch) {
        remoteChapterId = "1";
      }
    }

    // 2. サブタイトル抽出
    const titleEl = queryFirst(doc, SELECTORS.chapterTitle);
    const title = titleEl ? titleEl.textContent!.trim() : "";

    // 3. 前書き・本編・後書き抽出と区切り段落結合 (AC-NR-06, 07, 08)
    const parts: string[] = [];

    const prefaceHtml = extractSectionHtml(doc, SELECTORS.preface);
    if (prefaceHtml) {
      parts.push(prefaceHtml);
    }

    const mainBodyHtml = extractSectionHtml(doc, SELECTORS.mainBody);
    if (mainBodyHtml) {
      parts.push(mainBodyHtml);
    }

    const afterwordHtml = extractSectionHtml(doc, SELECTORS.afterword);
    if (afterwordHtml) {
      parts.push(afterwordHtml);
    }

    const rawCombinedHtml = parts.join(CHAPTER_SEPARATOR);
    const bodyHtml = sanitizeChapterHtml(rawCombinedHtml);
    const byteSize = new TextEncoder().encode(bodyHtml).length;

    // 4. 前後リンク抽出 (AC-NR-09)
    const prevChapterUrl = extractAbsoluteUrl(
      doc,
      SELECTORS.prevChapter,
      pageUrl,
    );
    const nextChapterUrl = extractAbsoluteUrl(
      doc,
      SELECTORS.nextChapter,
      pageUrl,
    );

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
   * 検索 URL を構築する (AC-NR-11)
   *
   * @param query 検索キーワード
   * @param options 検索オプション
   * @returns なろう小説 API 検索 URL
   */
  buildSearchUrl(query: string, options?: NovelSearchOptions): string {
    const url = new URL(API_BASE_URL);
    url.searchParams.set("out", "json");
    url.searchParams.set("lim", String(API_PAGE_LIMIT));

    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      url.searchParams.set("word", trimmedQuery);
    }

    const excludeTokens = parseExcludeTokens(options?.excludeKeyword);
    if (excludeTokens.length > 0) {
      url.searchParams.set("notword", excludeTokens.join(" "));
    }

    const orderMap: Record<NovelSearchOrder, string> = {
      weekly_ranking: "weeklypoint",
      popular: "hyoka",
      last_episode_published_at: "new",
      published_at: "generalfirstup",
    };
    const order = options?.order ?? "weekly_ranking";
    const orderParam = orderMap[order];
    url.searchParams.set("order", orderParam);

    if (options?.serialStatus === "running") {
      url.searchParams.set("type", "r");
    } else if (options?.serialStatus === "completed") {
      url.searchParams.set("type", "ter");
    }

    const genres = resolveNarouGenres(options);
    if (genres.length > 0) {
      url.searchParams.set("genre", genres.join("-"));
    }

    if (options?.page !== undefined && options.page >= 2) {
      const st = (options.page - 1) * API_PAGE_LIMIT + 1;
      url.searchParams.set("st", String(st));
    }

    return url.toString();
  }

  /**
   * 検索結果 JSON を解析する (AC-NR-12)
   *
   * @param html なろう小説 API の JSON 文字列
   * @param pageUrl 取得元ページ URL
   * @returns 検索結果一覧およびページ情報
   */
  searchNovels(html: string, pageUrl: string): ParsedSearchResult {
    const { st, currentPage } = parseApiUrlParams(pageUrl);

    let data: unknown;
    try {
      data = JSON.parse(html);
    } catch {
      return {
        items: [],
        pageInfo: {
          currentPage,
          hasNextPage: false,
          totalCount: 0,
        },
      };
    }

    if (!Array.isArray(data) || data.length === 0) {
      return {
        items: [],
        pageInfo: {
          currentPage,
          hasNextPage: false,
          totalCount: 0,
        },
      };
    }

    const header = data[0] as Record<string, unknown> | undefined;
    const totalCount =
      typeof header?.allcount === "number" ? header.allcount : 0;

    const items: NovelSearchResultItem[] = [];
    const entries = data.slice(1);

    for (const entry of entries) {
      const item = parseNovelEntry(entry);
      if (item) {
        items.push(item);
      }
    }

    const nextSt = st + API_PAGE_LIMIT;
    const hasNextPage =
      items.length > 0 &&
      st + items.length - 1 < totalCount &&
      nextSt <= API_MAX_START_OFFSET;

    return {
      items,
      pageInfo: {
        currentPage,
        hasNextPage,
        totalCount,
      },
    };
  }

  /**
   * ランキング URL を構築する (AC-NR-13)
   *
   * @param options ランキングオプション
   * @returns なろう小説 API ランキング URL
   */
  buildRankingUrl(options?: NovelRankingOptions): string {
    const url = new URL(API_BASE_URL);
    url.searchParams.set("out", "json");
    url.searchParams.set("lim", String(API_PAGE_LIMIT));

    const periodMap: Record<NovelRankingPeriod, string> = {
      daily: "dailypoint",
      weekly: "weeklypoint",
      monthly: "monthlypoint",
      entire: "hyoka",
    };
    const period = options?.period ?? "weekly";
    const orderParam = periodMap[period];
    url.searchParams.set("order", orderParam);

    if (options?.genre && options.genre !== "all" && options.genre.trim()) {
      url.searchParams.set("genre", options.genre.trim());
    }

    if (options?.page !== undefined && options.page >= 2) {
      const st = (options.page - 1) * API_PAGE_LIMIT + 1;
      url.searchParams.set("st", String(st));
    }

    return url.toString();
  }

  /**
   * ランキング結果 JSON を解析する (AC-NR-14)
   *
   * @param html なろう小説 API の JSON 文字列
   * @param pageUrl 取得元ページ URL
   * @returns ランキング結果一覧およびページ情報
   */
  getRanking(html: string, pageUrl: string): ParsedRankingResult {
    const { st, currentPage, order } = parseApiUrlParams(pageUrl);

    let data: unknown;
    try {
      data = JSON.parse(html);
    } catch {
      return {
        items: [],
        pageInfo: {
          currentPage,
          hasNextPage: false,
        },
      };
    }

    if (!Array.isArray(data) || data.length === 0) {
      return {
        items: [],
        pageInfo: {
          currentPage,
          hasNextPage: false,
        },
      };
    }

    const header = data[0] as Record<string, unknown> | undefined;
    const totalCount =
      typeof header?.allcount === "number" ? header.allcount : 0;

    const items: NovelRankingResultItem[] = [];
    const entries = data.slice(1);

    for (const entry of entries) {
      const item = parseNovelEntry(entry, order);
      if (item) {
        const rank = st + items.length;
        items.push({
          ...item,
          rank,
        });
      }
    }

    const nextSt = st + API_PAGE_LIMIT;
    const hasNextPage =
      items.length > 0 &&
      st + items.length - 1 < totalCount &&
      nextSt <= API_MAX_START_OFFSET;

    return {
      items,
      pageInfo: {
        currentPage,
        hasNextPage,
      },
    };
  }
}

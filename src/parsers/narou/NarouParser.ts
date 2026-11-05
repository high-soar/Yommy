import type {
  NovelParser,
  NovelSiteType,
  ParsedChapterContent,
  ParsedNovelIndex,
  ParsedTocItem,
} from "../types";
import { sanitizeChapterHtml } from "../sanitizer";

/**
 * なろう DOM セレクタ定数（優先順位リスト）
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

const NCODE_PATH_REGEX = /^\/(n\d+[a-z0-9]*)(?:\/|$)/i;
const NCODE_ANY_REGEX = /\/(n\d+[a-z0-9]*)(?:\/|$)/i;
const CHAPTER_ID_REGEX = /\/n\d+[a-z0-9]*\/(\d+)(?:\/|$)/i;
const DATE_REGEX = /(\d{4}\/\d{2}\/\d{2}(?:\s+\d{2}:\d{2})?)/;
const JP_DATE_REGEX = /(\d{4})[年/](\d{1,2})[月/](\d{1,2})/;
const BOUTEN_RT_REGEX = /^[・﹅●]+$/;

const CHAPTER_SEPARATOR = "<p><br></p><p>────────────</p><p><br></p>";

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
 * 要素内の <br> を改行文字に置換してテキストを抽出する
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
 * <ruby> 内の傍点記号を <em class="bouten"> に正規化する
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
 * セクション（前書き・本編・後書き）の HTML を抽出・正規化する
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
 * 小説家になろう（ncode.syosetu.com）向け小説パーサー
 * DOMParser を用いた決定論的 DOM トラバーサル処理（外部ネットワーク通信なし）
 */
export class NarouParser implements NovelParser {
  readonly siteType: NovelSiteType = "narou";

  /**
   * 指定された URL が小説家になろう（ncode.syosetu.com）の対象 URL か判定する
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
   * 作品トップ URL、エピソード URL 等から作品トップの正規化 URL を生成する
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
   * 作品トップ HTML からメタデータおよびエピソード目次リストを抽出する
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

    // 3. 著者名抽出
    const authorEl = queryFirst(doc, SELECTORS.author);
    let author = "";
    if (authorEl) {
      const rawAuthor =
        authorEl.tagName.toLowerCase() === "meta"
          ? (authorEl.getAttribute("content") ?? "")
          : authorEl.textContent!;
      author = rawAuthor.replace(/^作者[：:]\s*/, "").trim();
    }

    // 4. あらすじ抽出
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

    // 5. 次ページ目次 URL (nextTocPageUrl) 抽出
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

    // 6. 目次エピソードリスト走査
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

    // 7. 短編作品（1話完結）判定
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
   * 各話 HTML から整形・サニタイズ済み本文および前後の移動リンクを抽出する
   */
  parseChapterContent(html: string, pageUrl: string): ParsedChapterContent {
    const doc = new DOMParser().parseFromString(html, "text/html");

    // 1. remoteChapterId 抽出
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

    // 3. 前書き・本編・後書き抽出と結合
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

    // 4. 前後リンク抽出
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
}

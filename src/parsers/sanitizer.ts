/**
 * 許可する HTML タグのセット
 * リーダー画面での安全かつ統一された組版表示（vertical-rl / horizontal-tb）のため
 */
const ALLOWED_TAGS = new Set(["p", "br", "ruby", "rb", "rt", "rp", "em"]);

/**
 * 危険とみなされ、中身ごと完全に除去する HTML タグのセット
 */
const DANGEROUS_TAGS = new Set([
  "script",
  "iframe",
  "style",
  "object",
  "embed",
  "link",
  "meta",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "svg",
  "canvas",
  "video",
  "audio",
  "noscript",
  "template",
  "applet",
  "base",
  "frame",
  "frameset",
]);

/**
 * ノードを再帰的にサニタイズ・整形するヘルパー関数
 */
function cleanNode(node: Node): void {
  // HTML コメントノードは除去
  if (node.nodeType === Node.COMMENT_NODE) {
    node.parentNode?.removeChild(node);
    return;
  }

  // 要素ノード以外（テキストノード等）はそのまま保持
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const el = node as HTMLElement;
  const tagName = el.tagName.toLowerCase();

  // 危険タグは子要素ごと完全削除
  if (DANGEROUS_TAGS.has(tagName)) {
    el.remove();
    return;
  }

  // 子ノードを再帰的に処理（後順走査）
  const children = Array.from(el.childNodes);
  for (const child of children) {
    cleanNode(child);
  }

  // 許可タグの場合の属性フィルタリング
  if (ALLOWED_TAGS.has(tagName)) {
    if (tagName === "em") {
      const hasBouten = el.classList.contains("bouten");
      while (el.attributes.length > 0) {
        el.removeAttribute(el.attributes[0].name);
      }
      if (hasBouten) {
        el.setAttribute("class", "bouten");
      }
    } else {
      while (el.attributes.length > 0) {
        el.removeAttribute(el.attributes[0].name);
      }
      // 空の段落を <p><br></p> に統一
      if (tagName === "p") {
        if (el.childNodes.length === 0 || el.innerHTML.trim() === "") {
          el.innerHTML = "<br>";
        }
      }
    }
  } else {
    // 許可されていないタグは unwrap（子ノードで自身を置換）
    el.replaceWith(...Array.from(el.childNodes));
  }
}

/**
 * 小説各話本文 HTML のサニタイザー
 */
export class HtmlSanitizer {
  /**
   * 各話本文 HTML 文字列をサニタイズ・正規化する
   *
   * @param html サニタイズ対象の HTML 文字列
   * @returns 許可タグのみで構成された安全な HTML 文字列
   */
  static sanitizeChapterHtml(html: string): string {
    if (!html || html.trim() === "") {
      return "";
    }

    const doc = new DOMParser().parseFromString(html, "text/html");

    // body 直下のノードを再帰的にサニタイズ
    const bodyChildren = Array.from(doc.body.childNodes);
    for (const child of bodyChildren) {
      cleanNode(child);
    }

    return doc.body.innerHTML.trim();
  }
}

/**
 * 各話本文 HTML をサニタイズするショートカット関数
 */
export function sanitizeChapterHtml(html: string): string {
  return HtmlSanitizer.sanitizeChapterHtml(html);
}

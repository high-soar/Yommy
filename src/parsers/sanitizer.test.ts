import { describe, it, expect } from "vitest";
import { HtmlSanitizer, sanitizeChapterHtml } from "./sanitizer";

describe("HtmlSanitizer", () => {
  describe("許可タグと属性の保持・整形", () => {
    it("許可タグ（p, br, ruby, rb, rt, rp）を保持し属性を除去すること (AC-04)", () => {
      const input =
        '<p class="intro" id="p1" style="color:red">青い空に、<ruby class="r"><rb>太陽</rb><rp>(</rp><rt class="ruby-text">たいよう</rt><rp>)</rp></ruby>が輝いていた。<br class="break"></p>';
      const expected =
        "<p>青い空に、<ruby><rb>太陽</rb><rp>(</rp><rt>たいよう</rt><rp>)</rp></ruby>が輝いていた。<br></p>";
      expect(HtmlSanitizer.sanitizeChapterHtml(input)).toBe(expected);
      expect(sanitizeChapterHtml(input)).toBe(expected);
    });

    it("em タグについて class='bouten' のみ許可し他の属性や不要クラスを除去すること (AC-04)", () => {
      const input =
        '<p>それは<em class="bouten highlight" id="e1" style="font-weight:bold" data-test="val">信じがたい光景</em>であった。</p>';
      const expected =
        '<p>それは<em class="bouten">信じがたい光景</em>であった。</p>';
      expect(HtmlSanitizer.sanitizeChapterHtml(input)).toBe(expected);
    });

    it("bouten クラスを持たない em タグの全属性を除去してタグ自体は保持すること", () => {
      const input = '<p><em class="emphasis" style="color:blue">強調</em></p>';
      const expected = "<p><em>強調</em></p>";
      expect(HtmlSanitizer.sanitizeChapterHtml(input)).toBe(expected);
    });
  });

  describe("危険タグと XSS 攻撃コードの完全除去 (AC-05)", () => {
    it("script, iframe, style, object, embed, link, meta タグを中身ごと完全に除去すること", () => {
      const input = `
        <script>alert("xss");</script>
        <style>body { display: none; }</style>
        <p>安全な本文</p>
        <iframe src="https://evil.com">危険なフレーム</iframe>
        <object data="malware.swf"><param name="foo" value="bar"></object>
        <embed src="malware.swf">
        <link rel="stylesheet" href="evil.css">
        <meta http-equiv="refresh" content="0;url=evil.com">
      `;
      const result = HtmlSanitizer.sanitizeChapterHtml(input);
      expect(result).toBe("<p>安全な本文</p>");
      expect(result).not.toContain("alert");
      expect(result).not.toContain("script");
      expect(result).not.toContain("iframe");
      expect(result).not.toContain("style");
      expect(result).not.toContain("evil.com");
    });

    it("form, input, button, textarea, select 等のフォーム要素を中身ごと完全に除去すること", () => {
      const input =
        '<p>本文</p><form action="/steal"><input type="text" name="pw" value="1234"><button type="submit">送信</button></form>';
      expect(HtmlSanitizer.sanitizeChapterHtml(input)).toBe("<p>本文</p>");
    });

    it("要素上のすべての on* イベントハンドラ属性を除去すること", () => {
      const input =
        '<p onclick="steal()" onmouseover="evil()" onload="run()">段落本文</p>';
      expect(HtmlSanitizer.sanitizeChapterHtml(input)).toBe("<p>段落本文</p>");
    });

    it("HTML コメントノードを除去すること", () => {
      const input = "<p>本文<!-- コメント -->の続き</p>";
      expect(HtmlSanitizer.sanitizeChapterHtml(input)).toBe(
        "<p>本文の続き</p>",
      );
    });
  });

  describe("未許可タグの展開（unwrap）", () => {
    it("div, span, a, b, strong 等の未許可タグを除去しテキストおよび許可された子要素を残すこと", () => {
      const input =
        '<div><span class="text">テキスト</span>と<a href="javascript:alert(1)"><b>太字</b>と<strong>ルビ<ruby><rt>るび</rt></ruby></strong></a></div>';
      const expected = "テキストと太字とルビ<ruby><rt>るび</rt></ruby>";
      expect(HtmlSanitizer.sanitizeChapterHtml(input)).toBe(expected);
    });

    it("子要素を持たない未許可要素（img 等）が完全に除去されること", () => {
      const input = '<p>画像の前<img src="x" onerror="alert(1)">画像の後</p>';
      expect(HtmlSanitizer.sanitizeChapterHtml(input)).toBe(
        "<p>画像の前画像の後</p>",
      );
    });
  });

  describe("空行・段落の正規化", () => {
    it("カクヨムの空行（<p class='blank'><br></p>）を <p><br></p> に統一すること", () => {
      const input = '<p class="blank"><br></p>';
      expect(HtmlSanitizer.sanitizeChapterHtml(input)).toBe("<p><br></p>");
    });

    it("中身が空の p タグを <p><br></p> に統一すること", () => {
      const input = "<p></p><p>   </p>";
      expect(HtmlSanitizer.sanitizeChapterHtml(input)).toBe(
        "<p><br></p><p><br></p>",
      );
    });

    it("空文字または空白のみの入力に対して空文字を返すこと", () => {
      expect(HtmlSanitizer.sanitizeChapterHtml("")).toBe("");
      expect(HtmlSanitizer.sanitizeChapterHtml("   \n\t  ")).toBe("");
    });
  });
});

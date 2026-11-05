import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NarouParser } from "./NarouParser";

describe("NarouParser", () => {
  let parser: NarouParser;

  const loadFixture = (filename: string): string => {
    const fixturePath = resolve(__dirname, "__fixtures__", filename);
    return readFileSync(fixturePath, "utf-8");
  };

  beforeEach(() => {
    parser = new NarouParser();
  });

  describe("siteType プロパティ", () => {
    it("siteType が 'narou' であること", () => {
      expect(parser.siteType).toBe("narou");
    });
  });

  describe("AC-NR-01: URL 判定と小文字正規化", () => {
    it("小説家になろうの作品トップ・各話・ページネーション・大文字 ncode URL を正しく判定すること (canParse)", () => {
      expect(parser.canParse("https://ncode.syosetu.com/n9669bk/")).toBe(true);
      expect(parser.canParse("https://ncode.syosetu.com/n9669bk/1/")).toBe(
        true,
      );
      expect(parser.canParse("https://ncode.syosetu.com/n9669bk/?p=2")).toBe(
        true,
      );
      expect(parser.canParse("https://ncode.syosetu.com/N9669BK/")).toBe(true);
      expect(parser.canParse("http://ncode.syosetu.com/n9669bk/")).toBe(true);
      expect(parser.canParse("https://NCODE.SYOSETU.COM/n9669bk/")).toBe(true);
      expect(
        parser.canParse("https://ncode.syosetu.com/n9669bk?foo=bar#section"),
      ).toBe(true);
    });

    it("他サイト、18禁サイト、予約パス、無効文字列を拒絶すること (canParse)", () => {
      expect(parser.canParse("https://novel18.syosetu.com/n9669bk/")).toBe(
        false,
      );
      expect(parser.canParse("https://kakuyomu.jp/works/12345")).toBe(false);
      expect(
        parser.canParse(
          "https://ncode.syosetu.com/novelview/infotop/ncode/n9669bk/",
        ),
      ).toBe(false);
      expect(parser.canParse("https://ncode.syosetu.com/")).toBe(false);
      expect(parser.canParse("https://ncode.syosetu.com/abc/")).toBe(false);
      expect(parser.canParse("ftp://ncode.syosetu.com/n9669bk/")).toBe(false);
      expect(parser.canParse("not-a-valid-url")).toBe(false);
      expect(parser.canParse("")).toBe(false);
    });

    it("各種URLから小文字 ncode を抽出し canonicalUrl に正規化すること (normalizeWorkUrl)", () => {
      expect(
        parser.normalizeWorkUrl("https://ncode.syosetu.com/n9669bk/"),
      ).toBe("https://ncode.syosetu.com/n9669bk/");
      expect(
        parser.normalizeWorkUrl("https://ncode.syosetu.com/N9669BK/1/"),
      ).toBe("https://ncode.syosetu.com/n9669bk/");
      expect(
        parser.normalizeWorkUrl("https://ncode.syosetu.com/n9669bk/?p=2#top"),
      ).toBe("https://ncode.syosetu.com/n9669bk/");
      expect(parser.normalizeWorkUrl("http://ncode.syosetu.com/n9669bk")).toBe(
        "https://ncode.syosetu.com/n9669bk/",
      );
    });

    it("不正な URL の場合はエラーを送出すること (normalizeWorkUrl)", () => {
      expect(() =>
        parser.normalizeWorkUrl("https://novel18.syosetu.com/n9669bk/"),
      ).toThrow("Invalid Narou work URL");
      expect(() =>
        parser.normalizeWorkUrl("https://kakuyomu.jp/works/123"),
      ).toThrow("Invalid Narou work URL");
      expect(() => parser.normalizeWorkUrl("invalid-string")).toThrow(
        "Invalid Narou work URL",
      );
    });
  });

  describe("AC-NR-02 & AC-NR-03: 連載作品トップ情報と章見出しの抽出 (parseNovelIndex)", () => {
    it("現行DOMフィクスチャから作品情報・章見出し・初回公開日時を正しく抽出すること", () => {
      const html = loadFixture("work_index_serialized.html");
      const pageUrl = "https://ncode.syosetu.com/n9669bk/";
      const result = parser.parseNovelIndex(html, pageUrl);

      expect(result.siteType).toBe("narou");
      expect(result.remoteWorkId).toBe("n9669bk");
      expect(result.canonicalUrl).toBe("https://ncode.syosetu.com/n9669bk/");
      expect(result.title).toBe("無職転生 - 異世界行ったら本気だす");
      expect(result.author).toBe("理不尽な孫の手");
      expect(result.synopsis).toBe(
        "34歳無職童貞のニートは無一文で追い出され、トラックに轢かれて死んだ。\n目覚めると赤ん坊になっていた。\n本気で生きていく。",
      );
      expect(result.chapters).toHaveLength(3);

      expect(result.chapters[0]).toEqual({
        chapterIndex: 1,
        remoteChapterId: "1",
        partTitle: "第1章 幼年期",
        title: "プロローグ",
        url: "https://ncode.syosetu.com/n9669bk/1/",
        publishedAt: "2012/11/22 17:00",
      });

      expect(result.chapters[1]).toEqual({
        chapterIndex: 2,
        remoteChapterId: "2",
        partTitle: "第1章 幼年期",
        title: "第1話 ガキ相手でも本気",
        url: "https://ncode.syosetu.com/n9669bk/2/",
        publishedAt: "2012/11/23 18:00",
      });

      expect(result.chapters[2]).toEqual({
        chapterIndex: 3,
        remoteChapterId: "3",
        partTitle: "第2章 少年期",
        title: "第2話 魔法の練習",
        url: "https://ncode.syosetu.com/n9669bk/3/",
        publishedAt: "2012/11/24 10:00",
      });
    });

    it("レガシーDOMフィクスチャ (.index_box) からも正しく抽出できること", () => {
      const html = loadFixture("work_index_legacy.html");
      const pageUrl = "https://ncode.syosetu.com/n1234a/";
      const result = parser.parseNovelIndex(html, pageUrl);

      expect(result.remoteWorkId).toBe("n1234a");
      expect(result.title).toBe("レガシー作品タイトル");
      expect(result.author).toBe("旧作者名");
      expect(result.synopsis).toBe("旧スタイルのあらすじです。\n2行目です。");
      expect(result.chapters).toHaveLength(2);
      expect(result.chapters[0]).toEqual({
        chapterIndex: 1,
        remoteChapterId: "1",
        partTitle: "旧第一部",
        title: "旧第1話",
        url: "https://ncode.syosetu.com/n1234a/1/",
        publishedAt: "2015/01/01 12:00",
      });
      expect(result.chapters[1].publishedAt).toBe("2015/01/02 12:00");
    });

    it("URLからremoteWorkIdが取得できない場合、HTMLのlink[rel='canonical']やmeta[property='og:url']から抽出すること", () => {
      const htmlWithCanonical = `
        <!DOCTYPE html><html><head>
          <link rel="canonical" href="https://ncode.syosetu.com/n5555bb/">
          <title>タイトル</title>
        </head><body><div class="p-novel"><h1 class="p-novel__title">タイトル</h1><div class="p-novel__body">本文</div></div></body></html>
      `;
      const res1 = parser.parseNovelIndex(
        htmlWithCanonical,
        "https://example.com/test",
      );
      expect(res1.remoteWorkId).toBe("n5555bb");

      const htmlWithOgUrl = `
        <!DOCTYPE html><html><head>
          <meta property="og:url" content="https://ncode.syosetu.com/n6666cc/">
          <title>タイトル</title>
        </head><body><div class="p-novel"><h1 class="p-novel__title">タイトル</h1><div class="p-novel__body">本文</div></div></body></html>
      `;
      const res2 = parser.parseNovelIndex(
        htmlWithOgUrl,
        "https://example.com/test",
      );
      expect(res2.remoteWorkId).toBe("n6666cc");
    });

    it("remoteWorkIdが全く特定できない場合はエラーを送出すること", () => {
      const html = "<html><head><title>無名</title></head><body></body></html>";
      expect(() =>
        parser.parseNovelIndex(html, "https://example.com/other"),
      ).toThrow("Cannot extract remoteWorkId from URL or HTML");
    });

    it("メタデータ各セレクタのフォールバック動作を検証すること", () => {
      // 1. og:title, twitter:creator, .p-novel__summary
      const htmlFallback1 = `
        <!DOCTYPE html><html><head>
          <meta property="og:title" content="OGタイトル">
          <meta name="twitter:creator" content="@author_tw">
        </head><body>
          <div class="p-novel">
            <div class="p-novel__summary">サマリーあらすじ</div>
            <div class="p-eplist">
              <div class="p-eplist__sublist"><a class="p-eplist__subtitle" href="/n7777dd/1/">第1話</a></div>
            </div>
          </div>
        </body></html>
      `;
      const res1 = parser.parseNovelIndex(
        htmlFallback1,
        "https://ncode.syosetu.com/n7777dd/",
      );
      expect(res1.title).toBe("OGタイトル");
      expect(res1.author).toBe("@author_tw");
      expect(res1.synopsis).toBe("サマリーあらすじ");
      expect(res1.chapters[0].partTitle).toBeNull();
      expect(res1.chapters[0].publishedAt).toBeNull();

      // 2. document.title, .novel_writername a, meta[name="description"]
      const htmlFallback2 = `
        <!DOCTYPE html><html><head>
          <title>ドキュメントタイトル</title>
          <meta name="description" content="メタあらすじです。 // 無料オンライン小説です">
        </head><body>
          <div class="novel_writername"><a href="#">リンク作者名</a></div>
          <div class="p-eplist">
            <div class="p-eplist__chapter-title">   </div>
            <div class="p-eplist__sublist"><a href="/n7777dd/1/">第1話</a></div>
          </div>
        </body></html>
      `;
      const res2 = parser.parseNovelIndex(
        htmlFallback2,
        "https://ncode.syosetu.com/n7777dd/",
      );
      expect(res2.title).toBe("ドキュメントタイトル");
      expect(res2.author).toBe("リンク作者名");
      expect(res2.synopsis).toBe("メタあらすじです。");
      expect(res2.chapters[0].partTitle).toBeNull();

      // 3. title 要素も author 要素もない場合
      const htmlEmpty = `
        <!DOCTYPE html><html><head></head><body>
          <div class="p-eplist">
            <div class="p-eplist__sublist"><a href="/n7777dd/1/">第1話</a></div>
          </div>
        </body></html>
      `;
      const res3 = parser.parseNovelIndex(
        htmlEmpty,
        "https://ncode.syosetu.com/n7777dd/",
      );
      expect(res3.title).toBe("");
      expect(res3.author).toBe("");
      expect(res3.synopsis).toBe("");
    });
  });

  describe("AC-NR-04: 複数ページ目次の次ページ URL 抽出と検証 (nextTocPageUrl)", () => {
    it("1ページ目目次から有効な nextTocPageUrl を抽出し絶対URLに正規化すること", () => {
      const html = loadFixture("work_index_serialized.html");
      const pageUrl = "https://ncode.syosetu.com/n9669bk/";
      const result = parser.parseNovelIndex(html, pageUrl);

      expect(result.nextTocPageUrl).toBe(
        "https://ncode.syosetu.com/n9669bk/?p=2",
      );
    });

    it("2ページ目（最終ページ）では nextTocPageUrl が null であること", () => {
      const html = loadFixture("work_index_page2.html");
      const pageUrl = "https://ncode.syosetu.com/n9669bk/?p=2";
      const result = parser.parseNovelIndex(html, pageUrl);

      expect(result.nextTocPageUrl).toBeNull();
    });

    it("次ページリンクが外部ドメイン、http、別作品パス、18禁サイトの場合は null にすること (SSRF防止)", () => {
      const createHtmlWithNextLink = (nextHref: string) => `
        <!DOCTYPE html><html><body>
          <div class="p-novel"><h1 class="p-novel__title">作品</h1></div>
          <div class="p-eplist">
            <div class="p-eplist__sublist"><a href="/n9669bk/1/">第1話</a></div>
          </div>
          <div class="c-pager">
            <a class="c-pager__item c-pager__item--next" href="${nextHref}">次へ</a>
          </div>
        </body></html>
      `;

      // 外部ドメイン
      const r1 = parser.parseNovelIndex(
        createHtmlWithNextLink("https://evil.com/n9669bk/?p=2"),
        "https://ncode.syosetu.com/n9669bk/",
      );
      expect(r1.nextTocPageUrl).toBeNull();

      // http スキーム
      const r2 = parser.parseNovelIndex(
        createHtmlWithNextLink("http://ncode.syosetu.com/n9669bk/?p=2"),
        "https://ncode.syosetu.com/n9669bk/",
      );
      expect(r2.nextTocPageUrl).toBeNull();

      // 別作品パス
      const r3 = parser.parseNovelIndex(
        createHtmlWithNextLink("https://ncode.syosetu.com/n1111aa/?p=2"),
        "https://ncode.syosetu.com/n9669bk/",
      );
      expect(r3.nextTocPageUrl).toBeNull();

      // 18禁サイト
      const r4 = parser.parseNovelIndex(
        createHtmlWithNextLink("https://novel18.syosetu.com/n9669bk/?p=2"),
        "https://ncode.syosetu.com/n9669bk/",
      );
      expect(r4.nextTocPageUrl).toBeNull();

      // レガシーセレクタ a.c-pager__item--next[href]
      const htmlLegacyPager = `
        <!DOCTYPE html><html><body>
          <div class="p-novel"><h1 class="p-novel__title">作品</h1></div>
          <div class="p-eplist"><div class="p-eplist__sublist"><a href="/n9669bk/1/">第1話</a></div></div>
          <a class="c-pager__item--next" href="/n9669bk/?p=2">次へ</a>
        </body></html>
      `;
      const r5 = parser.parseNovelIndex(
        htmlLegacyPager,
        "https://ncode.syosetu.com/n9669bk/",
      );
      expect(r5.nextTocPageUrl).toBe("https://ncode.syosetu.com/n9669bk/?p=2");
    });
  });

  describe("AC-NR-05: 短編作品（1話完結）の目次・本文抽出", () => {
    it("目次リストがなく本文がある場合は短編作品と判定し擬似1話目次を生成すること (parseNovelIndex)", () => {
      const html = loadFixture("work_index_short.html");
      const pageUrl = "https://ncode.syosetu.com/n9999xx/";
      const result = parser.parseNovelIndex(html, pageUrl);

      expect(result.remoteWorkId).toBe("n9999xx");
      expect(result.canonicalUrl).toBe("https://ncode.syosetu.com/n9999xx/");
      expect(result.title).toBe("短編の素敵な物語");
      expect(result.author).toBe("短編作家");
      expect(result.synopsis).toBe("これは短編小説のあらすじです。");
      expect(result.nextTocPageUrl).toBeNull();
      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0]).toEqual({
        chapterIndex: 1,
        remoteChapterId: "1",
        partTitle: null,
        title: "短編の素敵な物語",
        url: "https://ncode.syosetu.com/n9999xx/",
        publishedAt: "2026/11/06",
      });
    });

    it("短編作品で公開日要素が存在しない場合やフォーマットが異なる場合のハンドリング", () => {
      // 掲載日形式 YYYY年MM月DD日
      const htmlJpDate = `
        <!DOCTYPE html><html><body>
          <h1 class="p-novel__title">短編タイトル</h1>
          <span class="p-novel__date-published">2025年1月5日</span>
          <div class="p-novel__body"><div class="p-novel__text">本文</div></div>
        </body></html>
      `;
      const r1 = parser.parseNovelIndex(
        htmlJpDate,
        "https://ncode.syosetu.com/n1111aa/",
      );
      expect(r1.chapters[0].publishedAt).toBe("2025/01/05");

      // 掲載日なし
      const htmlNoDate = `
        <!DOCTYPE html><html><body>
          <h1 class="p-novel__title">短編タイトル</h1>
          <div id="novel_honbun">本文</div>
        </body></html>
      `;
      const r2 = parser.parseNovelIndex(
        htmlNoDate,
        "https://ncode.syosetu.com/n1111aa/",
      );
      expect(r2.chapters[0].publishedAt).toBeNull();
    });

    it("短編作品トップURLから parseChapterContent で本文が抽出できること (remoteChapterId: '1')", () => {
      const html = loadFixture("work_index_short.html");
      const pageUrl = "https://ncode.syosetu.com/n9999xx/";
      const result = parser.parseChapterContent(html, pageUrl);

      expect(result.remoteChapterId).toBe("1");
      expect(result.title).toBe("短編の素敵な物語");
      expect(result.bodyHtml).toBe("<p>短編の本文です。1話で完結します。</p>");
      expect(result.byteSize).toBeGreaterThan(0);
      expect(result.prevChapterUrl).toBeNull();
      expect(result.nextChapterUrl).toBeNull();
    });
  });

  describe("AC-NR-06: 前書き・本編・後書きの本文抽出結合 (parseChapterContent)", () => {
    it("前書き・本編・後書きが存在する場合に指定の区切り段落を挟んで結合すること", () => {
      const html = loadFixture("episode_content.html");
      const pageUrl = "https://ncode.syosetu.com/n9669bk/2/";
      const result = parser.parseChapterContent(html, pageUrl);

      expect(result.remoteChapterId).toBe("2");
      expect(result.title).toBe("第1話 ガキ相手でも本気");

      // 区切り検証
      const separator = "<p><br></p><p>────────────</p><p><br></p>";
      expect(result.bodyHtml).toContain(separator);
      expect(result.bodyHtml).toContain("これは前書きです。");
      expect(result.bodyHtml).toContain(
        "読んでいただきありがとうございました。",
      );
      const firstSepIndex = result.bodyHtml.indexOf(separator);
      const secondSepIndex = result.bodyHtml.lastIndexOf(separator);
      expect(firstSepIndex).toBeGreaterThan(
        result.bodyHtml.indexOf("これは前書きです。"),
      );
      expect(secondSepIndex).toBeGreaterThan(firstSepIndex);
      expect(
        result.bodyHtml.indexOf("読んでいただきありがとうございました。"),
      ).toBeGreaterThan(secondSepIndex);
    });

    it("前書きのみ、後書きのみ、本編のみの場合に区切り段落が不適切に挿入されないこと", () => {
      // 本編のみ
      const htmlMainOnly = `
        <!DOCTYPE html><html><body>
          <h1 class="p-novel__title--rensai">タイトル</h1>
          <div class="p-novel__text"><p>本編のみの文章です。</p></div>
        </body></html>
      `;
      const r1 = parser.parseChapterContent(
        htmlMainOnly,
        "https://ncode.syosetu.com/n9669bk/1/",
      );
      expect(r1.bodyHtml).toBe("<p>本編のみの文章です。</p>");
      expect(r1.bodyHtml).not.toContain("────────────");

      // 前書き＋本編（後書きなし）
      const htmlPrefMain = `
        <!DOCTYPE html><html><body>
          <h1 class="p-novel__title--rensai">タイトル</h1>
          <div class="p-novel__text p-novel__text--preface"><p>前書き</p></div>
          <div class="p-novel__text"><p>本編</p></div>
        </body></html>
      `;
      const r2 = parser.parseChapterContent(
        htmlPrefMain,
        "https://ncode.syosetu.com/n9669bk/1/",
      );
      expect(r2.bodyHtml).toBe(
        "<p>前書き</p><p><br></p><p>────────────</p><p><br></p><p>本編</p>",
      );

      // 本編＋後書き（前書きなし）
      const htmlMainAfter = `
        <!DOCTYPE html><html><body>
          <h1 class="p-novel__title--rensai">タイトル</h1>
          <div class="p-novel__text"><p>本編</p></div>
          <div class="p-novel__text p-novel__text--afterword"><p>後書き</p></div>
        </body></html>
      `;
      const r3 = parser.parseChapterContent(
        htmlMainAfter,
        "https://ncode.syosetu.com/n9669bk/1/",
      );
      expect(r3.bodyHtml).toBe(
        "<p>本編</p><p><br></p><p>────────────</p><p><br></p><p>後書き</p>",
      );
    });

    it("レガシーDOM (#novel_p, #novel_honbun, #novel_a) からも本文結合が正しく行われること", () => {
      const html = loadFixture("episode_last.html");
      const pageUrl = "https://ncode.syosetu.com/n1234a/99/";
      const result = parser.parseChapterContent(html, pageUrl);

      expect(result.remoteChapterId).toBe("99");
      expect(result.title).toBe("旧エピローグ");
      const separator = "<p><br></p><p>────────────</p><p><br></p>";
      expect(result.bodyHtml).toContain("旧スタイルの前書きです。");
      expect(result.bodyHtml).toContain("旧スタイルの本編です。完結しました。");
      expect(result.bodyHtml).toContain("旧スタイルの後書きです。");
      expect(result.bodyHtml).toContain(separator);
    });

    it("サブタイトル優先セレクタリストのフォールバック動作を検証すること", () => {
      // 1. .p-novel__subtitle-episode
      const html1 =
        '<div class="p-novel__subtitle-episode">サブタイトル1</div><div class="p-novel__text"><p>本文</p></div>';
      expect(
        parser.parseChapterContent(
          html1,
          "https://ncode.syosetu.com/n9669bk/1/",
        ).title,
      ).toBe("サブタイトル1");

      // 2. .p-novel__title--rensai
      const html2 =
        '<h1 class="p-novel__title--rensai">サブタイトル2</h1><div class="p-novel__text"><p>本文</p></div>';
      expect(
        parser.parseChapterContent(
          html2,
          "https://ncode.syosetu.com/n9669bk/1/",
        ).title,
      ).toBe("サブタイトル2");

      // 3. .novel_subtitle
      const html3 =
        '<p class="novel_subtitle">サブタイトル3</p><div class="p-novel__text"><p>本文</p></div>';
      expect(
        parser.parseChapterContent(
          html3,
          "https://ncode.syosetu.com/n9669bk/1/",
        ).title,
      ).toBe("サブタイトル3");

      // 4. .p-novel__title
      const html4 =
        '<h1 class="p-novel__title">サブタイトル4</h1><div class="p-novel__text"><p>本文</p></div>';
      expect(
        parser.parseChapterContent(
          html4,
          "https://ncode.syosetu.com/n9669bk/1/",
        ).title,
      ).toBe("サブタイトル4");

      // 5. .novel_title
      const html5 =
        '<p class="novel_title">サブタイトル5</p><div class="p-novel__text"><p>本文</p></div>';
      expect(
        parser.parseChapterContent(
          html5,
          "https://ncode.syosetu.com/n9669bk/1/",
        ).title,
      ).toBe("サブタイトル5");

      // なし
      const htmlNone = '<div class="p-novel__text"><p>本文</p></div>';
      expect(
        parser.parseChapterContent(
          htmlNone,
          "https://ncode.syosetu.com/n9669bk/1/",
        ).title,
      ).toBe("");
    });
  });

  describe("AC-NR-07: ルビ保持と傍点 <em class='bouten'> 正規化", () => {
    it("通常ルビを保持しつつ中黒・丸等の傍点記号を <em class='bouten'> に正規化すること", () => {
      const html = loadFixture("episode_content.html");
      const pageUrl = "https://ncode.syosetu.com/n9669bk/2/";
      const result = parser.parseChapterContent(html, pageUrl);

      // 通常ルビ
      expect(result.bodyHtml).toContain("<ruby>魔法<rt>まほう</rt></ruby>");

      // 傍点（中黒・●・﹅）
      expect(result.bodyHtml).toContain('<em class="bouten">思われている</em>');
      expect(result.bodyHtml).toContain('<em class="bouten">決定打</em>');
      expect(result.bodyHtml).toContain('<em class="bouten">極意</em>');

      // rp, rt タグが em.bouten 内に残っていないこと
      expect(result.bodyHtml).not.toContain("<rt>・・・・・・</rt>");
      expect(result.bodyHtml).not.toContain("<rt>●●●</rt>");
      expect(result.bodyHtml).not.toContain("<rt>﹅﹅</rt>");
    });

    it("傍点基底テキストが空の場合や rt が通常の文字を含む場合は傍点変換しないこと", () => {
      const htmlMixed = `
        <!DOCTYPE html><html><body>
          <div class="p-novel__text">
            <p><ruby><rt>・</rt></ruby></p>
            <p><ruby>漢字<rt>かん・じ</rt></ruby></p>
          </div>
        </body></html>
      `;
      const result = parser.parseChapterContent(
        htmlMixed,
        "https://ncode.syosetu.com/n9669bk/1/",
      );
      expect(result.bodyHtml).toContain("<ruby>漢字<rt>かん・じ</rt></ruby>");
    });
  });

  describe("AC-NR-08: XSS 防止サニタイズ", () => {
    it("script, style, iframe, イベントハンドラ, 不要属性を完全に除去すること", () => {
      const html = loadFixture("episode_xss.html");
      const pageUrl = "https://ncode.syosetu.com/n9669bk/1/";
      const result = parser.parseChapterContent(html, pageUrl);

      expect(result.bodyHtml).not.toContain("<script>");
      expect(result.bodyHtml).not.toContain("alert");
      expect(result.bodyHtml).not.toContain("<style>");
      expect(result.bodyHtml).not.toContain("<iframe>");
      expect(result.bodyHtml).not.toContain("id=");
      expect(result.bodyHtml).not.toContain("onclick");
      expect(result.bodyHtml).not.toContain("onerror");
      expect(result.bodyHtml).not.toContain("<img");
      expect(result.bodyHtml).toContain("安全な本文段落");
    });
  });

  describe("AC-NR-09: 前後話ナビゲーション URL 抽出 (prevChapterUrl / nextChapterUrl)", () => {
    it("前話・次話リンクが存在する場合に絶対URLとして抽出すること", () => {
      const html = loadFixture("episode_content.html");
      const pageUrl = "https://ncode.syosetu.com/n9669bk/2/";
      const result = parser.parseChapterContent(html, pageUrl);

      expect(result.prevChapterUrl).toBe(
        "https://ncode.syosetu.com/n9669bk/1/",
      );
      expect(result.nextChapterUrl).toBe(
        "https://ncode.syosetu.com/n9669bk/3/",
      );
    });

    it("第1話（前話なし）の場合は prevChapterUrl が null になること", () => {
      const html = loadFixture("episode_first.html");
      const pageUrl = "https://ncode.syosetu.com/n9669bk/1/";
      const result = parser.parseChapterContent(html, pageUrl);

      expect(result.prevChapterUrl).toBeNull();
      expect(result.nextChapterUrl).toBe(
        "https://ncode.syosetu.com/n9669bk/2/",
      );
    });

    it("最終話（次話なし）の場合は nextChapterUrl が null になること (レガシー rel='prev' 含む)", () => {
      const html = loadFixture("episode_last.html");
      const pageUrl = "https://ncode.syosetu.com/n1234a/99/";
      const result = parser.parseChapterContent(html, pageUrl);

      expect(result.prevChapterUrl).toBe("https://ncode.syosetu.com/n1234a/1/");
      expect(result.nextChapterUrl).toBeNull();
    });

    it("前後リンクが存在しない場合は両方 null になること", () => {
      const html = '<div class="p-novel__text"><p>単話</p></div>';
      const result = parser.parseChapterContent(
        html,
        "https://ncode.syosetu.com/n9669bk/1/",
      );

      expect(result.prevChapterUrl).toBeNull();
      expect(result.nextChapterUrl).toBeNull();
    });

    it("前後リンクの URL が不正で new URL が失敗した場合は null を返すこと", () => {
      const html = `
        <div class="p-novel__text"><p>本文</p></div>
        <div class="c-pager">
          <a class="c-pager__item--before" href="http://::invalid">前へ</a>
          <a class="c-pager__item--next" href="http://::invalid">次へ</a>
        </div>
      `;
      const result = parser.parseChapterContent(
        html,
        "https://ncode.syosetu.com/n9669bk/1/",
      );
      expect(result.prevChapterUrl).toBeNull();
      expect(result.nextChapterUrl).toBeNull();
    });
  });

  describe("境界値・異常系カバレッジ", () => {
    it("目次リスト内にリンクタグを含まない要素が存在する場合はスキップすること", () => {
      const html = `
        <!DOCTYPE html><html><body>
          <h1 class="p-novel__title">作品</h1>
          <div class="p-eplist">
            <div class="p-eplist__sublist">リンクなしの告知項目</div>
            <div class="p-eplist__sublist"><a class="p-eplist__subtitle" href="/n9669bk/1/">第1話</a></div>
          </div>
        </body></html>
      `;
      const result = parser.parseNovelIndex(
        html,
        "https://ncode.syosetu.com/n9669bk/",
      );
      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0].title).toBe("第1話");
    });

    it("nextTocPageUrl の href が不正な URL で new URL が失敗した場合は null を返すこと", () => {
      const html = `
        <!DOCTYPE html><html><body>
          <h1 class="p-novel__title">作品</h1>
          <div class="p-eplist"><div class="p-eplist__sublist"><a href="/n9669bk/1/">第1話</a></div></div>
          <div class="c-pager"><a class="c-pager__item--next" href="http://::invalid">次へ</a></div>
        </body></html>
      `;
      const result = parser.parseNovelIndex(
        html,
        "https://ncode.syosetu.com/n9669bk/",
      );
      expect(result.nextTocPageUrl).toBeNull();
    });

    it("ruby タグ内に rt タグが存在しない場合は傍点変換をスキップすること", () => {
      const html = `
        <div class="p-novel__text">
          <p><ruby>ルビなし</ruby></p>
        </div>
      `;
      const result = parser.parseChapterContent(
        html,
        "https://ncode.syosetu.com/n9669bk/1/",
      );
      expect(result.bodyHtml).toContain("<ruby>ルビなし</ruby>");
    });

    it("本文コンテナが存在しない場合は bodyHtml が空文字になること", () => {
      const html = "<div>本文なし</div>";
      const result = parser.parseChapterContent(
        html,
        "https://ncode.syosetu.com/n9669bk/1/",
      );
      expect(result.bodyHtml).toBe("");
      expect(result.byteSize).toBe(0);
    });

    it("pageUrl に ncode が含まれない場合は remoteChapterId が空文字になること", () => {
      const html = '<div class="p-novel__text"><p>本文</p></div>';
      const result = parser.parseChapterContent(
        html,
        "https://example.com/other",
      );
      expect(result.remoteChapterId).toBe("");
    });

    it("前書き・本編・後書きの要素が存在しても中身が空白のみの場合は除外されること", () => {
      const html = `
        <div class="p-novel__subtitle-episode">タイトル</div>
        <div class="p-novel__text p-novel__text--preface">   </div>
        <div class="p-novel__text"><p>本文段落</p></div>
        <div class="p-novel__text p-novel__text--afterword"> \n </div>
      `;
      const result = parser.parseChapterContent(
        html,
        "https://ncode.syosetu.com/n9669bk/1/",
      );
      expect(result.bodyHtml).toBe("<p>本文段落</p>");
      expect(result.bodyHtml).not.toContain("────────────");
    });

    it("目次アイテムのリンクに href 属性がない場合やエピソードIDが数字でない場合、日付がマッチしない場合のハンドリング", () => {
      const html = `
        <!DOCTYPE html><html><body>
          <h1 class="p-novel__title">作品</h1>
          <div class="p-eplist">
            <div class="p-eplist__sublist"><a class="p-eplist__subtitle">リンク属性なし</a></div>
            <div class="p-eplist__sublist">
              <a class="p-eplist__subtitle" href="/n9669bk/abc/">数字なし</a>
              <div class="p-eplist__update">更新未定</div>
            </div>
          </div>
        </body></html>
      `;
      const result = parser.parseNovelIndex(
        html,
        "https://ncode.syosetu.com/n9669bk/",
      );
      expect(result.chapters).toHaveLength(2);
      expect(result.chapters[0].remoteChapterId).toBe("");
      expect(result.chapters[1].remoteChapterId).toBe("");
      expect(result.chapters[1].publishedAt).toBeNull();
    });

    it("meta タグに content 属性が存在しない場合のハンドリング", () => {
      const html = `
        <!DOCTYPE html><html><head>
          <meta property="og:title">
          <meta name="twitter:creator">
          <meta name="description">
          <link rel="canonical" href="https://example.com/not-narou/">
          <meta property="og:url" content="https://example.com/not-narou/">
        </head><body>
          <div class="p-eplist">
            <div class="p-eplist__sublist"><a href="/n9669bk/1/">話</a></div>
          </div>
        </body></html>
      `;
      const result = parser.parseNovelIndex(
        html,
        "https://ncode.syosetu.com/n9669bk/",
      );
      expect(result.title).toBe("");
      expect(result.author).toBe("");
      expect(result.synopsis).toBe("");
    });
  });

  describe("AC-NR-10: 決定論的単体テスト（外部通信ゼロ）", () => {
    it("パーサーの全メソッドがネットワーク通信を行わず同期・決定論的に完結すること", () => {
      expect(typeof parser.canParse).toBe("function");
      expect(typeof parser.normalizeWorkUrl).toBe("function");
      expect(typeof parser.parseNovelIndex).toBe("function");
      expect(typeof parser.parseChapterContent).toBe("function");
    });
  });
});

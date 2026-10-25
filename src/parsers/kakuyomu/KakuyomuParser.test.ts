import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { KakuyomuParser } from "./KakuyomuParser";

describe("KakuyomuParser", () => {
  let parser: KakuyomuParser;

  const loadFixture = (filename: string): string => {
    const fixturePath = resolve(__dirname, "__fixtures__", filename);
    return readFileSync(fixturePath, "utf-8");
  };

  beforeEach(() => {
    parser = new KakuyomuParser();
  });

  describe("siteType プロパティ", () => {
    it("siteType が 'kakuyomu' であること", () => {
      expect(parser.siteType).toBe("kakuyomu");
    });
  });

  describe("URL 判定と正規化 (AC-01)", () => {
    it("カクヨムの作品トップ URL および各話エピソード URL を正しく判定すること", () => {
      expect(
        parser.canParse("https://kakuyomu.jp/works/1177354054881162325"),
      ).toBe(true);
      expect(
        parser.canParse(
          "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162326",
        ),
      ).toBe(true);
      expect(
        parser.canParse(
          "https://www.kakuyomu.jp/works/1177354054881162325?foo=bar#section",
        ),
      ).toBe(true);
    });

    it("他サイトの URL やカクヨムの非作品ページ・無効な文字列を拒絶すること", () => {
      expect(parser.canParse("https://ncode.syosetu.com/n12345/")).toBe(false);
      expect(parser.canParse("https://kakuyomu.jp/users/onozaki")).toBe(false);
      expect(parser.canParse("not-a-valid-url")).toBe(false);
      expect(parser.canParse("")).toBe(false);
    });

    it("作品トップ URL・エピソード URL・クエリやハッシュ付き URL を作品トップ URL へ正規化すること", () => {
      expect(
        parser.normalizeWorkUrl(
          "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162326?ref=top#p1",
        ),
      ).toBe("https://kakuyomu.jp/works/1177354054881162325");
      expect(
        parser.normalizeWorkUrl(
          "https://kakuyomu.jp/works/1177354054881162325",
        ),
      ).toBe("https://kakuyomu.jp/works/1177354054881162325");
    });

    it("作品 ID が含まれない不正な URL を渡した場合はエラーを送出すること", () => {
      expect(() =>
        parser.normalizeWorkUrl("https://kakuyomu.jp/users/123"),
      ).toThrow("Invalid Kakuyomu work URL");
      expect(() => parser.normalizeWorkUrl("invalid-string")).toThrow(
        "Invalid Kakuyomu work URL",
      );
    });
  });

  describe("作品トップ情報の抽出 (AC-02, AC-07)", () => {
    it("作品トップ HTML（work_index.html）から作品 ID、タイトル、著者名、あらすじ、全目次を抽出すること", () => {
      const html = loadFixture("work_index.html");
      const pageUrl = "https://kakuyomu.jp/works/1177354054881162325";
      const result = parser.parseNovelIndex(html, pageUrl);

      expect(result.siteType).toBe("kakuyomu");
      expect(result.remoteWorkId).toBe("1177354054881162325");
      expect(result.canonicalUrl).toBe(
        "https://kakuyomu.jp/works/1177354054881162325",
      );
      expect(result.title).toBe("境界迷宮と異界の魔術師");
      expect(result.author).toBe("小野崎");
      expect(result.synopsis).toBe("異世界に召喚された少年の冒険譚。");
      expect(result.nextTocPageUrl).toBeNull();
      expect(result.chapters).toHaveLength(4);
    });
  });

  describe("章見出しの紐付けとエピソード連番 (AC-03)", () => {
    it("章見出し（widget-toc-chapter）が後続エピソードの partTitle に正しく紐付けられ 1 始まりの連番が付与されること", () => {
      const html = loadFixture("work_index.html");
      const pageUrl = "https://kakuyomu.jp/works/1177354054881162325";
      const result = parser.parseNovelIndex(html, pageUrl);

      // プロローグ（章見出し前）
      expect(result.chapters[0]).toEqual({
        chapterIndex: 1,
        remoteChapterId: "1177354054881162326",
        partTitle: null,
        title: "プロローグ：目覚め",
        url: "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162326",
        publishedAt: "2026-01-01T10:00:00Z",
      });

      // 第一章のエピソード群
      expect(result.chapters[1]).toEqual({
        chapterIndex: 2,
        remoteChapterId: "1177354054881162327",
        partTitle: "第一章 旅立ち",
        title: "第1話 見知らぬ空",
        url: "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162327",
        publishedAt: "2026-01-02T10:00:00Z",
      });

      expect(result.chapters[2]).toEqual({
        chapterIndex: 3,
        remoteChapterId: "1177354054881162328",
        partTitle: "第一章 旅立ち",
        title: "第2話 初めての魔法",
        url: "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162328",
        publishedAt: "2026-01-03T10:00:00Z",
      });

      // 第二章のエピソード
      expect(result.chapters[3]).toEqual({
        chapterIndex: 4,
        remoteChapterId: "1177354054881162329",
        partTitle: "第二章 迷宮踏破",
        title: "第3話 深層へ",
        url: "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162329",
        publishedAt: "2026-01-04T10:00:00Z",
      });
    });

    it("章見出しが存在しない単話短編作品（work_single.html）を正しく抽出すること", () => {
      const html = loadFixture("work_single.html");
      const pageUrl = "https://kakuyomu.jp/works/9999999999999999999";
      const result = parser.parseNovelIndex(html, pageUrl);

      expect(result.title).toBe("ある雨の日の奇跡");
      expect(result.author).toBe("雨宮");
      expect(result.synopsis).toBe("雨の日に起こった小さな奇跡の物語。");
      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0]).toEqual({
        chapterIndex: 1,
        remoteChapterId: "9999999999999999998",
        partTitle: null,
        title: "ある雨の日の奇跡",
        url: "https://kakuyomu.jp/works/9999999999999999999/episodes/9999999999999999998",
        publishedAt: "2026-02-01T12:00:00Z",
      });
    });
  });

  describe("各話本文のルビ・傍点抽出 (AC-04)", () => {
    it("各話 HTML（episode_content.html）からタイトル・サニタイズ本文・バイトサイズを抽出すること", () => {
      const html = loadFixture("episode_content.html");
      const pageUrl =
        "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162327";
      const result = parser.parseChapterContent(html, pageUrl);

      expect(result.remoteChapterId).toBe("1177354054881162327");
      expect(result.title).toBe("第1話 見知らぬ空");
      expect(result.bodyHtml).toContain(
        "<ruby><rb>太陽</rb><rp>(</rp><rt>たいよう</rt><rp>)</rp></ruby>",
      );
      expect(result.bodyHtml).toContain(
        '<em class="bouten">信じがたい光景</em>',
      );
      expect(result.bodyHtml).toContain("<p><br></p>");
      expect(result.byteSize).toBe(
        new TextEncoder().encode(result.bodyHtml).length,
      );
    });
  });

  describe("悪意あるコードの無害化サニタイズ (AC-05)", () => {
    it("XSS 攻撃コードを含む各話 HTML（episode_xss.html）から危険タグや属性を除去すること", () => {
      const html = loadFixture("episode_xss.html");
      const pageUrl =
        "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162399";
      const result = parser.parseChapterContent(html, pageUrl);

      expect(result.bodyHtml).not.toContain("<script");
      expect(result.bodyHtml).not.toContain("<style");
      expect(result.bodyHtml).not.toContain("<iframe");
      expect(result.bodyHtml).not.toContain("<form");
      expect(result.bodyHtml).not.toContain("<img");
      expect(result.bodyHtml).not.toContain("onclick");
      expect(result.bodyHtml).not.toContain("onerror");
      expect(result.bodyHtml).not.toContain("javascript:");
      expect(result.bodyHtml).toContain('<em class="bouten">安全な傍点</em>');
      expect(result.bodyHtml).toContain("段落1");
      expect(result.bodyHtml).toContain("<p>危険なフレーム</p>");
      expect(result.bodyHtml).toContain("<p>危険なリンク</p>");
      expect(result.bodyHtml).toContain("<p>通常の装飾テキスト</p>");
    });
  });

  describe("前後ナビゲーション URL の抽出 (AC-06)", () => {
    it("中間話では前話・次話リンクが絶対 URL として抽出されること", () => {
      const html = loadFixture("episode_content.html");
      const pageUrl =
        "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162327";
      const result = parser.parseChapterContent(html, pageUrl);

      expect(result.prevChapterUrl).toBe(
        "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162326",
      );
      expect(result.nextChapterUrl).toBe(
        "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162328",
      );
    });

    it("第1話（前話なし）では prevChapterUrl が null になること", () => {
      const html = loadFixture("episode_first.html");
      const pageUrl =
        "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162326";
      const result = parser.parseChapterContent(html, pageUrl);

      expect(result.prevChapterUrl).toBeNull();
      expect(result.nextChapterUrl).toBe(
        "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162327",
      );
    });

    it("最終話（次話なし）では nextChapterUrl が null になること", () => {
      const html = loadFixture("episode_last.html");
      const pageUrl =
        "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162329";
      const result = parser.parseChapterContent(html, pageUrl);

      expect(result.prevChapterUrl).toBe(
        "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162328",
      );
      expect(result.nextChapterUrl).toBeNull();
    });
  });

  describe("境界値およびフォールバック処理", () => {
    it("pageUrl に作品 ID がなく canonical link から取得できる場合に正常に抽出すること", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><link rel="canonical" href="https://kakuyomu.jp/works/5555555555555555555"></head>
        <body>
          <h1 id="workTitle">代替URL作品</h1>
        </body>
        </html>
      `;
      const result = parser.parseNovelIndex(html, "https://kakuyomu.jp/dummy");
      expect(result.remoteWorkId).toBe("5555555555555555555");
      expect(result.title).toBe("代替URL作品");
      expect(result.author).toBe("");
      expect(result.synopsis).toBe("");
      expect(result.chapters).toEqual([]);
    });

    it("新デザインの目次HTML（WorkTocSection_link）および著者要素から正しく抽出できること", () => {
      const modernHtml = `
        <!doctype html>
        <html>
          <head><link rel="canonical" href="https://kakuyomu.jp/works/16817330658027210412" /></head>
          <body>
            <header><h1>お嬢様系底辺ダンジョン配信者</h1></header>
            <div class="partialGiftWidgetActivityName">
              <a href="/users/doragontanishi">ドラゴンタニシ</a>
            </div>
            <div class="WorkIntroductionBox_catch">エセお嬢様のダンジョン無双</div>
            <div class="WorkToc_container">
              <a class="WorkTocSection_link" href="/works/16817330658027210412/episodes/16817330658029426899">
                <div class="WorkTocSection_title"><div>第1話 底辺配信お嬢様</div></div>
                <time datetime="2023-06-02T08:30:16.000Z">2023年6月2日</time>
              </a>
            </div>
          </body>
        </html>
      `;
      const result = parser.parseNovelIndex(
        modernHtml,
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      expect(result.title).toBe("お嬢様系底辺ダンジョン配信者");
      expect(result.author).toBe("ドラゴンタニシ");
      expect(result.synopsis).toBe("エセお嬢様のダンジョン無双");
      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0].title).toBe("第1話 底辺配信お嬢様");
      expect(result.chapters[0].remoteChapterId).toBe("16817330658029426899");
      expect(result.chapters[0].publishedAt).toBe("2023-06-02T08:30:16.000Z");
    });

    it("新デザインの目次HTMLで不正なリンク（hrefなし、IDなし、timeなし）が含まれていても安全にスキップ・処理すること", () => {
      const modernHtml = `
        <!doctype html>
        <html>
          <head><link rel="canonical" href="https://kakuyomu.jp/works/16817330658027210412" /></head>
          <body>
            <h1>作品</h1>
            <div class="WorkToc_container">
              <a class="WorkTocSection_link" href="/works/16817330658027210412/episodes/">IDなし</a>
              <a class="WorkTocSection_link" href="/works/16817330658027210412/episodes/111">タイトルクラスなし</a>
              <a class="WorkTocSection_link" href="/works/16817330658027210412/episodes/222">2023年6月2日公開</a>
            </div>
          </body>
        </html>
      `;
      const result = parser.parseNovelIndex(
        modernHtml,
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      expect(result.chapters).toHaveLength(2);
      expect(result.chapters[0].remoteChapterId).toBe("111");
      expect(result.chapters[0].title).toBe("タイトルクラスなし");
      expect(result.chapters[0].publishedAt).toBeNull();
      expect(result.chapters[1].remoteChapterId).toBe("222");
      expect(result.chapters[1].title).toBe("2023年6月2日公開");
    });

    it("pageUrl にも HTML にも作品 ID が見つからない場合はエラーを送出すること", () => {
      const html = "<html><body><h1>タイトルのみ</h1></body></html>";
      expect(() =>
        parser.parseNovelIndex(html, "https://kakuyomu.jp/invalid"),
      ).toThrow("Cannot extract remoteWorkId from URL or HTML");
    });

    it("各話 HTML で本文コンテナが存在しない場合は空文字の bodyHtml を返すこと", () => {
      const html =
        "<html><body><h1 class='widget-episodeTitle'>空エピソード</h1></body></html>";
      const result = parser.parseChapterContent(
        html,
        "https://kakuyomu.jp/works/1/episodes/99",
      );
      expect(result.remoteChapterId).toBe("99");
      expect(result.title).toBe("空エピソード");
      expect(result.bodyHtml).toBe("");
      expect(result.byteSize).toBe(0);
      expect(result.prevChapterUrl).toBeNull();
      expect(result.nextChapterUrl).toBeNull();
    });

    it("各話 URL に episodeId が含まれない場合でも空文字として安全に処理すること", () => {
      const html =
        "<html><body><div class='widget-episodeBody'><p>本文</p></div></body></html>";
      const result = parser.parseChapterContent(
        html,
        "https://kakuyomu.jp/works/1",
      );
      expect(result.remoteChapterId).toBe("");
      expect(result.title).toBe("");
      expect(result.bodyHtml).toBe("<p>本文</p>");
    });

    it("目次要素内にエピソードリンクや episodeId がない不正な要素が含まれていてもスキップすること", () => {
      const html = `
        <html><body>
          <div class="widget-toc-items">
            <div class="widget-toc-episode">エピソードリンクなし</div>
            <div class="widget-toc-episode"><a>href属性なし</a></div>
            <div class="widget-toc-episode"><a href="/not-episode/path">不正リンク</a></div>
            <div class="widget-toc-episode">
              <a href="/works/123/episodes/456"><span>正常エピソード</span></a>
              <time>2026-03-01</time>
            </div>
            <div class="widget-toc-episode">
              <a href="/works/123/episodes/789"><span>日時なしエピソード</span></a>
            </div>
            <div class="widget-toc-episode">
              <a href="/works/123/episodes/790"><span>空日時エピソード</span></a>
              <time></time>
            </div>
            <div class="widget-toc-episode">
              <a href="/works/123/episodes/791"></a>
            </div>
          </div>
        </body></html>
      `;
      const result = parser.parseNovelIndex(
        html,
        "https://kakuyomu.jp/works/123",
      );
      expect(result.chapters).toHaveLength(4);
      expect(result.chapters[0].remoteChapterId).toBe("456");
      expect(result.chapters[0].title).toBe("正常エピソード");
      expect(result.chapters[0].publishedAt).toBe("2026-03-01");
      expect(result.chapters[1].publishedAt).toBeNull();
      expect(result.chapters[2].publishedAt).toBeNull();
      expect(result.chapters[3].remoteChapterId).toBe("791");
      expect(result.chapters[3].title).toBe("");
    });

    it("widget-toc-section による節見出しや空見出しを処理できること", () => {
      const html = `
        <html><body>
          <div class="widget-toc-items">
            <div class="widget-toc-section">節見出し</div>
            <div class="widget-toc-episode">
              <a href="/works/123/episodes/101"><span>第1節</span></a>
            </div>
            <div class="widget-toc-chapter">   </div>
            <div class="widget-toc-episode">
              <a href="/works/123/episodes/102"><span>第2節</span></a>
            </div>
          </div>
        </body></html>
      `;
      const result = parser.parseNovelIndex(
        html,
        "https://kakuyomu.jp/works/123",
      );
      expect(result.chapters).toHaveLength(2);
      expect(result.chapters[0].partTitle).toBe("節見出し");
      expect(result.chapters[1].partTitle).toBeNull();
    });

    it("canonical リンクが存在しても作品 ID が含まれない場合はエラーを送出すること", () => {
      const html =
        '<html><head><link rel="canonical" href="https://kakuyomu.jp/other"></head><body></body></html>';
      expect(() =>
        parser.parseNovelIndex(html, "https://kakuyomu.jp/invalid"),
      ).toThrow("Cannot extract remoteWorkId from URL or HTML");
    });

    it("文書内での出現順序に関わらず、優先順位の高いセレクタの要素が優先抽出されること", () => {
      const indexHtml = `
        <html><body>
          <div id="catchphrase-and-title"><h1>低優先タイトル</h1></div>
          <div id="workTitle"><a href="/works/123">高優先タイトル</a></div>
          <a href="/users/abc">低優先著者</a>
          <span id="workAuthor-activityName"><a href="/users/def">高優先著者</a></span>
          <p id="description">低優先あらすじ</p>
          <p id="introduction">高優先あらすじ</p>
        </body></html>
      `;
      const indexResult = parser.parseNovelIndex(
        indexHtml,
        "https://kakuyomu.jp/works/123",
      );
      expect(indexResult.title).toBe("高優先タイトル");
      expect(indexResult.author).toBe("高優先著者");
      expect(indexResult.synopsis).toBe("高優先あらすじ");

      const chapterHtml = `
        <html><body>
          <header><h1>低優先サブタイトル</h1></header>
          <h2 class="widget-episodeTitle">高優先サブタイトル</h2>
          <div class="js-episode-body">低優先本文</div>
          <div class="widget-episodeBody"><p>高優先本文</p></div>
          <a rel="prev" href="/works/123/episodes/1">低優先前話</a>
          <a id="contentMain-previousEpisode" href="/works/123/episodes/2">高優先前話</a>
          <a rel="next" href="/works/123/episodes/8">低優先次話</a>
          <a id="contentMain-nextEpisode" href="/works/123/episodes/9">高優先次話</a>
        </body></html>
      `;
      const chapterResult = parser.parseChapterContent(
        chapterHtml,
        "https://kakuyomu.jp/works/123/episodes/5",
      );
      expect(chapterResult.title).toBe("高優先サブタイトル");
      expect(chapterResult.bodyHtml).toBe("<p>高優先本文</p>");
      expect(chapterResult.prevChapterUrl).toBe(
        "https://kakuyomu.jp/works/123/episodes/2",
      );
      expect(chapterResult.nextChapterUrl).toBe(
        "https://kakuyomu.jp/works/123/episodes/9",
      );
    });
  });
});

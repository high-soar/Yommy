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

    it("作品 ID が含まれない不正な URL や他サイトの URL を渡した場合はエラーを送出すること", () => {
      expect(() =>
        parser.normalizeWorkUrl("https://kakuyomu.jp/users/123"),
      ).toThrow("Invalid Kakuyomu work URL");
      expect(() =>
        parser.normalizeWorkUrl("https://kakuyomu.jp/works/invalid"),
      ).toThrow("Invalid Kakuyomu work URL");
      expect(() =>
        parser.normalizeWorkUrl("https://example.com/works/12345"),
      ).toThrow("Invalid Kakuyomu work URL");
      expect(() => parser.normalizeWorkUrl("invalid-string")).toThrow(
        "Invalid Kakuyomu work URL",
      );
    });
  });

  describe("__NEXT_DATA__ (__APOLLO_STATE__) による全エピソード・全章目次抽出 (AC-02, AC-03)", () => {
    it("静的 DOM に一部の話数しかなくても __NEXT_DATA__ から全 10 話および章見出しを漏れなく抽出すること", () => {
      const html = loadFixture("work_index_next_data.html");
      const pageUrl = "https://kakuyomu.jp/works/16817330658027210412";
      const result = parser.parseNovelIndex(html, pageUrl);

      expect(result.siteType).toBe("kakuyomu");
      expect(result.remoteWorkId).toBe("16817330658027210412");
      expect(result.title).toBe("お嬢様系底辺ダンジョン配信者");
      expect(result.author).toBe("ドラゴンタニシ");
      expect(result.synopsis).toBe("エセお嬢様のダンジョン無双");
      expect(result.chapters).toHaveLength(10);

      expect(result.chapters[0]).toEqual({
        chapterIndex: 1,
        remoteChapterId: "1001",
        partTitle: null,
        title: "プロローグ：配信開始",
        url: "https://kakuyomu.jp/works/16817330658027210412/episodes/1001",
        publishedAt: "2026-01-01T10:00:00Z",
      });

      expect(result.chapters[1].partTitle).toBe("第一章 迷宮の入り口");
      expect(result.chapters[1].remoteChapterId).toBe("1002");
      expect(result.chapters[5].partTitle).toBe("第一章 迷宮の入り口");
      expect(result.chapters[5].remoteChapterId).toBe("1006");

      expect(result.chapters[6].partTitle).toBe("第二章 深淵の配信者");
      expect(result.chapters[6].remoteChapterId).toBe("1007");
      expect(result.chapters[9]).toEqual({
        chapterIndex: 10,
        remoteChapterId: "1010",
        partTitle: "第二章 深淵の配信者",
        title: "第9話 伝説の始まり",
        url: "https://kakuyomu.jp/works/16817330658027210412/episodes/1010",
        publishedAt: "2026-01-10T10:00:00Z",
      });
    });

    it("DOM 上のタイトル・著者・あらすじが空の場合に __APOLLO_STATE__ の Work / UserAccount から補完すること", () => {
      const htmlWithAuthorActivity = `
        <html><body>
          <script id="__NEXT_DATA__" type="application/json">
            ${JSON.stringify({
              props: {
                pageProps: {
                  __APOLLO_STATE__: {
                    "UserAccount:u1": {
                      activityName: "活動名著者",
                      name: "id_name",
                    },
                    "Work:123": {
                      title: "Apolloタイトル",
                      author: { __ref: "UserAccount:u1" },
                      introduction: "Apolloあらすじ",
                      tableOfContents: [{ __ref: "TableOfContentsChapter:t1" }],
                    },
                    "Chapter:c1": { title: "   " },
                    "TableOfContentsChapter:t1": {
                      chapter: { __ref: "Chapter:c1" },
                      episodeUnions: [
                        { __ref: "Episode:e1" },
                        { __ref: "Episode:missing" },
                        { __ref: "Episode:no_title" },
                      ],
                    },
                    "Episode:e1": {
                      id: "901",
                      title: " 第1話 ",
                      publishedAt: null,
                    },
                    "Episode:no_title": {
                      id: "902",
                    },
                  },
                },
              },
            })}
          </script>
        </body></html>
      `;
      const res1 = parser.parseNovelIndex(
        htmlWithAuthorActivity,
        "https://kakuyomu.jp/works/123",
      );
      expect(res1.title).toBe("Apolloタイトル");
      expect(res1.author).toBe("活動名著者");
      expect(res1.synopsis).toBe("Apolloあらすじ");
      expect(res1.chapters).toHaveLength(1);
      expect(res1.chapters[0].partTitle).toBeNull();
      expect(res1.chapters[0].title).toBe("第1話");
      expect(res1.chapters[0].publishedAt).toBeNull();

      // alternateAuthorName および catchphrase へのフォールバック
      const htmlWithAltAuthor = `
        <html><body>
          <script id="__NEXT_DATA__" type="application/json">
            ${JSON.stringify({
              props: {
                pageProps: {
                  __APOLLO_STATE__: {
                    "UserAccount:u2": {
                      name: "account_name_fallback",
                    },
                    "Work:456": {
                      title: "別名義作品",
                      alternateAuthorName: "別名義著者",
                      author: { __ref: "UserAccount:u2" },
                      catchphrase: "キャッチコピーあらすじ",
                    },
                  },
                },
              },
            })}
          </script>
        </body></html>
      `;
      const res2 = parser.parseNovelIndex(
        htmlWithAltAuthor,
        "https://kakuyomu.jp/works/456",
      );
      expect(res2.author).toBe("別名義著者");
      expect(res2.synopsis).toBe("キャッチコピーあらすじ");

      // UserAccount.name へのフォールバックおよび欠損時
      const htmlWithUserName = `
        <html><body>
          <script id="__NEXT_DATA__" type="application/json">
            ${JSON.stringify({
              props: {
                pageProps: {
                  __APOLLO_STATE__: {
                    "UserAccount:u3": {
                      name: "user_id_author",
                    },
                    "Work:789": {
                      author: { __ref: "UserAccount:u3" },
                    },
                  },
                },
              },
            })}
          </script>
        </body></html>
      `;
      const res3 = parser.parseNovelIndex(
        htmlWithUserName,
        "https://kakuyomu.jp/works/789",
      );
      expect(res3.title).toBe("");
      expect(res3.author).toBe("user_id_author");
      expect(res3.synopsis).toBe("");
    });

    it("__NEXT_DATA__ が不正な JSON や不完全な構造の場合に安全に DOM 抽出へフォールバックすること", () => {
      const brokenJsonHtml = `
        <html><body>
          <h1 id="workTitle">DOMタイトル</h1>
          <script id="__NEXT_DATA__" type="application/json">{ invalid json </script>
          <div class="WorkToc_container">
            <div class="WorkToc_ChapterTitle">第一章 DOM章</div>
            <div class="WorkToc_chapterTitle">   </div>
            <a href="/works/123/episodes/555">第1話 DOM話</a>
          </div>
        </body></html>
      `;
      const result = parser.parseNovelIndex(
        brokenJsonHtml,
        "https://kakuyomu.jp/works/123",
      );
      expect(result.title).toBe("DOMタイトル");
      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0].partTitle).toBeNull();
      expect(result.chapters[0].remoteChapterId).toBe("555");

      // Work オブジェクトが存在しない、または toc 要素が欠損している __APOLLO_STATE__
      const incompleteApolloHtml = `
        <html><body>
          <script id="__NEXT_DATA__" type="application/json">
            ${JSON.stringify({
              props: {
                pageProps: {
                  __APOLLO_STATE__: {
                    "Work:123": {
                      tableOfContentsV2: [
                        { __ref: "TableOfContentsChapter:missing" },
                        { __ref: "TableOfContentsChapter:no_unions" },
                      ],
                    },
                    "TableOfContentsChapter:no_unions": {
                      chapter: { __ref: "Chapter:missing_ch" },
                    },
                  },
                },
              },
            })}
          </script>
          <div class="WorkToc_container">
            <div class="WorkToc_chapterTitle">現行DOM章タイトル</div>
            <a href="/works/123/episodes/777">第1話</a>
          </div>
        </body></html>
      `;
      const res2 = parser.parseNovelIndex(
        incompleteApolloHtml,
        "https://kakuyomu.jp/works/123",
      );
      expect(res2.chapters).toHaveLength(1);
      expect(res2.chapters[0].partTitle).toBe("現行DOM章タイトル");
      expect(res2.chapters[0].remoteChapterId).toBe("777");

      // __APOLLO_STATE__ 自体が存在しない JSON、および Work:id が存在しない JSON
      const noApolloHtml = `
        <html><body>
          <script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>
        </body></html>
      `;
      expect(
        parser.parseNovelIndex(noApolloHtml, "https://kakuyomu.jp/works/123")
          .chapters,
      ).toEqual([]);

      const noWorkHtml = `
        <html><body>
          <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"__APOLLO_STATE__":{}}}}</script>
        </body></html>
      `;
      expect(
        parser.parseNovelIndex(noWorkHtml, "https://kakuyomu.jp/works/123")
          .chapters,
      ).toEqual([]);
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

  describe("検索 URL の生成 (AC-08)", () => {
    it("キーワードのみ渡した場合、デフォルトの並び順（weekly_ranking）で URL を構築すること", () => {
      const url = parser.buildSearchUrl("異世界");
      expect(url).toBe(
        "https://kakuyomu.jp/search?q=%E7%95%B0%E4%B8%96%E7%95%8C&order=weekly_ranking",
      );
    });

    it("前後の余分な空白をトリムしてキーワードをエンコードすること", () => {
      const url = parser.buildSearchUrl("  ダンジョン 配信  ");
      expect(url).toBe(
        "https://kakuyomu.jp/search?q=%E3%83%80%E3%83%B3%E3%82%B8%E3%83%A7%E3%83%B3+%E9%85%8D%E4%BF%A1&order=weekly_ranking",
      );
    });

    it("並び順オプションを正しくクエリに付与すること", () => {
      expect(parser.buildSearchUrl("テスト", { order: "popular" })).toContain(
        "order=popular",
      );
      expect(
        parser.buildSearchUrl("テスト", { order: "last_episode_published_at" }),
      ).toContain("order=last_episode_published_at");
      expect(
        parser.buildSearchUrl("テスト", { order: "published_at" }),
      ).toContain("order=published_at");
      expect(
        parser.buildSearchUrl("テスト", { order: "weekly_ranking" }),
      ).toContain("order=weekly_ranking");
    });

    it("連載状態オプション（running, completed）を付与し、all または未指定の場合はクエリから省略すること", () => {
      expect(
        parser.buildSearchUrl("テスト", { serialStatus: "running" }),
      ).toContain("serial_status=running");
      expect(
        parser.buildSearchUrl("テスト", { serialStatus: "completed" }),
      ).toContain("serial_status=completed");
      expect(
        parser.buildSearchUrl("テスト", { serialStatus: "all" }),
      ).not.toContain("serial_status");
      expect(parser.buildSearchUrl("テスト", {})).not.toContain(
        "serial_status",
      );
    });

    it("ジャンル名オプション（小文字スラッグ）を正しくクエリに付与すること", () => {
      expect(parser.buildSearchUrl("テスト", { genre: "fantasy" })).toContain(
        "genre_name=fantasy",
      );
      expect(parser.buildSearchUrl("テスト", { genre: "ACTION" })).toContain(
        "genre_name=action",
      );
    });

    it("ページ番号オプションで 2 以上の場合は page クエリを付与し、1 または未指定の場合は省略すること", () => {
      expect(parser.buildSearchUrl("テスト", { page: 2 })).toContain("page=2");
      expect(parser.buildSearchUrl("テスト", { page: 5 })).toContain("page=5");
      expect(parser.buildSearchUrl("テスト", { page: 1 })).not.toContain(
        "page=",
      );
      expect(parser.buildSearchUrl("テスト", {})).not.toContain("page=");
    });

    it("すべてのオプションを組み合わせた検索 URL を構築できること", () => {
      const url = parser.buildSearchUrl("悪役令嬢", {
        order: "popular",
        serialStatus: "completed",
        genre: "romance",
        page: 3,
      });
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe(
        "https://kakuyomu.jp/search",
      );
      expect(parsed.searchParams.get("q")).toBe("悪役令嬢");
      expect(parsed.searchParams.get("order")).toBe("popular");
      expect(parsed.searchParams.get("serial_status")).toBe("completed");
      expect(parsed.searchParams.get("genre_name")).toBe("romance");
      expect(parsed.searchParams.get("page")).toBe("3");
    });
  });

  describe("検索結果の解析 (AC-09)", () => {
    it("Apollo State 正常系フィクスチャから作品一覧・メタデータ・ページ情報を漏れなく抽出すること", () => {
      const html = loadFixture("search_results_apollo.html");
      const result = parser.searchNovels(
        html,
        "https://kakuyomu.jp/search?q=異世界",
      );

      expect(result.pageInfo.currentPage).toBe(1);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.pageInfo.totalCount).toBe(42);
      expect(result.items).toHaveLength(2);

      const first = result.items[0];
      expect(first.remoteWorkId).toBe("16817330658027210001");
      expect(first.title).toBe("転生令嬢の異世界冒険譚");
      expect(first.author).toBe("カクヨム太郎");
      expect(first.synopsis).toBe(
        "異世界に転生した令嬢が奮闘するファンタジー。",
      );
      expect(first.genre).toBe("fantasy");
      expect(first.genreLabel).toBe("異世界ファンタジー");
      expect(first.serialStatus).toBe("running");
      expect(first.serialStatusLabel).toBe("連載中");
      expect(first.episodeCount).toBe(45);
      expect(first.characterCount).toBe(120500);
      expect(first.tags).toEqual(["異世界", "転生", "令嬢", "魔法"]);
      expect(first.reviewPoints).toBe(3820);
      expect(first.lastEpisodePublishedAt).toBe("2026-10-25T12:00:00Z");
      expect(first.workUrl).toBe(
        "https://kakuyomu.jp/works/16817330658027210001",
      );

      const second = result.items[1];
      expect(second.remoteWorkId).toBe("16817330658027210002");
      expect(second.title).toBe("現代ダンジョン無双");
      expect(second.author).toBe("次郎丸");
      expect(second.synopsis).toBe(
        "現代にダンジョンが出現した世界での爽快アクション。",
      );
      expect(second.genre).toBe("action");
      expect(second.genreLabel).toBe("現代ファンタジー");
      expect(second.serialStatus).toBe("completed");
      expect(second.serialStatusLabel).toBe("完結済");
      expect(second.episodeCount).toBe(120);
      expect(second.characterCount).toBe(350000);
      expect(second.tags).toEqual(["現代ファンタジー", "ダンジョン", "無双"]);
      expect(second.reviewPoints).toBe(8450);
      expect(second.lastEpisodePublishedAt).toBe("2026-10-20T18:30:00Z");
      expect(second.workUrl).toBe(
        "https://kakuyomu.jp/works/16817330658027210002",
      );
    });

    it("著者が alternateAuthorName や UserAccount.name にフォールバックする場合、あらすじが catchphrase にフォールバックする場合も正しく抽出すること", () => {
      const html = `
        <html><body>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "__APOLLO_STATE__": {
                    "ROOT_QUERY": {
                      "searchWorks({\\"query\\":\\"test\\"})": {
                        "pageInfo": { "hasNextPage": false },
                        "nodes": [{ "__ref": "Work:w1" }, { "__ref": "Work:w2" }]
                      }
                    },
                    "UserAccount:u1": { "name": "userNameOnly" },
                    "Work:w1": {
                      "id": "w1",
                      "title": "作品1",
                      "author": { "__ref": "UserAccount:u1" },
                      "catchphrase": "キャッチコピーあらすじ",
                      "serialStatus": "RUNNING"
                    },
                    "Work:w2": {
                      "id": "w2",
                      "title": "作品2",
                      "alternateAuthorName": "別名義ペンネーム",
                      "serialStatus": "COMPLETED"
                    }
                  }
                }
              }
            }
          </script>
        </body></html>
      `;
      const result = parser.searchNovels(
        html,
        "https://kakuyomu.jp/search?q=test",
      );
      expect(result.items).toHaveLength(2);
      expect(result.items[0].author).toBe("userNameOnly");
      expect(result.items[0].synopsis).toBe("キャッチコピーあらすじ");
      expect(result.items[1].author).toBe("別名義ペンネーム");
    });

    it("検索結果が 0 件の Apollo State を正常に処理し空リストを返すこと", () => {
      const html = loadFixture("search_results_empty.html");
      const result = parser.searchNovels(
        html,
        "https://kakuyomu.jp/search?q=存在しない作品",
      );
      expect(result.items).toEqual([]);
      expect(result.pageInfo.currentPage).toBe(1);
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.totalCount).toBe(0);
    });

    it("pageUrl のクエリから currentPage 番号を正しく認識すること", () => {
      const html = loadFixture("search_results_apollo.html");
      const result = parser.searchNovels(
        html,
        "https://kakuyomu.jp/search?q=異世界&page=3",
      );
      expect(result.pageInfo.currentPage).toBe(3);
    });

    it("静的 DOM フィクスチャ（search_results_dom.html）から作品情報と次ページ判定をフォールバック抽出すること", () => {
      const html = loadFixture("search_results_dom.html");
      const result = parser.searchNovels(
        html,
        "https://kakuyomu.jp/search?q=test",
      );

      expect(result.pageInfo.currentPage).toBe(1);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.items).toHaveLength(2);

      const first = result.items[0];
      expect(first.remoteWorkId).toBe("16817330658027210003");
      expect(first.title).toBe("DOM検索作品1：魔法学園の秘密");
      expect(first.author).toBe("DOM著者1");
      expect(first.synopsis).toBe("DOM版のあらすじテキスト1。");
      expect(first.genre).toBe("fantasy");
      expect(first.genreLabel).toBe("異世界ファンタジー");
      expect(first.serialStatus).toBe("running");
      expect(first.serialStatusLabel).toBe("連載中");
      expect(first.episodeCount).toBe(25);
      expect(first.characterCount).toBe(65000);
      expect(first.tags).toEqual(["学園", "魔法"]);
      expect(first.reviewPoints).toBe(1234);
      expect(first.lastEpisodePublishedAt).toBe("2026-10-28T09:00:00Z");

      const second = result.items[1];
      expect(second.remoteWorkId).toBe("16817330658027210004");
      expect(second.title).toBe("DOM検索作品2：完結ミステリー");
      expect(second.author).toBe("DOM著者2");
      expect(second.synopsis).toBe("DOM版のあらすじテキスト2。");
      expect(second.genre).toBe("mystery");
      expect(second.genreLabel).toBe("ミステリー");
      expect(second.serialStatus).toBe("completed");
      expect(second.serialStatusLabel).toBe("完結済");
      expect(second.episodeCount).toBe(50);
      expect(second.characterCount).toBe(120000);
      expect(second.tags).toEqual(["推理"]);
      expect(second.reviewPoints).toBe(3456);
      expect(second.lastEpisodePublishedAt).toBe("2026-10-21T15:00:00Z");
    });

    it("Apollo State が壊れた JSON や ROOT_QUERY が欠損している場合でも DOM 抽出へ安全にフォールバックすること", () => {
      const brokenHtml = `
        <html><body>
          <script id="__NEXT_DATA__" type="application/json">{ broken </script>
          <div class="widget-work">
            <h3 class="widget-work-title">
              <a href="/works/9999999999">フォールバック作品</a>
            </h3>
            <span class="widget-work-author"><a href="/users/author99">フォールバック著者</a></span>
          </div>
        </body></html>
      `;
      const result = parser.searchNovels(
        brokenHtml,
        "https://kakuyomu.jp/search?q=broken",
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0].remoteWorkId).toBe("9999999999");
      expect(result.items[0].title).toBe("フォールバック作品");
      expect(result.items[0].author).toBe("フォールバック著者");
    });
  });

  describe("ランキング URL の生成 (AC-10)", () => {
    it("オプション未指定時に総合・週間・長編（all/weekly?work_variation=long）のデフォルト URL を構築すること", () => {
      const url = parser.buildRankingUrl();
      expect(url).toBe(
        "https://kakuyomu.jp/rankings/all/weekly?work_variation=long",
      );
    });

    it("集計期間オプション（daily, weekly, monthly, entire）に応じてパスを正しく組み立てること", () => {
      expect(parser.buildRankingUrl({ period: "daily" })).toBe(
        "https://kakuyomu.jp/rankings/all/daily?work_variation=long",
      );
      expect(parser.buildRankingUrl({ period: "weekly" })).toBe(
        "https://kakuyomu.jp/rankings/all/weekly?work_variation=long",
      );
      expect(parser.buildRankingUrl({ period: "monthly" })).toBe(
        "https://kakuyomu.jp/rankings/all/monthly?work_variation=long",
      );
      expect(parser.buildRankingUrl({ period: "entire" })).toBe(
        "https://kakuyomu.jp/rankings/all/entire?work_variation=long",
      );
    });

    it("ジャンルオプション（fantasy, sf など）に応じて対象パスを正しく組み立てること", () => {
      expect(parser.buildRankingUrl({ genre: "fantasy" })).toBe(
        "https://kakuyomu.jp/rankings/fantasy/weekly?work_variation=long",
      );
      expect(parser.buildRankingUrl({ genre: "SF" })).toBe(
        "https://kakuyomu.jp/rankings/sf/weekly?work_variation=long",
      );
      expect(parser.buildRankingUrl({ genre: "all" })).toBe(
        "https://kakuyomu.jp/rankings/all/weekly?work_variation=long",
      );
    });

    it("ページ番号が 2 以上の場合に page クエリを付与し、1 または未指定では省略すること", () => {
      expect(parser.buildRankingUrl({ page: 2 })).toBe(
        "https://kakuyomu.jp/rankings/all/weekly?work_variation=long&page=2",
      );
      expect(parser.buildRankingUrl({ page: 1 })).toBe(
        "https://kakuyomu.jp/rankings/all/weekly?work_variation=long",
      );
      expect(parser.buildRankingUrl({})).toBe(
        "https://kakuyomu.jp/rankings/all/weekly?work_variation=long",
      );
    });

    it("ジャンル・期間・ページの組み合わせで正しいランキング URL を生成すること", () => {
      const url = parser.buildRankingUrl({
        genre: "action",
        period: "monthly",
        page: 3,
      });
      expect(url).toBe(
        "https://kakuyomu.jp/rankings/action/monthly?work_variation=long&page=3",
      );
    });
  });

  describe("ランキング結果の解析 (AC-11)", () => {
    it("Apollo State 正常系フィクスチャから 1 位から昇順に付与された順位を含む作品一覧およびページ情報を抽出すること", () => {
      const html = loadFixture("ranking_results_apollo.html");
      const result = parser.getRanking(
        html,
        "https://kakuyomu.jp/rankings/all/weekly?work_variation=long",
      );

      expect(result.pageInfo.currentPage).toBe(1);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.items).toHaveLength(3);

      const first = result.items[0];
      expect(first.rank).toBe(1);
      expect(first.remoteWorkId).toBe("16817330658027210101");
      expect(first.title).toBe("ランキング1位作品：最強の剣士");
      expect(first.author).toBe("ランキング1位作家");
      expect(first.genre).toBe("fantasy");
      expect(first.genreLabel).toBe("異世界ファンタジー");
      expect(first.serialStatus).toBe("running");
      expect(first.serialStatusLabel).toBe("連載中");
      expect(first.reviewPoints).toBe(15200);

      const second = result.items[1];
      expect(second.rank).toBe(2);
      expect(second.remoteWorkId).toBe("16817330658027210102");
      expect(second.title).toBe("ランキング2位作品：魔女の薬草店");
      expect(second.author).toBe("ランキング2位作家");
      expect(second.serialStatus).toBe("completed");
      expect(second.serialStatusLabel).toBe("完結済");

      const third = result.items[2];
      expect(third.rank).toBe(3);
      expect(third.remoteWorkId).toBe("16817330658027210103");
      expect(third.title).toBe("ランキング3位作品：悪役令嬢の逆転劇");
      expect(third.genre).toBe("romance");
      expect(third.genreLabel).toBe("ラブコメ");
    });

    it("pageUrl に page=2 が指定されている場合、順位が正しくオフセットされること", () => {
      const html = loadFixture("ranking_results_apollo.html");
      const result = parser.getRanking(
        html,
        "https://kakuyomu.jp/rankings/all/weekly?work_variation=long&page=2",
      );
      expect(result.pageInfo.currentPage).toBe(2);
      expect(result.items[0].rank).toBe(101);
      expect(result.items[1].rank).toBe(102);
      expect(result.items[2].rank).toBe(103);
    });

    it("ランキングが 0 件の Apollo State を正常に処理し空リストを返すこと", () => {
      const html = loadFixture("ranking_results_empty.html");
      const result = parser.getRanking(
        html,
        "https://kakuyomu.jp/rankings/all/daily?work_variation=long",
      );
      expect(result.items).toEqual([]);
      expect(result.pageInfo.currentPage).toBe(1);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it("静的 DOM フィクスチャ（ranking_results_dom.html）から順位要素および作品情報をフォールバック抽出すること", () => {
      const html = loadFixture("ranking_results_dom.html");
      const result = parser.getRanking(
        html,
        "https://kakuyomu.jp/rankings/all/weekly?work_variation=long",
      );

      expect(result.pageInfo.currentPage).toBe(1);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.items).toHaveLength(2);

      const first = result.items[0];
      expect(first.rank).toBe(1);
      expect(first.remoteWorkId).toBe("16817330658027210201");
      expect(first.title).toBe("DOMランキング1位作品");
      expect(first.author).toBe("順位著者1");
      expect(first.genre).toBe("sf");
      expect(first.genreLabel).toBe("SF");
      expect(first.serialStatus).toBe("running");
      expect(first.serialStatusLabel).toBe("連載中");
      expect(first.episodeCount).toBe(10);
      expect(first.characterCount).toBe(30000);
      expect(first.reviewPoints).toBe(500);
      expect(first.tags).toEqual(["宇宙"]);
      expect(first.lastEpisodePublishedAt).toBe("2026-10-28T12:00:00Z");

      const second = result.items[1];
      expect(second.rank).toBe(2);
      expect(second.remoteWorkId).toBe("16817330658027210202");
      expect(second.title).toBe("DOMランキング2位作品");
      expect(second.author).toBe("順位著者2");
      expect(second.genre).toBe("love_story");
      expect(second.genreLabel).toBe("恋愛");
      expect(second.serialStatus).toBe("completed");
      expect(second.serialStatusLabel).toBe("完結済");
      expect(second.episodeCount).toBe(20);
      expect(second.characterCount).toBe(60000);
      expect(second.reviewPoints).toBe(800);
      expect(second.tags).toEqual(["純愛"]);
      expect(second.lastEpisodePublishedAt).toBe("2026-10-27T12:00:00Z");
    });

    it("Apollo State が壊れている場合でも DOM 抽出へ安全にフォールバックすること", () => {
      const brokenHtml = `
        <html><body>
          <script id="__NEXT_DATA__" type="application/json">{ invalid json </script>
          <div class="RankingWorkBox">
            <div class="RankingWorkBox_rank">1位</div>
            <h3 class="widget-work-title">
              <a href="/works/88888888">DOMフォールバック作品</a>
            </h3>
            <span class="widget-work-author"><a href="/users/author88">著者88</a></span>
          </div>
        </body></html>
      `;
      const result = parser.getRanking(
        brokenHtml,
        "https://kakuyomu.jp/rankings/all/weekly",
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0].rank).toBe(1);
      expect(result.items[0].remoteWorkId).toBe("88888888");
      expect(result.items[0].title).toBe("DOMフォールバック作品");
      expect(result.items[0].author).toBe("著者88");
    });
  });
});

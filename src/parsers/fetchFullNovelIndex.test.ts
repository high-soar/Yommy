import { describe, it, expect, vi, beforeEach } from "vitest";
import { MockHttpClient } from "../bridges/http/mockHttpClient";
import type { NovelParser, ParsedNovelIndex } from "./types";
import {
  DEFAULT_TOC_PAGE_INTERVAL_MS,
  MAX_TOC_PAGES,
  fetchFullNovelIndex,
} from "./fetchFullNovelIndex";

describe("fetchFullNovelIndex: 複数ページ目次連続取得パイプライン", () => {
  let mockHttpClient: MockHttpClient;
  let mockParser: NovelParser;

  beforeEach(() => {
    mockHttpClient = new MockHttpClient();
    mockParser = {
      siteType: "narou",
      canParse: vi.fn((url: string) => {
        try {
          const u = new URL(url);
          return (
            u.hostname === "ncode.syosetu.com" &&
            /^\/n\d+[a-z0-9]*/i.test(u.pathname)
          );
        } catch {
          return false;
        }
      }),
      normalizeWorkUrl: vi.fn((url: string) => {
        if (!mockParser.canParse(url)) {
          throw new Error("Invalid Narou work URL");
        }
        const u = new URL(url);
        const match = u.pathname.match(/^\/(n\d+[a-z0-9]*)/i);
        return `https://ncode.syosetu.com/${match![1].toLowerCase()}/`;
      }),
      parseNovelIndex: vi.fn(),
      parseChapterContent: vi.fn(),
    };
  });

  it("定数が正しくエクスポートされていること", () => {
    expect(DEFAULT_TOC_PAGE_INTERVAL_MS).toBe(500);
    expect(MAX_TOC_PAGES).toBe(100);
  });

  it("単一ページの作品目次を正常に取得・返却すること (nextTocPageUrl === null)", async () => {
    const canonicalUrl = "https://ncode.syosetu.com/n9669bk/";
    const pageHtml = "<html>single page</html>";

    mockHttpClient.setResponse(canonicalUrl, () => ({
      status: 200,
      url: canonicalUrl,
      headers: {},
      html: pageHtml,
    }));

    const mockIndex: ParsedNovelIndex = {
      siteType: "narou",
      remoteWorkId: "n9669bk",
      canonicalUrl,
      title: "単一ページ作品",
      author: "作者名",
      synopsis: "あらすじ",
      chapters: [
        {
          chapterIndex: 1,
          remoteChapterId: "1",
          partTitle: "第1部",
          title: "第1話",
          url: "https://ncode.syosetu.com/n9669bk/1/",
          publishedAt: "2026/01/01",
        },
      ],
      nextTocPageUrl: null,
    };

    vi.mocked(mockParser.parseNovelIndex).mockReturnValue(mockIndex);

    const result = await fetchFullNovelIndex(
      mockHttpClient,
      mockParser,
      canonicalUrl,
    );

    expect(mockParser.normalizeWorkUrl).toHaveBeenCalledWith(canonicalUrl);
    expect(mockParser.parseNovelIndex).toHaveBeenCalledWith(
      pageHtml,
      canonicalUrl,
    );
    expect(result.title).toBe("単一ページ作品");
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].chapterIndex).toBe(1);
    expect(result.nextTocPageUrl).toBeNull();
  });

  it("複数ページ（3ページ）の目次を順次取得し、partTitle引き継ぎと連番chapterIndexを付与して結合すること", async () => {
    const canonicalUrl = "https://ncode.syosetu.com/n9669bk/";
    const p1Url = canonicalUrl;
    const p2Url = "https://ncode.syosetu.com/n9669bk/?p=2";
    const p3Url = "https://ncode.syosetu.com/n9669bk/?p=3";

    mockHttpClient.setResponse(p1Url, () => ({
      status: 200,
      url: p1Url,
      headers: {},
      html: "<html>p1</html>",
    }));
    mockHttpClient.setResponse(p2Url, () => ({
      status: 200,
      url: p2Url,
      headers: {},
      html: "<html>p2</html>",
    }));
    mockHttpClient.setResponse(p3Url, () => ({
      status: 200,
      url: p3Url,
      headers: {},
      html: "<html>p3</html>",
    }));

    vi.mocked(mockParser.parseNovelIndex).mockImplementation((_html, url) => {
      if (url === p1Url) {
        return {
          siteType: "narou",
          remoteWorkId: "n9669bk",
          canonicalUrl,
          title: "3ページ超長編",
          author: "長編作家",
          synopsis: "長編あらすじ",
          chapters: [
            {
              chapterIndex: 1,
              remoteChapterId: "1",
              partTitle: "第1章 旅立ち",
              title: "第1話 出立",
              url: "https://ncode.syosetu.com/n9669bk/1/",
              publishedAt: "2026/01/01",
            },
            {
              chapterIndex: 2,
              remoteChapterId: "2",
              partTitle: "第1章 旅立ち",
              title: "第2話 遭遇",
              url: "https://ncode.syosetu.com/n9669bk/2/",
              publishedAt: "2026/01/02",
            },
          ],
          nextTocPageUrl: p2Url,
        };
      }
      if (url === p2Url) {
        return {
          siteType: "narou",
          remoteWorkId: "n9669bk",
          canonicalUrl,
          title: "3ページ超長編",
          author: "長編作家",
          synopsis: "長編あらすじ",
          chapters: [
            {
              chapterIndex: 1,
              remoteChapterId: "3",
              partTitle: null, // 前ページの「第1章 旅立ち」を引き継ぐべき
              title: "第3話 継続",
              url: "https://ncode.syosetu.com/n9669bk/3/",
              publishedAt: "2026/01/03",
            },
            {
              chapterIndex: 2,
              remoteChapterId: "4",
              partTitle: "第2章 激闘", // 新しい章見出し
              title: "第4話 開戦",
              url: "https://ncode.syosetu.com/n9669bk/4/",
              publishedAt: "2026/01/04",
            },
          ],
          nextTocPageUrl: p3Url,
        };
      }
      return {
        siteType: "narou",
        remoteWorkId: "n9669bk",
        canonicalUrl,
        title: "3ページ超長編",
        author: "長編作家",
        synopsis: "長編あらすじ",
        chapters: [
          {
            chapterIndex: 1,
            remoteChapterId: "5",
            partTitle: null, // 前ページの「第2章 激闘」を引き継ぐべき
            title: "第5話 終局",
            url: "https://ncode.syosetu.com/n9669bk/5/",
            publishedAt: "2026/01/05",
          },
        ],
        nextTocPageUrl: null,
      };
    });

    const result = await fetchFullNovelIndex(
      mockHttpClient,
      mockParser,
      "https://ncode.syosetu.com/N9669BK/", // 大文字URL
      { intervalMs: 0 },
    );

    expect(result.chapters).toHaveLength(5);
    // 連番 chapterIndex 1..5
    expect(result.chapters.map((c) => c.chapterIndex)).toEqual([1, 2, 3, 4, 5]);
    // partTitle 引き継ぎ検証
    expect(result.chapters[0].partTitle).toBe("第1章 旅立ち");
    expect(result.chapters[1].partTitle).toBe("第1章 旅立ち");
    expect(result.chapters[2].partTitle).toBe("第1章 旅立ち"); // 引き継ぎ成功
    expect(result.chapters[3].partTitle).toBe("第2章 激闘");
    expect(result.chapters[4].partTitle).toBe("第2章 激闘"); // 引き継ぎ成功
    expect(result.nextTocPageUrl).toBeNull();
  });

  it("1ページ目から章見出しがなく（partTitle === null）2ページ目もnullの場合、partTitleがnullのまま維持されること", async () => {
    const canonicalUrl = "https://ncode.syosetu.com/n9669bk/";
    const p2Url = "https://ncode.syosetu.com/n9669bk/?p=2";

    mockHttpClient.setResponse(canonicalUrl, () => ({
      status: 200,
      url: canonicalUrl,
      headers: {},
      html: "p1",
    }));
    mockHttpClient.setResponse(p2Url, () => ({
      status: 200,
      url: p2Url,
      headers: {},
      html: "p2",
    }));

    vi.mocked(mockParser.parseNovelIndex).mockImplementation((_html, url) => ({
      siteType: "narou",
      remoteWorkId: "n9669bk",
      canonicalUrl,
      title: "章なし作品",
      author: "作家",
      synopsis: "あらすじ",
      chapters: [
        {
          chapterIndex: 1,
          remoteChapterId: url === canonicalUrl ? "1" : "2",
          partTitle: null,
          title: "話",
          url: `${canonicalUrl}${url === canonicalUrl ? "1" : "2"}/`,
          publishedAt: "2026/01/01",
        },
      ],
      nextTocPageUrl: url === canonicalUrl ? p2Url : null,
    }));

    const result = await fetchFullNovelIndex(
      mockHttpClient,
      mockParser,
      canonicalUrl,
      { intervalMs: 0 },
    );

    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0].partTitle).toBeNull();
    expect(result.chapters[1].partTitle).toBeNull();
  });

  it("maxPages 上限に達した場合、それ以上のページ取得を中断し、そこまでのエピソードを結合して nextTocPageUrl: null で返却すること", async () => {
    const canonicalUrl = "https://ncode.syosetu.com/n9669bk/";

    mockHttpClient.setResponse(/.*/, (options) => ({
      status: 200,
      url: options.url,
      headers: {},
      html: "page",
    }));

    vi.mocked(mockParser.parseNovelIndex).mockImplementation((_html, url) => {
      const u = new URL(url);
      const pageNum = parseInt(u.searchParams.get("p") ?? "1", 10);
      return {
        siteType: "narou",
        remoteWorkId: "n9669bk",
        canonicalUrl,
        title: "無限ページ作品",
        author: "作家",
        synopsis: "あらすじ",
        chapters: [
          {
            chapterIndex: 1,
            remoteChapterId: String(pageNum),
            partTitle: null,
            title: `第${pageNum}話`,
            url: `${canonicalUrl}${pageNum}/`,
            publishedAt: "2026/01/01",
          },
        ],
        nextTocPageUrl: `https://ncode.syosetu.com/n9669bk/?p=${pageNum + 1}`,
      };
    });

    const result = await fetchFullNovelIndex(
      mockHttpClient,
      mockParser,
      canonicalUrl,
      { maxPages: 3, intervalMs: 0 },
    );

    // maxPages = 3 なので3ページ分（3話）で停止
    expect(result.chapters).toHaveLength(3);
    expect(result.chapters.map((c) => c.chapterIndex)).toEqual([1, 2, 3]);
    expect(result.nextTocPageUrl).toBeNull();
    expect(mockParser.parseNovelIndex).toHaveBeenCalledTimes(3);
  });

  it("循環 URL（同一 URL の再訪）を検知した場合、無限ループを防止して安全に終了すること", async () => {
    const canonicalUrl = "https://ncode.syosetu.com/n9669bk/";
    const loopUrl = "https://ncode.syosetu.com/n9669bk/?p=2";

    mockHttpClient.setResponse(/.*/, (options) => ({
      status: 200,
      url: options.url,
      headers: {},
      html: "page",
    }));

    vi.mocked(mockParser.parseNovelIndex).mockImplementation((_html, url) => {
      if (url === canonicalUrl) {
        return {
          siteType: "narou",
          remoteWorkId: "n9669bk",
          canonicalUrl,
          title: "循環作品",
          author: "作家",
          synopsis: "あらすじ",
          chapters: [
            {
              chapterIndex: 1,
              remoteChapterId: "1",
              partTitle: null,
              title: "第1話",
              url: `${canonicalUrl}1/`,
              publishedAt: "2026/01/01",
            },
          ],
          nextTocPageUrl: loopUrl,
        };
      }
      // loopUrl から canonicalUrl（訪問済み）を指す循環
      return {
        siteType: "narou",
        remoteWorkId: "n9669bk",
        canonicalUrl,
        title: "循環作品",
        author: "作家",
        synopsis: "あらすじ",
        chapters: [
          {
            chapterIndex: 1,
            remoteChapterId: "2",
            partTitle: null,
            title: "第2話",
            url: `${canonicalUrl}2/`,
            publishedAt: "2026/01/02",
          },
        ],
        nextTocPageUrl: canonicalUrl,
      };
    });

    const result = await fetchFullNovelIndex(
      mockHttpClient,
      mockParser,
      canonicalUrl,
      { intervalMs: 0 },
    );

    expect(result.chapters).toHaveLength(2);
    expect(result.nextTocPageUrl).toBeNull();
    expect(mockParser.parseNovelIndex).toHaveBeenCalledTimes(2);
  });

  describe("不正な nextTocPageUrl ガード（SSRF・別作品混入防止）", () => {
    const canonicalUrl = "https://ncode.syosetu.com/n9669bk/";

    const testInvalidNextUrl = async (invalidNextUrl: string) => {
      mockHttpClient.setResponse(canonicalUrl, () => ({
        status: 200,
        url: canonicalUrl,
        headers: {},
        html: "page1",
      }));

      vi.mocked(mockParser.parseNovelIndex).mockReturnValue({
        siteType: "narou",
        remoteWorkId: "n9669bk",
        canonicalUrl,
        title: "テスト作品",
        author: "作家",
        synopsis: "あらすじ",
        chapters: [
          {
            chapterIndex: 1,
            remoteChapterId: "1",
            partTitle: null,
            title: "第1話",
            url: `${canonicalUrl}1/`,
            publishedAt: "2026/01/01",
          },
        ],
        nextTocPageUrl: invalidNextUrl,
      });

      const result = await fetchFullNovelIndex(
        mockHttpClient,
        mockParser,
        canonicalUrl,
        { intervalMs: 0 },
      );

      expect(result.chapters).toHaveLength(1);
      expect(result.nextTocPageUrl).toBeNull();
      expect(mockParser.parseNovelIndex).toHaveBeenCalledTimes(1);
    };

    it("非 HTTPS スキームの次ページ URL は拒否して終了すること (http:)", async () => {
      await testInvalidNextUrl("http://ncode.syosetu.com/n9669bk/?p=2");
    });

    it("外部ドメインの次ページ URL は拒否して終了すること", async () => {
      await testInvalidNextUrl(
        "https://malicious-site.example.com/n9669bk/?p=2",
      );
    });

    it("同一サイトだが別作品の URL は拒否して終了すること", async () => {
      await testInvalidNextUrl("https://ncode.syosetu.com/n1234ab/?p=2");
    });

    it("パーサーが canParse false と判定する URL は拒否して終了すること", async () => {
      await testInvalidNextUrl("https://novel18.syosetu.com/n9669bk/?p=2");
    });
  });

  describe("中断・エラーハンドリング（アトミック性担保）", () => {
    it("開始時点ですでに AbortSignal が abort されている場合、通信を行わずに即時中断すること", async () => {
      const controller = new AbortController();
      controller.abort(new Error("Aborted before start"));

      await expect(
        fetchFullNovelIndex(
          mockHttpClient,
          mockParser,
          "https://ncode.syosetu.com/n9669bk/",
          { signal: controller.signal },
        ),
      ).rejects.toThrow("Aborted before start");

      expect(mockParser.parseNovelIndex).not.toHaveBeenCalled();
    });

    it("次ページ取得待ちの間（sleep中）に abort された場合、安全に例外を送出して中断すること", async () => {
      const canonicalUrl = "https://ncode.syosetu.com/n9669bk/";
      const p2Url = "https://ncode.syosetu.com/n9669bk/?p=2";

      mockHttpClient.setResponse(canonicalUrl, () => ({
        status: 200,
        url: canonicalUrl,
        headers: {},
        html: "p1",
      }));

      vi.mocked(mockParser.parseNovelIndex).mockReturnValue({
        siteType: "narou",
        remoteWorkId: "n9669bk",
        canonicalUrl,
        title: "作品",
        author: "作家",
        synopsis: "あらすじ",
        chapters: [
          {
            chapterIndex: 1,
            remoteChapterId: "1",
            partTitle: null,
            title: "1",
            url: `${canonicalUrl}1/`,
            publishedAt: "2026/01/01",
          },
        ],
        nextTocPageUrl: p2Url,
      });

      const controller = new AbortController();
      setTimeout(() => controller.abort(new Error("Aborted in interval")), 10);

      await expect(
        fetchFullNovelIndex(mockHttpClient, mockParser, canonicalUrl, {
          intervalMs: 100,
          signal: controller.signal,
        }),
      ).rejects.toThrow("Aborted in interval");
    });

    it("1ページ目の通信エラー時は例外を再送出すること", async () => {
      const canonicalUrl = "https://ncode.syosetu.com/n9669bk/";
      mockHttpClient.setResponse(canonicalUrl, () => {
        throw new Error("Network timeout on page 1");
      });

      await expect(
        fetchFullNovelIndex(mockHttpClient, mockParser, canonicalUrl, {
          intervalMs: 0,
        }),
      ).rejects.toThrow("Network timeout on page 1");
    });

    it("2ページ目以降の通信エラー時は例外を再送出して全体中断すること（不完全データの保存防止）", async () => {
      const canonicalUrl = "https://ncode.syosetu.com/n9669bk/";
      const p2Url = "https://ncode.syosetu.com/n9669bk/?p=2";

      mockHttpClient.setResponse(canonicalUrl, () => ({
        status: 200,
        url: canonicalUrl,
        headers: {},
        html: "p1",
      }));
      mockHttpClient.setResponse(p2Url, () => {
        throw new Error("HTTP 500 on page 2");
      });

      vi.mocked(mockParser.parseNovelIndex).mockReturnValue({
        siteType: "narou",
        remoteWorkId: "n9669bk",
        canonicalUrl,
        title: "作品",
        author: "作家",
        synopsis: "あらすじ",
        chapters: [
          {
            chapterIndex: 1,
            remoteChapterId: "1",
            partTitle: null,
            title: "1",
            url: `${canonicalUrl}1/`,
            publishedAt: "2026/01/01",
          },
        ],
        nextTocPageUrl: p2Url,
      });

      await expect(
        fetchFullNovelIndex(mockHttpClient, mockParser, canonicalUrl, {
          intervalMs: 0,
        }),
      ).rejects.toThrow("HTTP 500 on page 2");
    });

    it("2ページ目以降のパース例外時は例外を再送出して全体中断すること", async () => {
      const canonicalUrl = "https://ncode.syosetu.com/n9669bk/";
      const p2Url = "https://ncode.syosetu.com/n9669bk/?p=2";

      mockHttpClient.setResponse(canonicalUrl, () => ({
        status: 200,
        url: canonicalUrl,
        headers: {},
        html: "p1",
      }));
      mockHttpClient.setResponse(p2Url, () => ({
        status: 200,
        url: p2Url,
        headers: {},
        html: "invalid html",
      }));

      vi.mocked(mockParser.parseNovelIndex)
        .mockReturnValueOnce({
          siteType: "narou",
          remoteWorkId: "n9669bk",
          canonicalUrl,
          title: "作品",
          author: "作家",
          synopsis: "あらすじ",
          chapters: [
            {
              chapterIndex: 1,
              remoteChapterId: "1",
              partTitle: null,
              title: "1",
              url: `${canonicalUrl}1/`,
              publishedAt: "2026/01/01",
            },
          ],
          nextTocPageUrl: p2Url,
        })
        .mockImplementationOnce(() => {
          throw new Error("DOM parse failure on page 2");
        });

      await expect(
        fetchFullNovelIndex(mockHttpClient, mockParser, canonicalUrl, {
          intervalMs: 0,
        }),
      ).rejects.toThrow("DOM parse failure on page 2");
    });

    it("無効な作品URLを渡した場合は normalizeWorkUrl の例外がそのまま送出されること", async () => {
      await expect(
        fetchFullNovelIndex(
          mockHttpClient,
          mockParser,
          "https://invalid.example.com/",
        ),
      ).rejects.toThrow("Invalid Narou work URL");
    });
  });
});

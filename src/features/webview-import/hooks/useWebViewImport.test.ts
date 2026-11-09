import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useWebViewImport, isChapterUrl } from "./useWebViewImport";
import { MockWebViewDomBridge } from "../../../bridges/webview/mockWebViewDomBridge";
import type { CapturedDomResult } from "../../../bridges/webview/types";
import type {
  NovelRepository,
  ChapterRepository,
  NovelRecord,
  ChapterSummary,
} from "../../../storage/types";
import { ParserRegistry } from "../../../parsers/parserRegistry";
import type {
  NovelParser,
  ParsedNovelIndex,
  ParsedChapterContent,
} from "../../../parsers/types";
import type { SyncEngine } from "../../cloud-sync/services/syncEngine";
import type { HttpClientBridge } from "../../../bridges/http/types";

const mockHttpClient: HttpClientBridge = {
  getHtml: vi.fn(),
};

const sampleNovel: NovelRecord = {
  id: "kakuyomu:16817330658027210412",
  siteType: "kakuyomu",
  remoteWorkId: "16817330658027210412",
  canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
  title: "境界迷宮と異界の魔術師",
  author: "小野崎",
  synopsis: "テストあらすじ",
  totalChapters: 2,
  cachedChapters: 0,
  totalByteSize: 0,
  bookmarkChapterIndex: null,
  bookmarkScrollProgress: 0,
  isFavorite: false,
  lastCheckedAt: null,
  lastReadAt: null,
  createdAt: "2026-11-08T00:00:00Z",
  updatedAt: "2026-11-08T00:00:00Z",
};

const sampleChapters: ChapterSummary[] = [
  {
    id: "kakuyomu:16817330658027210412:1",
    novelId: "kakuyomu:16817330658027210412",
    chapterIndex: 1,
    remoteChapterId: "16817330658027210413",
    partTitle: null,
    title: "プロローグ",
    url: "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210413",
    byteSize: 0,
    isRead: false,
    publishedAt: "2026-10-01",
    downloadedAt: null,
  },
  {
    id: "kakuyomu:16817330658027210412:2",
    novelId: "kakuyomu:16817330658027210412",
    chapterIndex: 2,
    remoteChapterId: "16817330658027210414",
    partTitle: null,
    title: "第1話",
    url: "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210414",
    byteSize: 0,
    isRead: false,
    publishedAt: "2026-10-02",
    downloadedAt: null,
  },
];

describe("useWebViewImport", () => {
  let bridge: MockWebViewDomBridge;
  let mockNovelRepo: NovelRepository;
  let mockChapterRepo: ChapterRepository;
  let mockParserRegistry: ParserRegistry;
  let mockKakuyomuParser: NovelParser;
  let mockNarouParser: NovelParser;
  let mockSyncEngine: SyncEngine;

  beforeEach(() => {
    bridge = new MockWebViewDomBridge();

    mockNovelRepo = {
      listNovels: vi.fn().mockResolvedValue([sampleNovel]),
      getNovelById: vi.fn().mockImplementation(async (id: string) => {
        if (id === sampleNovel.id) return sampleNovel;
        return null;
      }),
      upsertNovelWithToc: vi.fn().mockResolvedValue(sampleNovel),
      updateBookmark: vi.fn().mockResolvedValue(undefined),
      setFavorite: vi.fn().mockResolvedValue(undefined),
      deleteNovel: vi.fn().mockResolvedValue(undefined),
      clearNewUpdate: vi.fn().mockResolvedValue(undefined),
      updateLastCheckedAt: vi.fn().mockResolvedValue(undefined),
    };

    mockChapterRepo = {
      listChaptersByNovelId: vi.fn().mockResolvedValue(sampleChapters),
      getChapter: vi.fn().mockResolvedValue(null),
      saveChapterBody: vi.fn().mockResolvedValue(undefined),
      markChapterRead: vi.fn().mockResolvedValue(undefined),
      deleteCachedBodies: vi.fn().mockResolvedValue(0),
      deleteAllCachedBodies: vi.fn().mockResolvedValue(0),
      getStorageCacheSummary: vi.fn().mockResolvedValue({
        totalCachedChapters: 0,
        totalByteSize: 0,
      }),
    };

    mockKakuyomuParser = {
      siteType: "kakuyomu",
      canParse: vi.fn((url: string) => url.includes("kakuyomu.jp")),
      normalizeWorkUrl: vi.fn((url: string) => {
        const match = url.match(/(https:\/\/kakuyomu\.jp\/works\/[^/]+)/);
        return match ? match[1] : url;
      }),
      parseNovelIndex: vi.fn((): ParsedNovelIndex => ({
        siteType: "kakuyomu",
        remoteWorkId: "16817330658027210412",
        canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
        title: "境界迷宮と異界の魔術師",
        author: "小野崎",
        synopsis: "テストあらすじ",
        chapters: [
          {
            chapterIndex: 1,
            remoteChapterId: "16817330658027210413",
            partTitle: null,
            title: "プロローグ",
            url: "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210413",
            publishedAt: "2026-10-01",
          },
        ],
        nextTocPageUrl: null,
      })),
      parseChapterContent: vi.fn(
        (_html?: string, url?: string): ParsedChapterContent => {
          const episodeMatch = url?.match(/\/episodes\/([^/]+)/);
          const remoteChapterId = episodeMatch
            ? episodeMatch[1]
            : "16817330658027210413";
          return {
            remoteChapterId,
            title: "プロローグ",
            bodyHtml: "<p>本文テキスト</p>",
            byteSize: 100,
            prevChapterUrl: null,
            nextChapterUrl: null,
          };
        },
      ),
    };

    mockNarouParser = {
      siteType: "narou",
      canParse: vi.fn((url: string) => url.includes("syosetu.com")),
      normalizeWorkUrl: vi.fn((url: string) => {
        if (url.includes("n9669bk"))
          return "https://ncode.syosetu.com/n9669bk/";
        return url;
      }),
      parseNovelIndex: vi.fn((): ParsedNovelIndex => ({
        siteType: "narou",
        remoteWorkId: "n9669bk",
        canonicalUrl: "https://ncode.syosetu.com/n9669bk/",
        title: "なろう短編作品",
        author: "作者",
        synopsis: "あらすじ",
        chapters: [
          {
            chapterIndex: 1,
            remoteChapterId: "1",
            partTitle: null,
            title: "なろう短編作品",
            url: "https://ncode.syosetu.com/n9669bk/",
            publishedAt: "2026-10-01",
          },
        ],
        nextTocPageUrl: null,
      })),
      parseChapterContent: vi.fn((): ParsedChapterContent => ({
        remoteChapterId: "1",
        title: "なろう短編作品",
        bodyHtml: "<p>短編本文</p>",
        byteSize: 200,
        prevChapterUrl: null,
        nextChapterUrl: null,
      })),
    };

    mockParserRegistry = new ParserRegistry();
    mockParserRegistry.register(mockKakuyomuParser);
    mockParserRegistry.register(mockNarouParser);

    mockSyncEngine = {
      notifyChanged: vi.fn().mockResolvedValue(undefined),
    } as unknown as SyncEngine;
  });

  describe("初期化とURLロード・危険スキーム遮断 (AC-WV-01, AC-WV-02)", () => {
    it("初期 URL 未指定時は空の状態で初期化されること", () => {
      const { result } = renderHook(() =>
        useWebViewImport({
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      expect(result.current.url).toBe("");
      expect(result.current.pageTitle).toBe("");
      expect(result.current.canImport).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isImporting).toBe(false);
      expect(result.current.notice).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("初期 URL が与えられた場合、自動的にロードとパーサー判定が行われること", async () => {
      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://kakuyomu.jp/works/16817330658027210412",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      await act(async () => {});

      expect(result.current.url).toBe(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      expect(result.current.canImport).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("危険な URL スキーム（javascript:, data:, file: 等）は遮断されエラーとなること (AC-WV-02)", async () => {
      const { result } = renderHook(() =>
        useWebViewImport({
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      let success: boolean = true;
      await act(async () => {
        success = await result.current.loadUrl("javascript:alert(1)");
      });

      expect(success).toBe(false);
      expect(result.current.canImport).toBe(false);
      expect(result.current.error).toBe("安全でない URL スキームは開けません");
    });

    it("非対応 URL（カクヨム・なろう以外）をロードした場合は canImport が false になること (AC-WV-04)", async () => {
      const { result } = renderHook(() =>
        useWebViewImport({
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      let success: boolean = false;
      await act(async () => {
        success = await result.current.loadUrl("https://example.com/page");
      });

      expect(success).toBe(true);
      expect(result.current.canImport).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("空文字または空白のみの URL 移動時は false を返し状態を変更しないこと", async () => {
      const { result } = renderHook(() =>
        useWebViewImport({
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      let success: boolean = true;
      await act(async () => {
        success = await result.current.loadUrl("   ");
      });

      expect(success).toBe(false);
    });

    it("引数なしで loadUrl を呼び出した場合、現在の url state を使ってロードされること", async () => {
      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://kakuyomu.jp/works/16817330658027210412",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      await act(async () => {});

      let success: boolean = false;
      await act(async () => {
        success = await result.current.loadUrl();
      });

      expect(success).toBe(true);
      expect(result.current.canImport).toBe(true);
    });
  });

  describe("ネイティブブラウザ起動 (AC-WV-03)", () => {
    it("openNativeBrowser 実行時に bridge.open が安全な URL で呼び出されること", async () => {
      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://kakuyomu.jp/works/16817330658027210412",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      const openSpy = vi.spyOn(bridge, "open");

      await act(async () => {
        await result.current.openNativeBrowser();
      });

      expect(openSpy).toHaveBeenCalledWith({
        url: "https://kakuyomu.jp/works/16817330658027210412",
        title: undefined,
      });
    });

    it("危険スキーム URL で openNativeBrowser を実行した場合はエラーとなること", async () => {
      const { result } = renderHook(() =>
        useWebViewImport({
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      act(() => {
        result.current.setUrl("file:///android_asset/secret.txt");
      });

      await act(async () => {
        await result.current.openNativeBrowser();
      });

      expect(result.current.error).toBe("安全でない URL スキームは開けません");
    });

    it("bridge.open が Error 例外を送出した場合、そのメッセージが error に設定されること", async () => {
      vi.spyOn(bridge, "open").mockRejectedValueOnce(
        new Error("ブラウザの起動に失敗"),
      );

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://kakuyomu.jp/works/16817330658027210412",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      await act(async () => {
        await result.current.openNativeBrowser();
      });

      expect(result.current.error).toBe("ブラウザの起動に失敗");
    });

    it("bridge.open が非 Error 例外を送出した場合、既定のエラーメッセージが設定されること", async () => {
      vi.spyOn(bridge, "open").mockRejectedValueOnce("Unknown failure");

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://kakuyomu.jp/works/16817330658027210412",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      await act(async () => {
        await result.current.openNativeBrowser();
      });

      expect(result.current.error).toBe("ブラウザの起動に失敗しました");
    });
  });

  describe("作品トップ（目次）DOM インポート保存 (AC-WV-05, TR-11)", () => {
    it("目次ページ表示中にインポートを実行すると parseNovelIndex され upsertNovelWithToc で保存されること", async () => {
      bridge.setMockPage({
        html: "<html><body><div id='workTitle'>異界の魔術師</div></body></html>",
        url: "https://kakuyomu.jp/works/16817330658027210412",
        title: "作品目次ページ",
      });

      const onImportCompleteMock = vi.fn();

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://kakuyomu.jp/works/16817330658027210412",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
          syncEngine: mockSyncEngine,
          onImportComplete: onImportCompleteMock,
        }),
      );

      let importResult: unknown = null;
      await act(async () => {
        importResult = await result.current.importCurrentDom();
      });

      expect(mockKakuyomuParser.parseNovelIndex).toHaveBeenCalled();
      expect(mockNovelRepo.upsertNovelWithToc).toHaveBeenCalled();
      expect(mockSyncEngine.notifyChanged).toHaveBeenCalled();
      expect(onImportCompleteMock).toHaveBeenCalledWith({
        type: "novel",
        novelId: sampleNovel.id,
      });
      expect(importResult).toEqual({
        type: "novel",
        novelId: sampleNovel.id,
      });
      expect(result.current.notice).toContain("作品目次");
    });

    it("なろう短編作品（1話完結）の場合、parseChapterContent と saveChapterBody も実行されること", async () => {
      const narouShortNovel: NovelRecord = {
        ...sampleNovel,
        id: "narou:n9669bk",
        siteType: "narou",
        remoteWorkId: "n9669bk",
        canonicalUrl: "https://ncode.syosetu.com/n9669bk/",
      };

      (
        mockNovelRepo.upsertNovelWithToc as ReturnType<typeof vi.fn>
      ).mockResolvedValue(narouShortNovel);

      bridge.setMockPage({
        html: "<html><body><div id='novel_honbun'>短編の本文です</div></body></html>",
        url: "https://ncode.syosetu.com/n9669bk/",
        title: "なろう短編",
      });

      const onImportCompleteMock = vi.fn();

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://ncode.syosetu.com/n9669bk/",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
          syncEngine: mockSyncEngine,
          onImportComplete: onImportCompleteMock,
        }),
      );

      let importResult: unknown = null;
      await act(async () => {
        importResult = await result.current.importCurrentDom();
      });

      expect(mockNarouParser.parseNovelIndex).toHaveBeenCalled();
      expect(mockNarouParser.parseChapterContent).toHaveBeenCalled();
      expect(mockChapterRepo.saveChapterBody).toHaveBeenCalledWith(
        narouShortNovel.id,
        1,
        expect.anything(),
        expect.any(String),
      );
      expect(onImportCompleteMock).toHaveBeenCalledWith({
        type: "novel",
        novelId: narouShortNovel.id,
      });
      expect(importResult).toEqual({
        type: "novel",
        novelId: narouShortNovel.id,
      });
    });

    it("なろう短編作品で p-novel__body クラスが含まれる場合も本文が同時保存されること", async () => {
      const narouShortNovel: NovelRecord = {
        ...sampleNovel,
        id: "narou:n1111aa",
        siteType: "narou",
        remoteWorkId: "n1111aa",
        canonicalUrl: "https://ncode.syosetu.com/n1111aa/",
      };

      (
        mockNovelRepo.upsertNovelWithToc as ReturnType<typeof vi.fn>
      ).mockResolvedValue(narouShortNovel);

      bridge.setMockPage({
        html: "<html><body><div class='p-novel__body'>新レイアウト本文</div></body></html>",
        url: "https://ncode.syosetu.com/n1111aa/",
        title: "なろう短編新レイアウト",
      });

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://ncode.syosetu.com/n1111aa/",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      await act(async () => {
        await result.current.importCurrentDom();
      });

      expect(mockNarouParser.parseChapterContent).toHaveBeenCalled();
      expect(mockChapterRepo.saveChapterBody).toHaveBeenCalledWith(
        narouShortNovel.id,
        1,
        expect.anything(),
        expect.any(String),
      );
    });

    it("なろう短編作品で章 URL が作品 URL と同一の場合も本文が同時保存されること", async () => {
      const narouShortNovel: NovelRecord = {
        ...sampleNovel,
        id: "narou:n2222bb",
        siteType: "narou",
        remoteWorkId: "n2222bb",
        canonicalUrl: "https://ncode.syosetu.com/n2222bb/",
      };

      const customIndex: ParsedNovelIndex = {
        siteType: "narou",
        remoteWorkId: "n2222bb",
        canonicalUrl: "https://ncode.syosetu.com/n2222bb/",
        title: "短編同一URL",
        author: "作者",
        synopsis: "あらすじ",
        chapters: [
          {
            chapterIndex: 1,
            remoteChapterId: "1",
            partTitle: null,
            title: "短編",
            url: "https://ncode.syosetu.com/n2222bb/",
            publishedAt: "2026-10-01",
          },
        ],
        nextTocPageUrl: null,
      };

      vi.spyOn(mockNarouParser, "parseNovelIndex").mockReturnValueOnce(
        customIndex,
      );
      (
        mockNovelRepo.upsertNovelWithToc as ReturnType<typeof vi.fn>
      ).mockResolvedValue(narouShortNovel);

      bridge.setMockPage({
        html: "<html><body>本文テキスト</body></html>",
        url: "https://ncode.syosetu.com/n2222bb/",
        title: "短編同一URL",
      });

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://ncode.syosetu.com/n2222bb/",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      await act(async () => {
        await result.current.importCurrentDom();
      });

      expect(mockNarouParser.parseChapterContent).toHaveBeenCalled();
      expect(mockChapterRepo.saveChapterBody).toHaveBeenCalled();
    });

    it("nextTocPageUrl !== null の複数ページ目次インポート時、fetchFullNovelIndex を介して全話取得して保存すること (R1-01)", async () => {
      bridge.setMockPage({
        html: "<html><body>1ページ目</body></html>",
        url: "https://ncode.syosetu.com/n9669bk/",
        title: "複数ページ連載作品",
      });

      const mockIndexP1: ParsedNovelIndex = {
        siteType: "narou",
        remoteWorkId: "n9669bk",
        canonicalUrl: "https://ncode.syosetu.com/n9669bk/",
        title: "複数ページ連載作品",
        author: "作者",
        synopsis: "",
        chapters: [
          {
            chapterIndex: 1,
            remoteChapterId: "1",
            partTitle: null,
            title: "第1話",
            url: "https://ncode.syosetu.com/n9669bk/1/",
            publishedAt: null,
          },
        ],
        nextTocPageUrl: "https://ncode.syosetu.com/n9669bk/?p=2",
      };

      const mockFullIndex: ParsedNovelIndex = {
        ...mockIndexP1,
        chapters: [
          ...mockIndexP1.chapters,
          {
            chapterIndex: 2,
            remoteChapterId: "2",
            partTitle: null,
            title: "第2話",
            url: "https://ncode.syosetu.com/n9669bk/2/",
            publishedAt: null,
          },
        ],
        nextTocPageUrl: null,
      };

      (
        mockNarouParser.parseNovelIndex as ReturnType<typeof vi.fn>
      ).mockReturnValue(mockIndexP1);

      const mockFetchFull = vi.fn().mockResolvedValue(mockFullIndex);

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://ncode.syosetu.com/n9669bk/",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
          httpClient: mockHttpClient,
          fetchFullNovelIndex: mockFetchFull,
        }),
      );

      let importResult: unknown = null;
      await act(async () => {
        importResult = await result.current.importCurrentDom();
      });

      expect(mockFetchFull).toHaveBeenCalledWith(
        mockHttpClient,
        mockNarouParser,
        "https://ncode.syosetu.com/n9669bk/",
      );
      expect(mockNovelRepo.upsertNovelWithToc).toHaveBeenCalledWith(
        mockFullIndex,
        expect.any(String),
      );
      expect(importResult).not.toBeNull();
    });

    it("fetchFullNovelIndex が未指定の場合、デフォルトの fetchFullNovelIndex 実装が使用されること (R1-01)", async () => {
      bridge.setMockPage({
        html: "<html><body>1ページ目</body></html>",
        url: "https://ncode.syosetu.com/n9669bk/",
        title: "複数ページ連載作品",
      });

      const mockIndexP1: ParsedNovelIndex = {
        siteType: "narou",
        remoteWorkId: "n9669bk",
        canonicalUrl: "https://ncode.syosetu.com/n9669bk/",
        title: "複数ページ連載作品",
        author: "作者",
        synopsis: "",
        chapters: [],
        nextTocPageUrl: "https://ncode.syosetu.com/n9669bk/?p=2",
      };

      (
        mockNarouParser.parseNovelIndex as ReturnType<typeof vi.fn>
      ).mockReturnValue(mockIndexP1);

      (mockHttpClient.getHtml as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 200,
        url: "https://ncode.syosetu.com/n9669bk/",
        headers: {},
        html: "<html>目次</html>",
      });

      // fetchFullNovelIndex を省略してフックを初期化
      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://ncode.syosetu.com/n9669bk/",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
          httpClient: mockHttpClient,
        }),
      );

      let importResult: unknown = null;
      await act(async () => {
        importResult = await result.current.importCurrentDom();
      });

      expect(mockNovelRepo.upsertNovelWithToc).toHaveBeenCalled();
      expect(importResult).not.toBeNull();
    });

    it("キャプチャ URL に ?p=2 等のページ指定がある場合、fetchFullNovelIndex を介して全話取得して保存すること (R1-01)", async () => {
      bridge.setMockPage({
        html: "<html><body>2ページ目</body></html>",
        url: "https://ncode.syosetu.com/n9669bk/?p=2",
        title: "複数ページ連載作品 2ページ目",
      });

      const mockIndexP2: ParsedNovelIndex = {
        siteType: "narou",
        remoteWorkId: "n9669bk",
        canonicalUrl: "https://ncode.syosetu.com/n9669bk/",
        title: "複数ページ連載作品",
        author: "作者",
        synopsis: "",
        chapters: [
          {
            chapterIndex: 2,
            remoteChapterId: "2",
            partTitle: null,
            title: "第2話",
            url: "https://ncode.syosetu.com/n9669bk/2/",
            publishedAt: null,
          },
        ],
        nextTocPageUrl: null,
      };

      const mockFullIndex: ParsedNovelIndex = {
        ...mockIndexP2,
        chapters: [
          {
            chapterIndex: 1,
            remoteChapterId: "1",
            partTitle: null,
            title: "第1話",
            url: "https://ncode.syosetu.com/n9669bk/1/",
            publishedAt: null,
          },
          ...mockIndexP2.chapters,
        ],
        nextTocPageUrl: null,
      };

      (
        mockNarouParser.parseNovelIndex as ReturnType<typeof vi.fn>
      ).mockReturnValue(mockIndexP2);

      const mockFetchFull = vi.fn().mockResolvedValue(mockFullIndex);

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://ncode.syosetu.com/n9669bk/?p=2",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
          httpClient: mockHttpClient,
          fetchFullNovelIndex: mockFetchFull,
        }),
      );

      let importResult: unknown = null;
      await act(async () => {
        importResult = await result.current.importCurrentDom();
      });

      expect(mockFetchFull).toHaveBeenCalledWith(
        mockHttpClient,
        mockNarouParser,
        "https://ncode.syosetu.com/n9669bk/",
      );
      expect(mockNovelRepo.upsertNovelWithToc).toHaveBeenCalledWith(
        mockFullIndex,
        expect.any(String),
      );
      expect(importResult).not.toBeNull();
    });

    it("複数ページ目次であるにもかかわらず httpClient が未渡下の場合、エラーを設定して中断すること (R1-01)", async () => {
      bridge.setMockPage({
        html: "<html><body>1ページ目</body></html>",
        url: "https://ncode.syosetu.com/n9669bk/",
        title: "複数ページ連載作品",
      });

      const mockIndexP1: ParsedNovelIndex = {
        siteType: "narou",
        remoteWorkId: "n9669bk",
        canonicalUrl: "https://ncode.syosetu.com/n9669bk/",
        title: "複数ページ連載作品",
        author: "作者",
        synopsis: "",
        chapters: [],
        nextTocPageUrl: "https://ncode.syosetu.com/n9669bk/?p=2",
      };

      (
        mockNarouParser.parseNovelIndex as ReturnType<typeof vi.fn>
      ).mockReturnValue(mockIndexP1);

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://ncode.syosetu.com/n9669bk/",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
          // httpClient 未渡下
        }),
      );

      let importResult: unknown = null;
      await act(async () => {
        importResult = await result.current.importCurrentDom();
      });

      expect(importResult).toBeNull();
      expect(result.current.error).toBe(
        "複数ページ目次の取得にはネットワーク接続が必要です",
      );
    });

    it("複数ページ目次の fetchFullNovelIndex が例外を送出した場合、エラーを設定して中断すること (R1-01)", async () => {
      bridge.setMockPage({
        html: "<html><body>1ページ目</body></html>",
        url: "https://ncode.syosetu.com/n9669bk/",
        title: "複数ページ連載作品",
      });

      const mockIndexP1: ParsedNovelIndex = {
        siteType: "narou",
        remoteWorkId: "n9669bk",
        canonicalUrl: "https://ncode.syosetu.com/n9669bk/",
        title: "複数ページ連載作品",
        author: "作者",
        synopsis: "",
        chapters: [],
        nextTocPageUrl: "https://ncode.syosetu.com/n9669bk/?p=2",
      };

      (
        mockNarouParser.parseNovelIndex as ReturnType<typeof vi.fn>
      ).mockReturnValue(mockIndexP1);

      const mockFetchFull = vi
        .fn()
        .mockRejectedValue(new Error("Network timeout"));

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://ncode.syosetu.com/n9669bk/",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
          httpClient: mockHttpClient,
          fetchFullNovelIndex: mockFetchFull,
        }),
      );

      let importResult: unknown = null;
      await act(async () => {
        importResult = await result.current.importCurrentDom();
      });

      expect(importResult).toBeNull();
      expect(result.current.error).toBe("複数ページ目次の取得に失敗しました");
    });
  });

  describe("各話エピソード（本文）DOM インポート保存 (AC-WV-06, TR-11)", () => {
    it("登録済み作品のエピソード表示中にインポートすると saveChapterBody されリーダー遷移すること", async () => {
      bridge.setMockPage({
        html: "<html><body><div class='widget-episodeBody'>本文</div></body></html>",
        url: "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210413",
        title: "第1話 プロローグ",
      });

      const onImportCompleteMock = vi.fn();

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl:
            "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210413",
          initialNovelId: sampleNovel.id,
          initialChapterIndex: 1,
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
          syncEngine: mockSyncEngine,
          onImportComplete: onImportCompleteMock,
        }),
      );

      let importResult: unknown = null;
      await act(async () => {
        importResult = await result.current.importCurrentDom();
      });

      expect(mockKakuyomuParser.parseChapterContent).toHaveBeenCalled();
      expect(mockChapterRepo.saveChapterBody).toHaveBeenCalledWith(
        sampleNovel.id,
        1,
        expect.anything(),
        expect.any(String),
      );
      expect(mockSyncEngine.notifyChanged).toHaveBeenCalled();
      expect(onImportCompleteMock).toHaveBeenCalledWith({
        type: "chapter",
        novelId: sampleNovel.id,
        chapterIndex: 1,
      });
      expect(importResult).toEqual({
        type: "chapter",
        novelId: sampleNovel.id,
        chapterIndex: 1,
      });
      expect(result.current.notice).toContain("本文");
    });

    it("onImportComplete 未指定時でも本文インポートが正常に完了すること", async () => {
      bridge.setMockPage({
        html: "<html><body><div class='widget-episodeBody'>本文</div></body></html>",
        url: "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210413",
        title: "第1話 プロローグ",
      });

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl:
            "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210413",
          initialNovelId: sampleNovel.id,
          initialChapterIndex: 1,
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      let importResult: unknown = null;
      await act(async () => {
        importResult = await result.current.importCurrentDom();
      });

      expect(importResult).toEqual({
        type: "chapter",
        novelId: sampleNovel.id,
        chapterIndex: 1,
      });
      expect(result.current.notice).toContain("本文");
    });

    it("未登録作品のエピソード表示時に fetchFullNovelIndex による目次自動補完が成功して本文保存されること (AC-WV-07)", async () => {
      (
        mockNovelRepo.getNovelById as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (mockNovelRepo.listNovels as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      const mockFetchFullIndex = vi.fn().mockResolvedValue({
        siteType: "kakuyomu",
        remoteWorkId: "16817330658027210412",
        canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
        title: "自動補完された作品",
        author: "作者",
        synopsis: "あらすじ",
        chapters: [
          {
            chapterIndex: 1,
            remoteChapterId: "16817330658027210413",
            partTitle: null,
            title: "プロローグ",
            url: "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210413",
            publishedAt: "2026-10-01",
          },
        ],
        nextTocPageUrl: null,
      });

      bridge.setMockPage({
        html: "<html><body><div class='widget-episodeBody'>本文</div></body></html>",
        url: "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210413",
        title: "第1話",
      });

      const onImportCompleteMock = vi.fn();

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl:
            "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210413",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
          httpClient: mockHttpClient,
          fetchFullNovelIndex: mockFetchFullIndex,
          onImportComplete: onImportCompleteMock,
        }),
      );

      let importResult: unknown = null;
      await act(async () => {
        importResult = await result.current.importCurrentDom();
      });

      expect(mockFetchFullIndex).toHaveBeenCalled();
      expect(mockNovelRepo.upsertNovelWithToc).toHaveBeenCalled();
      expect(mockChapterRepo.saveChapterBody).toHaveBeenCalled();
      expect(onImportCompleteMock).toHaveBeenCalledWith({
        type: "chapter",
        novelId: sampleNovel.id,
        chapterIndex: 1,
      });
      expect(importResult).not.toBeNull();
    });

    it("未登録作品で目次自動補完が失敗した場合、エラー案内を表示し保存しないこと (AC-WV-07)", async () => {
      (
        mockNovelRepo.getNovelById as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (mockNovelRepo.listNovels as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      const mockFetchFullIndex = vi
        .fn()
        .mockRejectedValue(new Error("Cloudflare challenge required"));

      bridge.setMockPage({
        html: "<html><body>本文</body></html>",
        url: "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210413",
        title: "第1話",
      });

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl:
            "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210413",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
          httpClient: mockHttpClient,
          fetchFullNovelIndex: mockFetchFullIndex,
        }),
      );

      let importResult: unknown = null;
      await act(async () => {
        importResult = await result.current.importCurrentDom();
      });

      expect(importResult).toBeNull();
      expect(result.current.error).toBe(
        "先に作品トップ（目次）ページを取り込んでください",
      );
      expect(mockChapterRepo.saveChapterBody).not.toHaveBeenCalled();
    });

    it("initialNovelId 未指定でも listNovels 内の作品 canonicalUrl 一致から対象作品が特定されること", async () => {
      bridge.setMockPage({
        html: "<html><body><div class='widget-episodeBody'>本文</div></body></html>",
        url: "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210413",
        title: "第1話",
      });

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl:
            "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210413",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      let importResult: unknown = null;
      await act(async () => {
        importResult = await result.current.importCurrentDom();
      });

      expect(importResult).toEqual({
        type: "chapter",
        novelId: sampleNovel.id,
        chapterIndex: 1,
      });
      expect(mockChapterRepo.saveChapterBody).toHaveBeenCalledWith(
        sampleNovel.id,
        1,
        expect.anything(),
        expect.any(String),
      );
    });

    it("章一覧に一致する remoteChapterId が存在せず目次自動更新後も見つからない場合、誤上書きを防ぐためエラーとなり保存されないこと (R1-01)", async () => {
      (
        mockChapterRepo.listChaptersByNovelId as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      bridge.setMockPage({
        html: "<html><body><div class='widget-episodeBody'>未知のエピソード本文</div></body></html>",
        url: "https://kakuyomu.jp/works/16817330658027210412/episodes/9999999999",
        title: "番外編",
      });

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl:
            "https://kakuyomu.jp/works/16817330658027210412/episodes/9999999999",
          initialNovelId: sampleNovel.id,
          initialChapterIndex: 5,
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      let res: unknown = null;
      await act(async () => {
        res = await result.current.importCurrentDom();
      });

      expect(res).toBeNull();
      expect(result.current.error).toBe(
        "該当エピソードが作品目次に見つかりません。先に作品トップ（目次）を取り込んでください",
      );
      expect(mockChapterRepo.saveChapterBody).not.toHaveBeenCalled();
    });

    it("章一覧に存在しない話でも fetchFullNovelIndex による目次再取得で見つかった場合は正常に保存されること (R1-01)", async () => {
      // 初回は空、目次更新後は一致する章が存在
      const updatedChapters: ChapterSummary[] = [
        {
          id: "kakuyomu:16817330658027210412:3",
          novelId: sampleNovel.id,
          chapterIndex: 3,
          remoteChapterId: "9999999999",
          partTitle: null,
          title: "新着話",
          url: "https://kakuyomu.jp/works/16817330658027210412/episodes/9999999999",
          byteSize: 0,
          isRead: false,
          publishedAt: "2026-11-09",
          downloadedAt: null,
        },
      ];
      (mockChapterRepo.listChaptersByNovelId as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(updatedChapters);

      const mockFetchFull = vi.fn().mockResolvedValue({
        siteType: "kakuyomu",
        remoteWorkId: "16817330658027210412",
        canonicalUrl: sampleNovel.canonicalUrl,
        title: sampleNovel.title,
        author: sampleNovel.author,
        synopsis: sampleNovel.synopsis,
        chapters: [
          {
            chapterIndex: 3,
            remoteChapterId: "9999999999",
            partTitle: null,
            title: "新着話",
            url: "https://kakuyomu.jp/works/16817330658027210412/episodes/9999999999",
            publishedAt: "2026-11-09",
          },
        ],
        nextTocPageUrl: null,
      });

      bridge.setMockPage({
        html: "<html><body><div class='widget-episodeBody'>新着本文</div></body></html>",
        url: "https://kakuyomu.jp/works/16817330658027210412/episodes/9999999999",
        title: "新着話",
      });

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl:
            "https://kakuyomu.jp/works/16817330658027210412/episodes/9999999999",
          initialNovelId: sampleNovel.id,
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
          httpClient: mockHttpClient,
          fetchFullNovelIndex: mockFetchFull,
        }),
      );

      let res: unknown = null;
      await act(async () => {
        res = await result.current.importCurrentDom();
      });

      expect(res).toEqual({
        type: "chapter",
        novelId: sampleNovel.id,
        chapterIndex: 3,
      });
      expect(mockFetchFull).toHaveBeenCalled();
      expect(mockChapterRepo.saveChapterBody).toHaveBeenCalledWith(
        sampleNovel.id,
        3,
        expect.anything(),
        expect.any(String),
      );
    });

    it("章一覧に存在しない話で fetchFullNovelIndex 呼び出し時に例外が発生した場合でもクラッシュせず、エラーメッセージが設定されて null を返すこと (R1-01)", async () => {
      (
        mockChapterRepo.listChaptersByNovelId as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      const mockFetchFull = vi
        .fn()
        .mockRejectedValue(new Error("ネットワークエラー"));

      bridge.setMockPage({
        html: "<html><body><div class='widget-episodeBody'>新着本文</div></body></html>",
        url: "https://kakuyomu.jp/works/16817330658027210412/episodes/9999999999",
        title: "新着話",
      });

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl:
            "https://kakuyomu.jp/works/16817330658027210412/episodes/9999999999",
          initialNovelId: sampleNovel.id,
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
          httpClient: mockHttpClient,
          fetchFullNovelIndex: mockFetchFull,
        }),
      );

      let res: unknown = null;
      await act(async () => {
        res = await result.current.importCurrentDom();
      });

      expect(res).toBeNull();
      expect(result.current.error).toBe(
        "該当エピソードが作品目次に見つかりません。先に作品トップ（目次）を取り込んでください",
      );
      expect(mockFetchFull).toHaveBeenCalled();
      expect(mockChapterRepo.saveChapterBody).not.toHaveBeenCalled();
    });

    it("initialNovelId の canonicalUrl とキャプチャ話の canonicalUrl が一致しない場合、別作品へ誤上書きせず別作品の検索・分岐が行われること (R1-01)", async () => {
      // initialNovelId は sampleNovel (作品A) だが、キャプチャされた話は作品BのURL
      const anotherNovel: NovelRecord = {
        ...sampleNovel,
        id: "kakuyomu:9999999999999999999",
        remoteWorkId: "9999999999999999999",
        canonicalUrl: "https://kakuyomu.jp/works/9999999999999999999",
        title: "別作品タイトル",
      };
      (mockNovelRepo.listNovels as ReturnType<typeof vi.fn>).mockResolvedValue([
        sampleNovel,
        anotherNovel,
      ]);
      (
        mockNovelRepo.getNovelById as ReturnType<typeof vi.fn>
      ).mockImplementation(async (id: string) => {
        if (id === sampleNovel.id) return sampleNovel;
        if (id === anotherNovel.id) return anotherNovel;
        return null;
      });
      (
        mockChapterRepo.listChaptersByNovelId as ReturnType<typeof vi.fn>
      ).mockImplementation(async (novelId: string) => {
        if (novelId === anotherNovel.id) {
          return [
            {
              id: `${anotherNovel.id}:1`,
              novelId: anotherNovel.id,
              chapterIndex: 1,
              remoteChapterId: "12345",
              partTitle: null,
              title: "第1話",
              url: "https://kakuyomu.jp/works/9999999999999999999/episodes/12345",
              byteSize: 0,
              isRead: false,
              publishedAt: "2026-11-01",
              downloadedAt: null,
            },
          ];
        }
        return sampleChapters;
      });

      bridge.setMockPage({
        html: "<html><body><div class='widget-episodeBody'>別作品の第1話本文</div></body></html>",
        url: "https://kakuyomu.jp/works/9999999999999999999/episodes/12345",
        title: "別作品の第1話",
      });

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl:
            "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210413",
          initialNovelId: sampleNovel.id,
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      let res: unknown = null;
      await act(async () => {
        res = await result.current.importCurrentDom();
      });

      expect(res).toEqual({
        type: "chapter",
        novelId: anotherNovel.id,
        chapterIndex: 1,
      });
      // sampleNovel には保存されていないこと
      expect(mockChapterRepo.saveChapterBody).not.toHaveBeenCalledWith(
        sampleNovel.id,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
      // anotherNovel に正しく保存されていること
      expect(mockChapterRepo.saveChapterBody).toHaveBeenCalledWith(
        anotherNovel.id,
        1,
        expect.anything(),
        expect.any(String),
      );
    });

    it("未登録作品エピソードで httpClient が未指定の場合でも TypeError にならず安全にエラーとなること (R1-12)", async () => {
      (
        mockNovelRepo.getNovelById as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (mockNovelRepo.listNovels as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      const mockFetchFull = vi.fn();

      bridge.setMockPage({
        html: "<html><body>本文</body></html>",
        url: "https://kakuyomu.jp/works/unknown/episodes/1",
        title: "第1話",
      });

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://kakuyomu.jp/works/unknown/episodes/1",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
          // httpClient を渡さない
          fetchFullNovelIndex: mockFetchFull,
        }),
      );

      let res: unknown = null;
      await act(async () => {
        res = await result.current.importCurrentDom();
      });

      expect(res).toBeNull();
      expect(mockFetchFull).not.toHaveBeenCalled();
      expect(result.current.error).toBe(
        "先に作品トップ（目次）ページを取り込んでください",
      );
    });

    it("ネイティブの domCaptured 通知を受信した際に自動的にインポート処理が実行されること (R1-10)", async () => {
      const onImportCompleteMock = vi.fn();

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: sampleNovel.canonicalUrl,
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
          onImportComplete: onImportCompleteMock,
        }),
      );

      await act(async () => {
        bridge.emitDomCaptured({
          html: "<!DOCTYPE html><html><body><div id='workTitle'>通知から取込</div></body></html>",
          url: sampleNovel.canonicalUrl,
          title: "通知から取込",
        });
      });

      expect(mockNovelRepo.upsertNovelWithToc).toHaveBeenCalled();
      expect(onImportCompleteMock).toHaveBeenCalledWith({
        type: "novel",
        novelId: sampleNovel.id,
      });
      expect(result.current.pageTitle).toBe("通知から取込");
    });

    it("画面アンマウント時に webViewDomBridge.close() が呼び出されること (R1-11)", () => {
      const closeSpy = vi.spyOn(bridge, "close");

      const { unmount } = renderHook(() =>
        useWebViewImport({
          initialUrl: sampleNovel.canonicalUrl,
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      expect(closeSpy).not.toHaveBeenCalled();
      unmount();
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it("画面アンマウント時に webViewDomBridge.close() が例外を reject した場合でも unhandled rejection にならず安全に catch されること (R1-45)", () => {
      vi.spyOn(bridge, "close").mockRejectedValue(
        new Error("Bridge close error"),
      );

      const { unmount } = renderHook(() =>
        useWebViewImport({
          initialUrl: sampleNovel.canonicalUrl,
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      expect(() => unmount()).not.toThrow();
    });

    it("未登録作品エピソードで fetchFullNovelIndex が未指定の場合、エラーとなること", async () => {
      (
        mockNovelRepo.getNovelById as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (mockNovelRepo.listNovels as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      bridge.setMockPage({
        html: "<html><body>本文</body></html>",
        url: "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210413",
        title: "第1話",
      });

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl:
            "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210413",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      let importResult: unknown = null;
      await act(async () => {
        importResult = await result.current.importCurrentDom();
      });

      expect(importResult).toBeNull();
      expect(result.current.error).toBe(
        "先に作品トップ（目次）ページを取り込んでください",
      );
    });
  });

  describe("非対応 URL・例外ハンドリング (AC-WV-04)", () => {
    it("非対応 URL でインポートを実行した場合はエラーとなり中断されること", async () => {
      bridge.setMockPage({
        html: "<html><body>一般ページ</body></html>",
        url: "https://example.com/page",
        title: "Example",
      });

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://example.com/page",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      let importResult: unknown = null;
      await act(async () => {
        importResult = await result.current.importCurrentDom();
      });

      expect(importResult).toBeNull();
      expect(result.current.error).toBe("対応外のページです");
    });

    it("captureDom が例外を送出した場合、error が設定されること", async () => {
      vi.spyOn(bridge, "captureDom").mockRejectedValueOnce(
        new Error("Bridge connection lost"),
      );

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://kakuyomu.jp/works/16817330658027210412",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      await act(async () => {
        await result.current.importCurrentDom();
      });

      expect(result.current.error).toBe("Bridge connection lost");
      expect(result.current.isImporting).toBe(false);
    });

    it("captureDom が非 Error 例外を送出した場合、既定のエラー文言が設定されること", async () => {
      vi.spyOn(bridge, "captureDom").mockRejectedValueOnce(
        "Unknown bridge error",
      );

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://kakuyomu.jp/works/16817330658027210412",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      await act(async () => {
        await result.current.importCurrentDom();
      });

      expect(result.current.error).toBe("インポートに失敗しました");
      expect(result.current.isImporting).toBe(false);
    });
  });

  describe("戻るナビゲーション (AC-WV-08, TR-12)", () => {
    it("goBack 実行時に onNavigateBack が呼び出されること", () => {
      const onNavigateBackMock = vi.fn();

      const { result } = renderHook(() =>
        useWebViewImport({
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
          onNavigateBack: onNavigateBackMock,
        }),
      );

      act(() => {
        result.current.goBack();
      });

      expect(onNavigateBackMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("isChapterUrl ヘルパー関数の境界値検証", () => {
    it("カクヨムおよびなろうのエピソードURLを正しく判定し、未対応サイトや目次URLは false を返すこと", () => {
      expect(
        isChapterUrl(
          "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210413",
          "kakuyomu",
        ),
      ).toBe(true);
      expect(
        isChapterUrl(
          "https://kakuyomu.jp/works/16817330658027210412",
          "kakuyomu",
        ),
      ).toBe(false);

      expect(
        isChapterUrl("https://ncode.syosetu.com/n9669bk/1/", "narou"),
      ).toBe(true);
      expect(isChapterUrl("https://ncode.syosetu.com/n9669bk/", "narou")).toBe(
        false,
      );

      // 未知のサイト種別
      expect(
        isChapterUrl("https://example.com/works/1/episodes/1", "unknown_site"),
      ).toBe(false);
    });
  });

  describe("なろう1話のみだが本文を含まない連載目次ページのインポート", () => {
    it("目次ページに本文要素が存在せず章URLも異なる場合は本文保存を行わないこと", async () => {
      const narouSerialNovel: NovelRecord = {
        ...sampleNovel,
        id: "narou:n3333cc",
        siteType: "narou",
        remoteWorkId: "n3333cc",
        canonicalUrl: "https://ncode.syosetu.com/n3333cc/",
      };

      const customIndex: ParsedNovelIndex = {
        siteType: "narou",
        remoteWorkId: "n3333cc",
        canonicalUrl: "https://ncode.syosetu.com/n3333cc/",
        title: "連載作品",
        author: "作者",
        synopsis: "あらすじ",
        chapters: [
          {
            chapterIndex: 1,
            remoteChapterId: "1",
            partTitle: null,
            title: "第1話",
            url: "https://ncode.syosetu.com/n3333cc/1/",
            publishedAt: "2026-10-01",
          },
        ],
        nextTocPageUrl: null,
      };

      vi.spyOn(mockNarouParser, "parseNovelIndex").mockReturnValueOnce(
        customIndex,
      );
      (
        mockNovelRepo.upsertNovelWithToc as ReturnType<typeof vi.fn>
      ).mockResolvedValue(narouSerialNovel);

      bridge.setMockPage({
        html: "<html><body><div class='index_box'>目次のみ</div></body></html>",
        url: "https://ncode.syosetu.com/n3333cc/",
        title: "目次ページ",
      });

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://ncode.syosetu.com/n3333cc/",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      await act(async () => {
        await result.current.importCurrentDom();
      });

      expect(mockNovelRepo.upsertNovelWithToc).toHaveBeenCalled();
      expect(mockChapterRepo.saveChapterBody).not.toHaveBeenCalled();
    });

    it("addDomCapturedListener が未定義の bridge でも正常に初期化できること", () => {
      const bridgeWithoutListener = {
        canHandle: vi.fn(() => true),
        open: vi.fn(),
        close: vi.fn(),
        captureDom: vi.fn().mockResolvedValue({
          html: "<p>test</p>",
          url: "https://kakuyomu.jp/works/1",
          title: "test",
        }),
      };

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://kakuyomu.jp/works/1",
          webViewDomBridge: bridgeWithoutListener,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      expect(result.current.canImport).toBe(true);
    });

    it("importCapturedDomInternal で Error 例外が発生した場合、エラーメッセージが設定されること", async () => {
      (
        mockNovelRepo.upsertNovelWithToc as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(new Error("DB書き込み失敗"));

      bridge.setMockPage({
        html: "<html><body>目次</body></html>",
        url: "https://kakuyomu.jp/works/16817330658027210412",
        title: "目次",
      });

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://kakuyomu.jp/works/16817330658027210412",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      let res: unknown = null;
      await act(async () => {
        res = await result.current.importCurrentDom();
      });

      expect(res).toBeNull();
      expect(result.current.error).toBe("DB書き込み失敗");
    });

    it("importCapturedDomInternal で非 Error 例外が発生した場合、既定エラー文言が設定されること", async () => {
      (
        mockNovelRepo.upsertNovelWithToc as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce("不明な例外文字列");

      bridge.setMockPage({
        html: "<html><body>目次</body></html>",
        url: "https://kakuyomu.jp/works/16817330658027210412",
        title: "目次",
      });

      const { result } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://kakuyomu.jp/works/16817330658027210412",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      let res: unknown = null;
      await act(async () => {
        res = await result.current.importCurrentDom();
      });

      expect(res).toBeNull();
      expect(result.current.error).toBe("インポートに失敗しました");
    });

    it("アンマウント後に非同期処理が完了しても状態更新が行われないこと (isMountedRef)", async () => {
      let resolveOpen: () => void;
      const openPromise = new Promise<void>((resolve) => {
        resolveOpen = resolve;
      });
      vi.spyOn(bridge, "open").mockImplementation(() => openPromise);

      const { result, unmount } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://kakuyomu.jp/works/16817330658027210412",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      // openNativeBrowser を呼び出して非同期待機中にアンマウント
      await act(async () => {
        void result.current.openNativeBrowser();
      });
      unmount();

      resolveOpen!();
      await act(async () => {
        await Promise.resolve();
      });

      // アンマウント後の loadUrl 呼び出しも早期リターン
      const loadRes = await result.current.loadUrl("javascript:alert(1)");
      expect(loadRes).toBe(false);

      // アンマウント後の importCurrentDom 呼び出しも早期リターン
      const importRes = await result.current.importCurrentDom();
      expect(importRes).toBeNull();
    });

    it("captureDom の非同期待機中にアンマウントされた場合、importCapturedDomInternal で早期リターンすること (130行目)", async () => {
      let resolveCapture: (res: CapturedDomResult) => void;
      const capturePromise = new Promise<CapturedDomResult>((resolve) => {
        resolveCapture = resolve;
      });
      vi.spyOn(bridge, "captureDom").mockImplementation(() => capturePromise);

      const { result, unmount } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://kakuyomu.jp/works/16817330658027210412",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      let importPromise: Promise<unknown>;
      await act(async () => {
        importPromise = result.current.importCurrentDom();
      });

      // captureDom 待機中にアンマウント
      unmount();

      resolveCapture!({
        html: "<html><body>目次</body></html>",
        url: "https://kakuyomu.jp/works/16817330658027210412",
        title: "目次",
      });

      let res: unknown;
      await act(async () => {
        res = await importPromise;
      });

      expect(res).toBeNull();
    });

    it("アンマウント後に domCaptured リスナーが発火した場合、早期リターンすること (356行目)", () => {
      let capturedListener: ((captured: CapturedDomResult) => void) | undefined;
      vi.spyOn(bridge, "addDomCapturedListener").mockImplementation(
        (listener) => {
          capturedListener = listener;
          return () => {}; // unsubscribe を no-op にして unmount 後も保持
        },
      );

      const { unmount } = renderHook(() =>
        useWebViewImport({
          initialUrl: "https://kakuyomu.jp/works/16817330658027210412",
          webViewDomBridge: bridge,
          novelRepository: mockNovelRepo,
          chapterRepository: mockChapterRepo,
          parserRegistry: mockParserRegistry,
        }),
      );

      unmount();

      // アンマウント後に発火
      expect(() => {
        capturedListener?.({
          html: "<html><body>目次</body></html>",
          url: "https://kakuyomu.jp/works/16817330658027210412",
          title: "目次",
        });
      }).not.toThrow();
    });
  });
});

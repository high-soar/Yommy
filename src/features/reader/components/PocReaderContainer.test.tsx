import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./PocReaderContainer.stories";
import { PocReaderContainer } from "./PocReaderContainer";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import type { HttpClientBridge } from "../../../bridges/http/types";
import type {
  NovelRepository,
  ChapterRepository,
  NovelRecord,
  ChapterRecord,
} from "../../../storage/types";

const {
  Empty,
  WithLoadedNovel,
  WithRouteParams,
  WithOnDemandFetch,
  WithNavigationOnly,
} = composeStories(stories);

describe("PocReaderContainer", () => {
  beforeEach(async () => {
    await resetTestDb();
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Empty ストーリーで未取得時の空状態メッセージが表示されること", async () => {
      render(<Empty />);
      await waitFor(() => {
        expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
      });
      expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();
    });

    it("WithLoadedNovel ストーリーで保存済み作品と本文が表示されること", async () => {
      render(<WithLoadedNovel />);
      await waitFor(() => {
        expect(screen.getByTestId("reader-title")).toHaveTextContent(
          "境界迷宮と異界の魔術師",
        );
      });
      expect(screen.getByTestId("reader-chapter-title")).toHaveTextContent(
        "第1話 見知らぬ空",
      );
      expect(
        screen.getByTestId("reader-body").querySelector("ruby"),
      ).toBeInTheDocument();
    });

    it("WithRouteParams ストーリーでルートパラメータ指定の第2話とナビゲーション導線が表示されること", async () => {
      render(<WithRouteParams />);
      await waitFor(() => {
        expect(screen.getByTestId("reader-title")).toHaveTextContent(
          "境界迷宮と異界の魔術師",
        );
      });
      expect(screen.getByTestId("reader-chapter-title")).toHaveTextContent(
        "第2話 異界の森",
      );
      expect(screen.getByTestId("reader-body")).toHaveTextContent(
        "木々が生い茂る森の中を、少年は歩き続けた。",
      );
      expect(
        screen.getByTestId("reader-back-to-bookshelf"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("reader-back-to-detail")).toBeInTheDocument();
    });

    it("WithOnDemandFetch ストーリーで未キャッシュ話がオンデマンド取得されて本文が表示されること", async () => {
      render(<WithOnDemandFetch />);
      await waitFor(() => {
        expect(screen.getByTestId("reader-title")).toHaveTextContent(
          "境界迷宮と異界の魔術師",
        );
      });
      await waitFor(() => {
        expect(screen.getByTestId("reader-body")).toHaveTextContent(
          "オンデマンドで取得された本文です。",
        );
      });
    });

    it("WithNavigationOnly ストーリーで作品未取得時にナビゲーション導線が表示されること", async () => {
      render(<WithNavigationOnly />);
      await waitFor(() => {
        expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
      });
      expect(
        screen.getByTestId("reader-back-to-bookshelf"),
      ).toBeInTheDocument();
      const backToDetailButton = screen.getByTestId("reader-back-to-detail");
      expect(backToDetailButton).toBeInTheDocument();
      expect(backToDetailButton).toBeDisabled();
    });
  });

  describe("ナビゲーション導線の検証", () => {
    it("onBackToBookshelf が指定されている場合、ボタンクリック時にコールバックが呼ばれること", async () => {
      const user = userEvent.setup();
      const handleBackToBookshelf = vi.fn();

      render(
        <ServiceProvider>
          <PocReaderContainer onBackToBookshelf={handleBackToBookshelf} />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("reader-back-to-bookshelf"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-back-to-bookshelf"));
      expect(handleBackToBookshelf).toHaveBeenCalledTimes(1);
    });

    it("onBackToDetail が指定され novelId が渡されている場合、ボタンクリック時に onBackToDetail(novelId) が呼ばれること", async () => {
      const user = userEvent.setup();
      const handleBackToDetail = vi.fn();

      render(
        <ServiceProvider>
          <PocReaderContainer
            novelId="kakuyomu:1177354054881162325"
            onBackToDetail={handleBackToDetail}
          />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-back-to-detail")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-back-to-detail"));
      expect(handleBackToDetail).toHaveBeenCalledWith(
        "kakuyomu:1177354054881162325",
      );
    });

    it("onBackToDetail が指定され novelId 未指定だが DB から作品がロードされている場合、novel.id で onBackToDetail が呼ばれること", async () => {
      const user = userEvent.setup();
      const handleBackToDetail = vi.fn();

      const sampleNovel: NovelRecord = {
        id: "kakuyomu:99999",
        siteType: "kakuyomu",
        remoteWorkId: "99999",
        canonicalUrl: "https://kakuyomu.jp/works/99999",
        title: "テスト小説",
        author: "テスト著者",
        synopsis: "テストあらすじ",
        totalChapters: 1,
        cachedChapters: 1,
        totalByteSize: 100,
        bookmarkChapterIndex: 1,
        bookmarkScrollProgress: 0,
        isFavorite: false,
        lastCheckedAt: null,
        lastReadAt: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };

      const novelRepo: NovelRepository = {
        listNovels: async () => [sampleNovel],
        getNovelById: async () => sampleNovel,
        upsertNovelWithToc: async () => sampleNovel,
        updateBookmark: async () => {},
        deleteNovel: async () => {},
      };

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <PocReaderContainer onBackToDetail={handleBackToDetail} />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-title")).toHaveTextContent(
          "テスト小説",
        );
      });

      await user.click(screen.getByTestId("reader-back-to-detail"));
      expect(handleBackToDetail).toHaveBeenCalledWith("kakuyomu:99999");
    });

    it("onBackToDetail が指定されているが作品IDも作品レコードも存在しない場合、ボタンは disabled でクリックしても呼ばれないこと", async () => {
      const user = userEvent.setup();
      const handleBackToDetail = vi.fn();

      const novelRepo: NovelRepository = {
        listNovels: async () => [],
        getNovelById: async () => null,
        upsertNovelWithToc: async () => ({}) as unknown as NovelRecord,
        updateBookmark: async () => {},
        deleteNovel: async () => {},
      };

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <PocReaderContainer onBackToDetail={handleBackToDetail} />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
      });

      const button = screen.getByTestId("reader-back-to-detail");
      expect(button).toBeDisabled();
      await user.click(button);
      expect(handleBackToDetail).not.toHaveBeenCalled();
    });

    it("onBackToBookshelf も onBackToDetail も未指定の場合、reader-nav ナビゲーションバーが表示されないこと", async () => {
      render(
        <ServiceProvider>
          <PocReaderContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("reader-nav")).not.toBeInTheDocument();
    });
  });

  describe("ルートパラメータ連携と未キャッシュ話オンデマンド取得 (TR-03)", () => {
    const mockNovel: NovelRecord = {
      id: "kakuyomu:1177354054881162325",
      siteType: "kakuyomu",
      remoteWorkId: "1177354054881162325",
      canonicalUrl: "https://kakuyomu.jp/works/1177354054881162325",
      title: "境界迷宮と異界の魔術師",
      author: "小野崎",
      synopsis: "あらすじ",
      totalChapters: 3,
      cachedChapters: 0,
      totalByteSize: 0,
      bookmarkChapterIndex: 1,
      bookmarkScrollProgress: 0,
      isFavorite: false,
      lastCheckedAt: null,
      lastReadAt: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    it("novelId が指定され chapter.bodyHtml === null の場合、オンデマンドで本文を取得・保存・表示すること (TR-03)", async () => {
      let chapterInDb: ChapterRecord = {
        id: "kakuyomu:1177354054881162325:1",
        novelId: "kakuyomu:1177354054881162325",
        chapterIndex: 1,
        remoteChapterId: "1177354054881162326",
        partTitle: "第一部",
        title: "第1話 見知らぬ空",
        url: "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162326",
        bodyHtml: null, // 未キャッシュ
        byteSize: 0,
        isRead: false,
        publishedAt: "2026-01-01T00:00:00Z",
        downloadedAt: null,
      };

      const novelRepo: NovelRepository = {
        listNovels: async () => [mockNovel],
        getNovelById: async (id) => (id === mockNovel.id ? mockNovel : null),
        upsertNovelWithToc: async () => mockNovel,
        updateBookmark: async () => {},
        deleteNovel: async () => {},
      };

      const chapterRepo: ChapterRepository = {
        listChaptersByNovelId: async () => [],
        getChapter: async () => chapterInDb,
        saveChapterBody: async (_novelId, _idx, content, downloadedAt) => {
          chapterInDb = {
            ...chapterInDb,
            bodyHtml: content.bodyHtml,
            byteSize: content.byteSize,
            downloadedAt,
          };
        },
        markChapterRead: async () => {},
        deleteCachedBodies: async () => 0,
      };

      const mockEpisodeHtml = `<!doctype html><html><body><div class="widget-episodeBody"><p>オンデマンド本文</p></div></body></html>`;
      const httpBridge: HttpClientBridge = {
        getHtml: vi.fn().mockResolvedValue({
          status: 200,
          url: chapterInDb.url,
          html: mockEpisodeHtml,
          headers: {},
        }),
      };

      render(
        <ServiceProvider
          services={{
            httpClient: httpBridge,
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }}
        >
          <PocReaderContainer novelId="kakuyomu:1177354054881162325" />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-title")).toHaveTextContent(
          "境界迷宮と異界の魔術師",
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId("reader-body")).toHaveTextContent(
          "オンデマンド本文",
        );
      });

      expect(httpBridge.getHtml).toHaveBeenCalledWith({
        url: chapterInDb.url,
      });
    });

    it("オンデマンド取得中に HTTP エラーが発生した場合、エラーメッセージが表示されること", async () => {
      const chapterInDb: ChapterRecord = {
        id: "kakuyomu:1177354054881162325:1",
        novelId: "kakuyomu:1177354054881162325",
        chapterIndex: 1,
        remoteChapterId: "1177354054881162326",
        partTitle: "第一部",
        title: "第1話 見知らぬ空",
        url: "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162326",
        bodyHtml: null,
        byteSize: 0,
        isRead: false,
        publishedAt: "2026-01-01T00:00:00Z",
        downloadedAt: null,
      };

      const novelRepo: NovelRepository = {
        listNovels: async () => [mockNovel],
        getNovelById: async (id) => (id === mockNovel.id ? mockNovel : null),
        upsertNovelWithToc: async () => mockNovel,
        updateBookmark: async () => {},
        deleteNovel: async () => {},
      };

      const chapterRepo: ChapterRepository = {
        listChaptersByNovelId: async () => [],
        getChapter: async () => chapterInDb,
        saveChapterBody: async () => {},
        markChapterRead: async () => {},
        deleteCachedBodies: async () => 0,
      };

      const httpBridge: HttpClientBridge = {
        getHtml: vi
          .fn()
          .mockRejectedValue(new Error("オンデマンド通信エラー500")),
      };

      render(
        <ServiceProvider
          services={{
            httpClient: httpBridge,
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }}
        >
          <PocReaderContainer
            novelId="kakuyomu:1177354054881162325"
            chapterIndex={1}
          />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-error")).toHaveTextContent(
          "オンデマンド通信エラー500",
        );
      });
    });

    it("オンデマンド取得中に非Error例外がスローされた場合も文字列としてエラー表示されること", async () => {
      const chapterInDb: ChapterRecord = {
        id: "kakuyomu:1177354054881162325:1",
        novelId: "kakuyomu:1177354054881162325",
        chapterIndex: 1,
        remoteChapterId: "1177354054881162326",
        partTitle: "第一部",
        title: "第1話 見知らぬ空",
        url: "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162326",
        bodyHtml: null,
        byteSize: 0,
        isRead: false,
        publishedAt: "2026-01-01T00:00:00Z",
        downloadedAt: null,
      };

      const novelRepo: NovelRepository = {
        listNovels: async () => [mockNovel],
        getNovelById: async (id) => (id === mockNovel.id ? mockNovel : null),
        upsertNovelWithToc: async () => mockNovel,
        updateBookmark: async () => {},
        deleteNovel: async () => {},
      };

      const chapterRepo: ChapterRepository = {
        listChaptersByNovelId: async () => [],
        getChapter: async () => chapterInDb,
        saveChapterBody: async () => {},
        markChapterRead: async () => {},
        deleteCachedBodies: async () => 0,
      };

      const httpBridge: HttpClientBridge = {
        getHtml: vi.fn().mockRejectedValue("非Errorオンデマンド例外文字列"),
      };

      render(
        <ServiceProvider
          services={{
            httpClient: httpBridge,
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }}
        >
          <PocReaderContainer
            novelId="kakuyomu:1177354054881162325"
            chapterIndex={1}
          />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-error")).toHaveTextContent(
          "非Errorオンデマンド例外文字列",
        );
      });
    });

    it("novelId が指定され chapterIndex が範囲外（chapter === null）の場合、作品タイトルは表示され本文は未取得メッセージとなること", async () => {
      const novelRepo: NovelRepository = {
        listNovels: async () => [mockNovel],
        getNovelById: async (id) => (id === mockNovel.id ? mockNovel : null),
        upsertNovelWithToc: async () => mockNovel,
        updateBookmark: async () => {},
        deleteNovel: async () => {},
      };

      const chapterRepo: ChapterRepository = {
        listChaptersByNovelId: async () => [],
        getChapter: async () => null, // 範囲外
        saveChapterBody: async () => {},
        markChapterRead: async () => {},
        deleteCachedBodies: async () => 0,
      };

      render(
        <ServiceProvider
          services={{
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }}
        >
          <PocReaderContainer
            novelId="kakuyomu:1177354054881162325"
            chapterIndex={999}
          />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-title")).toHaveTextContent(
          "境界迷宮と異界の魔術師",
        );
      });
      expect(
        screen.queryByTestId("reader-chapter-title"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("reader-body")).toHaveTextContent(
        "本文がまだ取得されていません。",
      );
    });

    it("novelId で指定された作品が DB に存在しない場合、空状態が表示されること", async () => {
      const novelRepo: NovelRepository = {
        listNovels: async () => [],
        getNovelById: async () => null,
        upsertNovelWithToc: async () => mockNovel,
        updateBookmark: async () => {},
        deleteNovel: async () => {},
      };

      render(
        <ServiceProvider services={{ novelRepository: novelRepo }}>
          <PocReaderContainer novelId="kakuyomu:non-existent" />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
      });
    });
  });

  describe("作品取得・DB永続化フローの検証", () => {
    it("「作品取得」ボタンをクリックしたときに作品トップと第1話が取得・保存・表示されること", async () => {
      const user = userEvent.setup();
      render(
        <ServiceProvider>
          <PocReaderContainer />
        </ServiceProvider>,
      );

      // 初回は空状態
      await waitFor(() => {
        expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
      });

      // 作品取得ボタンをクリック
      const fetchButton = screen.getByTestId("fetch-novel-button");
      await user.click(fetchButton);

      // 取得完了後にタイトルと本文が表示されること
      await waitFor(() => {
        expect(screen.getByTestId("reader-title")).toHaveTextContent(
          "境界迷宮と異界の魔術師",
        );
      });
      expect(screen.getByTestId("reader-chapter-title")).toHaveTextContent(
        "プロローグ：目覚め",
      );
      const readerBody = screen.getByTestId("reader-body");
      expect(readerBody.querySelector("ruby")).toBeInTheDocument();
      expect(readerBody.querySelector("em.bouten")).toBeInTheDocument();
    });

    it("chapterIndex が指定されている場合に手動更新ボタンを押すと、該当エピソードの本文が取得・保存・表示されること", async () => {
      const user = userEvent.setup();
      render(
        <ServiceProvider>
          <PocReaderContainer chapterIndex={2} />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("fetch-novel-button"));

      await waitFor(() => {
        expect(screen.getByTestId("reader-title")).toHaveTextContent(
          "境界迷宮と異界の魔術師",
        );
      });
      expect(screen.getByTestId("reader-chapter-title")).toHaveTextContent(
        "第1話：二つの太陽",
      );
    });

    it("手動更新時に chapterIndex が目次範囲外（999）の場合は第1話にフォールバックして取得・保存・表示されること", async () => {
      const user = userEvent.setup();
      render(
        <ServiceProvider>
          <PocReaderContainer chapterIndex={999} />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("fetch-novel-button"));

      await waitFor(() => {
        expect(screen.getByTestId("reader-title")).toHaveTextContent(
          "境界迷宮と異界の魔術師",
        );
      });
      expect(screen.getByTestId("reader-chapter-title")).toHaveTextContent(
        "プロローグ：目覚め",
      );
    });

    it("設定（縦横切替・テーマ変更）が正しく反映されること", async () => {
      const user = userEvent.setup();
      render(
        <ServiceProvider>
          <PocReaderContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();
      });

      // 作品を取得
      await user.click(screen.getByTestId("fetch-novel-button"));
      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      });

      // 初期は縦書き
      expect(screen.getByTestId("reader-view")).toHaveAttribute(
        "data-writing-mode",
        "vertical-rl",
      );

      // 横書きに切替
      await user.click(screen.getByTestId("toggle-orientation"));
      expect(screen.getByTestId("reader-view")).toHaveAttribute(
        "data-writing-mode",
        "horizontal-tb",
      );

      // 再度クリックして縦書きに戻す
      await user.click(screen.getByTestId("toggle-orientation"));
      expect(screen.getByTestId("reader-view")).toHaveAttribute(
        "data-writing-mode",
        "vertical-rl",
      );

      // セピアテーマに切替
      await user.click(screen.getByTestId("theme-sepia"));
      expect(screen.getByTestId("reader-view")).toHaveAttribute(
        "data-theme",
        "sepia",
      );
    });

    it("作品取得時に非Error例外がスローされた場合も文字列としてエラー表示されること", async () => {
      const user = userEvent.setup();
      const failingHttp: HttpClientBridge = {
        getHtml: vi.fn().mockRejectedValue("ネットワーク接続エラー文字列"),
      };

      render(
        <ServiceProvider services={{ httpClient: failingHttp }}>
          <PocReaderContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("fetch-novel-button"));

      await waitFor(() => {
        expect(screen.getByTestId("reader-error")).toHaveTextContent(
          "ネットワーク接続エラー文字列",
        );
      });
    });

    it("作品取得時に HTTP 通信エラーが発生した場合はエラーメッセージが表示されること", async () => {
      const user = userEvent.setup();
      const failingHttp: HttpClientBridge = {
        getHtml: vi.fn().mockRejectedValue(new Error("403 Forbidden")),
      };

      render(
        <ServiceProvider services={{ httpClient: failingHttp }}>
          <PocReaderContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("fetch-novel-button"));

      await waitFor(() => {
        expect(screen.getByTestId("reader-error")).toHaveTextContent(
          "403 Forbidden",
        );
      });
    });

    it("目次が0件の作品を取得した場合は本文未取得として空チャプターが表示されること", async () => {
      const user = userEvent.setup();
      const emptyWorkHtml = `<!doctype html><html><head><link rel="canonical" href="https://kakuyomu.jp/works/1177354054881162325" /></head><body><div id="container"><header id="workHeader"><h1 id="workTitle">エピソードなし作品</h1><h2 id="workAuthor-activityName">著者</h2></header><div class="widget-toc-main"></div></div></body></html>`;

      const emptyTocHttp: HttpClientBridge = {
        getHtml: vi.fn().mockResolvedValue({
          status: 200,
          url: "https://kakuyomu.jp/works/1177354054881162325",
          html: emptyWorkHtml,
          headers: {},
        }),
      };

      render(
        <ServiceProvider services={{ httpClient: emptyTocHttp }}>
          <PocReaderContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("fetch-novel-button"));

      await waitFor(() => {
        expect(screen.getByTestId("reader-title")).toHaveTextContent(
          "エピソードなし作品",
        );
      });
      expect(screen.getByTestId("reader-body")).toHaveTextContent(
        "本文がまだ取得されていません。",
      );
    });

    it("初期化時にエラーが発生した場合はエラーメッセージが表示されること", async () => {
      const failingRepo = {
        listNovels: vi
          .fn()
          .mockRejectedValue(new Error("初期化Errorインスタンス")),
        getNovelById: vi.fn(),
        upsertNovelWithToc: vi.fn(),
        updateBookmark: vi.fn(),
        deleteNovel: vi.fn(),
      };

      render(
        <ServiceProvider services={{ novelRepository: failingRepo }}>
          <PocReaderContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-error")).toHaveTextContent(
          "初期化Errorインスタンス",
        );
      });
    });

    it("初期化時に非Error例外がスローされた場合も文字列としてエラー表示されること", async () => {
      const failingRepo = {
        listNovels: vi.fn().mockRejectedValue("非Error文字列例外"),
        getNovelById: vi.fn(),
        upsertNovelWithToc: vi.fn(),
        updateBookmark: vi.fn(),
        deleteNovel: vi.fn(),
      };

      render(
        <ServiceProvider services={{ novelRepository: failingRepo }}>
          <PocReaderContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-error")).toHaveTextContent(
          "非Error文字列例外",
        );
      });
    });

    it("初期設定で horizontal-tb および sepia が保存されている場合は正しく復元されること", async () => {
      const settingsRepo = {
        getReaderSettings: vi.fn().mockResolvedValue({
          writingMode: "horizontal-tb",
          theme: "sepia",
          fontFamily: "biz-ud-mincho",
          fontSizePx: 18,
          lineHeight: 1.8,
          pageMarginPx: 20,
          enableTapPaging: true,
          enableVolumeKeyPaging: false,
          updatedAt: "2026-01-01T00:00:00Z",
        }),
        updateReaderSettings: vi.fn(),
      };

      render(
        <ServiceProvider services={{ settingsRepository: settingsRepo }}>
          <PocReaderContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("toggle-orientation")).toHaveTextContent(
          "縦書き表示に切替",
        );
      });
      expect(screen.getByTestId("theme-sepia")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    it("初期設定で dark または black が保存されている場合にも正しく復元されること", async () => {
      const settingsRepo = {
        getReaderSettings: vi.fn().mockResolvedValue({
          writingMode: "vertical-rl",
          theme: "black",
          fontFamily: "biz-ud-mincho",
          fontSizePx: 18,
          lineHeight: 1.8,
          pageMarginPx: 20,
          enableTapPaging: true,
          enableVolumeKeyPaging: false,
          updatedAt: "2026-01-01T00:00:00Z",
        }),
        updateReaderSettings: vi.fn(),
      };

      render(
        <ServiceProvider services={{ settingsRepository: settingsRepo }}>
          <PocReaderContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("theme-black")).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      });
    });

    it("未対応サイトのURLを指定した場合はHTTP取得前に即座にエラーが表示されること (AC-01)", async () => {
      const user = userEvent.setup();
      const mockHttp = {
        getHtml: vi.fn(),
      };

      render(
        <ServiceProvider services={{ httpClient: mockHttp }}>
          <PocReaderContainer initialWorkUrl="https://example.com/novel/999" />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("fetch-novel-button"));

      await waitFor(() => {
        expect(screen.getByTestId("reader-error")).toHaveTextContent(
          "No parser registered for URL",
        );
      });
      expect(mockHttp.getHtml).not.toHaveBeenCalled();
    });

    it("エピソードURLを指定した場合は作品トップURLに正規化されて取得されること", async () => {
      const user = userEvent.setup();
      const mockHttp = {
        getHtml: vi
          .fn()
          .mockResolvedValue({ html: "<html><body></body></html>" }),
      };

      render(
        <ServiceProvider services={{ httpClient: mockHttp }}>
          <PocReaderContainer initialWorkUrl="https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162326?ref=top" />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("fetch-novel-button"));

      await waitFor(() => {
        expect(mockHttp.getHtml).toHaveBeenCalledWith({
          url: "https://kakuyomu.jp/works/1177354054881162325",
        });
      });
    });
  });
});

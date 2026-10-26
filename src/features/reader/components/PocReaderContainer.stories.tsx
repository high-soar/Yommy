import type { Meta, StoryObj } from "@storybook/react";
import { PocReaderContainer } from "./PocReaderContainer";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { createDefaultParserRegistry } from "../../../parsers/parserRegistry";
import type { DatabaseAdapter } from "../../../storage/adapter/types";
import type {
  NovelRepository,
  ChapterRepository,
  SettingsRepository,
  NovelRecord,
  ChapterRecord,
} from "../../../storage/types";
import type { HttpClientBridge } from "../../../bridges/http/types";

const mockHttpClient: HttpClientBridge = {
  getHtml: async () => ({
    status: 200,
    url: "https://kakuyomu.jp/works/1177354054881162325",
    html: "<html></html>",
    headers: {},
  }),
};

const mockDb: DatabaseAdapter = {
  execute: async () => {},
  query: async () => [],
  runTransaction: async (fn) => fn(),
  close: async () => {},
};

const mockSettingsRepo: SettingsRepository = {
  getReaderSettings: async () => ({
    writingMode: "vertical-rl",
    theme: "light",
    fontFamily: "biz-ud-mincho",
    fontSizePx: 18,
    lineHeight: 1.8,
    pageMarginPx: 20,
    enableTapPaging: true,
    enableVolumeKeyPaging: false,
    updatedAt: "2026-01-01T00:00:00Z",
  }),
  updateReaderSettings: async (patch) => ({
    writingMode: patch.writingMode ?? "vertical-rl",
    theme: patch.theme ?? "light",
    fontFamily: "biz-ud-mincho",
    fontSizePx: 18,
    lineHeight: 1.8,
    pageMarginPx: 20,
    enableTapPaging: true,
    enableVolumeKeyPaging: false,
    updatedAt: "2026-01-01T00:00:00Z",
  }),
};

const sampleNovel: NovelRecord = {
  id: "kakuyomu:1177354054881162325",
  siteType: "kakuyomu",
  remoteWorkId: "1177354054881162325",
  canonicalUrl: "https://kakuyomu.jp/works/1177354054881162325",
  title: "境界迷宮と異界の魔術師",
  author: "小野崎",
  synopsis: "あらすじ",
  totalChapters: 3,
  cachedChapters: 1,
  totalByteSize: 1024,
  bookmarkChapterIndex: 1,
  bookmarkScrollProgress: 0,
  isFavorite: false,
  lastCheckedAt: null,
  lastReadAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const meta: Meta<typeof PocReaderContainer> = {
  title: "Reader/PocReaderContainer",
  component: PocReaderContainer,
};

export default meta;
type Story = StoryObj<typeof PocReaderContainer>;

/**
 * 初期状態（DBに作品が存在せず空状態が表示される）
 */
export const Empty: Story = {
  name: "作品未取得（空状態）",
  render: () => {
    const novelRepo: NovelRepository = {
      listNovels: async () => [],
      getNovelById: async () => null,
      upsertNovelWithToc: async () => ({}) as unknown as NovelRecord,
      updateBookmark: async () => {},
      deleteNovel: async () => {},
    };
    const chapterRepo: ChapterRepository = {
      listChaptersByNovelId: async () => [],
      getChapter: async () => null,
      saveChapterBody: async () => {},
      markChapterRead: async () => {},
      deleteCachedBodies: async () => 0,
    };
    return (
      <ServiceProvider
        services={{
          httpClient: mockHttpClient,
          parserRegistry: createDefaultParserRegistry(),
          databaseAdapter: mockDb,
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          settingsRepository: mockSettingsRepo,
        }}
      >
        <PocReaderContainer />
      </ServiceProvider>
    );
  },
};

/**
 * DBから復元された作品・エピソードが表示されている状態
 */
export const WithLoadedNovel: Story = {
  name: "DB保存済み作品の閲覧状態",
  render: () => {
    const novelRepo: NovelRepository = {
      listNovels: async () => [sampleNovel],
      getNovelById: async () => sampleNovel,
      upsertNovelWithToc: async () => ({}) as unknown as NovelRecord,
      updateBookmark: async () => {},
      deleteNovel: async () => {},
    };
    const chapterRepo: ChapterRepository = {
      listChaptersByNovelId: async () => [],
      getChapter: async () => ({
        id: "kakuyomu:1177354054881162325:1",
        novelId: "kakuyomu:1177354054881162325",
        chapterIndex: 1,
        remoteChapterId: "1177354054881162326",
        partTitle: "第一部",
        title: "第1話 見知らぬ空",
        url: "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162326",
        bodyHtml:
          "<p>青い空に、二つの<ruby><rb>太陽</rb><rt>たいよう</rt></ruby>が輝いていた。</p>",
        byteSize: 120,
        isRead: false,
        publishedAt: "2026-01-01T00:00:00Z",
        downloadedAt: "2026-01-01T00:00:00Z",
      }),
      saveChapterBody: async () => {},
      markChapterRead: async () => {},
      deleteCachedBodies: async () => 0,
    };
    return (
      <ServiceProvider
        services={{
          httpClient: mockHttpClient,
          parserRegistry: createDefaultParserRegistry(),
          databaseAdapter: mockDb,
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          settingsRepository: mockSettingsRepo,
        }}
      >
        <PocReaderContainer />
      </ServiceProvider>
    );
  },
};

/**
 * ルートパラメータ（novelId / chapterIndex）指定とナビゲーション導線が表示されている状態
 */
export const WithRouteParams: Story = {
  name: "ルート指定ロード（第2話・ナビゲーション付き）",
  render: () => {
    const chapter2: ChapterRecord = {
      id: "kakuyomu:1177354054881162325:2",
      novelId: "kakuyomu:1177354054881162325",
      chapterIndex: 2,
      remoteChapterId: "1177354054881162327",
      partTitle: "第一部",
      title: "第2話 異界の森",
      url: "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162327",
      bodyHtml: "<p>木々が生い茂る森の中を、少年は歩き続けた。</p>",
      byteSize: 150,
      isRead: false,
      publishedAt: "2026-01-02T00:00:00Z",
      downloadedAt: "2026-01-02T00:00:00Z",
    };

    const novelRepo: NovelRepository = {
      listNovels: async () => [sampleNovel],
      getNovelById: async (id) => (id === sampleNovel.id ? sampleNovel : null),
      upsertNovelWithToc: async () => ({}) as unknown as NovelRecord,
      updateBookmark: async () => {},
      deleteNovel: async () => {},
    };

    const chapterRepo: ChapterRepository = {
      listChaptersByNovelId: async () => [],
      getChapter: async (_id, idx) => (idx === 2 ? chapter2 : null),
      saveChapterBody: async () => {},
      markChapterRead: async () => {},
      deleteCachedBodies: async () => 0,
    };

    return (
      <ServiceProvider
        services={{
          httpClient: mockHttpClient,
          parserRegistry: createDefaultParserRegistry(),
          databaseAdapter: mockDb,
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          settingsRepository: mockSettingsRepo,
        }}
      >
        <PocReaderContainer
          novelId="kakuyomu:1177354054881162325"
          chapterIndex={2}
          onBackToBookshelf={() => {}}
          onBackToDetail={() => {}}
        />
      </ServiceProvider>
    );
  },
};

/**
 * 未キャッシュ話のオンデマンド取得が行われる状態
 */
export const WithOnDemandFetch: Story = {
  name: "未キャッシュ話オンデマンド取得",
  render: () => {
    let currentChapter: ChapterRecord = {
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

    const episodeHtml = `<!doctype html><html><body><div class="widget-episodeBody"><p>オンデマンドで取得された本文です。</p></div></body></html>`;

    const onDemandHttp: HttpClientBridge = {
      getHtml: async ({ url }) => ({
        status: 200,
        url,
        html: episodeHtml,
        headers: {},
      }),
    };

    const novelRepo: NovelRepository = {
      listNovels: async () => [sampleNovel],
      getNovelById: async (id) => (id === sampleNovel.id ? sampleNovel : null),
      upsertNovelWithToc: async () => ({}) as unknown as NovelRecord,
      updateBookmark: async () => {},
      deleteNovel: async () => {},
    };

    const chapterRepo: ChapterRepository = {
      listChaptersByNovelId: async () => [],
      getChapter: async () => currentChapter,
      saveChapterBody: async (_novelId, _idx, content, downloadedAt) => {
        currentChapter = {
          ...currentChapter,
          bodyHtml: content.bodyHtml,
          byteSize: content.byteSize,
          downloadedAt,
        };
      },
      markChapterRead: async () => {},
      deleteCachedBodies: async () => 0,
    };

    return (
      <ServiceProvider
        services={{
          httpClient: onDemandHttp,
          parserRegistry: createDefaultParserRegistry(),
          databaseAdapter: mockDb,
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          settingsRepository: mockSettingsRepo,
        }}
      >
        <PocReaderContainer
          novelId="kakuyomu:1177354054881162325"
          chapterIndex={1}
          onBackToBookshelf={() => {}}
          onBackToDetail={() => {}}
        />
      </ServiceProvider>
    );
  },
};

/**
 * 作品未取得（空状態）でナビゲーションボタンのみ表示されている状態
 */
export const WithNavigationOnly: Story = {
  name: "ナビゲーション導線表示（作品未取得時）",
  render: () => {
    const novelRepo: NovelRepository = {
      listNovels: async () => [],
      getNovelById: async () => null,
      upsertNovelWithToc: async () => ({}) as unknown as NovelRecord,
      updateBookmark: async () => {},
      deleteNovel: async () => {},
    };
    const chapterRepo: ChapterRepository = {
      listChaptersByNovelId: async () => [],
      getChapter: async () => null,
      saveChapterBody: async () => {},
      markChapterRead: async () => {},
      deleteCachedBodies: async () => 0,
    };
    return (
      <ServiceProvider
        services={{
          httpClient: mockHttpClient,
          parserRegistry: createDefaultParserRegistry(),
          databaseAdapter: mockDb,
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          settingsRepository: mockSettingsRepo,
        }}
      >
        <PocReaderContainer
          onBackToBookshelf={() => {}}
          onBackToDetail={() => {}}
        />
      </ServiceProvider>
    );
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import { PocReaderContainer } from "./PocReaderContainer";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { createDefaultParserRegistry } from "../../../parsers/parserRegistry";
import type { DatabaseAdapter } from "../../../storage/adapter/types";
import type {
  NovelRepository,
  ChapterRepository,
  SettingsRepository,
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
      upsertNovelWithToc: async () =>
        ({}) as unknown as import("../../../storage/types").NovelRecord,
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
    const loadedNovel = {
      id: "kakuyomu:1177354054881162325",
      siteType: "kakuyomu" as const,
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

    const novelRepo: NovelRepository = {
      listNovels: async () => [loadedNovel],
      getNovelById: async () => loadedNovel,
      upsertNovelWithToc: async () =>
        ({}) as unknown as import("../../../storage/types").NovelRecord,
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

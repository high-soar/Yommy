import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ServiceProvider } from "../../../app/ServiceProvider";
import {
  useReader,
  toErrorMessage,
  isChapterFresh,
  delay,
  resolveEffectivePagingMode,
  calculateProgressFromPage,
  calculatePageFromProgress,
} from "./useReader";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import { SqlNovelRepository } from "../../../storage/repositories/novelRepository";
import { SqlChapterRepository } from "../../../storage/repositories/chapterRepository";
import { SqlSettingsRepository } from "../../../storage/repositories/settingsRepository";
import { MockHttpClient } from "../../../bridges/http/mockHttpClient";
import type { HttpClientBridge } from "../../../bridges/http/types";
import { createDefaultParserRegistry } from "../../../parsers/parserRegistry";
import type {
  ChapterRecord,
  NovelRecord,
  SettingsRepository,
  ReaderPagingMode,
} from "../../../storage/types";
import type { SyncEngine } from "../../cloud-sync/services/syncEngine";
import {
  CACHE_TTL_MS,
  SHORT_TIMEOUT_MS,
  STANDARD_TIMEOUT_MS,
  PREFETCH_INTERVAL_MS,
  PREFETCH_COUNT,
} from "../../../shared/constants/cache";
import workIndexHtml from "../../../parsers/kakuyomu/__fixtures__/work_index.html?raw";
import episodeContentHtml from "../../../parsers/kakuyomu/__fixtures__/episode_content.html?raw";
import narouWorkIndexSerializedHtml from "../../../parsers/narou/__fixtures__/work_index_serialized.html?raw";
import narouWorkIndexPage2Html from "../../../parsers/narou/__fixtures__/work_index_page2.html?raw";

describe("useReader", () => {
  beforeEach(async () => {
    await resetTestDb();
    localStorage.clear();
    vi.clearAllMocks();
  });

  const createWrapper =
    (services?: React.ComponentProps<typeof ServiceProvider>["services"]) =>
    ({ children }: { children: React.ReactNode }) =>
      React.createElement(ServiceProvider, { services }, children);

  const KAKUYOMU_WORK_ID = "1177354054881162325";
  const KAKUYOMU_EPISODE_IDS = [
    "1177354054881162326",
    "1177354054881162327",
    "1177354054881162328",
    "1177354054881162329",
  ];

  const seedNovelWithChapters = async (
    novelRepo: SqlNovelRepository,
    chapterRepo: SqlChapterRepository,
    options?: {
      chapterCount?: number;
      cachedCount?: number;
      isReadCount?: number;
      bookmarkChapterIndex?: number | null;
      bookmarkScrollProgress?: number;
      cachedDownloadedAt?: string | ((chapterIndex: number) => string);
    },
  ) => {
    const chapterCount = options?.chapterCount ?? 2;
    const cachedCount = options?.cachedCount ?? 0;
    const isReadCount = options?.isReadCount ?? 0;

    const novel = await novelRepo.upsertNovelWithToc(
      {
        siteType: "kakuyomu",
        remoteWorkId: KAKUYOMU_WORK_ID,
        canonicalUrl: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}`,
        title: "境界迷宮と異界の魔術師",
        author: "小野崎えいじ",
        synopsis: "異界の魔術師の物語",
        chapters: Array.from({ length: chapterCount }, (_, i) => ({
          chapterIndex: i + 1,
          remoteChapterId: KAKUYOMU_EPISODE_IDS[i] ?? `ep-${i + 1}`,
          partTitle: i >= 2 ? "第二章" : "第一章",
          title: `第${i + 1}話`,
          url: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}/episodes/${KAKUYOMU_EPISODE_IDS[i] ?? `ep-${i + 1}`}`,
          publishedAt: "2026-01-01T00:00:00Z",
        })),
        nextTocPageUrl: null,
      },
      "2026-01-01T00:00:00Z",
    );

    for (let i = 0; i < cachedCount; i++) {
      const downloadedAt = options?.cachedDownloadedAt
        ? typeof options.cachedDownloadedAt === "function"
          ? options.cachedDownloadedAt(i + 1)
          : options.cachedDownloadedAt
        : new Date().toISOString();
      await chapterRepo.saveChapterBody(
        novel.id,
        i + 1,
        {
          remoteChapterId: KAKUYOMU_EPISODE_IDS[i] ?? `ep-${i + 1}`,
          title: `第${i + 1}話`,
          bodyHtml: `<p>第${i + 1}話のキャッシュ済み本文です。</p>`,
          byteSize: 100,
          prevChapterUrl: null,
          nextChapterUrl: null,
        },
        downloadedAt,
      );
    }

    for (let i = 0; i < isReadCount; i++) {
      await chapterRepo.markChapterRead(novel.id, i + 1, true);
    }

    if (
      options?.bookmarkChapterIndex !== undefined &&
      options?.bookmarkScrollProgress !== undefined
    ) {
      await novelRepo.updateBookmark(
        novel.id,
        options.bookmarkChapterIndex ?? 1,
        options.bookmarkScrollProgress,
      );
    }

    return (await novelRepo.getNovelById(novel.id))!;
  };

  const createMockHttpClient = () => {
    const client = new MockHttpClient();
    client.setResponse(/kakuyomu\.jp\/works\/.*\/episodes\/.*/, {
      status: 200,
      headers: {},
      html: episodeContentHtml,
    });
    client.setResponse(/kakuyomu\.jp\/works\/.*/, {
      status: 200,
      headers: {},
      html: workIndexHtml,
    });
    return client;
  };

  describe("エピソード取得と未キャッシュ話オンデマンド取得 (AC-RD-01)", () => {
    it("キャッシュ済み話が存在する場合、実通信を行わずに即時表示準備が完了すること (AC-RD-01)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const httpClient = createMockHttpClient();
      const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            httpClient,
          }),
        },
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(getHtmlSpy).not.toHaveBeenCalled();
      expect(result.current.novel).not.toBeNull();
      expect(result.current.novel?.id).toBe(seeded.id);
      expect(result.current.chapter).not.toBeNull();
      expect(result.current.chapter?.chapterIndex).toBe(1);
      expect(result.current.chapter?.bodyHtml).toContain(
        "第1話のキャッシュ済み本文です。",
      );
      expect(result.current.error).toBeNull();
    });

    it("未キャッシュ話（bodyHtml === null）を開いた場合、自動的にオンデマンド取得・DB保存され本文が表示されること (AC-RD-01)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 0, // 未キャッシュ
      });

      const httpClient = createMockHttpClient();

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            httpClient,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.chapter).not.toBeNull();
      expect(result.current.chapter?.bodyHtml).not.toBeNull();
      // DB にも保存されていることを確認
      const dbChapter = await chapterRepo.getChapter(seeded.id, 1);
      expect(dbChapter?.bodyHtml).not.toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("novelId 未指定時、listNovels() の先頭作品の第1話が自動的に読み込まれること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 1,
      });

      const { result } = renderHook(() => useReader(), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.novel?.id).toBe(seeded.id);
      expect(result.current.chapterIndex).toBe(1);
      expect(result.current.chapter?.title).toBe("第1話");
    });

    it("options.chapterIndex 指定時はその話（第2話）が読み込まれること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 2 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.chapterIndex).toBe(2);
      expect(result.current.chapter?.title).toBe("第2話");
    });

    it("DB に作品が1件も存在しない場合、novel: null, chapter: null, totalChapters: 0 となりエラーにならないこと", async () => {
      const { result } = renderHook(() => useReader(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.novel).toBeNull();
      expect(result.current.chapter).toBeNull();
      expect(result.current.totalChapters).toBe(0);
      expect(result.current.hasPrevChapter).toBe(false);
      expect(result.current.hasNextChapter).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("存在しない novelId が指定された場合、novel: null, chapter: null となりエラーにならないこと", async () => {
      const { result } = renderHook(
        () => useReader({ novelId: "non-existent-id" }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.novel).toBeNull();
      expect(result.current.chapter).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("作品は存在するが指定の chapterIndex が DB に存在しない場合、chapter: null となること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 99 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.novel).not.toBeNull();
      expect(result.current.chapter).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("オンデマンド取得時にネットワーク通信エラーが発生した場合、error にメッセージが格納されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 0, // 未キャッシュ
      });

      const httpClient = new MockHttpClient();
      httpClient.setResponse(/kakuyomu\.jp\/works\/.*\/episodes\/.*/, () => {
        throw new Error("HTTP 500: Server Error");
      });

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            httpClient,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toContain("HTTP 500: Server Error");
    });

    it("アンマウント後に非同期処理が完了した場合に状態更新が行われないこと（isMounted ガード）", async () => {
      let resolveGetNovel: ((value: NovelRecord | null) => void) | null = null;
      const deferredNovel = new Promise<NovelRecord | null>((resolve) => {
        resolveGetNovel = resolve;
      });

      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      vi.spyOn(novelRepo, "getNovelById").mockImplementation(
        () => deferredNovel,
      );

      const { unmount } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(novelRepo.getNovelById).toHaveBeenCalled();
      });

      // 非同期解決前にアンマウント
      unmount();

      // その後非同期処理を完了させる
      await act(async () => {
        resolveGetNovel!(seeded);
      });
    });
  });

  describe("設定初期化・組み方向・テーマ・文字サイズ・行間の変更と永続化 (AC-RD-03, AC-RD-04, AC-RD-05)", () => {
    it("初回ロード時に settingsRepository から組版設定が正しく復元されること", async () => {
      const db = await resetTestDb();
      const settingsRepo = new SqlSettingsRepository(db);
      await settingsRepo.updateReaderSettings({
        writingMode: "horizontal-tb",
        theme: "dark",
        fontSizePx: 22,
        lineHeight: 2.0,
      });

      const { result } = renderHook(() => useReader(), {
        wrapper: createWrapper({ settingsRepository: settingsRepo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.writingMode).toBe("horizontal-tb");
      expect(result.current.theme).toBe("dark");
      expect(result.current.fontSizePx).toBe(22);
      expect(result.current.lineHeight).toBe(2.0);
      expect(result.current.fontFamily).toBe("biz-ud-mincho");
      expect(result.current.pageMarginPx).toBe(20);
    });

    it("初回ロード時に settingsRepository から fontFamily と pageMarginPx が正常に復元されること (SYS-REQ-09)", async () => {
      const db = await resetTestDb();
      const settingsRepo = new SqlSettingsRepository(db);
      await settingsRepo.updateReaderSettings({
        fontFamily: "klee",
        pageMarginPx: 32,
      });

      const { result } = renderHook(() => useReader(), {
        wrapper: createWrapper({ settingsRepository: settingsRepo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.fontFamily).toBe("klee");
      expect(result.current.pageMarginPx).toBe(32);
    });

    it("初回ロード時に settingsRepository.getReaderSettings が失敗した場合、fontFamily と pageMarginPx のデフォルト値（'biz-ud-mincho', 20）が維持されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const mockSettingsRepo: SettingsRepository = {
        getReaderSettings: async () => {
          throw new Error("設定読み出し失敗");
        },
        updateReaderSettings: async () => {
          throw new Error("更新不可");
        },
      };

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            settingsRepository: mockSettingsRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.fontFamily).toBe("biz-ud-mincho");
      expect(result.current.pageMarginPx).toBe(20);
      expect(result.current.error).toBeNull();
    });

    it("初回ロード時に settingsRepository.getReaderSettings が例外を投げた場合でも、デフォルト設定値が維持されて正常にロードが完了すること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const mockSettingsRepo: SettingsRepository = {
        getReaderSettings: async () => {
          throw new Error("設定読み出し失敗");
        },
        updateReaderSettings: async () => {
          throw new Error("更新不可");
        },
      };

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            settingsRepository: mockSettingsRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.writingMode).toBe("vertical-rl");
      expect(result.current.theme).toBe("light");
      expect(result.current.fontSizePx).toBe(18);
      expect(result.current.lineHeight).toBe(1.8);
      expect(result.current.fontFamily).toBe("biz-ud-mincho");
      expect(result.current.pageMarginPx).toBe(20);
      expect(result.current.error).toBeNull();
    });

    it("初期状態において enableVolumeKeyPaging が false であること (AC-RD-26)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.enableVolumeKeyPaging).toBe(false);
    });

    it("settingsRepository に保存された enableVolumeKeyPaging (true) が初回ロード時に復元されること (AC-RD-26)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const settingsRepo = new SqlSettingsRepository(db);
      await settingsRepo.updateReaderSettings({ enableVolumeKeyPaging: true });

      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            settingsRepository: settingsRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.enableVolumeKeyPaging).toBe(true);
    });

    it("初回ロード時に settingsRepository.getReaderSettings が失敗した場合、enableVolumeKeyPaging のデフォルト値 (false) が維持されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const mockSettingsRepo: SettingsRepository = {
        getReaderSettings: async () => {
          throw new Error("設定取得失敗");
        },
        updateReaderSettings: async () => {
          throw new Error("設定保存失敗");
        },
      };

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            settingsRepository: mockSettingsRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.enableVolumeKeyPaging).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("toggleWritingMode で vertical-rl と horizontal-tb が相互に切り替わり永続化されること (AC-RD-03)", async () => {
      const db = await resetTestDb();
      const settingsRepo = new SqlSettingsRepository(db);

      const { result } = renderHook(() => useReader(), {
        wrapper: createWrapper({ settingsRepository: settingsRepo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.writingMode).toBe("vertical-rl");

      await act(async () => {
        await result.current.toggleWritingMode();
      });

      expect(result.current.writingMode).toBe("horizontal-tb");
      let saved = await settingsRepo.getReaderSettings();
      expect(saved.writingMode).toBe("horizontal-tb");

      await act(async () => {
        await result.current.toggleWritingMode();
      });

      expect(result.current.writingMode).toBe("vertical-rl");
      saved = await settingsRepo.getReaderSettings();
      expect(saved.writingMode).toBe("vertical-rl");
    });

    it("changeTheme でテーマ（light / sepia / dark / black）が変更され永続化されること (AC-RD-04)", async () => {
      const db = await resetTestDb();
      const settingsRepo = new SqlSettingsRepository(db);

      const { result } = renderHook(() => useReader(), {
        wrapper: createWrapper({ settingsRepository: settingsRepo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.changeTheme("sepia");
      });
      expect(result.current.theme).toBe("sepia");
      let saved = await settingsRepo.getReaderSettings();
      expect(saved.theme).toBe("sepia");

      await act(async () => {
        await result.current.changeTheme("black");
      });
      expect(result.current.theme).toBe("black");
      saved = await settingsRepo.getReaderSettings();
      expect(saved.theme).toBe("black");
    });

    it("changeFontSize で文字サイズが 12〜32px にクランプされて更新・永続化されること (AC-RD-05)", async () => {
      const db = await resetTestDb();
      const settingsRepo = new SqlSettingsRepository(db);

      const { result } = renderHook(() => useReader(), {
        wrapper: createWrapper({ settingsRepository: settingsRepo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 正常範囲
      await act(async () => {
        await result.current.changeFontSize(20);
      });
      expect(result.current.fontSizePx).toBe(20);
      let saved = await settingsRepo.getReaderSettings();
      expect(saved.fontSizePx).toBe(20);

      // 下限クランプ (10 -> 12)
      await act(async () => {
        await result.current.changeFontSize(10);
      });
      expect(result.current.fontSizePx).toBe(12);
      saved = await settingsRepo.getReaderSettings();
      expect(saved.fontSizePx).toBe(12);

      // 上限クランプ (36 -> 32)
      await act(async () => {
        await result.current.changeFontSize(36);
      });
      expect(result.current.fontSizePx).toBe(32);
      saved = await settingsRepo.getReaderSettings();
      expect(saved.fontSizePx).toBe(32);
    });

    it("changeLineHeight で行間が 1.4〜2.4 にクランプかつ小数第1位に丸められて更新・永続化されること (AC-RD-05)", async () => {
      const db = await resetTestDb();
      const settingsRepo = new SqlSettingsRepository(db);

      const { result } = renderHook(() => useReader(), {
        wrapper: createWrapper({ settingsRepository: settingsRepo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 正常範囲かつ丸め (2.06 -> 2.1)
      await act(async () => {
        await result.current.changeLineHeight(2.06);
      });
      expect(result.current.lineHeight).toBe(2.1);
      let saved = await settingsRepo.getReaderSettings();
      expect(saved.lineHeight).toBe(2.1);

      // 下限クランプ (1.1 -> 1.4)
      await act(async () => {
        await result.current.changeLineHeight(1.1);
      });
      expect(result.current.lineHeight).toBe(1.4);
      saved = await settingsRepo.getReaderSettings();
      expect(saved.lineHeight).toBe(1.4);

      // 上限クランプ (2.8 -> 2.4)
      await act(async () => {
        await result.current.changeLineHeight(2.8);
      });
      expect(result.current.lineHeight).toBe(2.4);
      saved = await settingsRepo.getReaderSettings();
      expect(saved.lineHeight).toBe(2.4);
    });

    it("設定変更時に settingsRepository が例外を投げた場合、error にエラーメッセージが格納されること", async () => {
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
          pagingMode: "auto",
          updatedAt: "2026-01-01T00:00:00Z",
        }),
        updateReaderSettings: async () => {
          throw new Error("設定保存に失敗しました");
        },
      };

      const { result } = renderHook(() => useReader(), {
        wrapper: createWrapper({ settingsRepository: mockSettingsRepo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.toggleWritingMode();
      });
      expect(result.current.error).toBe("設定保存に失敗しました");

      await act(async () => {
        await result.current.changeTheme("dark");
      });
      expect(result.current.error).toBe("設定保存に失敗しました");

      await act(async () => {
        await result.current.changeFontSize(20);
      });
      expect(result.current.error).toBe("設定保存に失敗しました");

      await act(async () => {
        await result.current.changeLineHeight(2.0);
      });
      expect(result.current.error).toBe("設定保存に失敗しました");
    });
  });

  describe("前後エピソード連続遷移（goToChapter）と境界制御 (AC-RD-06)", () => {
    it("goToChapter で次話（第2話）へ遷移でき、本文が読み込まれて true が返却されること (AC-RD-06)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 3,
        cachedCount: 3,
      });

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let transitionResult = false;
      await act(async () => {
        transitionResult = await result.current.goToChapter(2);
      });

      expect(transitionResult).toBe(true);
      expect(result.current.chapterIndex).toBe(2);
      expect(result.current.chapter?.title).toBe("第2話");
      expect(result.current.hasPrevChapter).toBe(true);
      expect(result.current.hasNextChapter).toBe(true);
    });

    it("遷移先が未キャッシュ話の場合、オンデマンド取得されて本文が保存・反映されること (AC-RD-06)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 1, // 第1話のみキャッシュ済み、第2話未キャッシュ
      });

      const httpClient = createMockHttpClient();

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            httpClient,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let transitionResult = false;
      await act(async () => {
        transitionResult = await result.current.goToChapter(2);
      });

      expect(transitionResult).toBe(true);
      expect(result.current.chapterIndex).toBe(2);
      expect(result.current.chapter?.bodyHtml).not.toBeNull();
      const dbChapter = await chapterRepo.getChapter(seeded.id, 2);
      expect(dbChapter?.bodyHtml).not.toBeNull();
    });

    it("未キャッシュ話への goToChapter 実行中、旧エピソード本文がクリアされてローディング状態となり、完了後に新本文が描画されること (AC-RD-06, AC-RD-28)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 1, // 第1話のみキャッシュ済み、第2話未キャッシュ
      });

      let resolveFetch!: (value: {
        html: string;
        status: number;
        headers: Record<string, string>;
      }) => void;
      const fetchPromise = new Promise<{
        html: string;
        status: number;
        headers: Record<string, string>;
      }>((resolve) => {
        resolveFetch = resolve;
      });
      const httpClient = createMockHttpClient();
      httpClient.getHtml = vi.fn().mockImplementation(() => fetchPromise);

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            httpClient,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.chapter?.bodyHtml).not.toBeNull();

      // 第2話（未キャッシュ）へ遷移開始
      let transitionPromise!: Promise<boolean>;
      act(() => {
        transitionPromise = result.current.goToChapter(2);
      });

      // 通信中: isLoading が true であり、直前の本文がクリアされて chapter === null となること
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
        expect(result.current.chapter).toBeNull();
      });

      // 通信完了
      await act(async () => {
        resolveFetch({
          html: "<p>第2話本文</p>",
          status: 200,
          headers: {},
        });
        await transitionPromise;
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.chapterIndex).toBe(2);
      expect(result.current.chapter?.bodyHtml).not.toBeNull();
    });

    it("キャッシュ済み話への goToChapter 実行時、本文がクリアされずチラつきなしで即座に切り替わること (AC-RD-06, AC-RD-28)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2, // 2話ともキャッシュ済み
      });

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.chapter?.bodyHtml).not.toBeNull();

      let transitionResult = false;
      await act(async () => {
        transitionResult = await result.current.goToChapter(2);
      });

      expect(transitionResult).toBe(true);
      expect(result.current.chapterIndex).toBe(2);
      expect(result.current.chapter?.title).toBe("第2話");
      expect(result.current.chapter?.bodyHtml).not.toBeNull();
    });

    it("goToChapter の遷移通信中に重複して goToChapter が呼び出された場合、多重実行がガードされて false が返却されること (AC-RD-06)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 3,
        cachedCount: 1, // 第1話のみキャッシュ済み、第2・3話未キャッシュ
      });

      let resolveFetch!: (value: {
        html: string;
        status: number;
        headers: Record<string, string>;
      }) => void;
      const fetchPromise = new Promise<{
        html: string;
        status: number;
        headers: Record<string, string>;
      }>((resolve) => {
        resolveFetch = resolve;
      });
      const httpClient = createMockHttpClient();
      httpClient.getHtml = vi.fn().mockImplementation(() => fetchPromise);

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            httpClient,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 1回目の goToChapter(2) を開始
      let p1!: Promise<boolean>;
      act(() => {
        p1 = result.current.goToChapter(2);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // 通信中に 2回目の goToChapter(3) を呼び出す
      let p2Result: boolean | undefined;
      await act(async () => {
        p2Result = await result.current.goToChapter(3);
      });

      // 多重実行防止により 2回目は false が即座に返ること
      expect(p2Result).toBe(false);

      // 1回目の通信を完了させる
      await act(async () => {
        resolveFetch({
          html: "<p>第2話本文</p>",
          status: 200,
          headers: {},
        });
        const p1Result = await p1;
        expect(p1Result).toBe(true);
      });

      expect(result.current.chapterIndex).toBe(2);
    });

    it("hasPrevChapter と hasNextChapter が第1話・中間話・最終話で正しく判定されること (AC-RD-06)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 3,
        cachedCount: 3,
      });

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 第1話: prev=false, next=true
      expect(result.current.hasPrevChapter).toBe(false);
      expect(result.current.hasNextChapter).toBe(true);

      // 第2話: prev=true, next=true
      await act(async () => {
        await result.current.goToChapter(2);
      });
      expect(result.current.hasPrevChapter).toBe(true);
      expect(result.current.hasNextChapter).toBe(true);

      // 第3話（最終話）: prev=true, next=false
      await act(async () => {
        await result.current.goToChapter(3);
      });
      expect(result.current.hasPrevChapter).toBe(true);
      expect(result.current.hasNextChapter).toBe(false);
    });

    it("novel === null の場合、goToChapter は何もせず false を返却すること (AC-RD-06)", async () => {
      const { result } = renderHook(() => useReader(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let transitionResult = true;
      await act(async () => {
        transitionResult = await result.current.goToChapter(1);
      });
      expect(transitionResult).toBe(false);
    });

    it("targetChapterIndex < 1 または targetChapterIndex > totalChapters の場合、false を返却して遷移しないこと (AC-RD-06)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 0（下限未満）
      let r1 = true;
      await act(async () => {
        r1 = await result.current.goToChapter(0);
      });
      expect(r1).toBe(false);
      expect(result.current.chapterIndex).toBe(1);

      // 3（上限超え、totalChapters=2）
      let r2 = true;
      await act(async () => {
        r2 = await result.current.goToChapter(3);
      });
      expect(r2).toBe(false);
      expect(result.current.chapterIndex).toBe(1);
    });

    it("goToChapter 処理中に例外が発生した場合、error が設定され false が返却されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      vi.spyOn(chapterRepo, "getChapter").mockRejectedValueOnce(
        new Error("DB 読み込み例外"),
      );

      let transitionResult = true;
      await act(async () => {
        transitionResult = await result.current.goToChapter(2);
      });

      expect(transitionResult).toBe(false);
      expect(result.current.error).toBe("DB 読み込み例外");
    });
  });

  describe("既読フラグ（is_read）の自動更新 (AC-RD-07)", () => {
    it("未読エピソードの本文表示準備完了時に markChapterRead が自動実行され isRead: true となること (AC-RD-07)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
        isReadCount: 0, // 全話未読
      });

      const markChapterReadSpy = vi.spyOn(chapterRepo, "markChapterRead");

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(markChapterReadSpy).toHaveBeenCalledWith(seeded.id, 1, true);
      expect(result.current.chapter?.isRead).toBe(true);

      const dbChapter = await chapterRepo.getChapter(seeded.id, 1);
      expect(dbChapter?.isRead).toBe(true);
    });

    it("すでに既読（isRead === true）のエピソードを開いた場合、重複して markChapterRead を呼び出さないこと", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
        isReadCount: 1, // 第1話は既読
      });

      const markChapterReadSpy = vi.spyOn(chapterRepo, "markChapterRead");

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(markChapterReadSpy).not.toHaveBeenCalled();
      expect(result.current.chapter?.isRead).toBe(true);
    });

    it("goToChapter で次話へ遷移する際、遷移前の現在話に対して確実に markChapterRead が実行されること (AC-RD-07)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
        isReadCount: 0,
      });

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const markChapterReadSpy = vi.spyOn(chapterRepo, "markChapterRead");

      await act(async () => {
        await result.current.goToChapter(2);
      });

      // 遷移前の第1話、および遷移先の第2話の既読が記録されること
      expect(markChapterReadSpy).toHaveBeenCalledWith(seeded.id, 1, true);
      expect(markChapterReadSpy).toHaveBeenCalledWith(seeded.id, 2, true);
    });

    it("goToChapter で未キャッシュ話本文の解決中にアンマウントされた場合、遷移先話の markChapterRead・updateBookmark・startPrefetch が呼ばれないこと (R1-18)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 1, // 第1話のみキャッシュ済み、第2話は未キャッシュ
        isReadCount: 0,
      });

      let resolveGetHtml!: (value: {
        status: number;
        html: string;
        finalUrl: string;
      }) => void;
      const getHtmlPromise = new Promise<{
        status: number;
        html: string;
        finalUrl: string;
      }>((resolve) => {
        resolveGetHtml = resolve;
      });

      const httpClient = new MockHttpClient();
      httpClient.setResponse(
        /kakuyomu\.jp\/works\/.*\/episodes\/.*/,
        async (req) => {
          if (req.url.includes("episodes")) {
            return await getHtmlPromise;
          }
          return {
            status: 200,
            html: "<html></html>",
            headers: {},
            url: req.url,
          };
        },
      );

      const markChapterReadSpy = vi.spyOn(chapterRepo, "markChapterRead");
      const updateBookmarkSpy = vi.spyOn(novelRepo, "updateBookmark");

      const { result, unmount } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            httpClient,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let transitionPromise!: Promise<boolean>;
      act(() => {
        transitionPromise = result.current.goToChapter(2);
      });

      // 未キャッシュ話の本文取得待機中にコンポーネントがアンマウント
      unmount();

      // 本文取得完了
      resolveGetHtml({
        status: 200,
        html: `<p>第2話本文</p>`,
        finalUrl: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}/episodes/${KAKUYOMU_EPISODE_IDS[1]}`,
      });

      let transitionResult: boolean | undefined;
      await act(async () => {
        transitionResult = await transitionPromise;
      });

      expect(transitionResult).toBe(false);
      // 遷移前（第1話）の既読化は呼ばれる
      expect(markChapterReadSpy).toHaveBeenCalledWith(seeded.id, 1, true);
      // 遷移先（第2話）の既読化はアンマウントにより呼ばれない
      expect(markChapterReadSpy).not.toHaveBeenCalledWith(seeded.id, 2, true);
      // 遷移先（第2話）へのしおり更新はアンマウントにより呼ばれない
      expect(updateBookmarkSpy).not.toHaveBeenCalledWith(
        seeded.id,
        2,
        expect.anything(),
      );
    });

    it("goToChapter: 各非同期ステップ完了直後にアンマウントされていた場合、false を返して安全に中断されること (R1-18)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 3,
        cachedCount: 3,
        isReadCount: 0,
      });

      // 1. markPreviousAsRead (L829)
      {
        const unmountRef = { current: () => {} };
        const orig = chapterRepo.markChapterRead.bind(chapterRepo);
        vi.spyOn(chapterRepo, "markChapterRead").mockImplementation(
          async (...args) => {
            unmountRef.current();
            return orig(...args);
          },
        );
        const { result, unmount } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        unmountRef.current = unmount;
        let res: boolean | undefined;
        await act(async () => {
          res = await result.current.goToChapter(2);
        });
        expect(res).toBe(false);
      }

      // 2. getChapter (L836)
      {
        const unmountRef = { current: () => {} };
        vi.restoreAllMocks();
        const orig = chapterRepo.getChapter.bind(chapterRepo);
        vi.spyOn(chapterRepo, "getChapter").mockImplementation(
          async (...args) => {
            unmountRef.current();
            return orig(...args);
          },
        );
        const { result, unmount } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        unmountRef.current = unmount;
        let res: boolean | undefined;
        await act(async () => {
          res = await result.current.goToChapter(2);
        });
        expect(res).toBe(false);
      }

      // 3. resolveChapterBody (L849)
      {
        const unmountRef = { current: () => {} };
        vi.restoreAllMocks();
        const db3 = await resetTestDb();
        const novelRepo3 = new SqlNovelRepository(db3);
        const chapterRepo3 = new SqlChapterRepository(db3);
        const seeded3 = await seedNovelWithChapters(novelRepo3, chapterRepo3, {
          chapterCount: 3,
          cachedCount: 1,
          isReadCount: 0,
        });

        const origSave = chapterRepo3.saveChapterBody.bind(chapterRepo3);
        vi.spyOn(chapterRepo3, "saveChapterBody").mockImplementation(
          async (...args) => {
            unmountRef.current();
            return origSave(...args);
          },
        );

        const httpClient = new MockHttpClient();
        httpClient.setResponse(
          /kakuyomu\.jp\/works\/.*\/episodes\/.*/,
          (req) => ({
            status: 200,
            html: episodeContentHtml,
            headers: {},
            url: req.url,
          }),
        );

        const { result, unmount } = renderHook(
          () => useReader({ novelId: seeded3.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo3,
              chapterRepository: chapterRepo3,
              httpClient,
            }),
          },
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        unmountRef.current = unmount;
        let res: boolean | undefined;
        await act(async () => {
          res = await result.current.goToChapter(2);
        });
        expect(res).toBe(false);
      }

      // 4. 表示完了時 markChapterRead (L866)
      {
        const unmountRef = { current: () => {} };
        vi.restoreAllMocks();
        const db4 = await resetTestDb();
        const novelRepo4 = new SqlNovelRepository(db4);
        const chapterRepo4 = new SqlChapterRepository(db4);
        const seeded4 = await seedNovelWithChapters(novelRepo4, chapterRepo4, {
          chapterCount: 3,
          cachedCount: 3,
          isReadCount: 0,
        });

        const origMark = chapterRepo4.markChapterRead.bind(chapterRepo4);
        vi.spyOn(chapterRepo4, "markChapterRead").mockImplementation(
          async (...args) => {
            if (args[1] === 2) {
              unmountRef.current();
            }
            return origMark(...args);
          },
        );
        const { result, unmount } = renderHook(
          () => useReader({ novelId: seeded4.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo4,
              chapterRepository: chapterRepo4,
            }),
          },
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        unmountRef.current = unmount;
        let res: boolean | undefined;
        await act(async () => {
          res = await result.current.goToChapter(2);
        });
        expect(res).toBe(false);
      }

      // 5. updateBookmark (L877)
      {
        const unmountRef = { current: () => {} };
        vi.restoreAllMocks();
        const db5 = await resetTestDb();
        const novelRepo5 = new SqlNovelRepository(db5);
        const chapterRepo5 = new SqlChapterRepository(db5);
        const seeded5 = await seedNovelWithChapters(novelRepo5, chapterRepo5, {
          chapterCount: 3,
          cachedCount: 3,
          isReadCount: 0,
        });

        const origUpdate = novelRepo5.updateBookmark.bind(novelRepo5);
        vi.spyOn(novelRepo5, "updateBookmark").mockImplementation(
          async (...args) => {
            unmountRef.current();
            return origUpdate(...args);
          },
        );
        const { result, unmount } = renderHook(
          () => useReader({ novelId: seeded5.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo5,
              chapterRepository: chapterRepo5,
            }),
          },
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        unmountRef.current = unmount;
        let res: boolean | undefined;
        await act(async () => {
          res = await result.current.goToChapter(2);
        });
        expect(res).toBe(false);
      }

      // 6. getNovelById (L882)
      {
        const unmountRef = { current: () => {} };
        vi.restoreAllMocks();
        const db6 = await resetTestDb();
        const novelRepo6 = new SqlNovelRepository(db6);
        const chapterRepo6 = new SqlChapterRepository(db6);
        const seeded6 = await seedNovelWithChapters(novelRepo6, chapterRepo6, {
          chapterCount: 3,
          cachedCount: 3,
          isReadCount: 0,
        });

        const origGetNovel = novelRepo6.getNovelById.bind(novelRepo6);
        let called = 0;
        vi.spyOn(novelRepo6, "getNovelById").mockImplementation(
          async (...args) => {
            called++;
            if (called > 1) {
              unmountRef.current();
            }
            return origGetNovel(...args);
          },
        );
        const { result, unmount } = renderHook(
          () => useReader({ novelId: seeded6.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo6,
              chapterRepository: chapterRepo6,
            }),
          },
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        unmountRef.current = unmount;
        let res: boolean | undefined;
        await act(async () => {
          res = await result.current.goToChapter(2);
        });
        expect(res).toBe(false);
      }
    });
  });

  describe("しおり話数・スクロール進捗率の復元・自動保存 (AC-RD-08)", () => {
    it("保存済みしおり話と一致する場合、保存されていた bookmarkScrollProgress が復元されること (AC-RD-08)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
        bookmarkChapterIndex: 2,
        bookmarkScrollProgress: 0.65,
      });

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 2 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.initialScrollProgress).toBe(0.65);
      expect(result.current.scrollProgress).toBe(0.65);
    });

    it("保存済みしおり話と異なる話を開いた場合、進捗率は0となり直ちに updateBookmark でしおりが更新されること (AC-RD-08)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
        bookmarkChapterIndex: 2,
        bookmarkScrollProgress: 0.8,
      });

      const updateBookmarkSpy = vi.spyOn(novelRepo, "updateBookmark");

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.initialScrollProgress).toBe(0);
      expect(result.current.scrollProgress).toBe(0);
      expect(updateBookmarkSpy).toHaveBeenCalledWith(seeded.id, 1, 0);

      const dbNovel = await novelRepo.getNovelById(seeded.id);
      expect(dbNovel?.bookmarkChapterIndex).toBe(1);
      expect(dbNovel?.bookmarkScrollProgress).toBe(0);
    });

    it("updateScrollProgress で進捗率が 0.0〜1.0 にクランプされて更新され、updateBookmark で保存されること (AC-RD-08)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 正常値 (0.42)
      await act(async () => {
        await result.current.updateScrollProgress(0.42);
      });
      expect(result.current.scrollProgress).toBe(0.42);
      await waitFor(async () => {
        const dbNovel = await novelRepo.getNovelById(seeded.id);
        expect(dbNovel?.bookmarkScrollProgress).toBe(0.42);
      });

      // 下限クランプ (-0.2 -> 0.0)
      await act(async () => {
        await result.current.updateScrollProgress(-0.2);
      });
      expect(result.current.scrollProgress).toBe(0);
      await waitFor(async () => {
        const dbNovel = await novelRepo.getNovelById(seeded.id);
        expect(dbNovel?.bookmarkScrollProgress).toBe(0);
      });

      // 上限クランプ (1.5 -> 1.0)
      await act(async () => {
        await result.current.updateScrollProgress(1.5);
      });
      expect(result.current.scrollProgress).toBe(1);
      await waitFor(async () => {
        const dbNovel = await novelRepo.getNovelById(seeded.id);
        expect(dbNovel?.bookmarkScrollProgress).toBe(1);
      });

      // 非有限値 (NaN -> 0.0)
      await act(async () => {
        await result.current.updateScrollProgress(Number.NaN);
      });
      expect(result.current.scrollProgress).toBe(0);
    });

    it("updateScrollProgress が連続呼び出しされた場合、300ms デバウンスされて最後の値のみが DB に保存されること (R1-12)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const updateBookmarkSpy = vi.spyOn(novelRepo, "updateBookmark");

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      updateBookmarkSpy.mockClear();

      // 連続スクロール呼び出し
      await act(async () => {
        void result.current.updateScrollProgress(0.1);
        void result.current.updateScrollProgress(0.2);
        void result.current.updateScrollProgress(0.35);
      });

      // 呼び出し直後はステートのみ更新され、DB 保存はまだ実行されていない
      expect(result.current.scrollProgress).toBe(0.35);
      expect(updateBookmarkSpy).not.toHaveBeenCalled();

      // 300ms 後にデバウンスが発火し、最後の値 0.35 のみ保存される
      await waitFor(async () => {
        expect(updateBookmarkSpy).toHaveBeenCalledTimes(1);
        expect(updateBookmarkSpy).toHaveBeenCalledWith(seeded.id, 1, 0.35);
        const dbNovel = await novelRepo.getNovelById(seeded.id);
        expect(dbNovel?.bookmarkScrollProgress).toBe(0.35);
      });
    });

    it("updateScrollProgress の 300ms デバウンス待機中に flushBookmark を呼ぶとタイマーがキャンセルされ即時保存されること (R1-12)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const updateBookmarkSpy = vi.spyOn(novelRepo, "updateBookmark");

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      updateBookmarkSpy.mockClear();

      // スクロール進捗を更新後、デバウンス待機完了前に即時 flushBookmark
      await act(async () => {
        void result.current.updateScrollProgress(0.7);
        await result.current.flushBookmark();
      });

      // flushBookmark により即座に DB 保存される
      expect(updateBookmarkSpy).toHaveBeenCalledWith(seeded.id, 1, 0.7);
      const dbNovel = await novelRepo.getNovelById(seeded.id);
      expect(dbNovel?.bookmarkScrollProgress).toBe(0.7);

      // さらに 350ms 経過後も二重呼び出しされていないこと
      await new Promise((resolve) => setTimeout(resolve, 350));
      expect(updateBookmarkSpy).toHaveBeenCalledTimes(1);
    });

    it("flushBookmark で最新の (chapterIndex, scrollProgress) が DB に即時保存されること (AC-RD-08)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const updateBookmarkSpy = vi.spyOn(novelRepo, "updateBookmark");

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateScrollProgress(0.5);
      });

      updateBookmarkSpy.mockClear();

      await act(async () => {
        await result.current.flushBookmark();
      });

      expect(updateBookmarkSpy).toHaveBeenCalledWith(seeded.id, 1, 0.5);
    });

    it("flushBookmark の参照が作品情報の更新等で不要に変更されず安定していること (R1-12)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const { result, rerender } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialFlushBookmark = result.current.flushBookmark;

      // スクロール進捗を更新して再レンダーを発生させる
      await act(async () => {
        void result.current.updateScrollProgress(0.3);
      });

      rerender();

      expect(result.current.flushBookmark).toBe(initialFlushBookmark);
    });

    it("novel === null の状態で updateScrollProgress や flushBookmark を呼び出しても例外が発生しないこと", async () => {
      const { result } = renderHook(() => useReader(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateScrollProgress(0.5);
      });
      expect(result.current.scrollProgress).toBe(0.5);

      await act(async () => {
        await result.current.flushBookmark();
      });
      expect(result.current.error).toBeNull();
    });

    it("updateBookmark 時に例外が発生した場合、error にエラーメッセージが格納されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
        bookmarkChapterIndex: 1,
        bookmarkScrollProgress: 0,
      });

      vi.spyOn(novelRepo, "updateBookmark").mockRejectedValue(
        new Error("しおり更新例外"),
      );

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateScrollProgress(0.5);
      });
      await waitFor(() => {
        expect(result.current.error).toBe("しおり更新例外");
      });

      await act(async () => {
        await result.current.flushBookmark();
      });
      expect(result.current.error).toBe("しおり更新例外");
    });
  });

  describe("手動作品取得・更新（fetchNovelFromUrl）", () => {
    it("対応サイトURLから作品トップを取得・解析し、目次と対象話本文がオンデマンド保存・反映されること", async () => {
      const httpClient = createMockHttpClient();

      const { result } = renderHook(
        () =>
          useReader({
            initialWorkUrl: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}`,
          }),
        {
          wrapper: createWrapper({ httpClient }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.fetchNovelFromUrl();
      });

      expect(result.current.novel).not.toBeNull();
      expect(result.current.novel?.title).toBe("境界迷宮と異界の魔術師");
      expect(result.current.chapter).not.toBeNull();
      expect(result.current.chapter?.chapterIndex).toBe(1);
      expect(result.current.chapter?.isRead).toBe(true);
      expect(result.current.chapter?.bodyHtml).not.toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("未対応 URL（パーサー未登録）の場合、HTTP 通信を行わずに直ちに error が設定されること", async () => {
      const httpClient = createMockHttpClient();
      const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

      const { result } = renderHook(
        () =>
          useReader({
            initialWorkUrl: "https://unsupported-site.example.com/novel/123",
          }),
        {
          wrapper: createWrapper({ httpClient }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.fetchNovelFromUrl();
      });

      expect(getHtmlSpy).not.toHaveBeenCalled();
      expect(result.current.error).toContain("No parser registered for URL");
    });

    it("対象 URL が未指定（空文字）の場合、即座に error が設定されること", async () => {
      const { result } = renderHook(() => useReader({ initialWorkUrl: "" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.fetchNovelFromUrl();
      });

      expect(result.current.error).toBe("対象作品のURLが指定されていません");
    });

    it("通信例外が発生した場合、error にエラーメッセージが格納されること", async () => {
      const httpClient = new MockHttpClient();
      httpClient.setResponse(/kakuyomu\.jp\/works\/.*/, () => {
        throw new Error("HTTP 404: Not Found");
      });

      const { result } = renderHook(
        () =>
          useReader({
            initialWorkUrl: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}`,
          }),
        {
          wrapper: createWrapper({ httpClient }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.fetchNovelFromUrl();
      });

      expect(result.current.error).toBe("HTTP 404: Not Found");
    });

    it("チャプターが0件の作品の場合、作品レコードのみ保存され chapter: null となること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);

      const mockParser = {
        siteType: "kakuyomu" as const,
        canParse: () => true,
        normalizeWorkUrl: (url: string) => url,
        parseNovelIndex: () => ({
          siteType: "kakuyomu" as const,
          remoteWorkId: "00000",
          canonicalUrl: "https://kakuyomu.jp/works/00000",
          title: "空作品",
          author: "作者",
          synopsis: "あらすじ",
          chapters: [],
          nextTocPageUrl: null,
        }),
        parseChapterContent: () => {
          throw new Error("Should not be called");
        },
      };

      const parserRegistry = createDefaultParserRegistry();
      vi.spyOn(parserRegistry, "requireParser").mockReturnValue(mockParser);

      const httpClient = new MockHttpClient();
      httpClient.setResponse(/kakuyomu\.jp\/works\/00000/, {
        status: 200,
        headers: {},
        html: "<html></html>",
      });

      const { result } = renderHook(
        () =>
          useReader({
            initialWorkUrl: "https://kakuyomu.jp/works/00000",
          }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            parserRegistry,
            httpClient,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.fetchNovelFromUrl();
      });

      expect(result.current.novel).not.toBeNull();
      expect(result.current.novel?.title).toBe("空作品");
      expect(result.current.chapter).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("作品ロード済みの状態で fetchNovelFromUrl を呼び出した場合、novel.canonicalUrl が対象 URL として解決されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const httpClient = createMockHttpClient();

      const { result } = renderHook(() => useReader({ novelId: seeded.id }), {
        wrapper: createWrapper({
          novelRepository: novelRepo,
          chapterRepository: chapterRepo,
          httpClient,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.fetchNovelFromUrl();
      });

      expect(result.current.novel).not.toBeNull();
      expect(result.current.novel?.id).toBe(seeded.id);
      expect(result.current.error).toBeNull();
    });

    it("現在の chapterIndex が目次に存在しない場合、第1話（chapters[0]）にフォールバックして取得・反映されること", async () => {
      const httpClient = createMockHttpClient();

      const { result } = renderHook(
        () =>
          useReader({
            chapterIndex: 99,
            initialWorkUrl: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}`,
          }),
        {
          wrapper: createWrapper({ httpClient }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.fetchNovelFromUrl();
      });

      expect(result.current.novel).not.toBeNull();
      expect(result.current.chapter).not.toBeNull();
      expect(result.current.chapterIndex).toBe(1);
      expect(result.current.error).toBeNull();
    });

    it("fetchNovelFromUrl 完了時に chapterRepository.getChapter が null を返却した場合、chapter が null となること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);

      const httpClient = createMockHttpClient();

      const { result } = renderHook(
        () =>
          useReader({
            initialWorkUrl: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}`,
          }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            httpClient,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      vi.spyOn(chapterRepo, "getChapter").mockResolvedValue(null);

      await act(async () => {
        await result.current.fetchNovelFromUrl();
      });

      expect(result.current.novel).not.toBeNull();
      expect(result.current.chapter).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("fetchNovelFromUrl: 複数ページ目次作品（なろう）を取得した場合に fetchFullNovelIndex を介して全話が保存されること (R1-19)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);

      const httpClient = new MockHttpClient();
      httpClient.setResponse("https://ncode.syosetu.com/n9669bk/", () => ({
        status: 200,
        url: "https://ncode.syosetu.com/n9669bk/",
        headers: {},
        html: narouWorkIndexSerializedHtml,
      }));
      httpClient.setResponse("https://ncode.syosetu.com/n9669bk/?p=2", () => ({
        status: 200,
        url: "https://ncode.syosetu.com/n9669bk/?p=2",
        headers: {},
        html: narouWorkIndexPage2Html,
      }));
      httpClient.setResponse("https://ncode.syosetu.com/n9669bk/1/", () => ({
        status: 200,
        url: "https://ncode.syosetu.com/n9669bk/1/",
        headers: {},
        html: `<div id="novel_honbun"><p>第1話本文</p></div>`,
      }));

      const { result } = renderHook(
        () =>
          useReader({
            initialWorkUrl: "https://ncode.syosetu.com/n9669bk/",
          }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            httpClient,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.fetchNovelFromUrl();
      });

      expect(result.current.novel).not.toBeNull();
      // 1ページ目 (3話) + 2ページ目 (2話) = 合計 5話
      expect(result.current.novel?.totalChapters).toBe(5);
      expect(result.current.chapter).not.toBeNull();
      expect(result.current.chapter?.chapterIndex).toBe(1);
    });

    it("fetchNovelFromUrl: 本文取得中にアンマウントされた場合、後続の DB 更新および状態更新が安全にスキップされること (R1-18)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);

      let resolveChapter!: (value: unknown) => void;
      const chapterPromise = new Promise((resolve) => {
        resolveChapter = resolve;
      });

      const httpClient = new MockHttpClient();
      httpClient.setResponse(
        "https://kakuyomu.jp/works/1177354054881162325",
        () => ({
          status: 200,
          url: "https://kakuyomu.jp/works/1177354054881162325",
          headers: {},
          html: workIndexHtml,
        }),
      );
      httpClient.setResponse(
        `https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162327`,
        async () => {
          await chapterPromise;
          return {
            status: 200,
            url: `https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162327`,
            headers: {},
            html: episodeContentHtml,
          };
        },
      );

      const updateBookmarkSpy = vi.spyOn(novelRepo, "updateBookmark");

      const { result, unmount } = renderHook(
        () =>
          useReader({
            initialWorkUrl: "https://kakuyomu.jp/works/1177354054881162325",
          }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            httpClient,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let fetchPromise!: Promise<void>;
      act(() => {
        fetchPromise = result.current.fetchNovelFromUrl();
      });

      // エピソード本文取得待ちの間にアンマウント
      unmount();

      resolveChapter(null);

      await act(async () => {
        await fetchPromise;
      });

      // アンマウントされたため、後続のしおり更新は行われない
      expect(updateBookmarkSpy).not.toHaveBeenCalled();
    });

    it("fetchNovelFromUrl: 各非同期実行中（upsertNovelWithToc, saveChapterBody, markChapterRead, updateBookmark, getNovelById）にアンマウントされた場合、安全に中断されること (R1-18)", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);

      const targetUrl = "https://kakuyomu.jp/works/1177354054881162325";
      const httpClient = new MockHttpClient();
      httpClient.setResponse(targetUrl, () => ({
        status: 200,
        url: targetUrl,
        headers: {},
        html: workIndexHtml,
      }));
      httpClient.setResponse(
        /kakuyomu\.jp\/works\/.*\/episodes\/.*/,
        (req) => ({
          status: 200,
          url: req.url,
          headers: {},
          html: episodeContentHtml,
        }),
      );

      // 1. upsertNovelWithToc (L964)
      {
        const unmountRef = { current: () => {} };
        vi.restoreAllMocks();
        const orig = novelRepo.upsertNovelWithToc.bind(novelRepo);
        vi.spyOn(novelRepo, "upsertNovelWithToc").mockImplementation(
          async (...args) => {
            unmountRef.current();
            return orig(...args);
          },
        );
        const { result, unmount } = renderHook(
          () => useReader({ initialWorkUrl: targetUrl }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        unmountRef.current = unmount;
        await act(async () => {
          await result.current.fetchNovelFromUrl();
        });
      }

      // 2. saveChapterBody (L978)
      {
        const unmountRef = { current: () => {} };
        vi.restoreAllMocks();
        const db2 = await resetTestDb();
        const novelRepo2 = new SqlNovelRepository(db2);
        const chapterRepo2 = new SqlChapterRepository(db2);

        const orig = chapterRepo2.saveChapterBody.bind(chapterRepo2);
        vi.spyOn(chapterRepo2, "saveChapterBody").mockImplementation(
          async (...args) => {
            unmountRef.current();
            return orig(...args);
          },
        );
        const { result, unmount } = renderHook(
          () => useReader({ initialWorkUrl: targetUrl }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo2,
              chapterRepository: chapterRepo2,
              httpClient,
            }),
          },
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        unmountRef.current = unmount;
        await act(async () => {
          await result.current.fetchNovelFromUrl();
        });
      }

      // 3. markChapterRead (L986)
      {
        const unmountRef = { current: () => {} };
        vi.restoreAllMocks();
        const db3 = await resetTestDb();
        const novelRepo3 = new SqlNovelRepository(db3);
        const chapterRepo3 = new SqlChapterRepository(db3);

        const orig = chapterRepo3.markChapterRead.bind(chapterRepo3);
        vi.spyOn(chapterRepo3, "markChapterRead").mockImplementation(
          async (...args) => {
            unmountRef.current();
            return orig(...args);
          },
        );
        const { result, unmount } = renderHook(
          () => useReader({ initialWorkUrl: targetUrl }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo3,
              chapterRepository: chapterRepo3,
              httpClient,
            }),
          },
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        unmountRef.current = unmount;
        await act(async () => {
          await result.current.fetchNovelFromUrl();
        });
      }

      // 4. updateBookmark (L993)
      {
        const unmountRef = { current: () => {} };
        vi.restoreAllMocks();
        const db4 = await resetTestDb();
        const novelRepo4 = new SqlNovelRepository(db4);
        const chapterRepo4 = new SqlChapterRepository(db4);

        const orig = novelRepo4.updateBookmark.bind(novelRepo4);
        vi.spyOn(novelRepo4, "updateBookmark").mockImplementation(
          async (...args) => {
            unmountRef.current();
            return orig(...args);
          },
        );
        const { result, unmount } = renderHook(
          () => useReader({ initialWorkUrl: targetUrl }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo4,
              chapterRepository: chapterRepo4,
              httpClient,
            }),
          },
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        unmountRef.current = unmount;
        await act(async () => {
          await result.current.fetchNovelFromUrl();
        });
      }

      // 5. getNovelById (L996)
      {
        const unmountRef = { current: () => {} };
        vi.restoreAllMocks();
        const db5 = await resetTestDb();
        const novelRepo5 = new SqlNovelRepository(db5);
        const chapterRepo5 = new SqlChapterRepository(db5);

        let bookmarkUpdated = false;
        const origUpdate = novelRepo5.updateBookmark.bind(novelRepo5);
        vi.spyOn(novelRepo5, "updateBookmark").mockImplementation(
          async (...args) => {
            bookmarkUpdated = true;
            return origUpdate(...args);
          },
        );

        const orig = novelRepo5.getNovelById.bind(novelRepo5);
        vi.spyOn(novelRepo5, "getNovelById").mockImplementation(
          async (...args) => {
            if (bookmarkUpdated) {
              unmountRef.current();
            }
            return orig(...args);
          },
        );
        const { result, unmount } = renderHook(
          () => useReader({ initialWorkUrl: targetUrl }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo5,
              chapterRepository: chapterRepo5,
              httpClient,
            }),
          },
        );
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        unmountRef.current = unmount;
        await act(async () => {
          await result.current.fetchNovelFromUrl();
        });
      }
    });
  });

  describe("toErrorMessage ヘルパー関数", () => {
    it("Error インスタンスで非空 message の場合はその message を返却すること", () => {
      expect(toErrorMessage(new Error("カスタムエラー"))).toBe(
        "カスタムエラー",
      );
    });

    it("Error インスタンスで空 message の場合はデフォルトメッセージを返却すること", () => {
      expect(toErrorMessage(new Error(""))).toBe("エラーが発生しました");
    });

    it("文字列が渡された場合はその文字列を返却すること", () => {
      expect(toErrorMessage("文字列例外")).toBe("文字列例外");
    });

    it("その他の型（オブジェクト等）が渡された場合はデフォルトメッセージを返却すること", () => {
      expect(toErrorMessage({ code: 500 })).toBe("エラーが発生しました");
    });
  });

  describe("isChapterFresh ヘルパー関数", () => {
    it("chapter が null または undefined の場合は false を返すこと", () => {
      expect(isChapterFresh(null)).toBe(false);
      expect(isChapterFresh(undefined)).toBe(false);
    });

    it("chapter.bodyHtml が null の場合は false を返すこと", () => {
      expect(
        isChapterFresh({
          id: "ch-1",
          novelId: "nov-1",
          chapterIndex: 1,
          remoteChapterId: "rem-1",
          title: "第1話",
          partTitle: null,
          url: "https://example.com/1",
          bodyHtml: null,
          byteSize: 0,
          isRead: false,
          publishedAt: "2026-01-01T00:00:00Z",
          downloadedAt: new Date().toISOString(),
        }),
      ).toBe(false);
    });

    it("chapter.downloadedAt が null の場合は false を返すこと", () => {
      expect(
        isChapterFresh({
          id: "ch-1",
          novelId: "nov-1",
          chapterIndex: 1,
          remoteChapterId: "rem-1",
          title: "第1話",
          partTitle: null,
          url: "https://example.com/1",
          bodyHtml: "<p>本文</p>",
          byteSize: 10,
          isRead: false,
          publishedAt: "2026-01-01T00:00:00Z",
          downloadedAt: null,
        }),
      ).toBe(false);
    });

    it("downloadedAt が不正な日時文字列の場合（Number.isNaN）は false を返すこと", () => {
      expect(
        isChapterFresh({
          id: "ch-1",
          novelId: "nov-1",
          chapterIndex: 1,
          remoteChapterId: "rem-1",
          title: "第1話",
          partTitle: null,
          url: "https://example.com/1",
          bodyHtml: "<p>本文</p>",
          byteSize: 10,
          isRead: false,
          publishedAt: "2026-01-01T00:00:00Z",
          downloadedAt: "invalid-date-string",
        }),
      ).toBe(false);
    });

    it("downloadedAt が 7日以上前の場合は false を返すこと", () => {
      const now = Date.now();
      const eightDaysAgo = new Date(now - (CACHE_TTL_MS + 1000)).toISOString();
      expect(
        isChapterFresh(
          {
            id: "ch-1",
            novelId: "nov-1",
            chapterIndex: 1,
            remoteChapterId: "rem-1",
            title: "第1話",
            partTitle: null,
            url: "https://example.com/1",
            bodyHtml: "<p>本文</p>",
            byteSize: 10,
            isRead: false,
            publishedAt: "2026-01-01T00:00:00Z",
            downloadedAt: eightDaysAgo,
          },
          now,
        ),
      ).toBe(false);
    });

    it("downloadedAt が 7日以内の場合は true を返すこと（引数省略時の now も含む）", () => {
      const freshChapter: ChapterRecord = {
        id: "ch-1",
        novelId: "nov-1",
        chapterIndex: 1,
        remoteChapterId: "rem-1",
        title: "第1話",
        partTitle: null,
        url: "https://example.com/1",
        bodyHtml: "<p>本文</p>",
        byteSize: 10,
        isRead: false,
        publishedAt: "2026-01-01T00:00:00Z",
        downloadedAt: new Date(Date.now() - 1000).toISOString(),
      };
      expect(isChapterFresh(freshChapter)).toBe(true);
    });
  });

  describe("delay ヘルパー関数", () => {
    it("呼び出し時点で既に signal.aborted が true の場合、即座に reject されること（reason あり/なし）", async () => {
      const controller = new AbortController();
      controller.abort("Custom Abort");
      await expect(delay(100, controller.signal)).rejects.toBe("Custom Abort");

      const emptyController = new AbortController();
      emptyController.abort();
      await expect(delay(100, emptyController.signal)).rejects.toThrow(
        /aborted/i,
      );

      const mockSignal = {
        aborted: true,
        reason: undefined,
        addEventListener: vi.fn(),
      } as unknown as AbortSignal;
      await expect(delay(100, mockSignal)).rejects.toThrow("Aborted");
    });

    it("待機中に signal.abort() が呼ばれた場合、タイマーが解除され reject されること（reason あり/なし）", async () => {
      const controller = new AbortController();
      const p = delay(1000, controller.signal);
      controller.abort("Aborted during wait");
      await expect(p).rejects.toBe("Aborted during wait");

      const controller2 = new AbortController();
      const p2 = delay(1000, controller2.signal);
      controller2.abort();
      await expect(p2).rejects.toThrow(/aborted/i);

      let abortListener: (() => void) | undefined;
      const mockSignal = {
        aborted: false,
        reason: undefined,
        addEventListener: (_event: string, fn: () => void) => {
          abortListener = fn;
        },
      } as unknown as AbortSignal;
      const p3 = delay(1000, mockSignal);
      abortListener?.();
      await expect(p3).rejects.toThrow("Aborted");
    });

    it("signal を指定しない場合、または abort されない場合、指定時間経過後に正常に resolve されること", async () => {
      const start = Date.now();
      await delay(10);
      expect(Date.now() - start).toBeGreaterThanOrEqual(5);

      const controller = new AbortController();
      await delay(10, controller.signal);
    });
  });

  describe("Props / State 変更の追従", () => {
    it("options.chapterIndex が変更された場合、新たに指定された話がロードされること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 3,
        cachedCount: 3,
      });

      const { result, rerender } = renderHook(
        ({ chapterIndex }) => useReader({ novelId: seeded.id, chapterIndex }),
        {
          initialProps: { chapterIndex: 1 },
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.chapterIndex).toBe(1);
      expect(result.current.chapter?.title).toBe("第1話");

      rerender({ chapterIndex: 3 });

      await waitFor(() => {
        expect(result.current.chapterIndex).toBe(3);
      });

      expect(result.current.chapter?.title).toBe("第3話");
    });
  });

  describe("読書中5話自動先読みとキャッシュ鮮度管理 (AC-RD-12, AC-RD-13)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe("キャッシュ鮮度判定と短タイムアウトフォールバック (AC-RD-13)", () => {
      it("取得から7日以内のキャッシュは HTTP 通信を行わず即座に本文が表示されること (AC-RD-13)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 2,
          cachedCount: 2,
          cachedDownloadedAt: new Date(
            Date.now() - 3 * 24 * 60 * 60 * 1000,
          ).toISOString(), // 3日前
        });

        const httpClient = createMockHttpClient();
        const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );

        // マウント非同期処理のフラッシュ
        await act(async () => {
          await Promise.resolve();
        });

        expect(result.current.isLoading).toBe(false);
        expect(getHtmlSpy).not.toHaveBeenCalled();
        expect(result.current.chapter?.bodyHtml).toContain(
          "第1話のキャッシュ済み本文です。",
        );
        expect(result.current.error).toBeNull();
      });

      it("取得から7日経過したキャッシュは SHORT_TIMEOUT_MS (3000ms) で再取得を試み、成功時に新本文と新 downloadedAt で更新保存・表示されること (AC-RD-13)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const eightDaysAgo = new Date(
          Date.now() - (CACHE_TTL_MS + 24 * 60 * 60 * 1000),
        ).toISOString();
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 2,
          cachedCount: 2,
          cachedDownloadedAt: eightDaysAgo,
        });

        const httpClient = createMockHttpClient();
        const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );

        await act(async () => {
          await Promise.resolve();
        });

        expect(result.current.isLoading).toBe(false);
        // 3秒短タイムアウトで呼び出されたことを検証
        expect(getHtmlSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            url: expect.stringContaining("episodes/"),
            timeoutMs: SHORT_TIMEOUT_MS,
          }),
        );
        expect(result.current.error).toBeNull();

        // fixture の内容で本文が更新されていること
        expect(result.current.chapter?.bodyHtml).not.toContain(
          "第1話のキャッシュ済み本文です。",
        );
        const updatedDbChapter = await chapterRepo.getChapter(seeded.id, 1);
        expect(
          new Date(updatedDbChapter!.downloadedAt!).getTime(),
        ).toBeGreaterThan(new Date(eightDaysAgo).getTime());
      });

      it("7日経過キャッシュの再取得でタイムアウトまたは通信エラーが発生した場合、エラー画面を出さず即座に既存キャッシュ本文にフォールバックすること (AC-RD-13)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const eightDaysAgo = new Date(
          Date.now() - (CACHE_TTL_MS + 24 * 60 * 60 * 1000),
        ).toISOString();
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 2,
          cachedCount: 2,
          cachedDownloadedAt: eightDaysAgo,
        });

        const httpClient = new MockHttpClient();
        httpClient.setResponse(/kakuyomu\.jp\/works\/.*\/episodes\/.*/, () => {
          throw new Error("HTTP 504: Gateway Timeout");
        });

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );

        await act(async () => {
          await Promise.resolve();
        });

        expect(result.current.isLoading).toBe(false);
        // エラー画面を出さず既存キャッシュへフォールバック
        expect(result.current.error).toBeNull();
        expect(result.current.chapter?.bodyHtml).toContain(
          "第1話のキャッシュ済み本文です。",
        );
      });

      it("goToChapter で7日経過キャッシュの話へ遷移した場合も同様に 3秒短タイムアウトで再取得され、失敗時に既存キャッシュへフォールバックすること (AC-RD-13)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const eightDaysAgo = new Date(
          Date.now() - (CACHE_TTL_MS + 24 * 60 * 60 * 1000),
        ).toISOString();
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 2,
          cachedCount: 2,
          cachedDownloadedAt: (idx) =>
            idx === 1 ? new Date().toISOString() : eightDaysAgo,
        });

        const httpClient = new MockHttpClient();
        // 第2話の通信でエラー
        httpClient.setResponse(/kakuyomu\.jp\/works\/.*\/episodes\/.*/, () => {
          throw new Error("Network Offline");
        });

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );

        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.isLoading).toBe(false);

        let transitionResult = false;
        await act(async () => {
          transitionResult = await result.current.goToChapter(2);
        });

        expect(transitionResult).toBe(true);
        expect(result.current.chapterIndex).toBe(2);
        // エラーにならずフォールバック
        expect(result.current.error).toBeNull();
        expect(result.current.chapter?.bodyHtml).toContain(
          "第2話のキャッシュ済み本文です。",
        );
      });

      it("未キャッシュ話（初回取得）の通信時は STANDARD_TIMEOUT_MS (10000ms) で取得され、失敗時は通常通りエラー画面が表示されること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 2,
          cachedCount: 0,
        });

        const httpClient = new MockHttpClient();
        const getHtmlSpy = vi
          .spyOn(httpClient, "getHtml")
          .mockRejectedValue(new Error("HTTP 404: Not Found"));

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );

        await act(async () => {
          await Promise.resolve();
        });

        expect(result.current.isLoading).toBe(false);
        expect(getHtmlSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            timeoutMs: STANDARD_TIMEOUT_MS,
          }),
        );
        expect(result.current.error).toContain("HTTP 404: Not Found");
      });

      it("未キャッシュ話の通信で HTTP 400 以上のステータスコードが返された場合、例外がスローされエラー画面が表示されること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 2,
          cachedCount: 0,
        });

        const httpClient = new MockHttpClient();
        vi.spyOn(httpClient, "getHtml").mockResolvedValue({
          status: 500,
          url: "https://kakuyomu.jp/works/sample/episodes/1",
          headers: {},
          html: "",
        });

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );

        await act(async () => {
          await Promise.resolve();
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toContain(
          "エピソードの取得に失敗しました (HTTP 500)",
        );
      });

      it("goToChapter で未キャッシュ話への遷移時に通信エラーが発生した場合、エラーを設定しつつ対象話メタデータを保持すること (TR-10)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 3,
          cachedCount: 1,
        });

        const ch2 = await chapterRepo.getChapter(seeded.id, 2);
        expect(ch2).not.toBeNull();

        const httpClient = createMockHttpClient();
        httpClient.setResponse(ch2!.url, {
          status: 500,
          headers: {},
          html: "",
        });

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );

        await act(async () => {
          await Promise.resolve();
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.chapter?.chapterIndex).toBe(1);

        let success = true;
        await act(async () => {
          success = await result.current.goToChapter(2);
        });

        expect(success).toBe(false);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toContain(
          "エピソードの取得に失敗しました (HTTP 500)",
        );
        expect(result.current.chapterIndex).toBe(2);
        expect(result.current.chapter?.chapterIndex).toBe(2);
        expect(result.current.chapter?.url).toBe(ch2!.url);
      });

      it("goToChapter 失敗時に旧話の進捗がリセットされ、flushBookmark で新話進捗 0 が保存されること (R2-01)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 3,
          cachedCount: 1,
        });

        const ch2 = await chapterRepo.getChapter(seeded.id, 2);
        expect(ch2).not.toBeNull();

        const httpClient = createMockHttpClient();
        httpClient.setResponse(ch2!.url, {
          status: 500,
          headers: {},
          html: "",
        });

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );

        await act(async () => {
          await Promise.resolve();
        });

        // 第1話でスクロール進捗を 0.8 に進めて確定
        await act(async () => {
          result.current.updateScrollProgress(0.8);
          await result.current.flushBookmark();
        });

        expect(result.current.scrollProgress).toBe(0.8);

        // 第2話へ遷移を試行（通信エラーで失敗）
        let success = true;
        await act(async () => {
          success = await result.current.goToChapter(2);
        });

        expect(success).toBe(false);
        expect(result.current.chapterIndex).toBe(2);
        expect(result.current.scrollProgress).toBe(0);

        // 失敗後に flushBookmark を呼び出した場合、旧話の 0.8 ではなく新話の進捗 0 で保存されること (R2-01)
        await act(async () => {
          await result.current.flushBookmark();
        });

        const updatedNovel = await novelRepo.getNovelById(seeded.id);
        expect(updatedNovel?.bookmarkChapterIndex).toBe(2);
        expect(updatedNovel?.bookmarkScrollProgress).toBe(0);
      });
    });

    describe("読書中5話自動先読み (AC-RD-12)", () => {
      it("第 N 話表示完了後、初期インターバル 1.5秒を経て N+1 〜 min(N+5, totalChapters) 話が 1.5秒間隔で順次バックグラウンド取得・DB保存されること (AC-RD-12)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        // 全7話、第1話のみキャッシュ済み
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 7,
          cachedCount: 1,
        });

        const httpClient = createMockHttpClient();
        const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );

        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.isLoading).toBe(false);

        // 表示完了直後（初期インターバル 1500ms 経過前）: まだ先読み通信は行われない
        expect(getHtmlSpy).not.toHaveBeenCalled();

        // 1.5秒進める（初期インターバル経過） -> 第2話取得開始・完了
        await act(async () => {
          await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS);
        });

        const ch2 = await chapterRepo.getChapter(seeded.id, 2);
        expect(ch2?.bodyHtml).not.toBeNull();
        let ch3 = await chapterRepo.getChapter(seeded.id, 3);
        expect(ch3?.bodyHtml).toBeNull();

        // さらに 1.5秒進める -> 第3話取得完了
        await act(async () => {
          await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS);
        });
        ch3 = await chapterRepo.getChapter(seeded.id, 3);
        expect(ch3?.bodyHtml).not.toBeNull();

        // 第4話、第5話、第6話（計 PREFETCH_COUNT = 5話）まで進める
        await act(async () => {
          await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS);
        });
        const ch4 = await chapterRepo.getChapter(seeded.id, 4);
        expect(ch4?.bodyHtml).not.toBeNull();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS);
        });
        const ch5 = await chapterRepo.getChapter(seeded.id, 5);
        expect(ch5?.bodyHtml).not.toBeNull();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS);
        });
        const ch6 = await chapterRepo.getChapter(seeded.id, 1 + PREFETCH_COUNT);
        expect(ch6?.bodyHtml).not.toBeNull();

        // さらにタイマーを進めても、第7話は 5話上限（N+5）のため先読みされないこと
        await act(async () => {
          await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS * 2);
        });
        const ch7 = await chapterRepo.getChapter(seeded.id, 7);
        expect(ch7?.bodyHtml).toBeNull();
      });

      it("先読み対象話のうち 7日以内のキャッシュが存在する話は通信をスキップし、未キャッシュまたは7日経過話のみ取得されること (AC-RD-12)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const eightDaysAgo = new Date(
          Date.now() - (CACHE_TTL_MS + 24 * 60 * 60 * 1000),
        ).toISOString();
        // 全6話:
        // 第1話: 7日以内キャッシュ済み
        // 第2話: 7日以内キャッシュ済み -> スキップ
        // 第3話: 未キャッシュ -> STANDARD_TIMEOUT_MS で取得
        // 第4話: 7日経過キャッシュ -> SHORT_TIMEOUT_MS で取得
        // 第5話: 7日以内キャッシュ済み -> スキップ
        // 第6話: 未キャッシュ -> STANDARD_TIMEOUT_MS で取得
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 6,
          cachedCount: 5,
          cachedDownloadedAt: (idx) => {
            if (idx === 4) return eightDaysAgo;
            return new Date().toISOString();
          },
        });

        // 第3話と第6話を未キャッシュ（bodyHtml = null）にする
        await db.execute(
          "UPDATE chapters SET body_html = NULL WHERE chapter_index IN (3, 6);",
        );

        const httpClient = createMockHttpClient();
        const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );

        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.isLoading).toBe(false);

        // 先読みを最後まで完了させる
        await act(async () => {
          await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS * 6);
        });

        // getHtml が呼ばれたのは第3話、第4話、第6話のみ（第2話と第5話はスキップ）
        expect(getHtmlSpy).toHaveBeenCalledTimes(3);

        // 第4話は SHORT_TIMEOUT_MS で呼ばれていること
        const ch4Call = getHtmlSpy.mock.calls.find(
          (call) =>
            call[0].url.includes("ep-4") ||
            call[0].url.includes("1177354054881162329"),
        );
        expect(ch4Call?.[0].timeoutMs).toBe(SHORT_TIMEOUT_MS);

        // 第3話は STANDARD_TIMEOUT_MS で呼ばれていること
        const ch3Call = getHtmlSpy.mock.calls.find(
          (call) =>
            call[0].url.includes("ep-3") ||
            call[0].url.includes("1177354054881162328"),
        );
        expect(ch3Call?.[0].timeoutMs).toBe(STANDARD_TIMEOUT_MS);
      });

      it("先読み実行中に goToChapter で別話へ移動した場合、進行中の先読みが Abort され、新話数を起点として先読みが再開されること (AC-RD-12)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        // 全8話、第1話・第3話キャッシュ済み
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 8,
          cachedCount: 3,
        });

        const httpClient = createMockHttpClient();
        const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );

        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.isLoading).toBe(false);

        // 第1話表示後、初期インターバル中に goToChapter(3)
        await act(async () => {
          await result.current.goToChapter(3);
        });

        expect(result.current.chapterIndex).toBe(3);
        getHtmlSpy.mockClear();

        // 1.5秒進める -> 新起点第4話取得
        await act(async () => {
          await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS);
        });

        const ch4 = await chapterRepo.getChapter(seeded.id, 4);
        expect(ch4?.bodyHtml).not.toBeNull();
      });

      it("先読み実行中にコンポーネントがアンマウントされた場合、直ちに Abort され処理が安全に停止すること (AC-RD-12)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 5,
          cachedCount: 1,
        });

        const httpClient = createMockHttpClient();
        const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

        const { unmount } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );

        await act(async () => {
          await Promise.resolve();
        });

        // アンマウント
        unmount();

        // タイマーを進める
        await act(async () => {
          await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS * 5);
        });

        // アンマウント後は先読みが実行されないこと
        expect(getHtmlSpy).not.toHaveBeenCalled();
        const ch2 = await chapterRepo.getChapter(seeded.id, 2);
        expect(ch2?.bodyHtml).toBeNull();
      });

      it("先読み中の通信失敗・例外が発生しても、読書画面にエラーを表示せず読書を継続でき、次話以降の先読みが継続されること (AC-RD-12)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 4,
          cachedCount: 1,
        });

        const httpClient = new MockHttpClient();
        // 第2話は通信失敗、第3話以降は成功
        httpClient.setResponse(
          /kakuyomu\.jp\/works\/.*\/episodes\/(?:1177354054881162327|ep-2)/,
          () => {
            throw new Error("HTTP 500: Server Error");
          },
        );
        httpClient.setResponse(
          /kakuyomu\.jp\/works\/.*\/episodes\/(?:1177354054881162328|ep-3)/,
          {
            status: 200,
            headers: {},
            html: episodeContentHtml,
          },
        );

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );

        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.isLoading).toBe(false);

        // 1.5秒進める -> 第2話取得試行（失敗）
        await act(async () => {
          await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS);
        });

        // 読書中画面にエラーが波及しないこと
        expect(result.current.error).toBeNull();
        const ch2 = await chapterRepo.getChapter(seeded.id, 2);
        expect(ch2?.bodyHtml).toBeNull();

        // さらに 1.5秒進める -> 第3話取得試行（成功）
        await act(async () => {
          await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS);
        });

        expect(result.current.error).toBeNull();
        const ch3 = await chapterRepo.getChapter(seeded.id, 3);
        expect(ch3?.bodyHtml).not.toBeNull();
      });

      it("現在話が最終話（先読み対象話が存在しない場合）、先読みは実行されないこと", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 2,
          cachedCount: 2,
        });

        const httpClient = createMockHttpClient();
        const getHtmlSpy = vi.spyOn(httpClient, "getHtml");

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 2 }), // 最終話
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );

        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.isLoading).toBe(false);

        await act(async () => {
          await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS * 5);
        });

        expect(getHtmlSpy).not.toHaveBeenCalled();
      });

      it("先読みループ中に chapterRepository.getChapter が例外を投げた場合、console.warn で警告され画面エラーにならないこと", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 3,
          cachedCount: 1,
        });

        const consoleWarnSpy = vi
          .spyOn(console, "warn")
          .mockImplementation(() => {});

        const httpClient = createMockHttpClient();

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );

        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.isLoading).toBe(false);

        // 先読み時の getChapter で例外を投げる
        vi.spyOn(chapterRepo, "getChapter").mockRejectedValueOnce(
          new Error("DB Connection Lost"),
        );

        await act(async () => {
          await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS);
        });

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "[useReader] Prefetch loop terminated unexpectedly",
          expect.any(Error),
        );
        expect(result.current.error).toBeNull();
        consoleWarnSpy.mockRestore();
      });

      it("先読み対象話が DB に存在しない場合（getChapter が null）、スキップされて以降の話が先読みされること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 3,
          cachedCount: 1,
        });

        const origGetChapter = chapterRepo.getChapter.bind(chapterRepo);
        const getChapterSpy = vi.spyOn(chapterRepo, "getChapter");
        // 第2話の getChapter のみ null を返すようにモック
        getChapterSpy.mockImplementation(async (novelId, idx) => {
          if (idx === 2) return null;
          return origGetChapter(novelId, idx);
        });

        const httpClient = createMockHttpClient();

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );

        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.isLoading).toBe(false);

        // 先読みを進める（第2話は null スキップ、第3話が取得される）
        await act(async () => {
          await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS * 2);
        });

        getChapterSpy.mockRestore();
        const ch3 = await chapterRepo.getChapter(seeded.id, 3);
        expect(ch3?.bodyHtml).not.toBeNull();
      });

      it("先読み通信中に abort された場合、catch ブロックで静かに処理が中断すること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 3,
          cachedCount: 1,
        });

        const httpClient = new MockHttpClient();
        let abortPromiseReject: (() => void) | undefined;
        httpClient.setResponse(
          /kakuyomu\.jp\/works\/.*\/episodes\/.*/,
          (options) => {
            return new Promise((_resolve, reject) => {
              options.signal?.addEventListener("abort", () => {
                reject(options.signal?.reason ?? new Error("Aborted"));
              });
              abortPromiseReject = () => reject(new Error("Manual abort"));
            });
          },
        );

        const consoleWarnSpy = vi
          .spyOn(console, "warn")
          .mockImplementation(() => {});

        const { result, unmount } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient,
            }),
          },
        );

        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.isLoading).toBe(false);

        // 初期インターバル経過し、第2話の通信が開始される
        await act(async () => {
          await vi.advanceTimersByTimeAsync(PREFETCH_INTERVAL_MS);
        });

        // 通信中にアンマウント（これにより signal.abort() が呼ばれる）
        unmount();

        expect(consoleWarnSpy).not.toHaveBeenCalled();
        consoleWarnSpy.mockRestore();
        abortPromiseReject?.();
      });

      it("表示開始時に対象作品の novel.hasNewUpdate === true の場合 clearNewUpdate が呼び出されること (AC-RD-11)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 2,
          cachedCount: 2,
        });

        // has_new_update = 1 に設定
        await db.execute("UPDATE novels SET has_new_update = 1 WHERE id = ?", [
          seeded.id,
        ]);

        const clearSpy = vi.spyOn(novelRepo, "clearNewUpdate");

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await act(async () => {
          await Promise.resolve();
        });
        expect(result.current.isLoading).toBe(false);

        expect(clearSpy).toHaveBeenCalledWith(seeded.id);
      });
    });
  });

  describe("クラウド同期連携 (AC-RD-14)", () => {
    it("goToChapter による話数変更時に syncEngine.notifyChanged が呼び出されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const mockSyncEngine = {
        notifyChanged: vi.fn().mockResolvedValue(undefined),
      };
      const httpClient = createMockHttpClient();

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            syncEngine: mockSyncEngine as unknown as SyncEngine,
            httpClient,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockSyncEngine.notifyChanged.mockClear();

      await act(async () => {
        const success = await result.current.goToChapter(2);
        expect(success).toBe(true);
      });

      expect(mockSyncEngine.notifyChanged).toHaveBeenCalled();
    });

    it("loadInitialData で未読エピソードを開いて既読更新されたとき、syncEngine.notifyChanged が呼び出されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      // 第1話を未読にしておく
      await db.execute(
        "UPDATE chapters SET is_read = 0 WHERE novel_id = ? AND chapter_index = 1",
        [seeded.id],
      );

      const mockSyncEngine = {
        notifyChanged: vi.fn().mockResolvedValue(undefined),
      };
      const httpClient = createMockHttpClient();

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            syncEngine: mockSyncEngine as unknown as SyncEngine,
            httpClient,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockSyncEngine.notifyChanged).toHaveBeenCalled();
    });

    it("flushBookmark 呼び出し時に syncEngine.notifyChanged が呼び出されること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const mockSyncEngine = {
        notifyChanged: vi.fn().mockResolvedValue(undefined),
      };
      const httpClient = createMockHttpClient();

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            syncEngine: mockSyncEngine as unknown as SyncEngine,
            httpClient,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      mockSyncEngine.notifyChanged.mockClear();

      act(() => {
        void result.current.updateScrollProgress(0.4);
      });

      await act(async () => {
        await result.current.flushBookmark();
      });

      expect(mockSyncEngine.notifyChanged).toHaveBeenCalled();
    });

    it("syncEngine が未設定（undefined）でもエラーなく動作すること", async () => {
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });
      const httpClient = createMockHttpClient();

      const { result } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
            syncEngine: undefined,
            httpClient,
          }),
        },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        const success = await result.current.goToChapter(2);
        expect(success).toBe(true);
      });

      expect(result.current.chapterIndex).toBe(2);
    });
  });

  describe("ページ送りモード・ページネーション状態管理 (v0.4 Issue #122, #150)", () => {
    describe("resolveEffectivePagingMode", () => {
      it("横書き（horizontal-tb）の場合、pagingMode に関わらず常に 'scroll' を返すこと (AC-RD-15, v0.5 Issue #168, #173)", () => {
        expect(resolveEffectivePagingMode("paged", "horizontal-tb")).toBe(
          "scroll",
        );
        expect(resolveEffectivePagingMode("scroll", "horizontal-tb")).toBe(
          "scroll",
        );
        expect(resolveEffectivePagingMode("auto", "horizontal-tb")).toBe(
          "scroll",
        );
      });

      it("縦書き（vertical-rl）かつ pagingMode が 'paged' または 'auto' の場合、'paged' を返すこと (AC-RD-15)", () => {
        expect(resolveEffectivePagingMode("paged", "vertical-rl")).toBe(
          "paged",
        );
        expect(resolveEffectivePagingMode("auto", "vertical-rl")).toBe("paged");
      });

      it("縦書き（vertical-rl）かつ pagingMode が 'scroll' の場合、'scroll' を返すこと (AC-RD-15)", () => {
        expect(resolveEffectivePagingMode("scroll", "vertical-rl")).toBe(
          "scroll",
        );
      });

      it("想定外の pagingMode 値が渡された場合、組み方向判定にフォールバックすること", () => {
        expect(
          resolveEffectivePagingMode(
            "invalid" as unknown as ReaderPagingMode,
            "vertical-rl",
          ),
        ).toBe("paged");
        expect(
          resolveEffectivePagingMode(
            "invalid" as unknown as ReaderPagingMode,
            "horizontal-tb",
          ),
        ).toBe("scroll");
      });
    });

    describe("calculateProgressFromPage", () => {
      it("totalPages が 1 以下の場合は 0 を返すこと", () => {
        expect(calculateProgressFromPage(1, 1)).toBe(0);
        expect(calculateProgressFromPage(1, 0)).toBe(0);
        expect(calculateProgressFromPage(1, -5)).toBe(0);
      });

      it("totalPages > 1 の場合、(currentPage - 1) / (totalPages - 1) で進捗率を算出すること", () => {
        expect(calculateProgressFromPage(1, 5)).toBe(0);
        expect(calculateProgressFromPage(3, 5)).toBe(0.5);
        expect(calculateProgressFromPage(5, 5)).toBe(1);
      });

      it("currentPage が範囲外の場合は [1, totalPages] にクランプして算出すること", () => {
        expect(calculateProgressFromPage(0, 5)).toBe(0);
        expect(calculateProgressFromPage(-10, 5)).toBe(0);
        expect(calculateProgressFromPage(100, 5)).toBe(1);
      });
    });

    describe("calculatePageFromProgress", () => {
      it("totalPages が 1 以下の場合は常に 1 を返すこと", () => {
        expect(calculatePageFromProgress(0.5, 1)).toBe(1);
        expect(calculatePageFromProgress(0.5, 0)).toBe(1);
        expect(calculatePageFromProgress(0.5, -5)).toBe(1);
      });

      it("進捗率から対応するページ番号を復元できること", () => {
        expect(calculatePageFromProgress(0, 5)).toBe(1);
        expect(calculatePageFromProgress(0.5, 5)).toBe(3);
        expect(calculatePageFromProgress(1, 5)).toBe(5);
        expect(calculatePageFromProgress(0.5, 11)).toBe(6);
      });

      it("進捗率が範囲外または非数の場合はクランプして復元すること", () => {
        expect(calculatePageFromProgress(-0.5, 5)).toBe(1);
        expect(calculatePageFromProgress(1.5, 5)).toBe(5);
        expect(calculatePageFromProgress(Number.NaN, 5)).toBe(1);
      });
    });

    describe("useReader による pagingMode / effectivePagingMode 状態管理", () => {
      it("settingsRepository から保存された pagingMode を初期読み込みできること", async () => {
        const db = await resetTestDb();
        const settingsRepo = new SqlSettingsRepository(db);
        await settingsRepo.updateReaderSettings({ pagingMode: "paged" });

        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo);

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              settingsRepository: settingsRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.pagingMode).toBe("paged");
        expect(result.current.effectivePagingMode).toBe("paged");
      });

      it("settingsRepository の pagingMode が未設定の場合は初期値 'auto' となること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo);

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.pagingMode).toBe("auto");
        // デフォルト縦書き vertical-rl のため effectivePagingMode は paged
        expect(result.current.effectivePagingMode).toBe("paged");
      });

      it("changePagingMode を呼び出して pagingMode を変更し settingsRepository に永続化できること", async () => {
        const db = await resetTestDb();
        const settingsRepo = new SqlSettingsRepository(db);
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo);

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              settingsRepository: settingsRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
          await result.current.changePagingMode("scroll");
        });

        expect(result.current.pagingMode).toBe("scroll");
        expect(result.current.effectivePagingMode).toBe("scroll");

        const updatedSettings = await settingsRepo.getReaderSettings();
        expect(updatedSettings.pagingMode).toBe("scroll");
      });

      it("changePagingMode 時に settingsRepository.updateReaderSettings が失敗した場合、error がセットされること", async () => {
        const db = await resetTestDb();
        const settingsRepo = new SqlSettingsRepository(db);
        vi.spyOn(settingsRepo, "updateReaderSettings").mockRejectedValueOnce(
          new Error("DB更新エラー"),
        );

        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo);

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              settingsRepository: settingsRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
          await result.current.changePagingMode("paged");
        });

        expect(result.current.error).toBe("DB更新エラー");
      });

      it("組み方向（toggleWritingMode）を変更した際、pagingMode が 'auto' であれば effectivePagingMode が連動して切り替わること (AC-RD-15)", async () => {
        const db = await resetTestDb();
        const settingsRepo = new SqlSettingsRepository(db);
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo);

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              settingsRepository: settingsRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.writingMode).toBe("vertical-rl");
        expect(result.current.pagingMode).toBe("auto");
        expect(result.current.effectivePagingMode).toBe("paged");

        await act(async () => {
          await result.current.toggleWritingMode();
        });

        expect(result.current.writingMode).toBe("horizontal-tb");
        expect(result.current.effectivePagingMode).toBe("scroll");

        await act(async () => {
          await result.current.toggleWritingMode();
        });

        expect(result.current.writingMode).toBe("vertical-rl");
        expect(result.current.effectivePagingMode).toBe("paged");
      });

      it("pagingMode が 'paged' であっても横書き（horizontal-tb）時は effectivePagingMode が 'scroll' 固定となること (v0.5 Issue #168, #173)", async () => {
        const db = await resetTestDb();
        const settingsRepo = new SqlSettingsRepository(db);
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo);

        await settingsRepo.updateReaderSettings({
          writingMode: "horizontal-tb",
          pagingMode: "paged",
        });

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              settingsRepository: settingsRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.writingMode).toBe("horizontal-tb");
        expect(result.current.pagingMode).toBe("paged");
        expect(result.current.effectivePagingMode).toBe("scroll");
      });
    });

    describe("ページネーション操作・進捗率相互変換 (AC-RD-20)", () => {
      it("初期状態では currentPage = 1, totalPages = 1 であること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo);

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.currentPage).toBe(1);
        expect(result.current.totalPages).toBe(1);
      });

      it("setTotalPages で総ページ数を設定でき、1未満の値や非数は 1 にクランプされること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo);

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        act(() => {
          result.current.setTotalPages(10);
        });
        expect(result.current.totalPages).toBe(10);

        act(() => {
          result.current.setTotalPages(0);
        });
        expect(result.current.totalPages).toBe(1);

        act(() => {
          result.current.setTotalPages(-5);
        });
        expect(result.current.totalPages).toBe(1);

        act(() => {
          result.current.setTotalPages(Number.NaN);
        });
        expect(result.current.totalPages).toBe(1);
      });

      it("setTotalPages で currentPage が総ページ数を超えた場合、総ページ数にクランプされること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo);

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        act(() => {
          result.current.setTotalPages(10);
        });
        act(() => {
          result.current.goToPage(8);
        });
        expect(result.current.currentPage).toBe(8);

        act(() => {
          result.current.setTotalPages(5);
        });
        expect(result.current.currentPage).toBe(5);
        expect(result.current.totalPages).toBe(5);
      });

      it("goToPage で指定ページへ遷移し、進捗率が正しく算出されてしおりが更新されること (AC-RD-20)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo);

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        act(() => {
          result.current.setTotalPages(5);
        });

        // 5ページ中の3ページ目: (3 - 1) / (5 - 1) = 2 / 4 = 0.5
        await act(async () => {
          result.current.goToPage(3);
        });

        expect(result.current.currentPage).toBe(3);
        expect(result.current.scrollProgress).toBe(0.5);

        await waitFor(async () => {
          const reloadedNovel = await novelRepo.getNovelById(seeded.id);
          expect(reloadedNovel?.bookmarkChapterIndex).toBe(1);
          expect(reloadedNovel?.bookmarkScrollProgress).toBe(0.5);
        });
      });

      it("goToPage で第1ページ（1）に遷移した場合、進捗率は 0.0 となること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo);

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        act(() => {
          result.current.setTotalPages(5);
        });

        await act(async () => {
          result.current.goToPage(1);
        });

        expect(result.current.currentPage).toBe(1);
        expect(result.current.scrollProgress).toBe(0);
      });

      it("goToPage で最終ページに遷移した場合、進捗率は 1.0 となること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo);

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        act(() => {
          result.current.setTotalPages(5);
        });

        await act(async () => {
          result.current.goToPage(5);
        });

        expect(result.current.currentPage).toBe(5);
        expect(result.current.scrollProgress).toBe(1.0);
      });

      it("totalPages が 1 の場合、goToPage の進捗率は常に 0.0 となること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo);

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        act(() => {
          result.current.setTotalPages(1);
        });

        await act(async () => {
          result.current.goToPage(1);
        });

        expect(result.current.currentPage).toBe(1);
        expect(result.current.scrollProgress).toBe(0);
      });

      it("goToPage で範囲外の値（1未満・超過・NaN）が渡された場合、[1, totalPages] にクランプされること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo);

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        act(() => {
          result.current.setTotalPages(5);
        });

        await act(async () => {
          result.current.goToPage(0);
        });
        expect(result.current.currentPage).toBe(1);

        await act(async () => {
          result.current.goToPage(-10);
        });
        expect(result.current.currentPage).toBe(1);

        await act(async () => {
          result.current.goToPage(100);
        });
        expect(result.current.currentPage).toBe(5);

        await act(async () => {
          result.current.goToPage(Number.NaN);
        });
        expect(result.current.currentPage).toBe(1);
      });

      it("nextPage で次のページへ進み、最終ページではそれ以上進まないこと", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo);

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        act(() => {
          result.current.setTotalPages(3);
        });

        await act(async () => {
          result.current.nextPage();
        });
        expect(result.current.currentPage).toBe(2);

        await act(async () => {
          result.current.nextPage();
        });
        expect(result.current.currentPage).toBe(3);

        await act(async () => {
          result.current.nextPage();
        });
        expect(result.current.currentPage).toBe(3);
      });

      it("prevPage で前のページへ戻り、第1ページではそれ以上戻らないこと", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo);

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        act(() => {
          result.current.setTotalPages(3);
        });

        await act(async () => {
          result.current.goToPage(3);
        });
        expect(result.current.currentPage).toBe(3);

        await act(async () => {
          result.current.prevPage();
        });
        expect(result.current.currentPage).toBe(2);

        await act(async () => {
          result.current.prevPage();
        });
        expect(result.current.currentPage).toBe(1);

        await act(async () => {
          result.current.prevPage();
        });
        expect(result.current.currentPage).toBe(1);
      });
    });

    describe("しおり進捗率の復元とページネーション連動 (AC-RD-20)", () => {
      it("保存されたしおり進捗率（initialScrollProgress > 0）が存在する場合、初回 setTotalPages 時に対応するページ番号へ復元されること (AC-RD-20)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          bookmarkChapterIndex: 1,
          bookmarkScrollProgress: 0.5,
        });

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.initialScrollProgress).toBe(0.5);
        expect(result.current.scrollProgress).toBe(0.5);

        // 総ページ数 11 の場合: Math.round(0.5 * (11 - 1)) + 1 = 5 + 1 = 6 ページ
        act(() => {
          result.current.setTotalPages(11);
        });

        expect(result.current.currentPage).toBe(6);
      });

      it("保存されたしおり進捗率（initialScrollProgress > 0）が存在し、初回 setTotalPages(1) の場合、currentPage = 1 に復元されること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          bookmarkChapterIndex: 1,
          bookmarkScrollProgress: 0.5,
        });

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.initialScrollProgress).toBe(0.5);

        // 総ページ数 1 の場合: validTotal <= 1 のため 1 に復元
        act(() => {
          result.current.setTotalPages(1);
        });

        expect(result.current.currentPage).toBe(1);
      });

      it("初回 setTotalPages 後に再度 setTotalPages が呼ばれた場合は初期進捗率による復元を行わず、現在のページ位置を維持すること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          bookmarkChapterIndex: 1,
          bookmarkScrollProgress: 0.5,
        });

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        act(() => {
          result.current.setTotalPages(11);
        });
        expect(result.current.currentPage).toBe(6);

        // ユーザーがページ 7 へ移動
        await act(async () => {
          result.current.goToPage(7);
        });
        expect(result.current.currentPage).toBe(7);

        // ウィンドウリサイズ等で再度 setTotalPages が呼ばれても、現在のページ 7 を維持（初期進捗率 0.5 で 6 に戻らない）
        act(() => {
          result.current.setTotalPages(15);
        });
        expect(result.current.currentPage).toBe(7);
      });

      it("リーダー再遷移時などユーザーがページ操作を行う前に複数回 setTotalPages が呼ばれた場合（初回仮計測後に確定総ページ数が通知された場合）、常に保存済み進捗率に対応する正しいページ番号へ復元され、1ページ目や最終ページに化けないこと (R1-26, AC-RD-20)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          bookmarkChapterIndex: 1,
          bookmarkScrollProgress: 0.5,
        });

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.initialScrollProgress).toBe(0.5);

        // 1. 初期未確定時（例: 総ページ数 1）
        act(() => {
          result.current.setTotalPages(1);
        });
        expect(result.current.currentPage).toBe(1);

        // 2. スロット幅未確定による過大仮計測時（例: 総ページ数 21 -> 11ページ）
        act(() => {
          result.current.setTotalPages(21);
        });
        expect(result.current.currentPage).toBe(11);

        // 3. レイアウト・フォント確定後の本来の総ページ数（例: 総ページ数 11）
        // まだユーザーは goToPage を呼んでいないため、11ページへのクランプ（最終ページ化け）ではなく、
        // 進捗率 0.5 に対応する 6 ページ目（Math.round(0.5 * 10) + 1 = 6）へ正確に再復元されること
        act(() => {
          result.current.setTotalPages(11);
        });
        expect(result.current.currentPage).toBe(6);
      });

      it("保存されたしおり進捗率が 0.0 の場合、初回 setTotalPages 時も currentPage = 1 を維持すること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          bookmarkChapterIndex: 1,
          bookmarkScrollProgress: 0,
        });

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        act(() => {
          result.current.setTotalPages(10);
        });
        expect(result.current.currentPage).toBe(1);
      });

      it("別話を開いた場合（targetNovel.bookmarkChapterIndex !== targetIndex）、currentPage = 1, initialScrollProgress = 0, scrollProgress = 0 となること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 2,
          cachedCount: 2,
          bookmarkChapterIndex: 1,
          bookmarkScrollProgress: 0.8,
        });

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 2 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.currentPage).toBe(1);
        expect(result.current.initialScrollProgress).toBe(0);
        expect(result.current.scrollProgress).toBe(0);

        act(() => {
          result.current.setTotalPages(10);
        });
        expect(result.current.currentPage).toBe(1);
      });

      it("goToChapter で次話へ遷移した際、currentPage = 1, totalPages = 1, initialScrollProgress = 0, scrollProgress = 0 にリセットされること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 2,
          cachedCount: 2,
          bookmarkChapterIndex: 1,
          bookmarkScrollProgress: 0.5,
        });

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        act(() => {
          result.current.setTotalPages(11);
        });
        expect(result.current.currentPage).toBe(6);

        await act(async () => {
          const success = await result.current.goToChapter(2);
          expect(success).toBe(true);
        });

        expect(result.current.currentPage).toBe(1);
        expect(result.current.totalPages).toBe(1);
        expect(result.current.initialScrollProgress).toBe(0);
        expect(result.current.scrollProgress).toBe(0);

        act(() => {
          result.current.setTotalPages(8);
        });
        expect(result.current.currentPage).toBe(1);
      });

      it("goToChapter に startAt: 'end' を指定した場合、initialScrollProgress が 1.0 に設定され、setTotalPages 時に最終ページへ設定されること (R1-07)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 3,
          cachedCount: 3,
        });

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 2 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
          const success = await result.current.goToChapter(1, {
            startAt: "end",
          });
          expect(success).toBe(true);
        });

        expect(result.current.chapterIndex).toBe(1);
        expect(result.current.initialScrollProgress).toBe(1.0);
        expect(result.current.scrollProgress).toBe(1.0);

        // 総ページ数が計測されたら最終ページ（totalPages）に設定されること
        act(() => {
          result.current.setTotalPages(5);
        });
        expect(result.current.currentPage).toBe(5);
        expect(result.current.totalPages).toBe(5);
      });
    });

    describe("先読み（Prefetch）直列化とアンマウント保護 (R1-29)", () => {
      it("先読み実行中に連続して goToChapter が呼ばれた場合、前回の先読み完了を待ってから新エピソードの先読みが直列実行されること (R1-29)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 5,
          cachedCount: 2, // 1話・2話はキャッシュ済み、3話以降は未キャッシュ
        });

        let unblockPrefetch: () => void = () => {};
        const prefetchBlocker = new Promise<void>((r) => {
          unblockPrefetch = r;
        });

        const customHttpClient: HttpClientBridge = {
          getHtml: async (options) => {
            await prefetchBlocker;
            return {
              status: 200,
              url: options.url,
              headers: {},
              html: "<html><body><div class='widget-episodeBody'>第3話本文</div></body></html>",
            };
          },
        };

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient: customHttpClient,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        // 1.5秒待って先読みが第3話の HTTP リクエストでブロックされた状態にする
        await new Promise((r) => setTimeout(r, 1600));

        // 第2話へ遷移（goToChapter(2) 完了時に第2話の startPrefetch が走り、ブロック中の先行先読みを直列待機する）
        await act(async () => {
          const success = await result.current.goToChapter(2);
          expect(success).toBe(true);
        });

        // 先行先読みのブロックを解除し、直列化待機を通過させる
        await act(async () => {
          unblockPrefetch();
          await new Promise((r) => setTimeout(r, 50));
        });

        expect(result.current.chapterIndex).toBe(2);
      });

      it("loadInitialData の本文取得中にアンマウントされた場合、DB 更新処理がスキップされること (R1-29)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const updateBookmarkSpy = vi.spyOn(novelRepo, "updateBookmark");

        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 2,
          cachedCount: 0, // 未キャッシュ（通信発生）
          bookmarkChapterIndex: null, // しおりなし（ロード完了時は updateBookmark が走る）
        });

        let unblockFetch: () => void = () => {};
        const fetchBlocker = new Promise<void>((r) => {
          unblockFetch = r;
        });
        let onFetchStarted: () => void = () => {};
        const fetchStarted = new Promise<void>((r) => {
          onFetchStarted = r;
        });

        const mockHttpClient = new MockHttpClient();
        mockHttpClient.setResponse(
          `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}/episodes/${KAKUYOMU_EPISODE_IDS[0]}`,
          async () => {
            onFetchStarted();
            await fetchBlocker;
            return {
              status: 200,
              url: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}/episodes/${KAKUYOMU_EPISODE_IDS[0]}`,
              headers: {},
              html: "<html><body><div class='widget-episodeBody'>本文</div></body></html>",
            };
          },
        );

        const { unmount } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient: mockHttpClient,
            }),
          },
        );

        // HTTP 通信が開始されたことを待機（初期 DB 取得を確実に通過）
        await fetchStarted;

        // 通信待機中にアンマウント
        unmount();
        unblockFetch();
        await new Promise((r) => setTimeout(r, 50));

        // アンマウント後の不要な DB 書き込みがスキップされること
        expect(updateBookmarkSpy).not.toHaveBeenCalled();
      });

      it("先行先読みタスクの待機中にアンマウントされた場合、新先読みが安全に中断されること (R1-29)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);

        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 5,
          cachedCount: 2,
        });

        let unblockPrefetch: () => void = () => {};
        const prefetchBlocker = new Promise<void>((r) => {
          unblockPrefetch = r;
        });

        const customHttpClient: HttpClientBridge = {
          getHtml: async (options) => {
            await prefetchBlocker;
            return {
              status: 200,
              url: options.url,
              headers: {},
              html: "<html><body><div class='widget-episodeBody'>第3話本文</div></body></html>",
            };
          },
        };

        const { result, unmount } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient: customHttpClient,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        // 1.5秒待って第3話の先読みがブロックされた状態にする
        await new Promise((r) => setTimeout(r, 1600));

        // 第2話へ遷移して新先読みを開始（ブロック中の先行タスクを await previousPromise で待機中）
        await act(async () => {
          await result.current.goToChapter(2);
        });

        // 先行タスク待機中の状態でアンマウント（signal.aborted = true になる）
        unmount();

        // 先行ブロック解除
        unblockPrefetch();
        await new Promise((r) => setTimeout(r, 50));
      });

      it("startPrefetch が httpClient.getHtml に AbortSignal を伝播し、getHtml 解決前に abort された場合は saveChapterBody を呼び出さないこと (R2-13)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const saveBodySpy = vi.spyOn(chapterRepo, "saveChapterBody");

        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 3,
          cachedCount: 1,
        });

        let receivedSignal: AbortSignal | undefined;
        let resolveGetHtml!: () => void;
        const getHtmlGate = new Promise<void>((r) => {
          resolveGetHtml = r;
        });

        const customHttpClient: HttpClientBridge = {
          getHtml: async (options) => {
            receivedSignal = options.signal;
            await getHtmlGate;
            return {
              status: 200,
              url: options.url,
              headers: {},
              html: "<html><body><div class='widget-episodeBody'>第2話本文</div></body></html>",
            };
          },
        };

        const { result, unmount } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              httpClient: customHttpClient,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
        saveBodySpy.mockClear();

        // 1.5秒待って第2話の先読みリクエストを開始させる
        await new Promise((r) => setTimeout(r, 1600));
        expect(receivedSignal).toBeDefined();
        expect(receivedSignal?.aborted).toBe(false);

        // getHtml が解決する前にアンマウントして abort させる
        unmount();
        expect(receivedSignal?.aborted).toBe(true);

        // getHtml を正常解決させる（abort 済みのため saveChapterBody はスキップされること）
        resolveGetHtml();
        await new Promise((r) => setTimeout(r, 50));

        expect(saveBodySpy).not.toHaveBeenCalled();
      });

      it("goToChapter で前話末尾遷移（startAt: 'end'）した直後にルーター同期で chapterIndex プロパティが更新されても、計測済みの末尾ページ位置（currentPage / totalPages）がリセットされないこと (R2-04)", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);

        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 2,
          cachedCount: 2,
        });

        const { result, rerender } = renderHook(
          ({ chapterIdx }: { chapterIdx: number }) =>
            useReader({ novelId: seeded.id, chapterIndex: chapterIdx }),
          {
            initialProps: { chapterIdx: 2 },
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
          expect(result.current.chapterIndex).toBe(2);
        });

        // 前話へ末尾開始（startAt: "end"）で遷移し、ReaderView のページ数計測（setTotalPages(3)）を実行
        await act(async () => {
          await result.current.goToChapter(1, { startAt: "end" });
        });
        act(() => {
          result.current.setTotalPages(3);
        });
        expect(result.current.totalPages).toBe(3);
        expect(result.current.currentPage).toBe(3);

        // ReaderContainer の router.navigateToReader による URL パラメータ（chapterIndex）同期をシミュレート
        rerender({ chapterIdx: 1 });
        await new Promise((r) => setTimeout(r, 50));

        expect(result.current.chapterIndex).toBe(1);
        expect(result.current.totalPages).toBe(3);
        expect(result.current.currentPage).toBe(3);
      });
    });

    describe("しおり保護・画面ロック即時フラッシュ・クラウド同期競合検知 (Issue #342)", () => {
      it("未操作のまま flushBookmark() を呼び出しても updateBookmark および syncEngine.notifyChanged が実行されないこと", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 2,
          cachedCount: 2,
        });
        await novelRepo.updateBookmark(seeded.id, 1, 0.25);
        const updateSpy = vi.spyOn(novelRepo, "updateBookmark");
        const mockSyncEngine = {
          notifyChanged: vi.fn().mockResolvedValue(undefined),
          subscribePullCompleted: vi.fn(() => () => {}),
        };

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              syncEngine: mockSyncEngine as unknown as SyncEngine,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        updateSpy.mockClear();
        mockSyncEngine.notifyChanged.mockClear();

        await act(async () => {
          await result.current.flushBookmark();
        });

        expect(updateSpy).not.toHaveBeenCalled();
        expect(mockSyncEngine.notifyChanged).not.toHaveBeenCalled();
      });

      it("updateScrollProgress の 300ms デバウンス保存完了時に syncEngine.notifyChanged が呼ばれ、その後の hidden 復帰で重複保存しないこと", async () => {
        vi.useFakeTimers();
        const originalVisibility = Object.getOwnPropertyDescriptor(
          document,
          "visibilityState",
        );
        try {
          const db = await resetTestDb();
          const novelRepo = new SqlNovelRepository(db);
          const chapterRepo = new SqlChapterRepository(db);
          const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
            chapterCount: 2,
            cachedCount: 2,
          });
          await novelRepo.updateBookmark(seeded.id, 1, 0);
          const updateSpy = vi.spyOn(novelRepo, "updateBookmark");
          const mockSyncEngine = {
            notifyChanged: vi.fn().mockResolvedValue(undefined),
            subscribePullCompleted: vi.fn(() => () => {}),
          };

          const { result } = renderHook(
            () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
            {
              wrapper: createWrapper({
                novelRepository: novelRepo,
                chapterRepository: chapterRepo,
                syncEngine: mockSyncEngine as unknown as SyncEngine,
              }),
            },
          );

          await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
          });
          expect(result.current.isLoading).toBe(false);

          updateSpy.mockClear();
          mockSyncEngine.notifyChanged.mockClear();

          act(() => {
            void result.current.updateScrollProgress(0.6);
          });
          await act(async () => {
            await vi.advanceTimersByTimeAsync(350);
          });

          expect(updateSpy).toHaveBeenCalledTimes(1);
          expect(updateSpy).toHaveBeenCalledWith(seeded.id, 1, 0.6);
          expect(mockSyncEngine.notifyChanged).toHaveBeenCalledTimes(1);

          // 300ms 保存済みのため hidden 移行時は追加保存しない
          updateSpy.mockClear();
          mockSyncEngine.notifyChanged.mockClear();
          act(() => {
            Object.defineProperty(document, "visibilityState", {
              value: "hidden",
              writable: true,
              configurable: true,
            });
            document.dispatchEvent(new Event("visibilitychange"));
          });
          await act(async () => {
            await vi.advanceTimersByTimeAsync(50);
          });
          expect(updateSpy).not.toHaveBeenCalled();
          expect(mockSyncEngine.notifyChanged).not.toHaveBeenCalled();
        } finally {
          if (originalVisibility) {
            Object.defineProperty(
              document,
              "visibilityState",
              originalVisibility,
            );
          }
          vi.useRealTimers();
        }
      });

      it("300ms デバウンス待機中に visibilityState === 'hidden' になったとき即時フラッシュされ、未操作時の hidden では保存しないこと", async () => {
        vi.useFakeTimers();
        const originalVisibility = Object.getOwnPropertyDescriptor(
          document,
          "visibilityState",
        );
        try {
          const db = await resetTestDb();
          const novelRepo = new SqlNovelRepository(db);
          const chapterRepo = new SqlChapterRepository(db);
          const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
            chapterCount: 2,
            cachedCount: 2,
          });
          await novelRepo.updateBookmark(seeded.id, 1, 0);
          const updateSpy = vi.spyOn(novelRepo, "updateBookmark");
          const mockSyncEngine = {
            notifyChanged: vi.fn().mockResolvedValue(undefined),
            subscribePullCompleted: vi.fn(() => () => {}),
          };

          const { result } = renderHook(
            () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
            {
              wrapper: createWrapper({
                novelRepository: novelRepo,
                chapterRepository: chapterRepo,
                syncEngine: mockSyncEngine as unknown as SyncEngine,
              }),
            },
          );

          await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
          });
          updateSpy.mockClear();
          mockSyncEngine.notifyChanged.mockClear();

          // 未操作時の hidden では保存しない
          act(() => {
            Object.defineProperty(document, "visibilityState", {
              value: "hidden",
              writable: true,
              configurable: true,
            });
            document.dispatchEvent(new Event("visibilitychange"));
          });
          await act(async () => {
            await vi.advanceTimersByTimeAsync(50);
          });
          expect(updateSpy).not.toHaveBeenCalled();

          // ページ移動後の 300ms 待機中に hidden になると即時フラッシュされる
          act(() => {
            void result.current.updateScrollProgress(0.8);
          });
          expect(updateSpy).not.toHaveBeenCalled();

          await act(async () => {
            Object.defineProperty(document, "visibilityState", {
              value: "hidden",
              writable: true,
              configurable: true,
            });
            document.dispatchEvent(new Event("visibilitychange"));
            await vi.advanceTimersByTimeAsync(50);
          });
          expect(updateSpy).toHaveBeenCalledTimes(1);
          expect(updateSpy).toHaveBeenCalledWith(seeded.id, 1, 0.8);
          expect(mockSyncEngine.notifyChanged).toHaveBeenCalledTimes(1);
        } finally {
          if (originalVisibility) {
            Object.defineProperty(
              document,
              "visibilityState",
              originalVisibility,
            );
          }
          vi.useRealTimers();
        }
      });

      it("subscribePullCompleted で他端末の話数へ進んだしおりを検知したとき bookmarkConflict が設定され、移動・維持で解決できること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 3,
          cachedCount: 3,
        });
        await novelRepo.updateBookmark(seeded.id, 1, 0);

        let capturedListener:
          ((res: { pulled: boolean; mergedNovels: number }) => void) | null =
          null;
        const mockSyncEngine = {
          notifyChanged: vi.fn().mockResolvedValue(undefined),
          subscribePullCompleted: vi.fn((listener) => {
            capturedListener = listener;
            return () => {};
          }),
        };

        const { result } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              syncEngine: mockSyncEngine as unknown as SyncEngine,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
        expect(result.current.bookmarkConflict).toBeNull();

        // 競合なし時 resolveBookmarkConflict は false を返すこと
        await act(async () => {
          expect(await result.current.resolveBookmarkConflict("move")).toBe(
            false,
          );
          expect(await result.current.resolveBookmarkConflict("keep")).toBe(
            false,
          );
        });

        // リモートマージ結果を DB に模擬して pulled: false は無視されること
        await novelRepo.updateBookmark(seeded.id, 3, 0.4);
        await act(async () => {
          capturedListener?.({ pulled: false, mergedNovels: 0 });
        });
        expect(result.current.bookmarkConflict).toBeNull();

        // pulled: true で bookmarkConflict が検出されること
        await act(async () => {
          capturedListener?.({ pulled: true, mergedNovels: 1 });
        });
        await waitFor(() => {
          expect(result.current.bookmarkConflict).toEqual({
            currentChapterIndex: 1,
            remoteChapterIndex: 3,
          });
        });

        // 同一話数で再度通知された場合は競合がクリアされること
        await novelRepo.updateBookmark(seeded.id, 1, 0);
        await act(async () => {
          capturedListener?.({ pulled: true, mergedNovels: 1 });
        });
        await waitFor(() => {
          expect(result.current.bookmarkConflict).toBeNull();
        });

        // 範囲外 (totalChapters 超過) のしおりは無視されること
        await novelRepo.updateBookmark(seeded.id, 99, 0);
        await act(async () => {
          capturedListener?.({ pulled: true, mergedNovels: 1 });
        });
        await new Promise((r) => setTimeout(r, 30));
        expect(result.current.bookmarkConflict).toBeNull();

        // 再度 第3話との競合を発生させ、「移動する (move)」で第3話へ遷移すること
        await novelRepo.updateBookmark(seeded.id, 3, 0.5);
        await act(async () => {
          capturedListener?.({ pulled: true, mergedNovels: 1 });
        });
        await waitFor(() => {
          expect(result.current.bookmarkConflict).toEqual({
            currentChapterIndex: 1,
            remoteChapterIndex: 3,
          });
        });

        await act(async () => {
          const ok = await result.current.resolveBookmarkConflict("move");
          expect(ok).toBe(true);
        });
        expect(result.current.bookmarkConflict).toBeNull();
        expect(result.current.chapterIndex).toBe(3);

        // 第3話表示中に第2話の競合を発生させ、「そのまま読む (keep)」で現在話を明示保存・通知すること
        await novelRepo.updateBookmark(seeded.id, 2, 0.1);
        await act(async () => {
          capturedListener?.({ pulled: true, mergedNovels: 1 });
        });
        await waitFor(() => {
          expect(result.current.bookmarkConflict).toEqual({
            currentChapterIndex: 3,
            remoteChapterIndex: 2,
          });
        });

        const updateSpy = vi.spyOn(novelRepo, "updateBookmark");
        mockSyncEngine.notifyChanged.mockClear();

        await act(async () => {
          const ok = await result.current.resolveBookmarkConflict("keep");
          expect(ok).toBe(true);
        });
        expect(result.current.bookmarkConflict).toBeNull();
        expect(updateSpy).toHaveBeenCalledWith(seeded.id, 3, 0);
        expect(mockSyncEngine.notifyChanged).toHaveBeenCalledTimes(1);
      });

      it("resolveBookmarkConflict('keep') 実行時は保留中の 300ms デバウンスタイマーを破棄し、DB 保存失敗時は false と error を返すこと", async () => {
        vi.useFakeTimers();
        try {
          const db = await resetTestDb();
          const novelRepo = new SqlNovelRepository(db);
          const chapterRepo = new SqlChapterRepository(db);
          const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
            chapterCount: 3,
            cachedCount: 3,
          });
          await novelRepo.updateBookmark(seeded.id, 1, 0);

          let capturedListener:
            ((res: { pulled: boolean; mergedNovels: number }) => void) | null =
            null;
          const mockSyncEngine = {
            notifyChanged: vi.fn().mockResolvedValue(undefined),
            subscribePullCompleted: vi.fn((listener) => {
              capturedListener = listener;
              return () => {};
            }),
          };

          const { result } = renderHook(
            () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
            {
              wrapper: createWrapper({
                novelRepository: novelRepo,
                chapterRepository: chapterRepo,
                syncEngine: mockSyncEngine as unknown as SyncEngine,
              }),
            },
          );

          await act(async () => {
            await vi.advanceTimersByTimeAsync(50);
          });
          expect(result.current.isLoading).toBe(false);

          await novelRepo.updateBookmark(seeded.id, 3, 0.5);
          await act(async () => {
            capturedListener?.({ pulled: true, mergedNovels: 1 });
            await vi.advanceTimersByTimeAsync(20);
          });
          expect(result.current.bookmarkConflict).toEqual({
            currentChapterIndex: 1,
            remoteChapterIndex: 3,
          });

          // スクロールで 300ms デバウンス待機中に updateBookmark 失敗＋keep を実行
          const updateSpy = vi
            .spyOn(novelRepo, "updateBookmark")
            .mockRejectedValueOnce(new Error("Keep save failed"));
          await act(async () => {
            void result.current.updateScrollProgress(0.45);
          });

          let keepResult = true;
          await act(async () => {
            keepResult = await result.current.resolveBookmarkConflict("keep");
          });
          expect(keepResult).toBe(false);
          expect(result.current.error).toContain("Keep save failed");
          expect(updateSpy).toHaveBeenCalledTimes(1);

          // 旧 300ms タイマーがキャンセルされているため追加呼び出しされないこと
          await act(async () => {
            await vi.advanceTimersByTimeAsync(400);
          });
          expect(updateSpy).toHaveBeenCalledTimes(1);
        } finally {
          vi.useRealTimers();
        }
      });

      it("subscribePullCompleted の DB 再取得で null・例外・アンマウントが発生しても競合状態が安全に無視されること", async () => {
        const db = await resetTestDb();
        const novelRepo = new SqlNovelRepository(db);
        const chapterRepo = new SqlChapterRepository(db);
        const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
          chapterCount: 3,
          cachedCount: 3,
        });

        let capturedListener:
          ((res: { pulled: boolean; mergedNovels: number }) => void) | null =
          null;
        const mockSyncEngine = {
          notifyChanged: vi.fn().mockResolvedValue(undefined),
          subscribePullCompleted: vi.fn((listener) => {
            capturedListener = listener;
            return () => {};
          }),
        };

        const { result, unmount } = renderHook(
          () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
          {
            wrapper: createWrapper({
              novelRepository: novelRepo,
              chapterRepository: chapterRepo,
              syncEngine: mockSyncEngine as unknown as SyncEngine,
            }),
          },
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        const getNovelSpy = vi.spyOn(novelRepo, "getNovelById");
        // 1. null 返却時は競合にならないこと
        getNovelSpy.mockResolvedValueOnce(null);
        await act(async () => {
          capturedListener?.({ pulled: true, mergedNovels: 1 });
          await Promise.resolve();
        });
        expect(result.current.bookmarkConflict).toBeNull();

        // 2. 例外スロー時は安全に無視されること
        getNovelSpy.mockRejectedValueOnce(new Error("DB read failure"));
        await act(async () => {
          capturedListener?.({ pulled: true, mergedNovels: 1 });
          await Promise.resolve();
        });
        expect(result.current.bookmarkConflict).toBeNull();

        // 3. 取得完了前にアンマウントされてもクラッシュしないこと
        let resolveLate: ((v: NovelRecord | null) => void) | null = null;
        getNovelSpy.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveLate = resolve;
            }),
        );
        act(() => {
          capturedListener?.({ pulled: true, mergedNovels: 1 });
        });
        unmount();
        await act(async () => {
          resolveLate?.({ ...seeded, bookmarkChapterIndex: 3 });
          await Promise.resolve();
        });
      });
    });
  });
});

import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { useReader, toErrorMessage, isChapterFresh, delay } from "./useReader";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import { SqlNovelRepository } from "../../../storage/repositories/novelRepository";
import { SqlChapterRepository } from "../../../storage/repositories/chapterRepository";
import { SqlSettingsRepository } from "../../../storage/repositories/settingsRepository";
import { MockHttpClient } from "../../../bridges/http/mockHttpClient";
import { createDefaultParserRegistry } from "../../../parsers/parserRegistry";
import type {
  ChapterRecord,
  NovelRecord,
  SettingsRepository,
} from "../../../storage/types";
import {
  CACHE_TTL_MS,
  SHORT_TIMEOUT_MS,
  STANDARD_TIMEOUT_MS,
  PREFETCH_INTERVAL_MS,
  PREFETCH_COUNT,
} from "../../../shared/constants/cache";
import workIndexHtml from "../../../parsers/kakuyomu/__fixtures__/work_index.html?raw";
import episodeContentHtml from "../../../parsers/kakuyomu/__fixtures__/episode_content.html?raw";

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
      let dbNovel = await novelRepo.getNovelById(seeded.id);
      expect(dbNovel?.bookmarkScrollProgress).toBe(0.42);

      // 下限クランプ (-0.2 -> 0.0)
      await act(async () => {
        await result.current.updateScrollProgress(-0.2);
      });
      expect(result.current.scrollProgress).toBe(0);
      dbNovel = await novelRepo.getNovelById(seeded.id);
      expect(dbNovel?.bookmarkScrollProgress).toBe(0);

      // 上限クランプ (1.5 -> 1.0)
      await act(async () => {
        await result.current.updateScrollProgress(1.5);
      });
      expect(result.current.scrollProgress).toBe(1);
      dbNovel = await novelRepo.getNovelById(seeded.id);
      expect(dbNovel?.bookmarkScrollProgress).toBe(1);

      // 非有限値 (NaN -> 0.0)
      await act(async () => {
        await result.current.updateScrollProgress(Number.NaN);
      });
      expect(result.current.scrollProgress).toBe(0);
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
      expect(result.current.error).toBe("しおり更新例外");

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
});

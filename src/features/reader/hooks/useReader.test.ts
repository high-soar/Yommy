import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { useReader } from "./useReader";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import { SqlNovelRepository } from "../../../storage/repositories/novelRepository";
import { SqlChapterRepository } from "../../../storage/repositories/chapterRepository";
import { SqlSettingsRepository } from "../../../storage/repositories/settingsRepository";
import { MockHttpClient } from "../../../bridges/http/mockHttpClient";
import { createDefaultParserRegistry } from "../../../parsers/parserRegistry";
import type { SettingsRepository } from "../../../storage/types";
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
          remoteChapterId: KAKUYOMU_EPISODE_IDS[i],
          partTitle: i >= 2 ? "第二章" : "第一章",
          title: `第${i + 1}話`,
          url: `https://kakuyomu.jp/works/${KAKUYOMU_WORK_ID}/episodes/${KAKUYOMU_EPISODE_IDS[i]}`,
          publishedAt: "2026-01-01T00:00:00Z",
        })),
        nextTocPageUrl: null,
      },
      "2026-01-01T00:00:00Z",
    );

    for (let i = 0; i < cachedCount; i++) {
      await chapterRepo.saveChapterBody(
        novel.id,
        i + 1,
        {
          remoteChapterId: KAKUYOMU_EPISODE_IDS[i],
          title: `第${i + 1}話`,
          bodyHtml: `<p>第${i + 1}話のキャッシュ済み本文です。</p>`,
          byteSize: 100,
          prevChapterUrl: null,
          nextChapterUrl: null,
        },
        "2026-01-01T00:00:00Z",
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
      const db = await resetTestDb();
      const novelRepo = new SqlNovelRepository(db);
      const chapterRepo = new SqlChapterRepository(db);
      const seeded = await seedNovelWithChapters(novelRepo, chapterRepo, {
        chapterCount: 2,
        cachedCount: 2,
      });

      const { unmount } = renderHook(
        () => useReader({ novelId: seeded.id, chapterIndex: 1 }),
        {
          wrapper: createWrapper({
            novelRepository: novelRepo,
            chapterRepository: chapterRepo,
          }),
        },
      );

      // 直ちにアンマウント
      unmount();
      // エラーなく完了することを確認
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

      vi.spyOn(chapterRepo, "getChapter").mockRejectedValueOnce(
        new Error("DB 読み込み例外"),
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
      expect(result.current.error).toContain("Unsupported site");
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
});

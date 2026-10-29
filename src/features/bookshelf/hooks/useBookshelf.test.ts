import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { useBookshelf } from "./useBookshelf";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import { SqlNovelRepository } from "../../../storage/repositories/novelRepository";
import { MockHttpClient } from "../../../bridges/http/mockHttpClient";
import type { NovelSummary } from "../../../storage/types";
import workIndexHtml from "../../../parsers/kakuyomu/__fixtures__/work_index.html?raw";

describe("useBookshelf", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    await resetTestDb();
    localStorage.clear();
    vi.clearAllMocks();
  });

  const createWrapper =
    (services?: React.ComponentProps<typeof ServiceProvider>["services"]) =>
    ({ children }: { children: React.ReactNode }) =>
      React.createElement(ServiceProvider, { services }, children);

  describe("初回ロードとソート順復元", () => {
    it("初期化完了後に本棚の作品一覧を取得し、未登録時は空配列・既定ソート順 'unread_first' であること (AC-BS-01, AC-BS-11)", async () => {
      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.novels).toEqual([]);
      expect(result.current.sortOrder).toBe("unread_first");
      expect(result.current.isCheckingUpdates).toBe(false);
      expect(result.current.updateCheckProgress).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("app_settings に保存されたソート順が存在する場合、そのソート順で復元・取得されること (AC-BS-11)", async () => {
      const customAppSettingsRepo = {
        getSetting: vi.fn().mockResolvedValue("latest_published"),
        setSetting: vi.fn().mockResolvedValue(undefined),
      };
      const customNovelRepo = {
        listNovels: vi.fn().mockResolvedValue([]),
        getNovelById: vi.fn().mockResolvedValue(null),
        upsertNovelWithToc: vi.fn(),
        updateBookmark: vi.fn(),
        deleteNovel: vi.fn(),
        clearNewUpdate: vi.fn(),
        updateLastCheckedAt: vi.fn(),
      };

      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({
          appSettingsRepository: customAppSettingsRepo,
          novelRepository: customNovelRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(customAppSettingsRepo.getSetting).toHaveBeenCalledWith(
        "bookshelf_sort_order",
      );
      expect(customNovelRepo.listNovels).toHaveBeenCalledWith(
        "latest_published",
      );
      expect(result.current.sortOrder).toBe("latest_published");
    });

    it("app_settings の保存値が未知の文字列の場合、既定値 'unread_first' にフォールバックされること", async () => {
      const customAppSettingsRepo = {
        getSetting: vi.fn().mockResolvedValue("invalid_sort_order"),
        setSetting: vi.fn().mockResolvedValue(undefined),
      };
      const customNovelRepo = {
        listNovels: vi.fn().mockResolvedValue([]),
        getNovelById: vi.fn().mockResolvedValue(null),
        upsertNovelWithToc: vi.fn(),
        updateBookmark: vi.fn(),
        deleteNovel: vi.fn(),
        clearNewUpdate: vi.fn(),
        updateLastCheckedAt: vi.fn(),
      };

      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({
          appSettingsRepository: customAppSettingsRepo,
          novelRepository: customNovelRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(customNovelRepo.listNovels).toHaveBeenCalledWith("unread_first");
      expect(result.current.sortOrder).toBe("unread_first");
    });

    it("appSettingsRepository.getSetting が失敗した場合に error ステートが設定されること", async () => {
      const customAppSettingsRepo = {
        getSetting: vi.fn().mockRejectedValue(new Error("設定取得エラー")),
        setSetting: vi.fn().mockResolvedValue(undefined),
      };

      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({
          appSettingsRepository: customAppSettingsRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe("設定取得エラー");
      expect(result.current.novels).toEqual([]);

      // 非 Error 例外の場合
      const nonErrorAppSettingsRepo = {
        getSetting: vi.fn().mockRejectedValue("文字列設定エラー"),
        setSetting: vi.fn().mockResolvedValue(undefined),
      };

      const { result: result2 } = renderHook(
        () => useBookshelf({ intervalMs: 0 }),
        {
          wrapper: createWrapper({
            appSettingsRepository: nonErrorAppSettingsRepo,
          }),
        },
      );

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      expect(result2.current.error).toBe("文字列設定エラー");
    });

    it("初回一覧取得（novelRepository.listNovels）が失敗した場合に error ステートが設定されること", async () => {
      const failingRepo = {
        listNovels: vi.fn().mockRejectedValue(new Error("DB初期ロードエラー")),
        upsertNovelWithToc: vi.fn(),
      } as unknown as SqlNovelRepository;

      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({ novelRepository: failingRepo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe("DB初期ロードエラー");
      expect(result.current.novels).toEqual([]);

      // 非 Error 例外の場合
      const nonErrorRepo = {
        listNovels: vi.fn().mockRejectedValue("文字列DBエラー"),
        upsertNovelWithToc: vi.fn(),
      } as unknown as SqlNovelRepository;

      const { result: result2 } = renderHook(
        () => useBookshelf({ intervalMs: 0 }),
        {
          wrapper: createWrapper({ novelRepository: nonErrorRepo }),
        },
      );

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      expect(result2.current.error).toBe("文字列DBエラー");
    });

    it("アンマウント後に初期一覧取得が失敗してもステート更新エラーが発生しないこと", async () => {
      let rejectList: ((reason?: unknown) => void) | null = null;
      const customRepo = {
        listNovels: vi.fn(
          () =>
            new Promise((_, reject) => {
              rejectList = reject;
            }),
        ),
        upsertNovelWithToc: vi.fn(),
      } as unknown as SqlNovelRepository;

      const { unmount } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({ novelRepository: customRepo }),
      });

      await waitFor(() => {
        expect(customRepo.listNovels).toHaveBeenCalled();
      });

      unmount();

      await act(async () => {
        rejectList?.(new Error("アンマウント後エラー"));
      });

      expect(customRepo.listNovels).toHaveBeenCalled();
    });

    it("アンマウント後に初期一覧取得が成功してもステート更新エラーが発生しないこと", async () => {
      let resolveList: ((value: unknown) => void) | null = null;
      const customRepo = {
        listNovels: vi.fn(
          () =>
            new Promise((resolve) => {
              resolveList = resolve;
            }),
        ),
        upsertNovelWithToc: vi.fn(),
      } as unknown as SqlNovelRepository;

      const { unmount } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({ novelRepository: customRepo }),
      });

      await waitFor(() => {
        expect(customRepo.listNovels).toHaveBeenCalled();
      });

      unmount();

      await act(async () => {
        resolveList?.([]);
      });

      expect(customRepo.listNovels).toHaveBeenCalled();
    });
  });

  describe("ソート順変更と永続化 (setSortOrder)", () => {
    it("setSortOrder 呼び出しで DB に保存され、指定されたソート順で一覧が再取得されること (AC-BS-11)", async () => {
      const db = await resetTestDb();
      const repo = new SqlNovelRepository(db);

      const now = new Date().toISOString();
      // 2作品を登録
      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "1",
          canonicalUrl: "https://kakuyomu.jp/works/1",
          title: "B作品",
          author: "作者B",
          synopsis: "あらすじ",
          chapters: [],
          nextTocPageUrl: null,
        },
        now,
      );
      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "2",
          canonicalUrl: "https://kakuyomu.jp/works/2",
          title: "A作品",
          author: "作者A",
          synopsis: "あらすじ",
          chapters: [],
          nextTocPageUrl: null,
        },
        now,
      );

      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({ novelRepository: repo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.sortOrder).toBe("unread_first");

      // タイトル順に変更
      await act(async () => {
        await result.current.setSortOrder("title");
      });

      expect(result.current.sortOrder).toBe("title");
      expect(result.current.novels[0].title).toBe("A作品");
      expect(result.current.novels[1].title).toBe("B作品");
      expect(result.current.error).toBeNull();
    });

    it("setSortOrder で例外が発生した場合に error ステートが設定されること", async () => {
      const customAppSettingsRepo = {
        getSetting: vi.fn().mockResolvedValue("unread_first"),
        setSetting: vi.fn().mockRejectedValue(new Error("設定保存エラー")),
      };

      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({
          appSettingsRepository: customAppSettingsRepo,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setSortOrder("title");
      });

      expect(result.current.error).toBe("設定保存エラー");

      // 非 Error 例外
      customAppSettingsRepo.setSetting.mockRejectedValueOnce(
        "文字列設定エラー",
      );
      await act(async () => {
        await result.current.setSortOrder("created_at");
      });
      expect(result.current.error).toBe("文字列設定エラー");
    });
  });

  describe("「NEW」バッジ解除 (clearNovelUpdate)", () => {
    it("clearNovelUpdate 呼び出しで対象作品の hasNewUpdate が false に更新されること (AC-BS-09)", async () => {
      const db = await resetTestDb();
      const repo = new SqlNovelRepository(db);

      // 初回登録
      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "1",
          canonicalUrl: "https://kakuyomu.jp/works/1",
          title: "新着作品",
          author: "作者",
          synopsis: "あらすじ",
          chapters: [],
          nextTocPageUrl: null,
        },
        "2026-01-01T00:00:00Z",
      );

      // 新着エピソード追加で hasNewUpdate = true にする
      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "1",
          canonicalUrl: "https://kakuyomu.jp/works/1",
          title: "新着作品",
          author: "作者",
          synopsis: "あらすじ",
          chapters: [
            {
              chapterIndex: 1,
              remoteChapterId: "c1",
              partTitle: null,
              title: "第1話",
              url: "https://kakuyomu.jp/works/1/episodes/c1",
              publishedAt: "2026-01-01T00:00:00Z",
            },
          ],
          nextTocPageUrl: null,
        },
        "2026-01-02T00:00:00Z",
      );

      // 他の作品も登録（三項演算子の false 分岐カバー）
      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "2",
          canonicalUrl: "https://kakuyomu.jp/works/2",
          title: "別作品",
          author: "作者2",
          synopsis: "あらすじ",
          chapters: [],
          nextTocPageUrl: null,
        },
        new Date().toISOString(),
      );

      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({ novelRepository: repo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.novels[0].hasNewUpdate).toBe(true);

      // clearNovelUpdate を呼び出し
      await act(async () => {
        await result.current.clearNovelUpdate("kakuyomu:1");
      });

      expect(result.current.novels[0].hasNewUpdate).toBe(false);

      // DB 側も解除されていることを確認
      const reloaded = await repo.getNovelById("kakuyomu:1");
      expect(reloaded?.hasNewUpdate).toBe(false);
    });

    it("存在しない novelId で clearNovelUpdate を呼び出しても安全に処理されること", async () => {
      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.clearNovelUpdate("nonexistent");
      });

      expect(result.current.error).toBeNull();
    });

    it("clearNovelUpdate で例外が発生した場合に error ステートが設定されること", async () => {
      const customRepo = {
        listNovels: vi.fn().mockResolvedValue([
          {
            id: "kakuyomu:1",
            canonicalUrl: "https://kakuyomu.jp/works/1",
            title: "テスト作品",
            hasNewUpdate: true,
          } as NovelSummary,
        ]),
        clearNewUpdate: vi.fn().mockRejectedValue(new Error("NEW解除エラー")),
        upsertNovelWithToc: vi.fn(),
      } as unknown as SqlNovelRepository;

      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({ novelRepository: customRepo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.clearNovelUpdate("kakuyomu:1");
      });

      expect(result.current.error).toBe("NEW解除エラー");

      // 非 Error 例外
      vi.spyOn(customRepo, "clearNewUpdate").mockRejectedValueOnce(
        "非Error解除エラー",
      );
      await act(async () => {
        await result.current.clearNovelUpdate("kakuyomu:1");
      });
      expect(result.current.error).toBe("非Error解除エラー");
    });
  });

  describe("自動更新チェック (1時間経過判定とレートリミット順次実行)", () => {
    it("lastCheckedAt が null または 1時間以上前の作品のみ自動チェックが走り、1時間以内の作品はスキップされること (AC-BS-10)", async () => {
      const db = await resetTestDb();
      const repo = new SqlNovelRepository(db);

      const now = new Date("2026-01-01T12:00:00Z").getTime();
      vi.setSystemTime(now);

      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
      const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000).toISOString();

      // 1. 1時間以上前（更新チェック対象）
      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "1",
          canonicalUrl: "https://kakuyomu.jp/works/1",
          title: "作品1(2時間前)",
          author: "作者1",
          synopsis: "あらすじ1",
          chapters: [],
          nextTocPageUrl: null,
        },
        twoHoursAgo,
      );

      // 2. 30分前（スキップ対象）
      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "2",
          canonicalUrl: "https://kakuyomu.jp/works/2",
          title: "作品2(30分前)",
          author: "作者2",
          synopsis: "あらすじ2",
          chapters: [],
          nextTocPageUrl: null,
        },
        thirtyMinutesAgo,
      );

      // 3. lastCheckedAt === null（更新チェック対象）
      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "3",
          canonicalUrl: "https://kakuyomu.jp/works/3",
          title: "作品3(未チェック)",
          author: "作者3",
          synopsis: "あらすじ3",
          chapters: [],
          nextTocPageUrl: null,
        },
        twoHoursAgo,
      );
      await db.execute(
        "UPDATE novels SET last_checked_at = NULL WHERE id = 'kakuyomu:3';",
      );

      // 4. lastCheckedAt が不正文字列（更新チェック対象）
      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "4",
          canonicalUrl: "https://kakuyomu.jp/works/4",
          title: "作品4(不正日付)",
          author: "作者4",
          synopsis: "あらすじ4",
          chapters: [],
          nextTocPageUrl: null,
        },
        twoHoursAgo,
      );
      await db.execute(
        "UPDATE novels SET last_checked_at = 'invalid-date' WHERE id = 'kakuyomu:4';",
      );

      const mockHttp = new MockHttpClient();
      const requestedUrls: string[] = [];
      mockHttp.setResponse(
        /^https:\/\/kakuyomu\.jp\/works\/\d+$/,
        (options) => {
          requestedUrls.push(options.url);
          return {
            status: 200,
            url: options.url,
            headers: {},
            html: workIndexHtml,
          };
        },
      );

      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({
          novelRepository: repo,
          httpClient: mockHttp,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 自動更新チェック完了を待機
      await waitFor(() => {
        expect(result.current.isCheckingUpdates).toBe(false);
        expect(requestedUrls).toContain("https://kakuyomu.jp/works/1");
        expect(requestedUrls).toContain("https://kakuyomu.jp/works/3");
        expect(requestedUrls).toContain("https://kakuyomu.jp/works/4");
      });

      // 30分前の作品2は取得されていないこと
      expect(requestedUrls).not.toContain("https://kakuyomu.jp/works/2");

      vi.useRealTimers();
    });

    it("全作品が1時間以内にチェック済みの場合は自動更新チェックが走らないこと", async () => {
      const db = await resetTestDb();
      const repo = new SqlNovelRepository(db);

      const now = new Date("2026-01-01T12:00:00Z").getTime();
      vi.setSystemTime(now);
      const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString();

      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "1",
          canonicalUrl: "https://kakuyomu.jp/works/1",
          title: "最近チェック済み作品",
          author: "作者",
          synopsis: "あらすじ",
          chapters: [],
          nextTocPageUrl: null,
        },
        tenMinutesAgo,
      );

      const mockHttp = new MockHttpClient();
      const getHtmlSpy = vi.spyOn(mockHttp, "getHtml");

      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({
          novelRepository: repo,
          httpClient: mockHttp,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isCheckingUpdates).toBe(false);
      expect(getHtmlSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("新着エピソード検知時に hasNewUpdate が true となり本棚一覧に反映されること (AC-BS-08)", async () => {
      const db = await resetTestDb();
      const repo = new SqlNovelRepository(db);

      // 初回は0話で登録
      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "16817330658027210412",
          canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
          title: "境界迷宮と異界の魔術師",
          author: "小野崎えいじ",
          synopsis: "あらすじ",
          chapters: [],
          nextTocPageUrl: null,
        },
        "2026-01-01T00:00:00Z",
      );

      // 1時間以上経過状態にする
      await db.execute(
        "UPDATE novels SET last_checked_at = '2026-01-01T00:00:00Z';",
      );

      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({ novelRepository: repo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 自動更新チェック完了を待機
      await waitFor(() => {
        expect(result.current.isCheckingUpdates).toBe(false);
      });

      // 目次再取得（fixtureには4話存在）により新着検知
      expect(result.current.novels[0].hasNewUpdate).toBe(true);
      expect(result.current.novels[0].totalChapters).toBe(4);
    });

    it("1作品の更新取得で例外が発生しても処理全体がクラッシュせず後続のチェックが継続されること", async () => {
      const db = await resetTestDb();
      const repo = new SqlNovelRepository(db);

      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "1",
          canonicalUrl: "https://kakuyomu.jp/works/1",
          title: "エラー作品",
          author: "作者1",
          synopsis: "あらすじ1",
          chapters: [],
          nextTocPageUrl: null,
        },
        "2026-01-01T00:00:00Z",
      );
      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "2",
          canonicalUrl: "https://kakuyomu.jp/works/2",
          title: "正常作品",
          author: "作者2",
          synopsis: "あらすじ2",
          chapters: [],
          nextTocPageUrl: null,
        },
        "2026-01-01T00:00:00Z",
      );
      await db.execute("UPDATE novels SET last_checked_at = NULL;");

      const mockHttp = new MockHttpClient();
      mockHttp.setResponse("https://kakuyomu.jp/works/1", () => {
        throw new Error("HTTP 500 Server Error");
      });
      mockHttp.setResponse("https://kakuyomu.jp/works/2", (options) => ({
        status: 200,
        url: options.url,
        headers: {},
        html: workIndexHtml,
      }));

      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({
          novelRepository: repo,
          httpClient: mockHttp,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.isCheckingUpdates).toBe(false);
      });

      // 正常作品が更新されていること
      const normalNovel = result.current.novels.find(
        (n) => n.id === "kakuyomu:2",
      );
      expect(normalNovel).toBeDefined();
    });

    it("更新チェック途中でアンマウントされた場合、安全に中断されること", async () => {
      const db = await resetTestDb();
      const repo = new SqlNovelRepository(db);

      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "1",
          canonicalUrl: "https://kakuyomu.jp/works/1",
          title: "作品1",
          author: "作者1",
          synopsis: "あらすじ1",
          chapters: [],
          nextTocPageUrl: null,
        },
        "2026-01-01T00:00:00Z",
      );
      await db.execute("UPDATE novels SET last_checked_at = NULL;");

      let resolveHttp: (() => void) | null = null;
      const mockHttp = new MockHttpClient();
      mockHttp.setResponse(
        "https://kakuyomu.jp/works/1",
        () =>
          new Promise((resolve) => {
            resolveHttp = () =>
              resolve({
                status: 200,
                url: "https://kakuyomu.jp/works/1",
                headers: {},
                html: workIndexHtml,
              });
          }),
      );

      const { unmount } = renderHook(() => useBookshelf({ intervalMs: 100 }), {
        wrapper: createWrapper({
          novelRepository: repo,
          httpClient: mockHttp,
        }),
      });

      await waitFor(() => {
        expect(resolveHttp).not.toBeNull();
      });

      unmount();

      // アンマウント後に完了させる
      await act(async () => {
        resolveHttp?.();
      });
    });

    it("更新チェックのウェイト待機中（sleep）にアンマウントされた場合、安全に中断されること", async () => {
      const db = await resetTestDb();
      const repo = new SqlNovelRepository(db);

      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "1",
          canonicalUrl: "https://kakuyomu.jp/works/1",
          title: "作品1",
          author: "作者1",
          synopsis: "あらすじ1",
          chapters: [],
          nextTocPageUrl: null,
        },
        "2026-01-01T00:00:00Z",
      );
      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "2",
          canonicalUrl: "https://kakuyomu.jp/works/2",
          title: "作品2",
          author: "作者2",
          synopsis: "あらすじ2",
          chapters: [],
          nextTocPageUrl: null,
        },
        "2026-01-01T00:00:00Z",
      );
      await db.execute("UPDATE novels SET last_checked_at = NULL;");

      const mockHttp = new MockHttpClient();
      let callCount = 0;
      mockHttp.setResponse(
        /^https:\/\/kakuyomu\.jp\/works\/\d+$/,
        (options) => {
          callCount++;
          return {
            status: 200,
            url: options.url,
            headers: {},
            html: workIndexHtml,
          };
        },
      );

      // 500ms ウェイト
      const { unmount } = renderHook(() => useBookshelf({ intervalMs: 500 }), {
        wrapper: createWrapper({
          novelRepository: repo,
          httpClient: mockHttp,
        }),
      });

      // 1作品目が取得されるのを待機
      await waitFor(() => {
        expect(callCount).toBe(1);
      });

      // 作品2取得前の sleep 中にアンマウント
      unmount();

      // 待機時間を経過させる
      await new Promise((resolve) => setTimeout(resolve, 600));

      // アンマウントにより2作品目は取得されず中断されたこと
      expect(callCount).toBe(1);
    });
  });

  describe("手動一括更新チェック (checkUpdates)", () => {
    it("checkUpdates(true) 呼び出しで全登録作品が即時更新チェックされ進捗ステートが遷移すること (AC-BS-10)", async () => {
      const db = await resetTestDb();
      const repo = new SqlNovelRepository(db);

      const now = new Date().toISOString();
      // 直近チェック済み作品（自動更新ではスキップされるはずの作品）
      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "1",
          canonicalUrl: "https://kakuyomu.jp/works/1",
          title: "作品1",
          author: "作者1",
          synopsis: "あらすじ1",
          chapters: [],
          nextTocPageUrl: null,
        },
        now,
      );

      const mockHttp = new MockHttpClient();
      let requested = false;
      mockHttp.setResponse("https://kakuyomu.jp/works/1", (options) => {
        requested = true;
        return {
          status: 200,
          url: options.url,
          headers: {},
          html: workIndexHtml,
        };
      });

      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({
          novelRepository: repo,
          httpClient: mockHttp,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 自動チェックはスキップされたことを確認
      expect(result.current.isCheckingUpdates).toBe(false);
      expect(requested).toBe(false);

      // 手動一括更新を実行
      let updatePromise: Promise<void>;
      act(() => {
        updatePromise = result.current.checkUpdates(true);
      });

      await waitFor(() => {
        expect(result.current.isCheckingUpdates).toBe(false);
        expect(result.current.updateCheckProgress).toBeNull();
      });

      await act(async () => {
        await updatePromise!;
      });

      expect(requested).toBe(true);
    });

    it("更新チェック実行中の二重呼び出しは無視（ガード）されること", async () => {
      const db = await resetTestDb();
      const repo = new SqlNovelRepository(db);

      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "1",
          canonicalUrl: "https://kakuyomu.jp/works/1",
          title: "作品1",
          author: "作者1",
          synopsis: "あらすじ1",
          chapters: [],
          nextTocPageUrl: null,
        },
        "2026-01-01T00:00:00Z",
      );
      await db.execute(
        "UPDATE novels SET last_checked_at = '2026-01-01T12:00:00Z';",
      );

      let resolveHttp: (() => void) | null = null;
      let callCount = 0;
      const mockHttp = new MockHttpClient();
      mockHttp.setResponse("https://kakuyomu.jp/works/1", () => {
        callCount++;
        return new Promise((resolve) => {
          resolveHttp = () =>
            resolve({
              status: 200,
              url: "https://kakuyomu.jp/works/1",
              headers: {},
              html: workIndexHtml,
            });
        });
      });

      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({
          novelRepository: repo,
          httpClient: mockHttp,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 1回目の手動更新を開始
      let firstPromise: Promise<void>;
      act(() => {
        firstPromise = result.current.checkUpdates();
      });

      await waitFor(() => {
        expect(result.current.isCheckingUpdates).toBe(true);
      });

      // 実行中の2回目の呼び出し（ガードされること）
      await act(async () => {
        await result.current.checkUpdates();
      });

      expect(callCount).toBe(1);

      // 完了させる
      await act(async () => {
        resolveHttp?.();
        await firstPromise!;
      });

      expect(result.current.isCheckingUpdates).toBe(false);
    });

    it("checkUpdates(false) 呼び出しで1時間経過作品のみが更新対象となること", async () => {
      const db = await resetTestDb();
      const repo = new SqlNovelRepository(db);

      const now = Date.now();
      vi.setSystemTime(now);

      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
      const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString();

      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "1",
          canonicalUrl: "https://kakuyomu.jp/works/1",
          title: "作品1(2時間前)",
          author: "作者1",
          synopsis: "あらすじ1",
          chapters: [],
          nextTocPageUrl: null,
        },
        twoHoursAgo,
      );
      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "2",
          canonicalUrl: "https://kakuyomu.jp/works/2",
          title: "作品2(10分前)",
          author: "作者2",
          synopsis: "あらすじ2",
          chapters: [],
          nextTocPageUrl: null,
        },
        tenMinutesAgo,
      );

      const mockHttp = new MockHttpClient();
      const requestedUrls: string[] = [];
      mockHttp.setResponse(
        /^https:\/\/kakuyomu\.jp\/works\/\d+$/,
        (options) => {
          requestedUrls.push(options.url);
          return {
            status: 200,
            url: options.url,
            headers: {},
            html: workIndexHtml,
          };
        },
      );

      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({
          novelRepository: repo,
          httpClient: mockHttp,
        }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 自動チェック完了を待機
      await waitFor(() => {
        expect(result.current.isCheckingUpdates).toBe(false);
      });
      requestedUrls.length = 0;

      // checkUpdates(false) を実行
      await act(async () => {
        await result.current.checkUpdates(false);
      });

      // 作品1は前回の自動チェックで更新されたため、今回は1時間以内となり両方スキップされる
      expect(requestedUrls).toHaveLength(0);

      vi.useRealTimers();
    });

    it("作品が0件のときに checkUpdates を呼んでも安全に終了すること", async () => {
      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.checkUpdates();
      });

      expect(result.current.isCheckingUpdates).toBe(false);
      expect(result.current.updateCheckProgress).toBeNull();
    });
  });

  describe("手動リロード (reloadNovels)", () => {
    it("reloadNovels を呼び出すと最新の作品一覧が現在のソート順で再取得されること", async () => {
      const db = await resetTestDb();
      const repo = new SqlNovelRepository(db);

      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({ novelRepository: repo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.novels).toHaveLength(0);

      // 外部で1件追加
      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "999",
          canonicalUrl: "https://kakuyomu.jp/works/999",
          title: "外部追加作品",
          author: "作者",
          synopsis: "あらすじ",
          chapters: [],
          nextTocPageUrl: null,
        },
        "2026-01-01T00:00:00Z",
      );

      await act(async () => {
        await result.current.reloadNovels();
      });

      expect(result.current.novels).toHaveLength(1);
      expect(result.current.novels[0].title).toBe("外部追加作品");
    });

    it("reloadNovels でエラーが発生した場合に error ステートが設定され、再実行時にクリアされること", async () => {
      const db = await resetTestDb();
      const repo = new SqlNovelRepository(db);

      const { result } = renderHook(() => useBookshelf({ intervalMs: 0 }), {
        wrapper: createWrapper({ novelRepository: repo }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      vi.spyOn(repo, "listNovels").mockRejectedValueOnce(
        new Error("リロード失敗"),
      );

      await act(async () => {
        await result.current.reloadNovels();
      });

      expect(result.current.error).toBe("リロード失敗");
      expect(result.current.isLoading).toBe(false);

      // 非 Error 例外
      vi.spyOn(repo, "listNovels").mockRejectedValueOnce("非Errorリロード失敗");

      await act(async () => {
        await result.current.reloadNovels();
      });

      expect(result.current.error).toBe("非Errorリロード失敗");

      // 正常復帰時に error が null にクリアされること
      await act(async () => {
        await result.current.reloadNovels();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("ウェイト間隔（デフォルト 1000ms）の検証 (fakeTimers)", () => {
    it("複数作品の更新チェックで 1000ms のウェイトが挟まれること", async () => {
      const db = await resetTestDb();
      const repo = new SqlNovelRepository(db);

      const now = new Date().toISOString();
      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "1",
          canonicalUrl: "https://kakuyomu.jp/works/1",
          title: "作品1",
          author: "作者1",
          synopsis: "あらすじ1",
          chapters: [],
          nextTocPageUrl: null,
        },
        now,
      );
      await repo.upsertNovelWithToc(
        {
          siteType: "kakuyomu",
          remoteWorkId: "2",
          canonicalUrl: "https://kakuyomu.jp/works/2",
          title: "作品2",
          author: "作者2",
          synopsis: "あらすじ2",
          chapters: [],
          nextTocPageUrl: null,
        },
        now,
      );

      const mockHttp = new MockHttpClient();
      const checkTimestamps: number[] = [];
      mockHttp.setResponse(
        /^https:\/\/kakuyomu\.jp\/works\/\d+$/,
        (options) => {
          checkTimestamps.push(Date.now());
          return {
            status: 200,
            url: options.url,
            headers: {},
            html: workIndexHtml,
          };
        },
      );

      // options なしで初期化（デフォルト 1000ms）
      const { result } = renderHook(() => useBookshelf(), {
        wrapper: createWrapper({
          novelRepository: repo,
          httpClient: mockHttp,
        }),
      });

      // 初期ロード完了まで待機
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 手動一括更新のウェイト検証のため fakeTimers を開始
      vi.useFakeTimers();

      let checkPromise: Promise<void>;
      act(() => {
        checkPromise = result.current.checkUpdates(true);
      });

      // 1作品目は即時実行
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });
      expect(checkTimestamps.length).toBe(1);

      // 990ms 経過時点ではまだ2作品目は実行されない（計 1000ms ウェイト）
      await act(async () => {
        await vi.advanceTimersByTimeAsync(980);
      });
      expect(checkTimestamps.length).toBe(1);

      // 1000ms 到達で2作品目が実行される
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20);
      });
      expect(checkTimestamps.length).toBe(2);

      await act(async () => {
        await checkPromise!;
      });

      expect(checkTimestamps[1] - checkTimestamps[0]).toBeGreaterThanOrEqual(
        1000,
      );

      vi.useRealTimers();
    });
  });
});

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MockCloudSyncBridge } from "../../../bridges/cloud-sync/mockCloudSyncBridge";
import { MockHttpClient } from "../../../bridges/http/mockHttpClient";
import { createDefaultParserRegistry } from "../../../parsers/parserRegistry";
import {
  createInMemoryDb,
  resetTestDb,
} from "../../../storage/adapter/inMemoryDb";
import { SqlNovelRepository } from "../../../storage/repositories/novelRepository";
import { SqlChapterRepository } from "../../../storage/repositories/chapterRepository";
import { SqlAppSettingsRepository } from "../../../storage/repositories/appSettingsRepository";
import workIndexHtml from "../../../parsers/kakuyomu/__fixtures__/work_index.html?raw";
import type { YommySyncState } from "../types";
import { SyncEngine, validateSyncState, parseNovelUrl } from "./syncEngine";

describe("syncEngine", () => {
  describe("validateSyncState (スキーマ検証)", () => {
    const validState: YommySyncState = {
      version: 1,
      lastSyncedAt: "2026-10-31T12:00:00.000Z",
      novels: {
        "kakuyomu:16817330658027210412": {
          id: "kakuyomu:16817330658027210412",
          siteType: "kakuyomu",
          remoteWorkId: "16817330658027210412",
          canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
          title: "境界迷宮と異界の魔術師",
          author: "小野崎",
          synopsis: "あらすじ本文",
          totalChapters: 10,
          isFavorite: 1,
          hasNewUpdate: 0,
          latestEpisodePublishedAt: "2026-10-30T10:00:00.000Z",
          bookmarkChapterIndex: 2,
          lastReadAt: "2026-10-31T10:00:00.000Z",
          readChapterIds: ["16817330658027210413", "16817330658027210414"],
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-31T10:00:00.000Z",
        },
      },
      deletedNovels: {
        "kakuyomu:9999999999999999999": "2026-10-25T08:00:00.000Z",
      },
    };

    it("正常な YommySyncState JSON 文字列をパース・検証して同等のオブジェクトを返すこと", () => {
      const jsonStr = JSON.stringify(validState);
      const result = validateSyncState(jsonStr);
      expect(result).toEqual(validState);
    });

    it("正常な YommySyncState オブジェクトをそのまま受け入れられること", () => {
      const result = validateSyncState(validState);
      expect(result).toEqual(validState);
    });

    it("不正な JSON 構文の文字列が渡された場合に例外を送出すること", () => {
      expect(() => validateSyncState("{ invalid json ")).toThrow(/JSON/i);
    });

    it("null やプリミティブ値（number, boolean, string）が渡された場合に例外を送出すること", () => {
      expect(() => validateSyncState(null)).toThrow(/object/i);
      expect(() => validateSyncState(123)).toThrow(/object/i);
      expect(() => validateSyncState(true)).toThrow(/object/i);
      expect(() => validateSyncState([])).toThrow(/object/i);
    });

    it("プロトタイプ汚染が検知された場合に例外を送出すること", () => {
      const maliciousJson =
        '{"version":1,"lastSyncedAt":"2026-10-31T12:00:00.000Z","novels":{},"deletedNovels":{},"__proto__":{"polluted":true}}';
      expect(() => validateSyncState(maliciousJson)).toThrow(
        /Prototype pollution/i,
      );

      const maliciousNovelJson =
        '{"version":1,"lastSyncedAt":"2026-10-31T12:00:00.000Z","novels":{"__proto__":{}},"deletedNovels":{}}';
      expect(() => validateSyncState(maliciousNovelJson)).toThrow(
        /Prototype pollution/i,
      );
    });

    it("version が 1 以外の場合に例外を送出すること", () => {
      expect(() =>
        validateSyncState({ ...validState, version: 2 as unknown as 1 }),
      ).toThrow(/version/i);
      expect(() =>
        validateSyncState({
          ...validState,
          version: undefined as unknown as 1,
        }),
      ).toThrow(/version/i);
    });

    it("lastSyncedAt が不正または欠損している場合に例外を送出すること", () => {
      expect(() =>
        validateSyncState({ ...validState, lastSyncedAt: "invalid-date" }),
      ).toThrow(/lastSyncedAt/i);
      expect(() =>
        validateSyncState({
          ...validState,
          lastSyncedAt: 12345 as unknown as string,
        }),
      ).toThrow(/lastSyncedAt/i);
    });

    it("novels がオブジェクトでない場合に例外を送出すること", () => {
      expect(() =>
        validateSyncState({ ...validState, novels: null as unknown as object }),
      ).toThrow(/novels/i);
      expect(() =>
        validateSyncState({ ...validState, novels: [] as unknown as object }),
      ).toThrow(/novels/i);
    });

    it("novels 内の作品データで ID がキーと一致しない場合に例外を送出すること", () => {
      const invalidNovels = {
        ...validState,
        novels: {
          "kakuyomu:123": {
            ...validState.novels["kakuyomu:16817330658027210412"],
            id: "kakuyomu:999",
          },
        },
      };
      expect(() => validateSyncState(invalidNovels)).toThrow(/ID mismatch/i);
    });

    it("novels 内の作品データで siteType が不正な場合に例外を送出すること", () => {
      const invalidNovels = {
        ...validState,
        novels: {
          "kakuyomu:16817330658027210412": {
            ...validState.novels["kakuyomu:16817330658027210412"],
            siteType: "unknown" as unknown as "kakuyomu",
          },
        },
      };
      expect(() => validateSyncState(invalidNovels)).toThrow(/siteType/i);
    });

    it("novels 内の作品データで totalChapters が負数または非整数の場合に例外を送出すること", () => {
      const invalidNovels1 = {
        ...validState,
        novels: {
          "kakuyomu:16817330658027210412": {
            ...validState.novels["kakuyomu:16817330658027210412"],
            totalChapters: -1,
          },
        },
      };
      expect(() => validateSyncState(invalidNovels1)).toThrow(/totalChapters/i);

      const invalidNovels2 = {
        ...validState,
        novels: {
          "kakuyomu:16817330658027210412": {
            ...validState.novels["kakuyomu:16817330658027210412"],
            totalChapters: 1.5,
          },
        },
      };
      expect(() => validateSyncState(invalidNovels2)).toThrow(/totalChapters/i);
    });

    it("novels 内の作品データで isFavorite または hasNewUpdate が 0/1 以外の場合に例外を送出すること", () => {
      const invalidNovels1 = {
        ...validState,
        novels: {
          "kakuyomu:16817330658027210412": {
            ...validState.novels["kakuyomu:16817330658027210412"],
            isFavorite: 2 as unknown as 1,
          },
        },
      };
      expect(() => validateSyncState(invalidNovels1)).toThrow(/isFavorite/i);

      const invalidNovels2 = {
        ...validState,
        novels: {
          "kakuyomu:16817330658027210412": {
            ...validState.novels["kakuyomu:16817330658027210412"],
            hasNewUpdate: true as unknown as 1,
          },
        },
      };
      expect(() => validateSyncState(invalidNovels2)).toThrow(/hasNewUpdate/i);
    });

    it("novels 内の作品データで bookmarkChapterIndex が 0 以下の数値の場合に例外を送出すること", () => {
      const invalidNovels = {
        ...validState,
        novels: {
          "kakuyomu:16817330658027210412": {
            ...validState.novels["kakuyomu:16817330658027210412"],
            bookmarkChapterIndex: 0,
          },
        },
      };
      expect(() => validateSyncState(invalidNovels)).toThrow(
        /bookmarkChapterIndex/i,
      );
    });

    it("novels 内の作品データで readChapterIds が配列でない、または文字列以外が含まれる場合に例外を送出すること", () => {
      const invalidNovels1 = {
        ...validState,
        novels: {
          "kakuyomu:16817330658027210412": {
            ...validState.novels["kakuyomu:16817330658027210412"],
            readChapterIds: "not-an-array" as unknown as string[],
          },
        },
      };
      expect(() => validateSyncState(invalidNovels1)).toThrow(
        /readChapterIds/i,
      );

      const invalidNovels2 = {
        ...validState,
        novels: {
          "kakuyomu:16817330658027210412": {
            ...validState.novels["kakuyomu:16817330658027210412"],
            readChapterIds: [123] as unknown as string[],
          },
        },
      };
      expect(() => validateSyncState(invalidNovels2)).toThrow(
        /readChapterIds/i,
      );
    });

    it("novels 内の作品データで日時項目が不正な場合に例外を送出すること", () => {
      const invalidNovels1 = {
        ...validState,
        novels: {
          "kakuyomu:16817330658027210412": {
            ...validState.novels["kakuyomu:16817330658027210412"],
            createdAt: "invalid",
          },
        },
      };
      expect(() => validateSyncState(invalidNovels1)).toThrow(/createdAt/i);

      const invalidNovels2 = {
        ...validState,
        novels: {
          "kakuyomu:16817330658027210412": {
            ...validState.novels["kakuyomu:16817330658027210412"],
            updatedAt: "invalid",
          },
        },
      };
      expect(() => validateSyncState(invalidNovels2)).toThrow(/updatedAt/i);

      const invalidNovels3 = {
        ...validState,
        novels: {
          "kakuyomu:16817330658027210412": {
            ...validState.novels["kakuyomu:16817330658027210412"],
            lastReadAt: "invalid",
          },
        },
      };
      expect(() => validateSyncState(invalidNovels3)).toThrow(/lastReadAt/i);

      const invalidNovels4 = {
        ...validState,
        novels: {
          "kakuyomu:16817330658027210412": {
            ...validState.novels["kakuyomu:16817330658027210412"],
            latestEpisodePublishedAt: "invalid",
          },
        },
      };
      expect(() => validateSyncState(invalidNovels4)).toThrow(
        /latestEpisodePublishedAt/i,
      );
    });

    it("deletedNovels がオブジェクトでない、または値が不正な日時の場合に例外を送出すること", () => {
      expect(() =>
        validateSyncState({
          ...validState,
          deletedNovels: null as unknown as object,
        }),
      ).toThrow(/deletedNovels/i);

      expect(() =>
        validateSyncState({
          ...validState,
          deletedNovels: { "kakuyomu:123": "invalid-date" },
        }),
      ).toThrow(/deletedNovels/i);
    });
  });

  describe("parseNovelUrl (SSRF ガードとホワイトリスト検証)", () => {
    it("カクヨム作品トップの正常 URL を正しく解析すること", () => {
      const result = parseNovelUrl(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      expect(result).toEqual({
        siteType: "kakuyomu",
        workId: "16817330658027210412",
        canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
      });
    });

    it("末尾スラッシュ付き URL も許容して正規化 URL を返すこと", () => {
      const result = parseNovelUrl(
        "https://kakuyomu.jp/works/16817330658027210412/",
      );
      expect(result).toEqual({
        siteType: "kakuyomu",
        workId: "16817330658027210412",
        canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
      });
    });

    it("非 HTTPS スキーム（http://, file://, javascript:）を拒絶して null を返すこと", () => {
      expect(
        parseNovelUrl("http://kakuyomu.jp/works/16817330658027210412"),
      ).toBeNull();
      expect(parseNovelUrl("file:///etc/passwd")).toBeNull();
      expect(parseNovelUrl("javascript:alert(1)")).toBeNull();
    });

    it("未知のドメインを拒絶して null を返すこと (SSRF 防止)", () => {
      expect(
        parseNovelUrl("https://evil-site.com/works/16817330658027210412"),
      ).toBeNull();
      expect(
        parseNovelUrl(
          "https://kakuyomu.jp.evil.com/works/16817330658027210412",
        ),
      ).toBeNull();
    });

    it("ローカルホストやプライベート IP を拒絶して null を返すこと (SSRF 防止)", () => {
      expect(parseNovelUrl("http://127.0.0.1/works/12345")).toBeNull();
      expect(parseNovelUrl("http://169.254.169.254/works/12345")).toBeNull();
      expect(parseNovelUrl("http://localhost/works/12345")).toBeNull();
    });

    it("作品 ID が数字でない不正なパスを拒絶して null を返すこと", () => {
      expect(parseNovelUrl("https://kakuyomu.jp/works/abc")).toBeNull();
      expect(parseNovelUrl("https://kakuyomu.jp/search")).toBeNull();
    });

    it("不正な URL 文字列で例外を投げずに null を返すこと", () => {
      expect(parseNovelUrl("not-a-valid-url")).toBeNull();
    });
  });

  describe("SyncEngine (マージ・競合解決・自動同期)", () => {
    let db: Awaited<ReturnType<typeof createInMemoryDb>>;
    let bridge: MockCloudSyncBridge;
    let httpClient: MockHttpClient;
    let novelRepo: SqlNovelRepository;
    let chapterRepo: SqlChapterRepository;
    let appSettingsRepo: SqlAppSettingsRepository;
    let parserRegistry: ReturnType<typeof createDefaultParserRegistry>;
    let engine: SyncEngine;

    beforeEach(async () => {
      await resetTestDb();
      db = await createInMemoryDb();
      novelRepo = new SqlNovelRepository(db);
      chapterRepo = new SqlChapterRepository(db);
      appSettingsRepo = new SqlAppSettingsRepository(db);
      parserRegistry = createDefaultParserRegistry();
      bridge = new MockCloudSyncBridge();

      httpClient = new MockHttpClient();
      httpClient.setResponse(
        /^https:\/\/kakuyomu\.jp\/works\/\d+$/,
        (options) => ({
          status: 200,
          url: options.url,
          headers: {},
          html: workIndexHtml,
        }),
      );

      engine = new SyncEngine({
        bridge,
        novelRepository: novelRepo,
        chapterRepository: chapterRepo,
        appSettingsRepository: appSettingsRepo,
        parserRegistry,
        httpClient,
      });
    });

    afterEach(() => {
      engine.cancelDebouncedPush();
      vi.clearAllTimers();
    });

    it("pullAndMerge: リモートファイルが存在しない（null）場合、何もマージせず完了すること", async () => {
      const result = await engine.pullAndMerge();
      expect(result).toEqual({ pulled: false, mergedNovels: 0 });
      expect(await novelRepo.listNovels()).toHaveLength(0);
    });

    it("pullAndMerge: リモートにのみ存在する新規作品を自動目次取得しローカル DB へ保存し、しおり・既読を反映すること", async () => {
      const remoteState: YommySyncState = {
        version: 1,
        lastSyncedAt: "2026-10-31T12:00:00.000Z",
        novels: {
          "kakuyomu:16817330658027210412": {
            id: "kakuyomu:16817330658027210412",
            siteType: "kakuyomu",
            remoteWorkId: "16817330658027210412",
            canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
            title: "境界迷宮と異界の魔術師",
            author: "小野崎",
            synopsis: "あらすじ本文",
            totalChapters: 3,
            isFavorite: 1,
            hasNewUpdate: 0,
            latestEpisodePublishedAt: "2026-10-30T10:00:00.000Z",
            bookmarkChapterIndex: 2,
            lastReadAt: "2026-10-31T10:00:00.000Z",
            readChapterIds: ["16817330658027210413"],
            createdAt: "2026-10-01T00:00:00.000Z",
            updatedAt: "2026-10-31T10:00:00.000Z",
          },
        },
        deletedNovels: {},
      };
      await bridge.pushFile(JSON.stringify(remoteState));

      const result = await engine.pullAndMerge();
      expect(result.pulled).toBe(true);
      expect(result.mergedNovels).toBe(1);

      const localNovel = await novelRepo.getNovelById(
        "kakuyomu:16817330658027210412",
      );
      expect(localNovel).not.toBeNull();
      expect(localNovel?.title).toBe("境界迷宮と異界の魔術師");
      expect(localNovel?.bookmarkChapterIndex).toBe(2);
      expect(localNovel?.bookmarkScrollProgress).toBe(0.0);

      const chapters = await chapterRepo.listChaptersByNovelId(
        "kakuyomu:16817330658027210412",
      );
      expect(chapters.length).toBeGreaterThan(0);
      const readChapter = chapters.find(
        (c) => c.remoteChapterId === "16817330658027210413",
      );
      expect(readChapter?.isRead).toBe(true);

      const lastSynced = await appSettingsRepo.getCloudSyncLastSyncedAt();
      expect(lastSynced).toBeGreaterThan(0);
    });

    it("pullAndMerge: リモート作品の canonicalUrl がホワイトリストに違反する場合、目次取得をスキップすること (SSRF 防止)", async () => {
      const maliciousRemoteState: YommySyncState = {
        version: 1,
        lastSyncedAt: "2026-10-31T12:00:00.000Z",
        novels: {
          "kakuyomu:malicious": {
            id: "kakuyomu:malicious",
            siteType: "kakuyomu",
            remoteWorkId: "malicious",
            canonicalUrl: "http://169.254.169.254/latest/meta-data/",
            title: "不正URL作品",
            author: "攻撃者",
            synopsis: "SSRF攻撃",
            totalChapters: 1,
            isFavorite: 0,
            hasNewUpdate: 0,
            latestEpisodePublishedAt: null,
            bookmarkChapterIndex: null,
            lastReadAt: null,
            readChapterIds: [],
            createdAt: "2026-10-01T00:00:00.000Z",
            updatedAt: "2026-10-01T00:00:00.000Z",
          },
        },
        deletedNovels: {},
      };
      await bridge.pushFile(JSON.stringify(maliciousRemoteState));

      const result = await engine.pullAndMerge();
      expect(result.pulled).toBe(true);
      expect(await novelRepo.listNovels()).toHaveLength(0);
    });

    it("pullAndMerge: リモートの deletedNovels に含まれる作品の削除日時がローカル作品より新しい場合、ローカル DB からカスケード削除されること (Tombstone 伝播)", async () => {
      const parser = parserRegistry.requireParser(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      const index = parser.parseNovelIndex(
        workIndexHtml,
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      await novelRepo.upsertNovelWithToc(index, "2026-10-10T00:00:00.000Z");

      const remoteState: YommySyncState = {
        version: 1,
        lastSyncedAt: "2026-10-31T12:00:00.000Z",
        novels: {},
        deletedNovels: {
          "kakuyomu:16817330658027210412": "2026-10-20T00:00:00.000Z",
        },
      };
      await bridge.pushFile(JSON.stringify(remoteState));

      await engine.pullAndMerge();
      expect(
        await novelRepo.getNovelById("kakuyomu:16817330658027210412"),
      ).toBeNull();
    });

    it("pullAndMerge: リモートの deletedNovels の削除日時がローカル作品の登録/更新日時より古い場合、ローカル作品を削除しないこと", async () => {
      const parser = parserRegistry.requireParser(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      const index = parser.parseNovelIndex(
        workIndexHtml,
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      await novelRepo.upsertNovelWithToc(index, "2026-10-25T00:00:00.000Z");

      const remoteState: YommySyncState = {
        version: 1,
        lastSyncedAt: "2026-10-31T12:00:00.000Z",
        novels: {},
        deletedNovels: {
          "kakuyomu:16817330658027210412": "2026-10-20T00:00:00.000Z",
        },
      };
      await bridge.pushFile(JSON.stringify(remoteState));

      await engine.pullAndMerge();
      expect(
        await novelRepo.getNovelById("kakuyomu:16817330658027210412"),
      ).not.toBeNull();
    });

    it("pullAndMerge: ローカルに Tombstone が存在し削除日時がリモート更新日時より新しい場合、リモート作品を復元せずスキップすること", async () => {
      const parser = parserRegistry.requireParser(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      const index = parser.parseNovelIndex(
        workIndexHtml,
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      await novelRepo.upsertNovelWithToc(index, "2026-10-10T00:00:00.000Z");
      // ローカルで削除
      await novelRepo.deleteNovel("kakuyomu:16817330658027210412");

      const remoteState: YommySyncState = {
        version: 1,
        lastSyncedAt: "2026-10-31T12:00:00.000Z",
        novels: {
          "kakuyomu:16817330658027210412": {
            id: "kakuyomu:16817330658027210412",
            siteType: "kakuyomu",
            remoteWorkId: "16817330658027210412",
            canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
            title: "境界迷宮と異界の魔術師",
            author: "小野崎",
            synopsis: "あらすじ本文",
            totalChapters: 3,
            isFavorite: 1,
            hasNewUpdate: 0,
            latestEpisodePublishedAt: "2026-10-10T10:00:00.000Z",
            bookmarkChapterIndex: 1,
            lastReadAt: "2026-10-10T10:00:00.000Z",
            readChapterIds: [],
            createdAt: "2026-10-10T00:00:00.000Z",
            updatedAt: "2026-10-10T00:00:00.000Z", // ローカル削除より古い
          },
        },
        deletedNovels: {},
      };
      await bridge.pushFile(JSON.stringify(remoteState));

      await engine.pullAndMerge();
      expect(
        await novelRepo.getNovelById("kakuyomu:16817330658027210412"),
      ).toBeNull();
    });

    it("pullAndMerge: 同一作品が存在する場合、リモートの lastReadAt が新しければリモートの bookmarkChapterIndex を採用しスクロール進捗率をリセットすること", async () => {
      const parser = parserRegistry.requireParser(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      const index = parser.parseNovelIndex(
        workIndexHtml,
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      await novelRepo.upsertNovelWithToc(index, "2026-10-10T00:00:00.000Z");
      await novelRepo.updateBookmark("kakuyomu:16817330658027210412", 1, 0.5);

      const remoteState: YommySyncState = {
        version: 1,
        lastSyncedAt: "2026-10-31T12:00:00.000Z",
        novels: {
          "kakuyomu:16817330658027210412": {
            id: "kakuyomu:16817330658027210412",
            siteType: "kakuyomu",
            remoteWorkId: "16817330658027210412",
            canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
            title: "境界迷宮と異界の魔術師",
            author: "小野崎",
            synopsis: "あらすじ本文",
            totalChapters: 3,
            isFavorite: 1,
            hasNewUpdate: 0,
            latestEpisodePublishedAt: "2026-10-10T10:00:00.000Z",
            bookmarkChapterIndex: 2,
            lastReadAt: "2026-10-30T10:00:00.000Z",
            readChapterIds: [],
            createdAt: "2026-10-10T00:00:00.000Z",
            updatedAt: "2026-10-30T10:00:00.000Z",
          },
        },
        deletedNovels: {},
      };
      await bridge.pushFile(JSON.stringify(remoteState));

      await engine.pullAndMerge();
      const local = await novelRepo.getNovelById(
        "kakuyomu:16817330658027210412",
      );
      expect(local?.bookmarkChapterIndex).toBe(2);
      expect(local?.bookmarkScrollProgress).toBe(0.0);
    });

    it("pullAndMerge: 同一作品でリモートとしおり話数が同じ場合、ローカルのスクロール進捗率をそのまま維持すること", async () => {
      const parser = parserRegistry.requireParser(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      const index = parser.parseNovelIndex(
        workIndexHtml,
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      await novelRepo.upsertNovelWithToc(index, "2026-10-10T00:00:00.000Z");
      await novelRepo.updateBookmark("kakuyomu:16817330658027210412", 2, 0.75);

      const remoteState: YommySyncState = {
        version: 1,
        lastSyncedAt: "2026-10-31T12:00:00.000Z",
        novels: {
          "kakuyomu:16817330658027210412": {
            id: "kakuyomu:16817330658027210412",
            siteType: "kakuyomu",
            remoteWorkId: "16817330658027210412",
            canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
            title: "境界迷宮と異界の魔術師",
            author: "小野崎",
            synopsis: "あらすじ本文",
            totalChapters: 3,
            isFavorite: 1,
            hasNewUpdate: 0,
            latestEpisodePublishedAt: "2026-10-10T10:00:00.000Z",
            bookmarkChapterIndex: 2,
            lastReadAt: "2026-10-30T10:00:00.000Z",
            readChapterIds: [],
            createdAt: "2026-10-10T00:00:00.000Z",
            updatedAt: "2026-10-30T10:00:00.000Z",
          },
        },
        deletedNovels: {},
      };
      await bridge.pushFile(JSON.stringify(remoteState));

      await engine.pullAndMerge();
      const local = await novelRepo.getNovelById(
        "kakuyomu:16817330658027210412",
      );
      expect(local?.bookmarkChapterIndex).toBe(2);
      expect(local?.bookmarkScrollProgress).toBe(0.75);
    });

    it("pullAndMerge: ローカルの lastReadAt が新しい場合、ローカルの bookmarkChapterIndex を維持すること", async () => {
      const parser = parserRegistry.requireParser(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      const index = parser.parseNovelIndex(
        workIndexHtml,
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      await novelRepo.upsertNovelWithToc(index, "2026-10-10T00:00:00.000Z");
      await novelRepo.updateBookmark("kakuyomu:16817330658027210412", 3, 0.4);

      // DB の last_read_at を新しく設定
      await db.execute("UPDATE novels SET last_read_at = ? WHERE id = ?;", [
        "2026-10-31T15:00:00.000Z",
        "kakuyomu:16817330658027210412",
      ]);

      const remoteState: YommySyncState = {
        version: 1,
        lastSyncedAt: "2026-10-31T12:00:00.000Z",
        novels: {
          "kakuyomu:16817330658027210412": {
            id: "kakuyomu:16817330658027210412",
            siteType: "kakuyomu",
            remoteWorkId: "16817330658027210412",
            canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
            title: "境界迷宮と異界の魔術師",
            author: "小野崎",
            synopsis: "あらすじ本文",
            totalChapters: 3,
            isFavorite: 1,
            hasNewUpdate: 0,
            latestEpisodePublishedAt: "2026-10-10T10:00:00.000Z",
            bookmarkChapterIndex: 1,
            lastReadAt: "2026-10-30T10:00:00.000Z",
            readChapterIds: [],
            createdAt: "2026-10-10T00:00:00.000Z",
            updatedAt: "2026-10-30T10:00:00.000Z",
          },
        },
        deletedNovels: {},
      };
      await bridge.pushFile(JSON.stringify(remoteState));

      await engine.pullAndMerge();
      const local = await novelRepo.getNovelById(
        "kakuyomu:16817330658027210412",
      );
      expect(local?.bookmarkChapterIndex).toBe(3);
      expect(local?.bookmarkScrollProgress).toBe(0.4);
    });

    it("pullAndMerge: 既読エピソード ID を両端末の和集合（Union）としてマージすること", async () => {
      const parser = parserRegistry.requireParser(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      const index = parser.parseNovelIndex(
        workIndexHtml,
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      await novelRepo.upsertNovelWithToc(index, "2026-10-10T00:00:00.000Z");

      // ローカルで第1話を既読化
      await chapterRepo.markChapterRead(
        "kakuyomu:16817330658027210412",
        1,
        true,
      );

      // リモートでは第2話（エピソードID）が既読
      const chapters = await chapterRepo.listChaptersByNovelId(
        "kakuyomu:16817330658027210412",
      );
      const secondEpId = chapters.find(
        (c) => c.chapterIndex === 2,
      )?.remoteChapterId;

      const remoteState: YommySyncState = {
        version: 1,
        lastSyncedAt: "2026-10-31T12:00:00.000Z",
        novels: {
          "kakuyomu:16817330658027210412": {
            id: "kakuyomu:16817330658027210412",
            siteType: "kakuyomu",
            remoteWorkId: "16817330658027210412",
            canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
            title: "境界迷宮と異界の魔術師",
            author: "小野崎",
            synopsis: "あらすじ本文",
            totalChapters: 3,
            isFavorite: 1,
            hasNewUpdate: 0,
            latestEpisodePublishedAt: "2026-10-10T10:00:00.000Z",
            bookmarkChapterIndex: 1,
            lastReadAt: "2026-10-10T10:00:00.000Z",
            readChapterIds: [secondEpId!],
            createdAt: "2026-10-10T00:00:00.000Z",
            updatedAt: "2026-10-10T00:00:00.000Z",
          },
        },
        deletedNovels: {},
      };
      await bridge.pushFile(JSON.stringify(remoteState));

      await engine.pullAndMerge();

      const mergedChapters = await chapterRepo.listChaptersByNovelId(
        "kakuyomu:16817330658027210412",
      );
      expect(mergedChapters.find((c) => c.chapterIndex === 1)?.isRead).toBe(
        true,
      );
      expect(mergedChapters.find((c) => c.chapterIndex === 2)?.isRead).toBe(
        true,
      );
      expect(mergedChapters.find((c) => c.chapterIndex === 3)?.isRead).toBe(
        false,
      );
    });

    it("pullAndMerge: 401 Unauthorized エラー発生時に連携解除（signOut および setCloudSyncAccountEmail(null)）へ自動フォールバックすること", async () => {
      bridge.setSimulate401(true);
      bridge.setAuthState({ status: "connected", email: "user@example.com" });
      await appSettingsRepo.setCloudSyncAccountEmail("user@example.com");

      await expect(engine.pullAndMerge()).rejects.toThrow("401");
      expect(await bridge.getAuthState()).toEqual({ status: "unlinked" });
      expect(await appSettingsRepo.getCloudSyncAccountEmail()).toBeNull();
    });

    it("pushCurrentState: ローカル DB の作品一覧および Tombstone 一覧から正しい YommySyncState を生成し bridge.pushFile を呼び出すこと", async () => {
      const parser = parserRegistry.requireParser(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      const index = parser.parseNovelIndex(
        workIndexHtml,
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      await novelRepo.upsertNovelWithToc(index, "2026-10-10T00:00:00.000Z");
      await novelRepo.updateBookmark("kakuyomu:16817330658027210412", 2, 0.3);
      await chapterRepo.markChapterRead(
        "kakuyomu:16817330658027210412",
        1,
        true,
      );

      // 他の作品を削除して Tombstone を作成
      const index2 = {
        ...index,
        remoteWorkId: "9999999",
        canonicalUrl: "https://kakuyomu.jp/works/9999999",
        title: "削除予定作品",
      };
      await novelRepo.upsertNovelWithToc(index2, "2026-10-10T00:00:00.000Z");
      await novelRepo.deleteNovel("kakuyomu:9999999");

      await engine.pushCurrentState();

      const pushedContent = bridge.getFileContent();
      expect(pushedContent).not.toBeNull();
      const pushedState = JSON.parse(pushedContent!) as YommySyncState;

      expect(pushedState.version).toBe(1);
      expect(pushedState.novels["kakuyomu:16817330658027210412"]).toBeDefined();
      expect(
        pushedState.novels["kakuyomu:16817330658027210412"]
          .bookmarkChapterIndex,
      ).toBe(2);
      expect(
        pushedState.novels["kakuyomu:16817330658027210412"].readChapterIds,
      ).toHaveLength(1);
      expect(pushedState.deletedNovels["kakuyomu:9999999"]).toBeDefined();

      const lastSynced = await appSettingsRepo.getCloudSyncLastSyncedAt();
      expect(lastSynced).toBeGreaterThan(0);
    });

    it("pushCurrentState: 既存のリモート Tombstone とローカル Tombstone がマージ（和集合）されて Push されること", async () => {
      const remoteState: YommySyncState = {
        version: 1,
        lastSyncedAt: "2026-10-31T12:00:00.000Z",
        novels: {},
        deletedNovels: {
          "kakuyomu:remote-deleted-1": "2026-10-20T00:00:00.000Z",
        },
      };
      await bridge.pushFile(JSON.stringify(remoteState));

      // ローカルで別作品を削除
      const parser = parserRegistry.requireParser(
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      const index = parser.parseNovelIndex(
        workIndexHtml,
        "https://kakuyomu.jp/works/16817330658027210412",
      );
      await novelRepo.upsertNovelWithToc(index, "2026-10-10T00:00:00.000Z");
      await novelRepo.deleteNovel("kakuyomu:16817330658027210412");

      await engine.pushCurrentState();

      const pushedContent = bridge.getFileContent();
      const pushedState = JSON.parse(pushedContent!) as YommySyncState;

      expect(
        pushedState.deletedNovels["kakuyomu:remote-deleted-1"],
      ).toBeDefined();
      expect(
        pushedState.deletedNovels["kakuyomu:16817330658027210412"],
      ).toBeDefined();
    });

    it("pushCurrentState: 401 エラー発生時に連携解除へ自動フォールバックすること", async () => {
      bridge.setSimulate401(true);
      bridge.setAuthState({ status: "connected", email: "user@example.com" });
      await appSettingsRepo.setCloudSyncAccountEmail("user@example.com");

      await expect(engine.pushCurrentState()).rejects.toThrow("401");
      expect(await bridge.getAuthState()).toEqual({ status: "unlinked" });
      expect(await appSettingsRepo.getCloudSyncAccountEmail()).toBeNull();
    });

    it("デバウンス制御: scheduleDebouncedPush が指定時間デバウンスされ、連続呼び出し時にタイマーがリセットされること", async () => {
      vi.useFakeTimers();
      const pushSpy = vi.spyOn(engine, "pushCurrentState").mockResolvedValue();

      engine.scheduleDebouncedPush(2500);
      vi.advanceTimersByTime(1000);
      expect(pushSpy).not.toHaveBeenCalled();

      // 再度スケジュール（リセット）
      engine.scheduleDebouncedPush(2500);
      vi.advanceTimersByTime(2000);
      expect(pushSpy).not.toHaveBeenCalled();

      // 2500ms 経過で実行
      vi.advanceTimersByTime(500);
      expect(pushSpy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it("cancelDebouncedPush で保留中の Push がキャンセルされること", async () => {
      vi.useFakeTimers();
      const pushSpy = vi.spyOn(engine, "pushCurrentState").mockResolvedValue();

      engine.scheduleDebouncedPush(2500);
      vi.advanceTimersByTime(1000);
      engine.cancelDebouncedPush();

      vi.advanceTimersByTime(3000);
      expect(pushSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("flushDebouncedPush で保留中の Push が即時実行されること", async () => {
      vi.useFakeTimers();
      const pushSpy = vi.spyOn(engine, "pushCurrentState").mockResolvedValue();

      engine.scheduleDebouncedPush(2500);
      expect(pushSpy).not.toHaveBeenCalled();

      await engine.flushDebouncedPush();
      expect(pushSpy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it("notifyChanged が scheduleDebouncedPush をトリガーすること", () => {
      const scheduleSpy = vi
        .spyOn(engine, "scheduleDebouncedPush")
        .mockReturnValue(Promise.resolve());

      engine.notifyChanged(2000);
      expect(scheduleSpy).toHaveBeenCalledWith(2000);
    });

    it("sync: pullAndMerge の後に pushCurrentState を順次実行すること", async () => {
      const pullSpy = vi
        .spyOn(engine, "pullAndMerge")
        .mockResolvedValue({ pulled: true, mergedNovels: 1 });
      const pushSpy = vi.spyOn(engine, "pushCurrentState").mockResolvedValue();

      const result = await engine.sync();
      expect(pullSpy).toHaveBeenCalledTimes(1);
      expect(pushSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ pulled: true, mergedNovels: 1 });
    });
  });
});

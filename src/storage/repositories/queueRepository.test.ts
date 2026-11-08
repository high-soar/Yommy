import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb } from "../adapter/inMemoryDb";
import { SqlNovelRepository } from "./novelRepository";
import { SqlQueueRepository, createQueueRepository } from "./queueRepository";
import type { ParsedNovelIndex } from "../../parsers/types";

describe("SqlQueueRepository", () => {
  let novelRepo: SqlNovelRepository;
  let queueRepo: SqlQueueRepository;

  const novelId = "kakuyomu:1177354054881162325";
  const secondNovelId = "narou:n1234ab";

  const sampleParsedIndex: ParsedNovelIndex = {
    siteType: "kakuyomu",
    remoteWorkId: "1177354054881162325",
    canonicalUrl: "https://kakuyomu.jp/works/1177354054881162325",
    title: "テスト小説",
    author: "テスト作者",
    synopsis: "あらすじ",
    nextTocPageUrl: null,
    chapters: [
      {
        chapterIndex: 1,
        remoteChapterId: "ep1",
        partTitle: "第1部",
        title: "第1話 はじまり",
        url: "https://kakuyomu.jp/works/1177354054881162325/episodes/ep1",
        publishedAt: "2026-01-01T10:00:00Z",
      },
      {
        chapterIndex: 2,
        remoteChapterId: "ep2",
        partTitle: "第1部",
        title: "第2話 仲間",
        url: "https://kakuyomu.jp/works/1177354054881162325/episodes/ep2",
        publishedAt: "2026-01-02T10:00:00Z",
      },
      {
        chapterIndex: 3,
        remoteChapterId: "ep3",
        partTitle: "第1部",
        title: "第3話 激闘",
        url: "https://kakuyomu.jp/works/1177354054881162325/episodes/ep3",
        publishedAt: "2026-01-03T10:00:00Z",
      },
    ],
  };

  const secondParsedIndex: ParsedNovelIndex = {
    siteType: "narou",
    remoteWorkId: "n1234ab",
    canonicalUrl: "https://ncode.syosetu.com/n1234ab/",
    title: "第二小説",
    author: "第二作者",
    synopsis: "あらすじ2",
    nextTocPageUrl: null,
    chapters: [
      {
        chapterIndex: 1,
        remoteChapterId: "1",
        partTitle: null,
        title: "話1",
        url: "https://ncode.syosetu.com/n1234ab/1/",
        publishedAt: "2026-01-01T00:00:00Z",
      },
    ],
  };

  beforeEach(async () => {
    const adapter = await resetTestDb();
    novelRepo = new SqlNovelRepository(adapter);
    queueRepo = new SqlQueueRepository(adapter);

    await novelRepo.upsertNovelWithToc(
      sampleParsedIndex,
      "2026-01-01T00:00:00Z",
    );
    await novelRepo.upsertNovelWithToc(
      secondParsedIndex,
      "2026-01-01T00:00:00Z",
    );
  });

  describe("createQueueRepository", () => {
    it("ファクトリ関数が SqlQueueRepository のインスタンスを生成すること", async () => {
      const adapter = await resetTestDb();
      const repo = createQueueRepository(adapter);
      expect(repo).toBeInstanceOf(SqlQueueRepository);
    });
  });

  describe("enqueueChapters", () => {
    it("空配列を渡した場合は no-op で何も追加されないこと", async () => {
      await queueRepo.enqueueChapters(novelId, []);
      const items = await queueRepo.listByNovelId(novelId);
      expect(items).toEqual([]);
    });

    it("対象エピソード群を一括登録でき、初期状態が pending となること", async () => {
      const now = "2026-01-02T10:00:00.000Z";
      await queueRepo.enqueueChapters(
        novelId,
        [
          {
            chapterIndex: 1,
            targetUrl:
              "https://kakuyomu.jp/works/1177354054881162325/episodes/ep1",
          },
          {
            chapterIndex: 2,
            targetUrl:
              "https://kakuyomu.jp/works/1177354054881162325/episodes/ep2",
          },
        ],
        now,
      );

      const items = await queueRepo.listByNovelId(novelId);
      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({
        novelId,
        chapterIndex: 1,
        targetUrl: "https://kakuyomu.jp/works/1177354054881162325/episodes/ep1",
        status: "pending",
        retryCount: 0,
        lastError: null,
        createdAt: now,
        updatedAt: now,
      });
      expect(items[1]).toMatchObject({
        novelId,
        chapterIndex: 2,
        targetUrl: "https://kakuyomu.jp/works/1177354054881162325/episodes/ep2",
        status: "pending",
        retryCount: 0,
        lastError: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    it("nowIso 省略時に現在日時が ISO8601 形式で設定されること", async () => {
      await queueRepo.enqueueChapters(novelId, [
        {
          chapterIndex: 1,
          targetUrl:
            "https://kakuyomu.jp/works/1177354054881162325/episodes/ep1",
        },
      ]);

      const items = await queueRepo.listByNovelId(novelId);
      expect(items).toHaveLength(1);
      expect(Date.parse(items[0].createdAt)).not.toBeNaN();
      expect(Date.parse(items[0].updatedAt)).not.toBeNaN();
    });

    it("既に同一 (novel_id, chapter_index) レコードが存在する場合、targetUrl更新、status=pending、lastError=nullにリセットされ、retryCountが維持されること", async () => {
      // 1. 初回登録
      await queueRepo.enqueueChapters(
        novelId,
        [
          {
            chapterIndex: 1,
            targetUrl: "https://example.com/old",
          },
        ],
        "2026-01-01T00:00:00.000Z",
      );

      // 2. failed かつ retryCount = 2, lastError を設定
      await queueRepo.updateStatus(novelId, 1, "failed", {
        incrementRetry: true,
        lastError: "ネットワークエラー",
        nowIso: "2026-01-01T01:00:00.000Z",
      });
      await queueRepo.updateStatus(novelId, 1, "failed", {
        incrementRetry: true,
        lastError: "タイムアウト",
        nowIso: "2026-01-01T02:00:00.000Z",
      });

      const beforeItems = await queueRepo.listByNovelId(novelId);
      expect(beforeItems[0].status).toBe("failed");
      expect(beforeItems[0].retryCount).toBe(2);
      expect(beforeItems[0].lastError).toBe("タイムアウト");

      // 3. 再度 enqueueChapters（再試行時など）
      const updateTime = "2026-01-02T00:00:00.000Z";
      await queueRepo.enqueueChapters(
        novelId,
        [
          {
            chapterIndex: 1,
            targetUrl: "https://example.com/new",
          },
        ],
        updateTime,
      );

      const afterItems = await queueRepo.listByNovelId(novelId);
      expect(afterItems).toHaveLength(1);
      expect(afterItems[0].targetUrl).toBe("https://example.com/new");
      expect(afterItems[0].status).toBe("pending");
      expect(afterItems[0].lastError).toBeNull();
      expect(afterItems[0].retryCount).toBe(2); // retry_count は維持される
      expect(afterItems[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
      expect(afterItems[0].updatedAt).toBe(updateTime);
    });
  });

  describe("listByNovelId", () => {
    it("キュー一覧が chapter_index 昇順で取得でき、他作品のレコードと完全分離されること", async () => {
      // 順不同で登録
      await queueRepo.enqueueChapters(novelId, [
        { chapterIndex: 3, targetUrl: "https://example.com/3" },
        { chapterIndex: 1, targetUrl: "https://example.com/1" },
        { chapterIndex: 2, targetUrl: "https://example.com/2" },
      ]);

      // 別作品のキューも登録
      await queueRepo.enqueueChapters(secondNovelId, [
        { chapterIndex: 1, targetUrl: "https://example.com/second1" },
      ]);

      const items = await queueRepo.listByNovelId(novelId);
      expect(items).toHaveLength(3);
      expect(items[0].chapterIndex).toBe(1);
      expect(items[1].chapterIndex).toBe(2);
      expect(items[2].chapterIndex).toBe(3);

      const secondItems = await queueRepo.listByNovelId(secondNovelId);
      expect(secondItems).toHaveLength(1);
      expect(secondItems[0].chapterIndex).toBe(1);
      expect(secondItems[0].targetUrl).toBe("https://example.com/second1");
    });

    it("キューが存在しない作品の場合は空配列を返すこと", async () => {
      const items = await queueRepo.listByNovelId("unknown:novel");
      expect(items).toEqual([]);
    });
  });

  describe("updateStatus", () => {
    beforeEach(async () => {
      await queueRepo.enqueueChapters(novelId, [
        { chapterIndex: 1, targetUrl: "https://example.com/1" },
      ]);
    });

    it("downloading への遷移が反映され、nowIso 省略時も updatedAt が更新されること", async () => {
      await queueRepo.updateStatus(novelId, 1, "downloading");
      const items = await queueRepo.listByNovelId(novelId);
      expect(items[0].status).toBe("downloading");
      expect(items[0].retryCount).toBe(0);
      expect(items[0].lastError).toBeNull();
    });

    it("failed への遷移時に incrementRetry: true で retryCount が加算され lastError が保存されること", async () => {
      const now = "2026-01-02T12:00:00.000Z";
      await queueRepo.updateStatus(novelId, 1, "failed", {
        incrementRetry: true,
        lastError: "503 Service Unavailable",
        nowIso: now,
      });

      const items = await queueRepo.listByNovelId(novelId);
      expect(items[0].status).toBe("failed");
      expect(items[0].retryCount).toBe(1);
      expect(items[0].lastError).toBe("503 Service Unavailable");
      expect(items[0].updatedAt).toBe(now);

      // さらに失敗（incrementRetry: true）
      await queueRepo.updateStatus(novelId, 1, "failed", {
        incrementRetry: true,
        lastError: "Timeout",
      });
      const items2 = await queueRepo.listByNovelId(novelId);
      expect(items2[0].retryCount).toBe(2);
      expect(items2[0].lastError).toBe("Timeout");
    });

    it("failed 時に lastError が未指定の場合は従前の lastError が保持されること", async () => {
      await queueRepo.updateStatus(novelId, 1, "failed", {
        lastError: "Initial error",
      });
      await queueRepo.updateStatus(novelId, 1, "failed", {});
      const items = await queueRepo.listByNovelId(novelId);
      expect(items[0].lastError).toBe("Initial error");
    });

    it("completed への遷移時に lastError 未指定の場合は last_error が NULL にクリアされること", async () => {
      // 一旦 failed でエラーを記録
      await queueRepo.updateStatus(novelId, 1, "failed", {
        lastError: "Temporary error",
      });

      // completed へ遷移（lastError は未指定）
      await queueRepo.updateStatus(novelId, 1, "completed");
      const items = await queueRepo.listByNovelId(novelId);
      expect(items[0].status).toBe("completed");
      expect(items[0].lastError).toBeNull();
    });

    it("pending への遷移時に lastError 未指定の場合は last_error が NULL にクリアされること", async () => {
      await queueRepo.updateStatus(novelId, 1, "failed", {
        lastError: "Error before retry",
      });

      await queueRepo.updateStatus(novelId, 1, "pending");
      const items = await queueRepo.listByNovelId(novelId);
      expect(items[0].status).toBe("pending");
      expect(items[0].lastError).toBeNull();
    });

    it("incrementRetry: false または省略時は retryCount が加算されないこと", async () => {
      await queueRepo.updateStatus(novelId, 1, "downloading", {
        incrementRetry: false,
      });
      const items = await queueRepo.listByNovelId(novelId);
      expect(items[0].retryCount).toBe(0);
    });

    it("存在しないレコードに対する updateStatus は例外を投げず無視されること", async () => {
      await expect(
        queueRepo.updateStatus(novelId, 999, "downloading"),
      ).resolves.toBeUndefined();
    });
  });

  describe("resetInterruptedToPending", () => {
    it("downloading 状態のレコードのみ pending に戻り、completed や failed は不変であること", async () => {
      await queueRepo.enqueueChapters(novelId, [
        { chapterIndex: 1, targetUrl: "https://example.com/1" },
        { chapterIndex: 2, targetUrl: "https://example.com/2" },
        { chapterIndex: 3, targetUrl: "https://example.com/3" },
      ]);

      await queueRepo.updateStatus(novelId, 1, "completed");
      await queueRepo.updateStatus(novelId, 2, "downloading");
      await queueRepo.updateStatus(novelId, 3, "failed", {
        lastError: "Error",
      });

      const resetTime = "2026-01-02T15:00:00.000Z";
      await queueRepo.resetInterruptedToPending(novelId, resetTime);

      const items = await queueRepo.listByNovelId(novelId);
      expect(items[0].status).toBe("completed");
      expect(items[1].status).toBe("pending");
      expect(items[1].updatedAt).toBe(resetTime);
      expect(items[2].status).toBe("failed");
      expect(items[2].lastError).toBe("Error");
    });

    it("他作品の downloading レコードは変更されないこと", async () => {
      await queueRepo.enqueueChapters(secondNovelId, [
        { chapterIndex: 1, targetUrl: "https://example.com/second1" },
      ]);
      await queueRepo.updateStatus(secondNovelId, 1, "downloading");

      await queueRepo.resetInterruptedToPending(novelId);

      const secondItems = await queueRepo.listByNovelId(secondNovelId);
      expect(secondItems[0].status).toBe("downloading");
    });

    it("nowIso 省略時にも正常に現在日時で更新されること", async () => {
      await queueRepo.enqueueChapters(novelId, [
        { chapterIndex: 1, targetUrl: "https://example.com/1" },
      ]);
      await queueRepo.updateStatus(novelId, 1, "downloading");

      await queueRepo.resetInterruptedToPending(novelId);

      const items = await queueRepo.listByNovelId(novelId);
      expect(items[0].status).toBe("pending");
      expect(Date.parse(items[0].updatedAt)).not.toBeNaN();
    });
  });

  describe("deleteByNovelAndChapters", () => {
    it("空配列を渡した場合は no-op であること", async () => {
      await queueRepo.enqueueChapters(novelId, [
        { chapterIndex: 1, targetUrl: "https://example.com/1" },
      ]);
      await queueRepo.deleteByNovelAndChapters(novelId, []);
      const items = await queueRepo.listByNovelId(novelId);
      expect(items).toHaveLength(1);
    });

    it("指定作品の指定話数のみ削除され、他話数および他作品のキューは保持されること", async () => {
      await queueRepo.enqueueChapters(novelId, [
        { chapterIndex: 1, targetUrl: "https://example.com/1" },
        { chapterIndex: 2, targetUrl: "https://example.com/2" },
        { chapterIndex: 3, targetUrl: "https://example.com/3" },
      ]);
      await queueRepo.enqueueChapters(secondNovelId, [
        { chapterIndex: 2, targetUrl: "https://example.com/second2" },
      ]);

      await queueRepo.deleteByNovelAndChapters(novelId, [1, 3]);

      const items = await queueRepo.listByNovelId(novelId);
      expect(items).toHaveLength(1);
      expect(items[0].chapterIndex).toBe(2);

      const secondItems = await queueRepo.listByNovelId(secondNovelId);
      expect(secondItems).toHaveLength(1);
      expect(secondItems[0].chapterIndex).toBe(2);
    });
  });

  describe("clearNovelQueue", () => {
    it("指定作品の全キューレコードが削除され、他作品のキューは保持されること", async () => {
      await queueRepo.enqueueChapters(novelId, [
        { chapterIndex: 1, targetUrl: "https://example.com/1" },
        { chapterIndex: 2, targetUrl: "https://example.com/2" },
      ]);
      await queueRepo.enqueueChapters(secondNovelId, [
        { chapterIndex: 1, targetUrl: "https://example.com/second1" },
      ]);

      await queueRepo.clearNovelQueue(novelId);

      const items = await queueRepo.listByNovelId(novelId);
      expect(items).toHaveLength(0);

      const secondItems = await queueRepo.listByNovelId(secondNovelId);
      expect(secondItems).toHaveLength(1);
    });
  });

  describe("clearAllQueue", () => {
    it("全作品の全キューレコードが一括削除されること", async () => {
      await queueRepo.enqueueChapters(novelId, [
        { chapterIndex: 1, targetUrl: "https://example.com/1" },
      ]);
      await queueRepo.enqueueChapters(secondNovelId, [
        { chapterIndex: 1, targetUrl: "https://example.com/second1" },
      ]);

      await queueRepo.clearAllQueue();

      expect(await queueRepo.listByNovelId(novelId)).toHaveLength(0);
      expect(await queueRepo.listByNovelId(secondNovelId)).toHaveLength(0);
    });
  });

  describe("ON DELETE CASCADE 連携", () => {
    it("親作品（novels）削除時に関連する download_queue レコードが自動削除されること", async () => {
      await queueRepo.enqueueChapters(novelId, [
        { chapterIndex: 1, targetUrl: "https://example.com/1" },
        { chapterIndex: 2, targetUrl: "https://example.com/2" },
      ]);

      expect(await queueRepo.listByNovelId(novelId)).toHaveLength(2);

      // 親作品削除
      await novelRepo.deleteNovel(novelId);

      // CASCADE により自動削除されていること
      const items = await queueRepo.listByNovelId(novelId);
      expect(items).toHaveLength(0);
    });
  });
});

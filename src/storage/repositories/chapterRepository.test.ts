import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb } from "../adapter/inMemoryDb";
import { SqlNovelRepository } from "./novelRepository";
import { SqlChapterRepository } from "./chapterRepository";
import type {
  ParsedNovelIndex,
  ParsedChapterContent,
} from "../../parsers/types";

describe("SqlChapterRepository", () => {
  let novelRepo: SqlNovelRepository;
  let chapterRepo: SqlChapterRepository;

  const novelId = "kakuyomu:1177354054881162325";

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

  beforeEach(async () => {
    const adapter = await resetTestDb();
    novelRepo = new SqlNovelRepository(adapter);
    chapterRepo = new SqlChapterRepository(adapter);
    await novelRepo.upsertNovelWithToc(
      sampleParsedIndex,
      "2026-01-01T00:00:00Z",
    );
  });

  describe("listChaptersByNovelId", () => {
    it("作品内の全エピソードが chapterIndex 昇順で取得でき bodyHtml が除外されていること", async () => {
      const chapters = await chapterRepo.listChaptersByNovelId(novelId);
      expect(chapters).toHaveLength(3);
      expect(chapters[0].chapterIndex).toBe(1);
      expect(chapters[1].chapterIndex).toBe(2);
      expect(chapters[2].chapterIndex).toBe(3);

      expect(chapters[0].title).toBe("第1話 はじまり");
      expect(chapters[0].partTitle).toBe("第1部");
      expect(chapters[0].isRead).toBe(false);
      expect(chapters[0].byteSize).toBe(0);
      expect(
        (chapters[0] as unknown as Record<string, unknown>).bodyHtml,
      ).toBeUndefined();
    });

    it("存在しない novelId の場合は空配列を返すこと", async () => {
      const chapters =
        await chapterRepo.listChaptersByNovelId("kakuyomu:not-found");
      expect(chapters).toEqual([]);
    });
  });

  describe("getChapter", () => {
    it("指定した作品・話数の ChapterRecord が取得できること", async () => {
      const chapter = await chapterRepo.getChapter(novelId, 2);
      expect(chapter).not.toBeNull();
      expect(chapter?.id).toBe("kakuyomu:1177354054881162325:2");
      expect(chapter?.novelId).toBe(novelId);
      expect(chapter?.chapterIndex).toBe(2);
      expect(chapter?.title).toBe("第2話 仲間");
      expect(chapter?.bodyHtml).toBeNull();
    });

    it("存在しない話数の場合は null を返すこと", async () => {
      const chapter = await chapterRepo.getChapter(novelId, 999);
      expect(chapter).toBeNull();
    });
  });

  describe("saveChapterBody と親作品の集計キャッシュ再計算", () => {
    it("本文を保存したときに対象エピソードが更新され親作品の cachedChapters と totalByteSize が再計算されること", async () => {
      const content1: ParsedChapterContent = {
        remoteChapterId: "ep1",
        title: "第1話 はじまり",
        bodyHtml: "<p>第1話の本文です。</p>",
        byteSize: 1200,
        prevChapterUrl: null,
        nextChapterUrl:
          "https://kakuyomu.jp/works/1177354054881162325/episodes/ep2",
      };

      await chapterRepo.saveChapterBody(
        novelId,
        1,
        content1,
        "2026-01-05T12:00:00.000Z",
      );

      // チャプターの確認
      const ch1 = await chapterRepo.getChapter(novelId, 1);
      expect(ch1?.bodyHtml).toBe("<p>第1話の本文です。</p>");
      expect(ch1?.byteSize).toBe(1200);
      expect(ch1?.downloadedAt).toBe("2026-01-05T12:00:00.000Z");

      // 親作品の集計値確認 (cachedChapters = 1, totalByteSize = 1200)
      const novel1 = await novelRepo.getNovelById(novelId);
      expect(novel1?.cachedChapters).toBe(1);
      expect(novel1?.totalByteSize).toBe(1200);

      // 第2話の本文も保存
      const content2: ParsedChapterContent = {
        remoteChapterId: "ep2",
        title: "第2話 仲間",
        bodyHtml: "<p>第2話の本文です。長めの文章。</p>",
        byteSize: 1800,
        prevChapterUrl:
          "https://kakuyomu.jp/works/1177354054881162325/episodes/ep1",
        nextChapterUrl:
          "https://kakuyomu.jp/works/1177354054881162325/episodes/ep3",
      };

      await chapterRepo.saveChapterBody(
        novelId,
        2,
        content2,
        "2026-01-05T12:01:00.000Z",
      );

      // 親作品の集計値確認 (cachedChapters = 2, totalByteSize = 3000)
      const novel2 = await novelRepo.getNovelById(novelId);
      expect(novel2?.cachedChapters).toBe(2);
      expect(novel2?.totalByteSize).toBe(3000);
    });
  });

  describe("markChapterRead", () => {
    it("既読フラグを true および false に更新できること", async () => {
      await chapterRepo.markChapterRead(novelId, 1, true);
      const ch1 = await chapterRepo.getChapter(novelId, 1);
      expect(ch1?.isRead).toBe(true);

      await chapterRepo.markChapterRead(novelId, 1, false);
      const ch1Unread = await chapterRepo.getChapter(novelId, 1);
      expect(ch1Unread?.isRead).toBe(false);
    });
  });

  describe("deleteCachedBodies と親作品の集計キャッシュ再計算", () => {
    beforeEach(async () => {
      // 1話、2話、3話の本文を保存
      await chapterRepo.saveChapterBody(
        novelId,
        1,
        {
          remoteChapterId: "ep1",
          title: "1",
          bodyHtml: "<p>1</p>",
          byteSize: 100,
          prevChapterUrl: null,
          nextChapterUrl: null,
        },
        "2026-01-05T00:00:00Z",
      );
      await chapterRepo.saveChapterBody(
        novelId,
        2,
        {
          remoteChapterId: "ep2",
          title: "2",
          bodyHtml: "<p>2</p>",
          byteSize: 200,
          prevChapterUrl: null,
          nextChapterUrl: null,
        },
        "2026-01-05T00:00:00Z",
      );
      await chapterRepo.saveChapterBody(
        novelId,
        3,
        {
          remoteChapterId: "ep3",
          title: "3",
          bodyHtml: "<p>3</p>",
          byteSize: 300,
          prevChapterUrl: null,
          nextChapterUrl: null,
        },
        "2026-01-05T00:00:00Z",
      );
      // 1話と2話を既読にする
      await chapterRepo.markChapterRead(novelId, 1, true);
      await chapterRepo.markChapterRead(novelId, 2, true);
    });

    it("options 未指定時は全キャッシュを削除し親作品の集計値が0になり既読フラグは維持されること", async () => {
      const deletedCount = await chapterRepo.deleteCachedBodies(novelId);
      expect(deletedCount).toBe(3);

      const ch1 = await chapterRepo.getChapter(novelId, 1);
      expect(ch1?.bodyHtml).toBeNull();
      expect(ch1?.byteSize).toBe(0);
      expect(ch1?.downloadedAt).toBeNull();
      expect(ch1?.isRead).toBe(true); // 既読は維持される

      const novel = await novelRepo.getNovelById(novelId);
      expect(novel?.cachedChapters).toBe(0);
      expect(novel?.totalByteSize).toBe(0);
    });

    it("onlyRead: true の場合は既読エピソードのみキャッシュが削除され未読分は維持されること", async () => {
      const deletedCount = await chapterRepo.deleteCachedBodies(novelId, {
        onlyRead: true,
      });
      expect(deletedCount).toBe(2); // 1話と2話のみ削除

      // 1話（既読）はキャッシュ削除
      const ch1 = await chapterRepo.getChapter(novelId, 1);
      expect(ch1?.bodyHtml).toBeNull();
      expect(ch1?.byteSize).toBe(0);
      expect(ch1?.isRead).toBe(true);

      // 3話（未読）はキャッシュ維持
      const ch3 = await chapterRepo.getChapter(novelId, 3);
      expect(ch3?.bodyHtml).toBe("<p>3</p>");
      expect(ch3?.byteSize).toBe(300);
      expect(ch3?.isRead).toBe(false);

      // 親作品の集計値確認 (cachedChapters = 1, totalByteSize = 300)
      const novel = await novelRepo.getNovelById(novelId);
      expect(novel?.cachedChapters).toBe(1);
      expect(novel?.totalByteSize).toBe(300);
    });
  });
});

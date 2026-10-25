import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb, initTestDb } from "../adapter/inMemoryDb";
import { SqlNovelRepository } from "./novelRepository";
import type { ParsedNovelIndex } from "../../parsers/types";

describe("SqlNovelRepository", () => {
  let repository: SqlNovelRepository;

  beforeEach(async () => {
    const adapter = await resetTestDb();
    repository = new SqlNovelRepository(adapter);
  });

  const sampleParsedIndex: ParsedNovelIndex = {
    siteType: "kakuyomu",
    remoteWorkId: "1177354054881162325",
    canonicalUrl: "https://kakuyomu.jp/works/1177354054881162325",
    title: "テスト小説タイトル",
    author: "テスト作者",
    synopsis: "テスト小説のあらすじです。",
    nextTocPageUrl: null,
    chapters: [
      {
        chapterIndex: 1,
        remoteChapterId: "ep1",
        partTitle: "第1章",
        title: "第1話 はじまり",
        url: "https://kakuyomu.jp/works/1177354054881162325/episodes/ep1",
        publishedAt: "2026-01-01T10:00:00Z",
      },
      {
        chapterIndex: 2,
        remoteChapterId: "ep2",
        partTitle: "第1章",
        title: "第2話 旅立ち",
        url: "https://kakuyomu.jp/works/1177354054881162325/episodes/ep2",
        publishedAt: "2026-01-02T10:00:00Z",
      },
    ],
  };

  describe("upsertNovelWithToc / getNovelById", () => {
    it("新規小説とその目次を登録し完全な NovelRecord が取得できること", async () => {
      const fetchedAt = "2026-01-10T12:00:00.000Z";
      const created = await repository.upsertNovelWithToc(
        sampleParsedIndex,
        fetchedAt,
      );

      expect(created.id).toBe("kakuyomu:1177354054881162325");
      expect(created.siteType).toBe("kakuyomu");
      expect(created.remoteWorkId).toBe("1177354054881162325");
      expect(created.canonicalUrl).toBe(
        "https://kakuyomu.jp/works/1177354054881162325",
      );
      expect(created.title).toBe("テスト小説タイトル");
      expect(created.author).toBe("テスト作者");
      expect(created.synopsis).toBe("テスト小説のあらすじです。");
      expect(created.totalChapters).toBe(2);
      expect(created.cachedChapters).toBe(0);
      expect(created.totalByteSize).toBe(0);
      expect(created.bookmarkChapterIndex).toBeNull();
      expect(created.bookmarkScrollProgress).toBe(0);
      expect(created.isFavorite).toBe(false);
      expect(created.lastCheckedAt).toBe(fetchedAt);
      expect(created.lastReadAt).toBeNull();
      expect(created.createdAt).toBe(fetchedAt);
      expect(created.updatedAt).toBe(fetchedAt);

      // getNovelById で同一のレコードが取得できること
      const fetched = await repository.getNovelById(
        "kakuyomu:1177354054881162325",
      );
      expect(fetched).toEqual(created);
    });

    it("存在しない novelId の場合 getNovelById は null を返すこと", async () => {
      const result = await repository.getNovelById("kakuyomu:not-found");
      expect(result).toBeNull();
    });

    it("既存小説を更新した場合にタイトルや目次が更新され既存キャッシュ・しおり・お気に入りが維持されること", async () => {
      const fetchedAt1 = "2026-01-10T12:00:00.000Z";
      await repository.upsertNovelWithToc(sampleParsedIndex, fetchedAt1);

      // しおりを更新し、お気に入りを ON に設定
      await repository.updateBookmark("kakuyomu:1177354054881162325", 1, 0.75);
      const adapter = await initTestDb();
      await adapter.execute(
        "UPDATE novels SET is_favorite = 1, cached_chapters = 1, total_byte_size = 500 WHERE id = ?;",
        ["kakuyomu:1177354054881162325"],
      );
      // 第1話に本文キャッシュと既読を設定
      await adapter.execute(
        "UPDATE chapters SET body_html = '<p>本文</p>', byte_size = 500, is_read = 1, downloaded_at = ? WHERE novel_id = ? AND chapter_index = 1;",
        ["2026-01-11T00:00:00.000Z", "kakuyomu:1177354054881162325"],
      );

      // 目次を更新（第3話を追加、タイトル・あらすじを変更）
      const updatedIndex: ParsedNovelIndex = {
        ...sampleParsedIndex,
        title: "新・テスト小説タイトル",
        synopsis: "あらすじが更新されました。",
        chapters: [
          ...sampleParsedIndex.chapters,
          {
            chapterIndex: 3,
            remoteChapterId: "ep3",
            partTitle: "第2章",
            title: "第3話 新たな仲間",
            url: "https://kakuyomu.jp/works/1177354054881162325/episodes/ep3",
            publishedAt: "2026-01-12T10:00:00Z",
          },
        ],
      };

      const fetchedAt2 = "2026-01-12T12:00:00.000Z";
      const updatedNovel = await repository.upsertNovelWithToc(
        updatedIndex,
        fetchedAt2,
      );

      expect(updatedNovel.title).toBe("新・テスト小説タイトル");
      expect(updatedNovel.synopsis).toBe("あらすじが更新されました。");
      expect(updatedNovel.totalChapters).toBe(3);
      expect(updatedNovel.cachedChapters).toBe(1); // キャッシュ数が維持されている
      expect(updatedNovel.totalByteSize).toBe(500); // サイズが維持されている
      expect(updatedNovel.bookmarkChapterIndex).toBe(1); // しおりが維持されている
      expect(updatedNovel.bookmarkScrollProgress).toBe(0.75);
      expect(updatedNovel.isFavorite).toBe(true); // お気に入りが維持されている
      expect(updatedNovel.createdAt).toBe(fetchedAt1); // 初回登録日時が維持されている
      expect(updatedNovel.lastCheckedAt).toBe(fetchedAt2); // 更新確認日時が更新されている
      expect(updatedNovel.updatedAt).toBe(fetchedAt2);

      // 第1話のキャッシュと既読フラグが維持されていることの確認
      const ch1 = await adapter.query<{
        body_html: string | null;
        byte_size: number;
        is_read: number;
      }>(
        "SELECT body_html, byte_size, is_read FROM chapters WHERE novel_id = ? AND chapter_index = 1;",
        ["kakuyomu:1177354054881162325"],
      );
      expect(ch1[0].body_html).toBe("<p>本文</p>");
      expect(ch1[0].byte_size).toBe(500);
      expect(ch1[0].is_read).toBe(1);

      // 第3話が未取得状態で追加されていることの確認
      const ch3 = await adapter.query<{
        body_html: string | null;
        byte_size: number;
        is_read: number;
      }>(
        "SELECT body_html, byte_size, is_read FROM chapters WHERE novel_id = ? AND chapter_index = 3;",
        ["kakuyomu:1177354054881162325"],
      );
      expect(ch3).toHaveLength(1);
      expect(ch3[0].body_html).toBeNull();
      expect(ch3[0].byte_size).toBe(0);
      expect(ch3[0].is_read).toBe(0);
    });

    it("話が途中に挿入されて chapter_index がずれた場合でも remote_chapter_id により本文キャッシュが正しく維持されること", async () => {
      const adapter = await initTestDb();
      await repository.upsertNovelWithToc(
        sampleParsedIndex,
        "2026-01-10T00:00:00Z",
      );

      // ep2（初期は chapter_index = 2）に本文キャッシュを保存
      await adapter.execute(
        "UPDATE chapters SET body_html = '<p>ep2の本文</p>', byte_size = 200, downloaded_at = ? WHERE novel_id = ? AND remote_chapter_id = ?;",
        ["2026-01-11T00:00:00Z", "kakuyomu:1177354054881162325", "ep2"],
      );

      // ep1 と ep2 の間に新規話 ep_new を挿入した目次で更新
      const insertedIndex: ParsedNovelIndex = {
        ...sampleParsedIndex,
        chapters: [
          {
            chapterIndex: 1,
            remoteChapterId: "ep1",
            partTitle: "第1章",
            title: "第1話 はじまり",
            url: "https://kakuyomu.jp/works/1177354054881162325/episodes/ep1",
            publishedAt: "2026-01-01T10:00:00Z",
          },
          {
            chapterIndex: 2,
            remoteChapterId: "ep_new",
            partTitle: "第1章",
            title: "第1.5話 幕間",
            url: "https://kakuyomu.jp/works/1177354054881162325/episodes/ep_new",
            publishedAt: "2026-01-01T15:00:00Z",
          },
          {
            chapterIndex: 3,
            remoteChapterId: "ep2",
            partTitle: "第1章",
            title: "第2話 旅立ち",
            url: "https://kakuyomu.jp/works/1177354054881162325/episodes/ep2",
            publishedAt: "2026-01-02T10:00:00Z",
          },
        ],
      };

      await repository.upsertNovelWithToc(
        insertedIndex,
        "2026-01-12T00:00:00Z",
      );

      // 新規挿入された ep_new（chapter_index = 2）は本文未取得であること
      const newEp = await adapter.query<{
        body_html: string | null;
        chapter_index: number;
      }>(
        "SELECT body_html, chapter_index FROM chapters WHERE novel_id = ? AND remote_chapter_id = ?;",
        ["kakuyomu:1177354054881162325", "ep_new"],
      );
      expect(newEp[0].chapter_index).toBe(2);
      expect(newEp[0].body_html).toBeNull();

      // ep2 は chapter_index が 3 に更新されつつ、本文キャッシュが維持されていること
      const ep2 = await adapter.query<{
        body_html: string | null;
        chapter_index: number;
      }>(
        "SELECT body_html, chapter_index FROM chapters WHERE novel_id = ? AND remote_chapter_id = ?;",
        ["kakuyomu:1177354054881162325", "ep2"],
      );
      expect(ep2[0].chapter_index).toBe(3);
      expect(ep2[0].body_html).toBe("<p>ep2の本文</p>");
    });
  });

  describe("listNovels", () => {
    it("作品が0件の場合は空配列を返すこと", async () => {
      const novels = await repository.listNovels();
      expect(novels).toEqual([]);
    });

    it("複数作品が閲覧日時降順（閲覧済み優先）で取得でき synopsis を除外したサマリーとなること", async () => {
      // 3作品を登録
      const n1: ParsedNovelIndex = {
        ...sampleParsedIndex,
        remoteWorkId: "1",
        canonicalUrl: "https://kakuyomu.jp/works/1",
        title: "小説1（閲覧なし）",
      };
      const n2: ParsedNovelIndex = {
        ...sampleParsedIndex,
        remoteWorkId: "2",
        canonicalUrl: "https://kakuyomu.jp/works/2",
        title: "小説2（古い閲覧）",
      };
      const n3: ParsedNovelIndex = {
        ...sampleParsedIndex,
        remoteWorkId: "3",
        canonicalUrl: "https://kakuyomu.jp/works/3",
        title: "小説3（新しい閲覧）",
      };

      await repository.upsertNovelWithToc(n1, "2026-01-01T00:00:00Z");
      await repository.upsertNovelWithToc(n2, "2026-01-02T00:00:00Z");
      await repository.upsertNovelWithToc(n3, "2026-01-03T00:00:00Z");

      // n2, n3 にしおり閲覧日を設定
      await repository.updateBookmark("kakuyomu:2", 1, 0.5); // last_read_at が設定される
      // 少し時間をあけて n3 を閲覧
      const adapter = await initTestDb();
      await adapter.execute(
        "UPDATE novels SET last_read_at = '2026-01-10T10:00:00Z' WHERE id = 'kakuyomu:2';",
      );
      await adapter.execute(
        "UPDATE novels SET last_read_at = '2026-01-10T12:00:00Z' WHERE id = 'kakuyomu:3';",
      );

      const list = await repository.listNovels();
      expect(list).toHaveLength(3);
      // n3（最新閲覧） -> n2（過去閲覧） -> n1（未閲覧）の順
      expect(list[0].id).toBe("kakuyomu:3");
      expect(list[1].id).toBe("kakuyomu:2");
      expect(list[2].id).toBe("kakuyomu:1");

      // synopsis プロパティが含まれていないことの確認
      expect(
        (list[0] as unknown as Record<string, unknown>).synopsis,
      ).toBeUndefined();
    });
  });

  describe("updateBookmark", () => {
    it("しおり話数、スクロール位置、閲覧日時が更新されること", async () => {
      await repository.upsertNovelWithToc(
        sampleParsedIndex,
        "2026-01-01T00:00:00Z",
      );

      await repository.updateBookmark("kakuyomu:1177354054881162325", 2, 0.42);

      const novel = await repository.getNovelById(
        "kakuyomu:1177354054881162325",
      );
      expect(novel).not.toBeNull();
      expect(novel?.bookmarkChapterIndex).toBe(2);
      expect(novel?.bookmarkScrollProgress).toBe(0.42);
      expect(novel?.lastReadAt).not.toBeNull();
    });
  });

  describe("deleteNovel", () => {
    it("作品削除時に CASCADE により紐づく chapters および download_queue も削除されること", async () => {
      await repository.upsertNovelWithToc(
        sampleParsedIndex,
        "2026-01-01T00:00:00Z",
      );

      const adapter = await initTestDb();
      // download_queue にもテスト用データを挿入
      await adapter.execute(
        `INSERT INTO download_queue (novel_id, chapter_index, target_url, status, created_at, updated_at)
         VALUES ('kakuyomu:1177354054881162325', 1, 'https://example.com/1', 'pending', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');`,
      );

      // 削除実行
      await repository.deleteNovel("kakuyomu:1177354054881162325");

      // novels から消えていること
      const novel = await repository.getNovelById(
        "kakuyomu:1177354054881162325",
      );
      expect(novel).toBeNull();

      // chapters からも消えていること（CASCADE）
      const chapters = await adapter.query(
        "SELECT * FROM chapters WHERE novel_id = 'kakuyomu:1177354054881162325';",
      );
      expect(chapters).toHaveLength(0);

      // download_queue からも消えていること（CASCADE）
      const queue = await adapter.query(
        "SELECT * FROM download_queue WHERE novel_id = 'kakuyomu:1177354054881162325';",
      );
      expect(queue).toHaveLength(0);
    });
  });
});

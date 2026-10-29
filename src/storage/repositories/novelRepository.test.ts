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
      expect(created.hasNewUpdate).toBe(false);
      expect(created.latestEpisodePublishedAt).toBe("2026-01-02T10:00:00.000Z");
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

    it("各話の publishedAt が未設定または無効な日付文字列の場合は latestEpisodePublishedAt が null となること", async () => {
      const indexWithoutDates: ParsedNovelIndex = {
        ...sampleParsedIndex,
        remoteWorkId: "no-dates",
        canonicalUrl: "https://kakuyomu.jp/works/no-dates",
        chapters: [
          {
            chapterIndex: 1,
            remoteChapterId: "ep1",
            partTitle: null,
            title: "第1話",
            url: "https://kakuyomu.jp/works/no-dates/ep1",
            publishedAt: null,
          },
          {
            chapterIndex: 2,
            remoteChapterId: "ep2",
            partTitle: null,
            title: "第2話",
            url: "https://kakuyomu.jp/works/no-dates/ep2",
            publishedAt: "invalid-date-string",
          },
        ],
      };

      const created = await repository.upsertNovelWithToc(
        indexWithoutDates,
        "2026-01-01T00:00:00Z",
      );
      expect(created.latestEpisodePublishedAt).toBeNull();
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
      expect(updatedNovel.hasNewUpdate).toBe(true); // 話数増加により NEW フラグが立つ
      expect(updatedNovel.latestEpisodePublishedAt).toBe(
        "2026-01-12T10:00:00.000Z",
      );

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

    it("話数が増加しない更新の場合、既存の hasNewUpdate 値が維持されること", async () => {
      await repository.upsertNovelWithToc(
        sampleParsedIndex,
        "2026-01-01T00:00:00Z",
      );

      // 話数不変で再 upsert（hasNewUpdate = false が維持される）
      const reUpsert1 = await repository.upsertNovelWithToc(
        sampleParsedIndex,
        "2026-01-02T00:00:00Z",
      );
      expect(reUpsert1.hasNewUpdate).toBe(false);

      // 意図的に has_new_update = 1 に設定した状態で話数不変の再 upsert
      const adapter = await initTestDb();
      await adapter.execute(
        "UPDATE novels SET has_new_update = 1 WHERE id = ?;",
        ["kakuyomu:1177354054881162325"],
      );

      const reUpsert2 = await repository.upsertNovelWithToc(
        sampleParsedIndex,
        "2026-01-03T00:00:00Z",
      );
      expect(reUpsert2.hasNewUpdate).toBe(true);
    });

    it("話数は同じだが既存の remote_chapter_id と異なる新規エピソードが含まれる場合に hasNewUpdate = true と判定されること", async () => {
      // 2話構成（ep1, ep2）で初期登録（hasNewUpdate = false）
      await repository.upsertNovelWithToc(
        sampleParsedIndex,
        "2026-01-01T00:00:00Z",
      );

      // 話数は同じ2話だが、ep2 が削除され ep3 に置き換わった目次
      const updatedSameCountWithNewChapter: ParsedNovelIndex = {
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
            remoteChapterId: "ep3", // 新規チャプター ID
            partTitle: "第1章",
            title: "第2話 新たなる旅立ち",
            url: "https://kakuyomu.jp/works/1177354054881162325/episodes/ep3",
            publishedAt: "2026-01-03T10:00:00Z",
          },
        ],
      };

      const result = await repository.upsertNovelWithToc(
        updatedSameCountWithNewChapter,
        "2026-01-02T00:00:00Z",
      );

      expect(result.totalChapters).toBe(2);
      expect(result.hasNewUpdate).toBe(true); // 新規チャプター ID 検知により true となること
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

  describe("clearNewUpdate", () => {
    it("clearNewUpdate 呼び出しにより has_new_update が 0 にリセットされること", async () => {
      await repository.upsertNovelWithToc(
        sampleParsedIndex,
        "2026-01-01T00:00:00Z",
      );
      const adapter = await initTestDb();
      await adapter.execute(
        "UPDATE novels SET has_new_update = 1 WHERE id = 'kakuyomu:1177354054881162325';",
      );

      await repository.clearNewUpdate("kakuyomu:1177354054881162325");

      const novel = await repository.getNovelById(
        "kakuyomu:1177354054881162325",
      );
      expect(novel?.hasNewUpdate).toBe(false);
    });
  });

  describe("updateLastCheckedAt", () => {
    it("updateLastCheckedAt 呼び出しにより last_checked_at が指定日時に更新されること", async () => {
      await repository.upsertNovelWithToc(
        sampleParsedIndex,
        "2026-01-01T00:00:00Z",
      );

      const checkedAt = "2026-02-01T15:30:00.000Z";
      await repository.updateLastCheckedAt(
        "kakuyomu:1177354054881162325",
        checkedAt,
      );

      const novel = await repository.getNovelById(
        "kakuyomu:1177354054881162325",
      );
      expect(novel?.lastCheckedAt).toBe(checkedAt);
    });
  });

  describe("listNovels と 5 種ソートクエリ", () => {
    it("作品が0件の場合は空配列を返すこと", async () => {
      const novels = await repository.listNovels();
      expect(novels).toEqual([]);
    });

    describe("各ソート順の並び順検証", () => {
      let adapter: Awaited<ReturnType<typeof initTestDb>>;

      beforeEach(async () => {
        adapter = await initTestDb();

        // 4作品（A, B, C, D）を登録
        // A: hasNewUpdate = 1, read, latestPublished = '2026-01-04'
        await repository.upsertNovelWithToc(
          {
            ...sampleParsedIndex,
            remoteWorkId: "A",
            canonicalUrl: "https://kakuyomu.jp/works/A",
            title: "alpha",
            chapters: [
              {
                chapterIndex: 1,
                remoteChapterId: "a1",
                partTitle: null,
                title: "1話",
                url: "https://kakuyomu.jp/works/A/1",
                publishedAt: "2026-01-04T00:00:00Z",
              },
            ],
          },
          "2026-01-01T00:00:00Z",
        );

        // B: hasNewUpdate = 0, read (most recent read), latestPublished = '2026-01-10' (latest)
        await repository.upsertNovelWithToc(
          {
            ...sampleParsedIndex,
            remoteWorkId: "B",
            canonicalUrl: "https://kakuyomu.jp/works/B",
            title: "Beta",
            chapters: [
              {
                chapterIndex: 1,
                remoteChapterId: "b1",
                partTitle: null,
                title: "1話",
                url: "https://kakuyomu.jp/works/B/1",
                publishedAt: "2026-01-10T00:00:00Z",
              },
            ],
          },
          "2026-01-02T00:00:00Z",
        );

        // C: hasNewUpdate = 0, unread, latestPublished = '2026-01-02'
        await repository.upsertNovelWithToc(
          {
            ...sampleParsedIndex,
            remoteWorkId: "C",
            canonicalUrl: "https://kakuyomu.jp/works/C",
            title: "Charlie",
            chapters: [
              {
                chapterIndex: 1,
                remoteChapterId: "c1",
                partTitle: null,
                title: "1話",
                url: "https://kakuyomu.jp/works/C/1",
                publishedAt: "2026-01-02T00:00:00Z",
              },
            ],
          },
          "2026-01-03T00:00:00Z",
        );

        // D: hasNewUpdate = 1, unread, latestPublished = null
        await repository.upsertNovelWithToc(
          {
            ...sampleParsedIndex,
            remoteWorkId: "D",
            canonicalUrl: "https://kakuyomu.jp/works/D",
            title: "delta",
            chapters: [
              {
                chapterIndex: 1,
                remoteChapterId: "d1",
                partTitle: null,
                title: "1話",
                url: "https://kakuyomu.jp/works/D/1",
                publishedAt: null,
              },
            ],
          },
          "2026-01-04T00:00:00Z",
        );

        // 状態を直接調整
        // A: has_new_update = 1, last_read_at = '2026-01-05T00:00:00Z'
        await adapter.execute(
          "UPDATE novels SET has_new_update = 1, last_read_at = '2026-01-05T00:00:00Z' WHERE id = 'kakuyomu:A';",
        );
        // B: has_new_update = 0, last_read_at = '2026-01-06T00:00:00Z'
        await adapter.execute(
          "UPDATE novels SET has_new_update = 0, last_read_at = '2026-01-06T00:00:00Z' WHERE id = 'kakuyomu:B';",
        );
        // C: has_new_update = 0, last_read_at = NULL
        await adapter.execute(
          "UPDATE novels SET has_new_update = 0, last_read_at = NULL WHERE id = 'kakuyomu:C';",
        );
        // D: has_new_update = 1, last_read_at = NULL
        await adapter.execute(
          "UPDATE novels SET has_new_update = 1, last_read_at = NULL WHERE id = 'kakuyomu:D';",
        );
      });

      it("デフォルト（引数なし）および 'unread_first' で更新あり優先＋最近読んだ順となること", async () => {
        const defaultList = await repository.listNovels();
        const unreadFirstList = await repository.listNovels("unread_first");

        const expectedIds = [
          "kakuyomu:A", // NEW = 1, read
          "kakuyomu:D", // NEW = 1, unread
          "kakuyomu:B", // NEW = 0, read
          "kakuyomu:C", // NEW = 0, unread
        ];

        expect(defaultList.map((n) => n.id)).toEqual(expectedIds);
        expect(unreadFirstList.map((n) => n.id)).toEqual(expectedIds);

        // synopsis がサマリーに含まれていないこと
        expect(
          (defaultList[0] as unknown as Record<string, unknown>).synopsis,
        ).toBeUndefined();
      });

      it("'last_read' で最近読んだ順（更新ありを特別扱いしない）となること", async () => {
        const list = await repository.listNovels("last_read");
        expect(list.map((n) => n.id)).toEqual([
          "kakuyomu:B", // 2026-01-06 (最新読了)
          "kakuyomu:A", // 2026-01-05 (過去読了)
          "kakuyomu:D", // 未読・created_at: 2026-01-04
          "kakuyomu:C", // 未読・created_at: 2026-01-03
        ]);
      });

      it("'latest_published' で作品更新日順（エピソード公開日最大値 DESC）となること", async () => {
        const list = await repository.listNovels("latest_published");
        expect(list.map((n) => n.id)).toEqual([
          "kakuyomu:B", // 2026-01-10
          "kakuyomu:A", // 2026-01-04
          "kakuyomu:C", // 2026-01-02
          "kakuyomu:D", // NULL (末尾)
        ]);
      });

      it("'latest_published' でタイムゾーン表記揺れ（JSTとUTC）が実時刻順に正規化されてソートされること", async () => {
        // 作品 X: JST 2026-01-02T05:00:00+09:00 (= UTC 2026-01-01T20:00:00.000Z)
        await repository.upsertNovelWithToc(
          {
            ...sampleParsedIndex,
            remoteWorkId: "timezone_X",
            canonicalUrl: "https://kakuyomu.jp/works/timezone_X",
            title: "Novel X",
            chapters: [
              {
                chapterIndex: 1,
                remoteChapterId: "x1",
                partTitle: null,
                title: "1話",
                url: "https://kakuyomu.jp/works/timezone_X/1",
                publishedAt: "2026-01-02T05:00:00+09:00",
              },
            ],
          },
          "2026-01-01T00:00:00Z",
        );

        // 作品 Y: UTC 2026-01-01T22:00:00Z (= UTC 2026-01-01T22:00:00.000Z。実時刻としては X より新しい)
        await repository.upsertNovelWithToc(
          {
            ...sampleParsedIndex,
            remoteWorkId: "timezone_Y",
            canonicalUrl: "https://kakuyomu.jp/works/timezone_Y",
            title: "Novel Y",
            chapters: [
              {
                chapterIndex: 1,
                remoteChapterId: "y1",
                partTitle: null,
                title: "1話",
                url: "https://kakuyomu.jp/works/timezone_Y/1",
                publishedAt: "2026-01-01T22:00:00Z",
              },
            ],
          },
          "2026-01-01T00:00:00Z",
        );

        const novelX = await repository.getNovelById("kakuyomu:timezone_X");
        const novelY = await repository.getNovelById("kakuyomu:timezone_Y");
        expect(novelX?.latestEpisodePublishedAt).toBe(
          "2026-01-01T20:00:00.000Z",
        );
        expect(novelY?.latestEpisodePublishedAt).toBe(
          "2026-01-01T22:00:00.000Z",
        );

        const list = await repository.listNovels("latest_published");
        const ids = list.map((n) => n.id);
        const indexY = ids.indexOf("kakuyomu:timezone_Y");
        const indexX = ids.indexOf("kakuyomu:timezone_X");
        // 実時刻で新しい Y の方が X より先（小さいインデックス）に来ること
        expect(indexY).toBeLessThan(indexX);
      });

      it("'created_at' で作品登録日降順となること", async () => {
        const list = await repository.listNovels("created_at");
        expect(list.map((n) => n.id)).toEqual([
          "kakuyomu:D", // 2026-01-04
          "kakuyomu:C", // 2026-01-03
          "kakuyomu:B", // 2026-01-02
          "kakuyomu:A", // 2026-01-01
        ]);
      });

      it("'title' でタイトル順（アルファベット大文字小文字無視昇順）となること", async () => {
        const list = await repository.listNovels("title");
        expect(list.map((n) => n.id)).toEqual([
          "kakuyomu:A", // "alpha"
          "kakuyomu:B", // "Beta"
          "kakuyomu:C", // "Charlie"
          "kakuyomu:D", // "delta"
        ]);
      });

      it("未知のソート順が渡された場合はフォールバックとして 'unread_first' が適用されること", async () => {
        const list = await repository.listNovels(
          "unknown_sort" as unknown as import("../types").BookshelfSortOrder,
        );
        expect(list.map((n) => n.id)).toEqual([
          "kakuyomu:A", // NEW = 1, read
          "kakuyomu:D", // NEW = 1, unread
          "kakuyomu:B", // NEW = 0, read
          "kakuyomu:C", // NEW = 0, unread
        ]);
      });
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

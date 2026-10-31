import { describe, it, expect, vi } from "vitest";
import {
  DDL_STATEMENTS,
  initializeDatabaseSchema,
  migrateDatabaseSchema,
} from "./schema";
import type { DatabaseAdapter } from "./adapter/types";
import { resetTestDb } from "./adapter/inMemoryDb";

describe("storage/schema", () => {
  it("DDL_STATEMENTS に必要な CREATE TABLE 文および初期行投入文が定義されていること", () => {
    expect(DDL_STATEMENTS).toContain("CREATE TABLE IF NOT EXISTS novels");
    expect(DDL_STATEMENTS).toContain("CREATE TABLE IF NOT EXISTS chapters");
    expect(DDL_STATEMENTS).toContain(
      "CREATE TABLE IF NOT EXISTS download_queue",
    );
    expect(DDL_STATEMENTS).toContain(
      "CREATE TABLE IF NOT EXISTS reader_settings",
    );
    expect(DDL_STATEMENTS).toContain("CREATE TABLE IF NOT EXISTS app_settings");
    expect(DDL_STATEMENTS).toContain(
      "CREATE TABLE IF NOT EXISTS deleted_novels",
    );
    expect(DDL_STATEMENTS).toContain("UNIQUE (novel_id, remote_chapter_id)");
    expect(DDL_STATEMENTS).toContain("INSERT OR IGNORE INTO reader_settings");
    expect(DDL_STATEMENTS).toContain("INSERT OR IGNORE INTO app_settings");
  });

  it("novels テーブルに has_new_update, latest_episode_published_at およびソート用インデックスが定義されていること", () => {
    expect(DDL_STATEMENTS).toContain(
      "has_new_update INTEGER NOT NULL DEFAULT 0",
    );
    expect(DDL_STATEMENTS).toContain("latest_episode_published_at TEXT");
    expect(DDL_STATEMENTS).toContain(
      "CREATE INDEX IF NOT EXISTS idx_novels_last_read_at",
    );
    expect(DDL_STATEMENTS).toContain(
      "CREATE INDEX IF NOT EXISTS idx_novels_has_new_update",
    );
    expect(DDL_STATEMENTS).toContain(
      "CREATE INDEX IF NOT EXISTS idx_novels_latest_published",
    );
    expect(DDL_STATEMENTS).toContain(
      "CREATE INDEX IF NOT EXISTS idx_novels_created_at",
    );
    expect(DDL_STATEMENTS).toContain(
      "CREATE INDEX IF NOT EXISTS idx_novels_title",
    );
  });

  it("app_settings テーブルに key, value, updated_at カラムおよび初期行が定義されていること", () => {
    expect(DDL_STATEMENTS).toContain("key TEXT PRIMARY KEY");
    expect(DDL_STATEMENTS).toContain("value TEXT NOT NULL");
    expect(DDL_STATEMENTS).toContain("updated_at TEXT NOT NULL");
    expect(DDL_STATEMENTS).toContain("'bookshelf_sort_order', 'unread_first'");
  });

  it("reader_settings テーブルに paging_mode カラム（CHECK制約付き）および初期行投入が定義されていること (AC-ST-13 / db-schema)", () => {
    expect(DDL_STATEMENTS).toContain(
      "paging_mode TEXT NOT NULL DEFAULT 'auto' CHECK (paging_mode IN ('auto', 'paged', 'scroll'))",
    );
    expect(DDL_STATEMENTS).toContain(
      "1, 'vertical-rl', 'light', 'biz-ud-mincho', 18, 1.8, 20, 1, 0, 'auto', '2026-01-01T00:00:00.000Z'",
    );
  });

  it("deleted_novels テーブルに id, deleted_at カラムおよびインデックスが定義されていること (db-schema)", () => {
    expect(DDL_STATEMENTS).toContain(
      "CREATE TABLE IF NOT EXISTS deleted_novels",
    );
    expect(DDL_STATEMENTS).toContain("id TEXT PRIMARY KEY");
    expect(DDL_STATEMENTS).toContain("deleted_at INTEGER NOT NULL");
    expect(DDL_STATEMENTS).toContain(
      "CREATE INDEX IF NOT EXISTS idx_deleted_novels_deleted_at ON deleted_novels(deleted_at DESC)",
    );
  });

  it("initializeDatabaseSchema が各 DDL 文を順次実行し、reader_settings および app_settings の初期行を投入すること", async () => {
    const executed: string[] = [];
    const mockDb: DatabaseAdapter = {
      execute: vi.fn(async (sql: string) => {
        executed.push(sql);
      }),
      query: vi.fn(async () => []),
      runTransaction: vi.fn(),
      close: vi.fn(),
    };

    await initializeDatabaseSchema(mockDb);
    expect(executed.length).toBeGreaterThan(0);
    expect(executed[0]).toBe("PRAGMA foreign_keys = ON");
    expect(
      executed.some((sql) =>
        sql.includes("INSERT OR IGNORE INTO reader_settings"),
      ),
    ).toBe(true);
    expect(
      executed.some((sql) =>
        sql.includes("INSERT OR IGNORE INTO app_settings"),
      ),
    ).toBe(true);
    expect(mockDb.execute).toHaveBeenCalled();
  });

  it("migrateDatabaseSchema は novels テーブルが存在しない場合は何も実行せず早期終了すること", async () => {
    const mockDb: DatabaseAdapter = {
      execute: vi.fn(),
      query: vi.fn(async () => []),
      runTransaction: vi.fn(),
      close: vi.fn(),
    };

    await migrateDatabaseSchema(mockDb);
    expect(mockDb.query).toHaveBeenCalledWith("PRAGMA table_info(novels);");
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it("migrateDatabaseSchema は対象カラムが既に存在する場合は ALTER TABLE を実行しないこと", async () => {
    const mockDb: DatabaseAdapter = {
      execute: vi.fn(),
      query: vi.fn(async () => [
        { name: "id" },
        { name: "has_new_update" },
        { name: "latest_episode_published_at" },
      ]) as unknown as DatabaseAdapter["query"],
      runTransaction: vi.fn(),
      close: vi.fn(),
    };

    await migrateDatabaseSchema(mockDb);
    expect(mockDb.query).toHaveBeenCalledWith("PRAGMA table_info(novels);");
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it("実際の SQLite データベース初期化後に novels, app_settings テーブルおよび初期行が存在すること", async () => {
    const db = await resetTestDb();

    // novels テーブル情報検証
    const novelColumns = await db.query<{ name: string }>(
      "PRAGMA table_info(novels);",
    );
    const columnNames = novelColumns.map((c) => c.name);
    expect(columnNames).toContain("has_new_update");
    expect(columnNames).toContain("latest_episode_published_at");

    // app_settings テーブル初期行検証
    const settings = await db.query<{ key: string; value: string }>(
      "SELECT key, value FROM app_settings WHERE key = 'bookshelf_sort_order';",
    );
    expect(settings).toHaveLength(1);
    expect(settings[0].value).toBe("unread_first");

    // reader_settings テーブル初期行および paging_mode カラム検証 (AC-ST-13)
    const readerSettingsColumns = await db.query<{ name: string }>(
      "PRAGMA table_info(reader_settings);",
    );
    const readerColumnNames = readerSettingsColumns.map((c) => c.name);
    expect(readerColumnNames).toContain("paging_mode");

    const readerSettingsRows = await db.query<{ paging_mode: string }>(
      "SELECT paging_mode FROM reader_settings WHERE id = 1;",
    );
    expect(readerSettingsRows).toHaveLength(1);
    expect(readerSettingsRows[0].paging_mode).toBe("auto");

    // deleted_novels テーブル存在およびカラム型検証
    const deletedNovelsColumns = await db.query<{
      name: string;
      type: string;
      pk: number;
      notnull: number;
    }>("PRAGMA table_info(deleted_novels);");
    expect(deletedNovelsColumns).toHaveLength(2);
    expect(deletedNovelsColumns.find((c) => c.name === "id")?.pk).toBe(1);
    expect(
      deletedNovelsColumns.find((c) => c.name === "deleted_at")?.notnull,
    ).toBe(1);
  });

  it("既存の v0.2 スキーマ（旧 novels テーブル）から initializeDatabaseSchema を実行した際、既存データが保持されたままカラム・インデックス・app_settings が正常に追加されること", async () => {
    const db = await resetTestDb();
    // 既存テーブルを全削除して v0.2 スキーマ（has_new_update, latest_episode_published_at なし）を手動構築
    await db.execute("DROP TABLE IF EXISTS chapters;");
    await db.execute("DROP TABLE IF EXISTS download_queue;");
    await db.execute("DROP TABLE IF EXISTS novels;");
    await db.execute("DROP TABLE IF EXISTS app_settings;");

    await db.execute(`
      CREATE TABLE novels (
        id TEXT PRIMARY KEY,
        site_type TEXT NOT NULL,
        remote_work_id TEXT NOT NULL,
        canonical_url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        author TEXT NOT NULL DEFAULT '',
        synopsis TEXT NOT NULL DEFAULT '',
        total_chapters INTEGER NOT NULL DEFAULT 0,
        cached_chapters INTEGER NOT NULL DEFAULT 0,
        total_byte_size INTEGER NOT NULL DEFAULT 0,
        bookmark_chapter_index INTEGER,
        bookmark_scroll_progress REAL NOT NULL DEFAULT 0,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        last_checked_at TEXT,
        last_read_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 既存データを投入
    await db.execute(`
      INSERT INTO novels (
        id, site_type, remote_work_id, canonical_url, title, created_at, updated_at
      ) VALUES (
        'kakuyomu:legacy_1', 'kakuyomu', 'legacy_1', 'https://kakuyomu.jp/works/legacy_1', '既存作品', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
      );
    `);

    // アップグレード実行
    await initializeDatabaseSchema(db);

    // カラムが追加されていること
    const novelColumns = await db.query<{ name: string }>(
      "PRAGMA table_info(novels);",
    );
    const columnNames = novelColumns.map((c) => c.name);
    expect(columnNames).toContain("has_new_update");
    expect(columnNames).toContain("latest_episode_published_at");

    // 既存データが保持され、新カラムの初期値（has_new_update: 0, latest_episode_published_at: null）が反映されていること
    const novels = await db.query<{
      id: string;
      title: string;
      has_new_update: number;
      latest_episode_published_at: string | null;
    }>(
      "SELECT id, title, has_new_update, latest_episode_published_at FROM novels WHERE id = 'kakuyomu:legacy_1';",
    );
    expect(novels).toHaveLength(1);
    expect(novels[0].title).toBe("既存作品");
    expect(novels[0].has_new_update).toBe(0);
    expect(novels[0].latest_episode_published_at).toBeNull();

    // 新インデックスが利用可能であること（エラーなくクエリ実行可能）
    const sortResult = await db.query(
      "SELECT id FROM novels ORDER BY has_new_update DESC, latest_episode_published_at DESC;",
    );
    expect(sortResult).toHaveLength(1);

    // app_settings も新設されていること
    const settings = await db.query<{ key: string; value: string }>(
      "SELECT key, value FROM app_settings WHERE key = 'bookshelf_sort_order';",
    );
    expect(settings).toHaveLength(1);
    expect(settings[0].value).toBe("unread_first");

    // deleted_novels も新設され、インデックスが利用可能であること
    const deletedNovels = await db.query(
      "SELECT id, deleted_at FROM deleted_novels ORDER BY deleted_at DESC;",
    );
    expect(deletedNovels).toEqual([]);
  });

  it("既存の v0.3 スキーマ（deleted_novels なし）から migrateDatabaseSchema を実行した際、deleted_novels テーブルとインデックスが安全に追加されること (AC-BS-13 / db-schema)", async () => {
    const db = await resetTestDb();
    await db.execute("DROP TABLE IF EXISTS deleted_novels;");

    // deleted_novels が存在しないことを確認
    const tablesBefore = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'deleted_novels';",
    );
    expect(tablesBefore).toHaveLength(0);

    // マイグレーション実行
    await migrateDatabaseSchema(db);

    // deleted_novels が作成されていること
    const tablesAfter = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'deleted_novels';",
    );
    expect(tablesAfter).toHaveLength(1);

    // インデックスを使用してクエリ可能であること
    await db.execute(
      "INSERT INTO deleted_novels (id, deleted_at) VALUES ('kakuyomu:del_1', 1730376000000);",
    );
    const rows = await db.query<{ id: string; deleted_at: number }>(
      "SELECT id, deleted_at FROM deleted_novels ORDER BY deleted_at DESC;",
    );
    expect(rows).toEqual([{ id: "kakuyomu:del_1", deleted_at: 1730376000000 }]);
  });

  it("既存の v0.3 スキーマ（paging_mode なしの旧 reader_settings）から migrateDatabaseSchema を実行した際、paging_mode カラムが安全に追加されること (AC-ST-13 / db-schema)", async () => {
    const db = await resetTestDb();
    // reader_settings を paging_mode なしの旧スキーマで再作成
    await db.execute("DROP TABLE IF EXISTS reader_settings;");
    await db.execute(`
      CREATE TABLE reader_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        writing_mode TEXT NOT NULL DEFAULT 'vertical-rl',
        theme TEXT NOT NULL DEFAULT 'light',
        font_family TEXT NOT NULL DEFAULT 'biz-ud-mincho',
        font_size_px INTEGER NOT NULL DEFAULT 18,
        line_height REAL NOT NULL DEFAULT 1.8,
        page_margin_px INTEGER NOT NULL DEFAULT 20,
        enable_tap_paging INTEGER NOT NULL DEFAULT 1,
        enable_volume_key_paging INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
    `);
    await db.execute(`
      INSERT INTO reader_settings (
        id, writing_mode, theme, font_family, font_size_px, line_height, page_margin_px, enable_tap_paging, enable_volume_key_paging, updated_at
      ) VALUES (
        1, 'horizontal-tb', 'sepia', 'gothic', 20, 2.0, 24, 0, 0, '2026-01-01T00:00:00.000Z'
      );
    `);

    // マイグレーション実行
    await migrateDatabaseSchema(db);

    const columns = await db.query<{ name: string }>(
      "PRAGMA table_info(reader_settings);",
    );
    expect(columns.map((c) => c.name)).toContain("paging_mode");

    // 既存の設定値が維持され、paging_mode の初期値 'auto' が適用されること
    const rows = await db.query<{
      writing_mode: string;
      theme: string;
      paging_mode: string;
    }>(
      "SELECT writing_mode, theme, paging_mode FROM reader_settings WHERE id = 1;",
    );
    expect(rows).toEqual([
      {
        writing_mode: "horizontal-tb",
        theme: "sepia",
        paging_mode: "auto",
      },
    ]);
  });
});

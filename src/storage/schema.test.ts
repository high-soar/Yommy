import { describe, it, expect, vi } from "vitest";
import { DDL_STATEMENTS, initializeDatabaseSchema } from "./schema";
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

  it("initializeDatabaseSchema が各 DDL 文を順次実行し、reader_settings および app_settings の初期行を投入すること", async () => {
    const executed: string[] = [];
    const mockDb: DatabaseAdapter = {
      execute: vi.fn(async (sql: string) => {
        executed.push(sql);
      }),
      query: vi.fn(),
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
  });
});

import { describe, it, expect, vi } from "vitest";
import { DDL_STATEMENTS, initializeDatabaseSchema } from "./schema";
import type { DatabaseAdapter } from "./adapter/types";

describe("storage/schema", () => {
  it("DDL_STATEMENTS に必要な CREATE TABLE 文が定義されていること", () => {
    expect(DDL_STATEMENTS).toContain("CREATE TABLE IF NOT EXISTS novels");
    expect(DDL_STATEMENTS).toContain("CREATE TABLE IF NOT EXISTS chapters");
    expect(DDL_STATEMENTS).toContain(
      "CREATE TABLE IF NOT EXISTS download_queue",
    );
    expect(DDL_STATEMENTS).toContain(
      "CREATE TABLE IF NOT EXISTS reader_settings",
    );
    expect(DDL_STATEMENTS).toContain("UNIQUE (novel_id, remote_chapter_id)");
  });

  it("initializeDatabaseSchema が各 DDL 文を順次実行すること", async () => {
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
    expect(mockDb.execute).toHaveBeenCalled();
  });
});

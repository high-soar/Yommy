import { describe, it, expect, vi } from "vitest";
import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { CapacitorSqliteAdapter } from "./capacitorSqlite";
import { SqlNovelRepository } from "../repositories/novelRepository";
import { SqlQueueRepository } from "../repositories/queueRepository";
import type { ParsedNovelIndex } from "../../parsers/types";

describe("CapacitorSqliteAdapter", () => {
  const createMockConnection = (
    overrides: Partial<SQLiteDBConnection> = {},
  ): SQLiteDBConnection => {
    return {
      execute: vi.fn().mockResolvedValue({ changes: { changes: 1 } }),
      run: vi.fn().mockResolvedValue({ changes: { changes: 1 } }),
      query: vi.fn().mockResolvedValue({ values: [{ id: 1, name: "test" }] }),
      beginTransaction: vi.fn().mockResolvedValue({ changes: {} }),
      commitTransaction: vi.fn().mockResolvedValue({ changes: {} }),
      rollbackTransaction: vi.fn().mockResolvedValue({ changes: {} }),
      close: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    } as unknown as SQLiteDBConnection;
  };

  describe("execute", () => {
    it("params が空または未指定の場合に connection.execute を transaction: false で呼び出すこと", async () => {
      const mockConn = createMockConnection();
      const adapter = new CapacitorSqliteAdapter(mockConn);

      await adapter.execute("CREATE TABLE foo (id INT);");
      expect(mockConn.execute).toHaveBeenCalledWith(
        "CREATE TABLE foo (id INT);",
        false,
      );
      expect(mockConn.run).not.toHaveBeenCalled();

      await adapter.execute("CREATE TABLE bar (id INT);", []);
      expect(mockConn.execute).toHaveBeenCalledWith(
        "CREATE TABLE bar (id INT);",
        false,
      );
    });

    it("params が指定された場合に connection.run を transaction: false で呼び出すこと", async () => {
      const mockConn = createMockConnection();
      const adapter = new CapacitorSqliteAdapter(mockConn);

      await adapter.execute("INSERT INTO foo (id) VALUES (?);", [42]);
      expect(mockConn.run).toHaveBeenCalledWith(
        "INSERT INTO foo (id) VALUES (?);",
        [42],
        false,
      );
      expect(mockConn.execute).not.toHaveBeenCalled();
    });

    it("connection.execute または connection.run で例外が発生した場合にスローされること", async () => {
      const mockConn = createMockConnection({
        execute: vi.fn().mockRejectedValue(new Error("execute 失敗")),
        run: vi.fn().mockRejectedValue(new Error("run 失敗")),
      });
      const adapter = new CapacitorSqliteAdapter(mockConn);

      await expect(adapter.execute("BAD SQL;")).rejects.toThrow("execute 失敗");
      await expect(
        adapter.execute("BAD SQL WITH PARAMS;", [1]),
      ).rejects.toThrow("run 失敗");
    });
  });

  describe("query", () => {
    it("connection.query を呼び出して values 配列を返すこと", async () => {
      const rows = [
        { id: 1, title: "小説A" },
        { id: 2, title: "小説B" },
      ];
      const mockConn = createMockConnection({
        query: vi.fn().mockResolvedValue({ values: rows }),
      });
      const adapter = new CapacitorSqliteAdapter(mockConn);

      const result = await adapter.query(
        "SELECT * FROM novels WHERE is_favorite = ?;",
        [1],
      );
      expect(mockConn.query).toHaveBeenCalledWith(
        "SELECT * FROM novels WHERE is_favorite = ?;",
        [1],
      );
      expect(result).toEqual(rows);
    });

    it("connection.query の結果 values が未定義または null の場合に空配列を返すこと", async () => {
      const mockConn = createMockConnection({
        query: vi.fn().mockResolvedValue({ values: undefined }),
      });
      const adapter = new CapacitorSqliteAdapter(mockConn);

      const result = await adapter.query("SELECT * FROM empty_table;");
      expect(result).toEqual([]);
    });

    it("connection.query で例外が発生した場合にスローされること", async () => {
      const mockConn = createMockConnection({
        query: vi.fn().mockRejectedValue(new Error("query 失敗")),
      });
      const adapter = new CapacitorSqliteAdapter(mockConn);

      await expect(adapter.query("SELECT * FROM invalid;")).rejects.toThrow(
        "query 失敗",
      );
    });
  });

  describe("runTransaction", () => {
    it("正常終了時に beginTransaction -> 処理実行 -> commitTransaction が呼ばれること", async () => {
      const mockConn = createMockConnection();
      const adapter = new CapacitorSqliteAdapter(mockConn);

      const res = await adapter.runTransaction(async () => {
        expect(mockConn.beginTransaction).toHaveBeenCalledTimes(1);
        expect(mockConn.commitTransaction).not.toHaveBeenCalled();
        return 12345;
      });

      expect(res).toBe(12345);
      expect(mockConn.commitTransaction).toHaveBeenCalledTimes(1);
      expect(mockConn.rollbackTransaction).not.toHaveBeenCalled();
    });

    it("処理中に例外が発生した場合に rollbackTransaction が呼ばれ例外が再スローされること", async () => {
      const mockConn = createMockConnection();
      const adapter = new CapacitorSqliteAdapter(mockConn);

      await expect(
        adapter.runTransaction(async () => {
          throw new Error("トランザクション内エラー");
        }),
      ).rejects.toThrow("トランザクション内エラー");

      expect(mockConn.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockConn.commitTransaction).not.toHaveBeenCalled();
      expect(mockConn.rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it("txAdapter 経由での execute / query および close / runTransaction 禁止が機能すること", async () => {
      const mockConn = createMockConnection();
      const adapter = new CapacitorSqliteAdapter(mockConn);

      await adapter.runTransaction(async (tx) => {
        await tx.execute("INSERT INTO foo VALUES (1);");
        await tx.query("SELECT * FROM foo;");
        await expect(tx.close()).resolves.toBeUndefined();
        await expect(tx.runTransaction(async () => {})).rejects.toThrow(
          "Nested transactions are not supported",
        );
      });

      expect(mockConn.execute).toHaveBeenCalledWith(
        "INSERT INTO foo VALUES (1);",
        false,
      );
      expect(mockConn.query).toHaveBeenCalledWith("SELECT * FROM foo;", []);
    });

    it("並行する runTransaction が mutex により直列化され 'Already in transaction' を防止すること", async () => {
      const order: string[] = [];
      const mockConn = createMockConnection({
        beginTransaction: vi.fn().mockImplementation(async () => {
          order.push("begin");
        }),
        commitTransaction: vi.fn().mockImplementation(async () => {
          order.push("commit");
        }),
      });
      const adapter = new CapacitorSqliteAdapter(mockConn);

      let tx1Resolve: () => void;
      const tx1Wait = new Promise<void>((r) => {
        tx1Resolve = r;
      });

      const p1 = adapter.runTransaction(async () => {
        order.push("tx1-start");
        await tx1Wait;
        order.push("tx1-end");
      });

      const p2 = adapter.runTransaction(async () => {
        order.push("tx2-start");
        order.push("tx2-end");
      });

      // マイクロタスクを進めて tx1 が開始されるのを待つ
      await new Promise((r) => setTimeout(r, 10));

      // tx1 が実行中の時点では tx2 の beginTransaction はまだ呼ばれていない
      expect(order).toEqual(["begin", "tx1-start"]);

      tx1Resolve!();
      await Promise.all([p1, p2]);

      expect(order).toEqual([
        "begin",
        "tx1-start",
        "tx1-end",
        "commit",
        "begin",
        "tx2-start",
        "tx2-end",
        "commit",
      ]);
    });

    it("トランザクション実行中に外から呼び出された execute / query がコミット完了まで待機すること", async () => {
      const order: string[] = [];
      const mockConn = createMockConnection({
        beginTransaction: vi.fn().mockImplementation(async () => {
          order.push("tx-begin");
        }),
        commitTransaction: vi.fn().mockImplementation(async () => {
          order.push("tx-commit");
        }),
        execute: vi.fn().mockImplementation(async () => {
          order.push("ext-execute");
        }),
        query: vi.fn().mockImplementation(async () => {
          order.push("ext-query");
          return { values: [] };
        }),
      });
      const adapter = new CapacitorSqliteAdapter(mockConn);

      let txResolve: () => void;
      const txWait = new Promise<void>((r) => {
        txResolve = r;
      });

      const txPromise = adapter.runTransaction(async () => {
        order.push("tx-body");
        await txWait;
      });

      const extExecPromise = adapter.execute("EXTERNAL EXECUTE;");
      const extQueryPromise = adapter.query("EXTERNAL QUERY;");

      // マイクロタスクを進めて tx が実行中であることを確認
      await new Promise((r) => setTimeout(r, 10));

      expect(order).toEqual(["tx-begin", "tx-body"]);

      txResolve!();
      await Promise.all([txPromise, extExecPromise, extQueryPromise]);

      expect(order).toEqual([
        "tx-begin",
        "tx-body",
        "tx-commit",
        "ext-execute",
        "ext-query",
      ]);
    });

    it("前のタスクが例外で失敗しても後続の操作が中断されず実行されること", async () => {
      const mockConn = createMockConnection();
      const adapter = new CapacitorSqliteAdapter(mockConn);

      await expect(
        adapter.runTransaction(async () => {
          throw new Error("先行失敗");
        }),
      ).rejects.toThrow("先行失敗");

      // 後続の execute が正常に実行できること
      await expect(adapter.execute("SELECT 1;")).resolves.toBeUndefined();
    });
  });

  describe("close", () => {
    it("connection.close を呼び出すこと", async () => {
      const mockConn = createMockConnection();
      const adapter = new CapacitorSqliteAdapter(mockConn);

      await adapter.close();
      expect(mockConn.close).toHaveBeenCalledTimes(1);
    });

    it("connection.close で例外が発生した場合にスローされること", async () => {
      const mockConn = createMockConnection({
        close: vi.fn().mockRejectedValue(new Error("close 失敗")),
      });
      const adapter = new CapacitorSqliteAdapter(mockConn);

      await expect(adapter.close()).rejects.toThrow("close 失敗");
    });
  });

  describe("リポジトリとのトランザクション統合（再帰デッドロック防止）", () => {
    it("SqlNovelRepository.upsertNovelWithToc が mutex 直列化アダプター下でデッドロックせず正常終了すること", async () => {
      const mockConn = createMockConnection({
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes("FROM novels WHERE id = ?")) {
            return {
              values: [
                {
                  id: "narou:n1234",
                  site_type: "narou",
                  remote_work_id: "n1234",
                  canonical_url: "https://ncode.syosetu.com/n1234/",
                  title: "テスト小説",
                  author: "テスト作者",
                  synopsis: "あらすじ",
                  total_chapters: 1,
                  cached_chapters: 0,
                  total_byte_size: 0,
                  bookmark_chapter_index: null,
                  bookmark_scroll_progress: 0,
                  is_favorite: 0,
                  has_new_update: 0,
                  latest_episode_published_at: null,
                  last_checked_at: null,
                  last_read_at: null,
                  created_at: "2026-01-01T00:00:00.000Z",
                  updated_at: "2026-01-01T00:00:00.000Z",
                },
              ],
            };
          }
          if (sql.includes("SELECT remote_chapter_id FROM chapters")) {
            return { values: [] };
          }
          if (
            sql.includes(
              "SELECT remote_chapter_id, chapter_index FROM chapters",
            )
          ) {
            return { values: [] };
          }
          return { values: [] };
        }),
      });
      const adapter = new CapacitorSqliteAdapter(mockConn);
      const repo = new SqlNovelRepository(adapter);

      const parsedIndex: ParsedNovelIndex = {
        siteType: "narou",
        remoteWorkId: "n1234",
        canonicalUrl: "https://ncode.syosetu.com/n1234/",
        title: "テスト小説",
        author: "テスト作者",
        synopsis: "あらすじ",
        nextTocPageUrl: null,
        chapters: [
          {
            chapterIndex: 1,
            remoteChapterId: "1",
            partTitle: null,
            title: "第1話",
            url: "https://ncode.syosetu.com/n1234/1/",
            publishedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      };

      const deadlockTimeout = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Deadlock detected in upsertNovelWithToc")),
          300,
        ),
      );

      const result = await Promise.race([
        repo.upsertNovelWithToc(parsedIndex, "2026-01-01T00:00:00.000Z"),
        deadlockTimeout,
      ]);

      expect(result).not.toBeNull();
      expect(mockConn.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockConn.commitTransaction).toHaveBeenCalledTimes(1);
    });

    it("SqlQueueRepository.enqueueChapters が mutex 直列化アダプター下でデッドロックせず正常終了すること", async () => {
      const mockConn = createMockConnection();
      const adapter = new CapacitorSqliteAdapter(mockConn);
      const repo = new SqlQueueRepository(adapter);

      const deadlockTimeout = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Deadlock detected in enqueueChapters")),
          300,
        ),
      );

      await Promise.race([
        repo.enqueueChapters("narou:n1234", [
          { chapterIndex: 1, targetUrl: "https://ncode.syosetu.com/n1234/1/" },
        ]),
        deadlockTimeout,
      ]);

      expect(mockConn.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockConn.commitTransaction).toHaveBeenCalledTimes(1);
    });
  });
});

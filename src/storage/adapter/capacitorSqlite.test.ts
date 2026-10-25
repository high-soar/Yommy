import { describe, it, expect, vi } from "vitest";
import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { CapacitorSqliteAdapter } from "./capacitorSqlite";

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
});

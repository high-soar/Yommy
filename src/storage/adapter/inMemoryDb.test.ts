import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryDatabaseAdapter,
  initTestDb,
  resetTestDb,
  closeTestDb,
  createInMemoryDb,
} from "./inMemoryDb";

describe("InMemoryDatabaseAdapter", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  describe("初期化とリセット (initTestDb / resetTestDb)", () => {
    it("initTestDb で6つのテーブルが定義され reader_settings の初期行が挿入されること", async () => {
      const adapter = await initTestDb();
      expect(adapter).toBeInstanceOf(InMemoryDatabaseAdapter);

      // 各テーブルの存在確認（全6テーブル）
      const tables = await adapter.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC;",
      );
      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toHaveLength(6);
      expect(tableNames).toContain("novels");
      expect(tableNames).toContain("chapters");
      expect(tableNames).toContain("download_queue");
      expect(tableNames).toContain("reader_settings");
      expect(tableNames).toContain("app_settings");
      expect(tableNames).toContain("deleted_novels");

      // reader_settings の初期行確認
      const settings = await adapter.query<{
        id: number;
        writing_mode: string;
        theme: string;
        font_family: string;
        font_size_px: number;
        line_height: number;
        page_margin_px: number;
        enable_tap_paging: number;
        enable_volume_key_paging: number;
      }>("SELECT * FROM reader_settings WHERE id = 1;");

      expect(settings).toHaveLength(1);
      expect(settings[0]).toMatchObject({
        id: 1,
        writing_mode: "vertical-rl",
        theme: "light",
        font_family: "biz-ud-mincho",
        font_size_px: 18,
        line_height: 1.8,
        page_margin_px: 20,
        enable_tap_paging: 1,
        enable_volume_key_paging: 0,
      });
    });

    it("initTestDb を連続して呼び出した場合は同一のキャッシュ済みアダプターインスタンスを返すこと", async () => {
      const adapter1 = await initTestDb();
      const adapter2 = await initTestDb();
      expect(adapter1).toBe(adapter2);
    });

    it("closeTestDb でクローズした後に initTestDb を呼び出した場合は新規初期化が実行されること", async () => {
      await closeTestDb();
      const adapter = await initTestDb();
      expect(adapter).toBeInstanceOf(InMemoryDatabaseAdapter);
    });

    it("resetTestDb でデータがクリアされ初期状態に決定論的にリセットされること", async () => {
      const adapter = await resetTestDb();

      // データを挿入
      await adapter.execute(
        `INSERT INTO novels (id, site_type, remote_work_id, canonical_url, title, created_at, updated_at)
         VALUES ('narou:n1234', 'narou', 'n1234', 'https://ncode.syosetu.com/n1234/', 'テスト作品', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');`,
      );

      const beforeReset = await adapter.query("SELECT * FROM novels;");
      expect(beforeReset).toHaveLength(1);

      // リセット実行
      const resetAdapter = await resetTestDb();
      const afterReset = await resetAdapter.query("SELECT * FROM novels;");
      expect(afterReset).toHaveLength(0);

      // 初期設定行は復元されていること
      const settings = await resetAdapter.query(
        "SELECT * FROM reader_settings WHERE id = 1;",
      );
      expect(settings).toHaveLength(1);
    });

    it("PRAGMA foreign_keys = ON が有効化されており外部キー制約違反で例外がスローされること", async () => {
      const adapter = await resetTestDb();

      // 親テーブル novels に存在しない novel_id を chapters に挿入
      await expect(
        adapter.execute(
          `INSERT INTO chapters (id, novel_id, chapter_index, remote_chapter_id, title, url)
           VALUES ('non-existent:1', 'non-existent', 1, 'ep1', '第1話', 'https://example.com/1');`,
        ),
      ).rejects.toThrow();
    });
  });

  describe("execute / query", () => {
    it("パラメータなしおよびパラメータありの execute と query が正常動作すること", async () => {
      const adapter = await resetTestDb();

      await adapter.execute(
        "CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT);",
      );
      await adapter.execute("INSERT INTO test_table (name) VALUES (?);", [
        "Alice",
      ]);
      await adapter.execute("INSERT INTO test_table (name) VALUES (?);", [
        "Bob",
      ]);

      const allRows = await adapter.query<{ id: number; name: string }>(
        "SELECT * FROM test_table ORDER BY id ASC;",
      );
      expect(allRows).toHaveLength(2);
      expect(allRows[0].name).toBe("Alice");
      expect(allRows[1].name).toBe("Bob");

      const filtered = await adapter.query<{ id: number; name: string }>(
        "SELECT * FROM test_table WHERE name = ?;",
        ["Alice"],
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);

      const notFound = await adapter.query<{ id: number; name: string }>(
        "SELECT * FROM test_table WHERE name = ?;",
        ["Charlie"],
      );
      expect(notFound).toHaveLength(0);

      // boolean パラメータの正規化テスト（true -> 1, false -> 0）
      await adapter.execute("CREATE TABLE bool_table (id INT, flag INTEGER);");
      await adapter.execute("INSERT INTO bool_table VALUES (?, ?);", [1, true]);
      await adapter.execute("INSERT INTO bool_table VALUES (?, ?);", [
        2,
        false,
      ]);

      const trueRows = await adapter.query<{ id: number; flag: number }>(
        "SELECT * FROM bool_table WHERE flag = ?;",
        [true],
      );
      expect(trueRows).toHaveLength(1);
      expect(trueRows[0].id).toBe(1);

      const falseRows = await adapter.query<{ id: number; flag: number }>(
        "SELECT * FROM bool_table WHERE flag = ?;",
        [false],
      );
      expect(falseRows).toHaveLength(1);
      expect(falseRows[0].id).toBe(2);

      // undefined パラメータの正規化テスト（undefined -> null）
      await adapter.execute("INSERT INTO test_table VALUES (?, ?);", [
        3,
        undefined,
      ]);
      const nullRows = await adapter.query<{ id: number; name: string | null }>(
        "SELECT * FROM test_table WHERE id = ?;",
        [3],
      );
      expect(nullRows).toHaveLength(1);
      expect(nullRows[0].name).toBeNull();
    });

    it("不正な SQL 構文の場合に execute および query で例外がスローされること", async () => {
      const adapter = await resetTestDb();

      await expect(adapter.execute("INVALID SQL STATEMENT;")).rejects.toThrow();
      await expect(
        adapter.query("SELECT * FROM non_existent_table;"),
      ).rejects.toThrow();
    });
  });

  describe("runTransaction", () => {
    it("トランザクション内で正常完了した処理がコミットされること", async () => {
      const adapter = await resetTestDb();

      const result = await adapter.runTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO novels (id, site_type, remote_work_id, canonical_url, title, created_at, updated_at)
           VALUES ('t:1', 'kakuyomu', '1', 'https://kakuyomu.jp/works/1', 'タイトル1', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');`,
        );
        return "SUCCESS";
      });

      expect(result).toBe("SUCCESS");
      const rows = await adapter.query(
        "SELECT * FROM novels WHERE id = 't:1';",
      );
      expect(rows).toHaveLength(1);
    });

    it("トランザクション内でエラーが発生したときにロールバックされ例外がスローされること", async () => {
      const adapter = await resetTestDb();

      await expect(
        adapter.runTransaction(async (tx) => {
          await tx.execute(
            `INSERT INTO novels (id, site_type, remote_work_id, canonical_url, title, created_at, updated_at)
             VALUES ('t:rollback', 'kakuyomu', 'rb', 'https://kakuyomu.jp/works/rb', 'タイトルRB', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');`,
          );
          throw new Error("意図的なエラー");
        }),
      ).rejects.toThrow("意図的なエラー");

      const rows = await adapter.query(
        "SELECT * FROM novels WHERE id = 't:rollback';",
      );
      expect(rows).toHaveLength(0);
    });

    it("txAdapter 経由での execute / query および close / runTransaction 禁止が機能すること (R3-02)", async () => {
      const adapter = await resetTestDb();

      await adapter.runTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO novels (id, site_type, remote_work_id, canonical_url, title, created_at, updated_at)
           VALUES ('t:tx_adapter', 'kakuyomu', 'tx', 'https://kakuyomu.jp/works/tx', 'タイトルTX', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');`,
        );
        const inTxRows = await tx.query<{ id: string }>(
          "SELECT id FROM novels WHERE id = 't:tx_adapter';",
        );
        expect(inTxRows).toHaveLength(1);
        await expect(tx.close()).resolves.toBeUndefined();
        await expect(tx.runTransaction(async () => {})).rejects.toThrow(
          "Nested transactions are not supported",
        );
      });

      const rows = await adapter.query(
        "SELECT id FROM novels WHERE id = 't:tx_adapter';",
      );
      expect(rows).toHaveLength(1);
    });

    it("runTransaction 実行中の外部 execute / query が統一 mutex により直列化されること (R3-02)", async () => {
      const adapter = await resetTestDb();
      const events: string[] = [];
      let txStarted = false;

      const txPromise = adapter.runTransaction(async (tx) => {
        events.push("tx:start");
        txStarted = true;
        await new Promise((resolve) => setTimeout(resolve, 30));
        await tx.execute(
          `INSERT INTO novels (id, site_type, remote_work_id, canonical_url, title, created_at, updated_at)
           VALUES ('t:outer_sync', 'kakuyomu', 'os', 'https://kakuyomu.jp/works/os', 'タイトルOS', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');`,
        );
        events.push("tx:end");
        return "tx_done";
      });

      while (!txStarted) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }

      const extQueryPromise = (async () => {
        events.push("extQuery:wait");
        const rows = await adapter.query<{ id: string }>(
          "SELECT id FROM novels WHERE id = 't:outer_sync';",
        );
        events.push("extQuery:done");
        return rows;
      })();

      const [txRes, extRows] = await Promise.all([txPromise, extQueryPromise]);
      expect(txRes).toBe("tx_done");
      expect(extRows).toEqual([{ id: "t:outer_sync" }]);
      expect(events).toEqual([
        "tx:start",
        "extQuery:wait",
        "tx:end",
        "extQuery:done",
      ]);
    });

    it("並行する runTransaction が直列化され順序正しく実行されること (R2-07)", async () => {
      const adapter = await resetTestDb();
      const events: string[] = [];

      const tx1 = adapter.runTransaction(async (tx) => {
        events.push("tx1:start");
        await new Promise((resolve) => setTimeout(resolve, 20));
        await tx.execute(
          `INSERT INTO novels (id, site_type, remote_work_id, canonical_url, title, created_at, updated_at)
           VALUES ('t:parallel1', 'kakuyomu', 'p1', 'https://kakuyomu.jp/works/p1', '並行1', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');`,
        );
        events.push("tx1:end");
        return "res1";
      });

      const tx2 = adapter.runTransaction(async (tx) => {
        events.push("tx2:start");
        await tx.execute(
          `INSERT INTO novels (id, site_type, remote_work_id, canonical_url, title, created_at, updated_at)
           VALUES ('t:parallel2', 'kakuyomu', 'p2', 'https://kakuyomu.jp/works/p2', '並行2', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');`,
        );
        events.push("tx2:end");
        return "res2";
      });

      const results = await Promise.all([tx1, tx2]);
      expect(results).toEqual(["res1", "res2"]);
      expect(events).toEqual(["tx1:start", "tx1:end", "tx2:start", "tx2:end"]);

      const rows = await adapter.query(
        "SELECT id FROM novels ORDER BY id ASC;",
      );
      expect(rows).toEqual([{ id: "t:parallel1" }, { id: "t:parallel2" }]);
    });

    it("先行する runTransaction がエラーでロールバックしても後続の runTransaction が正常に直列実行されること (R2-07)", async () => {
      const adapter = await resetTestDb();
      const events: string[] = [];

      const txFail = adapter.runTransaction(async (tx) => {
        events.push("fail:start");
        await new Promise((resolve) => setTimeout(resolve, 20));
        await tx.execute(
          `INSERT INTO novels (id, site_type, remote_work_id, canonical_url, title, created_at, updated_at)
           VALUES ('t:fail', 'kakuyomu', 'fail', 'https://kakuyomu.jp/works/fail', '失敗', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');`,
        );
        events.push("fail:error");
        throw new Error("意図的エラー");
      });

      const txSuccess = adapter.runTransaction(async (tx) => {
        events.push("success:start");
        await tx.execute(
          `INSERT INTO novels (id, site_type, remote_work_id, canonical_url, title, created_at, updated_at)
           VALUES ('t:success', 'kakuyomu', 'ok', 'https://kakuyomu.jp/works/ok', '成功', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');`,
        );
        events.push("success:end");
        return "ok";
      });

      await expect(txFail).rejects.toThrow("意図的エラー");
      const successResult = await txSuccess;
      expect(successResult).toBe("ok");
      expect(events).toEqual([
        "fail:start",
        "fail:error",
        "success:start",
        "success:end",
      ]);

      const rows = await adapter.query("SELECT id FROM novels;");
      expect(rows).toEqual([{ id: "t:success" }]);
    });
  });

  describe("close", () => {
    it("close を呼び出して正常にクローズできること", async () => {
      const adapter = await initTestDb();
      await expect(adapter.close()).resolves.toBeUndefined();
    });
  });

  describe("エクスポート・リストア・更新コールバック (exportBinary / onUpdate)", () => {
    it("exportBinary でバイナリを抽出し、初期データとしてリストアできること", async () => {
      const adapter = await resetTestDb();
      await adapter.execute(
        `INSERT INTO novels (id, site_type, remote_work_id, canonical_url, title, created_at, updated_at)
         VALUES ('backup:1', 'kakuyomu', 'b1', 'https://kakuyomu.jp/works/b1', 'バックアップ作品', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');`,
      );

      const binary = adapter.exportBinary();
      expect(binary).toBeInstanceOf(Uint8Array);
      expect(binary.length).toBeGreaterThan(0);

      // バイナリから復元
      const restoredAdapter = await resetTestDb(binary);
      const rows = await restoredAdapter.query<{ id: string; title: string }>(
        "SELECT id, title FROM novels WHERE id = 'backup:1';",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe("バックアップ作品");
    });

    it("execute および runTransaction の成功時に onUpdate コールバックが呼び出されること", async () => {
      let callCount = 0;
      const onUpdate = () => {
        callCount++;
      };

      const adapter = await resetTestDb(undefined, onUpdate);
      expect(callCount).toBe(0);

      await adapter.execute(
        "CREATE TABLE update_test (id INTEGER PRIMARY KEY);",
      );
      expect(callCount).toBe(1);

      await adapter.runTransaction(async (tx) => {
        await tx.execute("INSERT INTO update_test VALUES (1);");
      });
      // runTransaction 完了時に発火
      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    it("createInMemoryDb で独立したインメモリ DB アダプターを生成できること", async () => {
      const adapter = await createInMemoryDb();
      expect(adapter).toBeInstanceOf(InMemoryDatabaseAdapter);
      const rows = await adapter.query("SELECT * FROM reader_settings;");
      expect(rows).toHaveLength(1);
      await adapter.close();
    });
  });
});

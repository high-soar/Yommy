import type { Database, SqlValue } from "sql.js";
import initSqlJs from "sql.js/dist/sql-wasm-inline.js";
import type { DatabaseAdapter } from "./types";
import { DDL_STATEMENTS } from "../schema";

/**
 * テスト・ブラウザ環境向けのインメモリ SQLite アダプター
 */
export class InMemoryDatabaseAdapter implements DatabaseAdapter {
  private inTransaction = false;
  private mutex: Promise<void> = Promise.resolve();

  constructor(
    private db: Database,
    private onUpdate?: () => void,
  ) {}

  private lock<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.mutex.then(
      () => operation(),
      () => operation(),
    );
    this.mutex = next.then(
      () => {},
      () => {},
    );
    return next;
  }

  private normalizeParams(params: unknown[]): SqlValue[] {
    return params.map((p) => {
      if (typeof p === "boolean") {
        return p ? 1 : 0;
      }
      if (p === undefined) {
        return null;
      }
      return p as SqlValue;
    });
  }

  private rawExecute(sql: string, params: unknown[] = []): void {
    if (params.length > 0) {
      this.db.run(sql, this.normalizeParams(params));
    } else {
      this.db.run(sql);
    }
  }

  private rawQuery<T = unknown>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql);
    try {
      if (params.length > 0) {
        stmt.bind(this.normalizeParams(params));
      }
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    return this.lock(async () => {
      this.rawExecute(sql, params);
      if (!this.inTransaction) {
        this.onUpdate?.();
      }
    });
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.lock(async () => {
      return this.rawQuery<T>(sql, params);
    });
  }

  async runTransaction<T>(
    action: (tx: DatabaseAdapter) => Promise<T>,
  ): Promise<T> {
    return this.lock(async () => {
      this.inTransaction = true;
      this.rawExecute("BEGIN TRANSACTION;");
      try {
        const txAdapter: DatabaseAdapter = {
          execute: async (sql, params = []) => {
            this.rawExecute(sql, params);
          },
          query: async <R = unknown>(sql: string, params: unknown[] = []) => {
            return this.rawQuery<R>(sql, params);
          },
          runTransaction: async () => {
            throw new Error("Nested transactions are not supported");
          },
          close: () => Promise.resolve(),
        };
        const result = await action(txAdapter);
        this.rawExecute("COMMIT;");
        this.inTransaction = false;
        this.onUpdate?.();
        return result;
      } catch (err) {
        this.inTransaction = false;
        this.rawExecute("ROLLBACK;");
        throw err;
      }
    });
  }

  async close(): Promise<void> {
    return this.lock(async () => {
      this.db.close();
    });
  }

  /**
   * 現在の SQLite データベースのバイナリ（Uint8Array）をエクスポートする
   */
  exportBinary(): Uint8Array {
    return this.db.export();
  }
}

/**
 * 新規のインメモリ SQLite アダプターを生成する
 */
export async function createInMemoryDb(
  initialData?: Uint8Array,
  onUpdate?: () => void,
): Promise<InMemoryDatabaseAdapter> {
  const SQL = await initSqlJs();
  const db = initialData ? new SQL.Database(initialData) : new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  if (!initialData) {
    db.exec(DDL_STATEMENTS);
  }
  return new InMemoryDatabaseAdapter(db, onUpdate);
}

let currentAdapter: InMemoryDatabaseAdapter | null = null;

/**
 * テスト用インメモリ DB アダプターを取得（初期化済みならキャッシュを返す）
 */
export async function initTestDb(
  initialData?: Uint8Array,
  onUpdate?: () => void,
): Promise<InMemoryDatabaseAdapter> {
  if (currentAdapter) {
    return currentAdapter;
  }
  return await resetTestDb(initialData, onUpdate);
}

/**
 * テスト用インメモリ DB アダプターをクローズし、キャッシュを破棄する
 */
export async function closeTestDb(): Promise<void> {
  if (currentAdapter) {
    await currentAdapter.close();
    currentAdapter = null;
  }
}

/**
 * テスト用インメモリ DB を初期化・リセットする
 * initialData が渡された場合はそのバイナリで復元し、渡されない場合は DDL と初期設定を流す
 */
export async function resetTestDb(
  initialData?: Uint8Array,
  onUpdate?: () => void,
): Promise<InMemoryDatabaseAdapter> {
  await closeTestDb();
  currentAdapter = await createInMemoryDb(initialData, onUpdate);
  return currentAdapter;
}

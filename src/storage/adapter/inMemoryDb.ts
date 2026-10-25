import type { Database, SqlValue } from "sql.js";
import initSqlJs from "sql.js/dist/sql-wasm-inline.js";
import type { DatabaseAdapter } from "./types";
import { DDL_STATEMENTS } from "../schema";

const INITIAL_READER_SETTINGS_SQL = `
INSERT INTO reader_settings (
  id, writing_mode, theme, font_family, font_size_px, line_height, page_margin_px, enable_tap_paging, enable_volume_key_paging, updated_at
) VALUES (
  1, 'vertical-rl', 'light', 'biz-ud-mincho', 18, 1.8, 20, 1, 0, '2026-01-01T00:00:00.000Z'
);
`;

/**
 * テスト・ブラウザ環境向けのインメモリ SQLite アダプター
 */
export class InMemoryDatabaseAdapter implements DatabaseAdapter {
  private inTransaction = false;

  constructor(
    private db: Database,
    private onUpdate?: () => void,
  ) {}

  private normalizeParams(params: unknown[]): SqlValue[] {
    return params.map((p) => {
      if (typeof p === "boolean") {
        return p ? 1 : 0;
      }
      return p as SqlValue;
    });
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    if (params.length > 0) {
      this.db.run(sql, this.normalizeParams(params));
    } else {
      this.db.run(sql);
    }
    if (!this.inTransaction) {
      this.onUpdate?.();
    }
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
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

  async runTransaction<T>(action: () => Promise<T>): Promise<T> {
    this.inTransaction = true;
    this.db.run("BEGIN TRANSACTION;");
    try {
      const result = await action();
      this.db.run("COMMIT;");
      this.inTransaction = false;
      this.onUpdate?.();
      return result;
    } catch (err) {
      this.inTransaction = false;
      this.db.run("ROLLBACK;");
      throw err;
    }
  }

  async close(): Promise<void> {
    this.db.close();
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
    db.exec(INITIAL_READER_SETTINGS_SQL);
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

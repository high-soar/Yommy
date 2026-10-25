import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import type { DatabaseAdapter } from "./types";

export class CapacitorSqliteAdapter implements DatabaseAdapter {
  constructor(private connection: SQLiteDBConnection) {}

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    if (params.length > 0) {
      await this.connection.run(sql, params, false);
    } else {
      await this.connection.execute(sql, false);
    }
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const res = await this.connection.query(sql, params);
    return (res.values ?? []) as T[];
  }

  async runTransaction<T>(action: () => Promise<T>): Promise<T> {
    await this.connection.beginTransaction();
    try {
      const result = await action();
      await this.connection.commitTransaction();
      return result;
    } catch (err) {
      await this.connection.rollbackTransaction();
      throw err;
    }
  }

  async close(): Promise<void> {
    await this.connection.close();
  }
}

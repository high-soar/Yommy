import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import type { DatabaseAdapter } from "./types";

export class CapacitorSqliteAdapter implements DatabaseAdapter {
  private mutex: Promise<void> = Promise.resolve();

  constructor(private connection: SQLiteDBConnection) {}

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

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    return this.lock(() => this.rawExecute(sql, params));
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.lock(() => this.rawQuery<T>(sql, params));
  }

  async runTransaction<T>(
    action: (tx: DatabaseAdapter) => Promise<T>,
  ): Promise<T> {
    return this.lock(async () => {
      await this.connection.beginTransaction();
      try {
        const txAdapter: DatabaseAdapter = {
          execute: (sql, params) => this.rawExecute(sql, params),
          query: (sql, params) => this.rawQuery(sql, params),
          runTransaction: async () => {
            throw new Error("Nested transactions are not supported");
          },
          close: () => Promise.resolve(),
        };
        const result = await action(txAdapter);
        await this.connection.commitTransaction();
        return result;
      } catch (err) {
        await this.connection.rollbackTransaction();
        throw err;
      }
    });
  }

  private async rawExecute(sql: string, params: unknown[] = []): Promise<void> {
    if (params.length > 0) {
      await this.connection.run(sql, params, false);
    } else {
      await this.connection.execute(sql, false);
    }
  }

  private async rawQuery<T = unknown>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const res = await this.connection.query(sql, params);
    return (res.values ?? []) as T[];
  }

  async close(): Promise<void> {
    return this.lock(() => this.connection.close());
  }
}

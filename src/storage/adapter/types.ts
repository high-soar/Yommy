export interface DatabaseAdapter {
  execute(sql: string, params?: unknown[]): Promise<void>;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  runTransaction<T>(action: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

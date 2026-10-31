import type { DatabaseAdapter } from "../adapter/types";
import type { AppSettingsRepository } from "../types";

interface AppSettingRow {
  key: string;
  value: string;
  updated_at: string;
}

/**
 * SQLite バックエンドによる汎用アプリケーション設定リポジトリ実装
 * （docs/specs/architecture.md および docs/specs/db-schema.md に準拠）
 */
export class SqlAppSettingsRepository implements AppSettingsRepository {
  constructor(private db: DatabaseAdapter) {}

  /**
   * 指定された設定キーの値を取得する。存在しない場合は null を返す。
   */
  async getSetting(key: string): Promise<string | null> {
    const rows = await this.db.query<AppSettingRow>(
      "SELECT value FROM app_settings WHERE key = ?;",
      [key],
    );
    if (rows.length === 0) {
      return null;
    }
    return rows[0].value;
  }

  /**
   * 設定キーと値を保存・更新（UPSERT）する。
   */
  async setSetting(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.execute(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at;`,
      [key, value, now],
    );
  }

  async getCloudSyncLastSyncedAt(): Promise<number | null> {
    throw new Error("getCloudSyncLastSyncedAt is not implemented yet");
  }

  async setCloudSyncLastSyncedAt(_timestamp: number | null): Promise<void> {
    throw new Error("setCloudSyncLastSyncedAt is not implemented yet");
  }

  async getCloudSyncAccountEmail(): Promise<string | null> {
    throw new Error("getCloudSyncAccountEmail is not implemented yet");
  }

  async setCloudSyncAccountEmail(_email: string | null): Promise<void> {
    throw new Error("setCloudSyncAccountEmail is not implemented yet");
  }
}

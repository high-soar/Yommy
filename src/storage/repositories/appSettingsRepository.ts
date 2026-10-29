import type { DatabaseAdapter } from "../adapter/types";
import type { AppSettingsRepository } from "../types";

interface AppSettingRow {
  key: string;
  value: string;
  updated_at: string;
}

export class SqlAppSettingsRepository implements AppSettingsRepository {
  constructor(private db: DatabaseAdapter) {}

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
}

import type { DatabaseAdapter } from "../adapter/types";
import type { ReaderSettings, SettingsRepository } from "../types";

interface ReaderSettingsRow {
  id: number;
  writing_mode: ReaderSettings["writingMode"];
  theme: ReaderSettings["theme"];
  font_family: ReaderSettings["fontFamily"];
  font_size_px: number;
  line_height: number;
  page_margin_px: number;
  enable_tap_paging: number;
  enable_volume_key_paging: number;
  updated_at: string;
}

export class SqlSettingsRepository implements SettingsRepository {
  constructor(private db: DatabaseAdapter) {}

  private mapRowToSettings(row: ReaderSettingsRow): ReaderSettings {
    return {
      writingMode: row.writing_mode,
      theme: row.theme,
      fontFamily: row.font_family,
      fontSizePx: row.font_size_px,
      lineHeight: row.line_height,
      pageMarginPx: row.page_margin_px,
      enableTapPaging: row.enable_tap_paging === 1,
      enableVolumeKeyPaging: row.enable_volume_key_paging === 1,
      updatedAt: row.updated_at,
    };
  }

  async getReaderSettings(): Promise<ReaderSettings> {
    const rows = await this.db.query<ReaderSettingsRow>(
      "SELECT * FROM reader_settings WHERE id = 1;",
    );
    if (rows.length === 0) {
      throw new Error("reader_settings の初期行が見つかりません。");
    }
    return this.mapRowToSettings(rows[0]);
  }

  async updateReaderSettings(
    patch: Partial<ReaderSettings>,
  ): Promise<ReaderSettings> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (patch.writingMode !== undefined) {
      fields.push("writing_mode = ?");
      values.push(patch.writingMode);
    }
    if (patch.theme !== undefined) {
      fields.push("theme = ?");
      values.push(patch.theme);
    }
    if (patch.fontFamily !== undefined) {
      fields.push("font_family = ?");
      values.push(patch.fontFamily);
    }
    if (patch.fontSizePx !== undefined) {
      fields.push("font_size_px = ?");
      values.push(patch.fontSizePx);
    }
    if (patch.lineHeight !== undefined) {
      fields.push("line_height = ?");
      values.push(patch.lineHeight);
    }
    if (patch.pageMarginPx !== undefined) {
      fields.push("page_margin_px = ?");
      values.push(patch.pageMarginPx);
    }
    if (patch.enableTapPaging !== undefined) {
      fields.push("enable_tap_paging = ?");
      values.push(patch.enableTapPaging ? 1 : 0);
    }
    if (patch.enableVolumeKeyPaging !== undefined) {
      fields.push("enable_volume_key_paging = ?");
      values.push(patch.enableVolumeKeyPaging ? 1 : 0);
    }

    if (fields.length > 0) {
      const updatedAt = patch.updatedAt ?? new Date().toISOString();
      fields.push("updated_at = ?");
      values.push(updatedAt);

      await this.db.execute(
        `UPDATE reader_settings SET ${fields.join(", ")} WHERE id = 1;`,
        values,
      );
    }

    return await this.getReaderSettings();
  }

  async getCloudSyncLastSyncedAt(): Promise<number | null> {
    const rows = await this.db.query<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'cloud_sync_last_synced_at';",
    );
    if (rows.length === 0) {
      return null;
    }
    const num = Number(rows[0].value);
    return Number.isNaN(num) ? null : num;
  }

  async setCloudSyncLastSyncedAt(timestamp: number | null): Promise<void> {
    if (timestamp === null) {
      await this.db.execute(
        "DELETE FROM app_settings WHERE key = 'cloud_sync_last_synced_at';",
      );
    } else {
      const now = new Date().toISOString();
      await this.db.execute(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES ('cloud_sync_last_synced_at', ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at;`,
        [String(timestamp), now],
      );
    }
  }

  async getCloudSyncAccountEmail(): Promise<string | null> {
    const rows = await this.db.query<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'cloud_sync_account_email';",
    );
    if (rows.length === 0) {
      return null;
    }
    return rows[0].value;
  }

  async setCloudSyncAccountEmail(email: string | null): Promise<void> {
    if (email === null) {
      await this.db.execute(
        "DELETE FROM app_settings WHERE key = 'cloud_sync_account_email';",
      );
    } else {
      const now = new Date().toISOString();
      await this.db.execute(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES ('cloud_sync_account_email', ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at;`,
        [email, now],
      );
    }
  }
}

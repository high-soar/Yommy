import type { DatabaseAdapter } from "../adapter/types";
import type { ReaderSettings, SettingsRepository } from "../types";
import { SqlAppSettingsRepository } from "./appSettingsRepository";

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
  paging_mode: ReaderSettings["pagingMode"];
  updated_at: string;
}

export class SqlSettingsRepository implements SettingsRepository {
  private appSettingsRepo: SqlAppSettingsRepository;

  constructor(private db: DatabaseAdapter) {
    this.appSettingsRepo = new SqlAppSettingsRepository(db);
  }

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
      pagingMode: row.paging_mode,
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
    if (patch.pagingMode !== undefined) {
      fields.push("paging_mode = ?");
      values.push(patch.pagingMode);
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
    return await this.appSettingsRepo.getCloudSyncLastSyncedAt();
  }

  async setCloudSyncLastSyncedAt(timestamp: number | null): Promise<void> {
    await this.appSettingsRepo.setCloudSyncLastSyncedAt(timestamp);
  }

  async getCloudSyncAccountEmail(): Promise<string | null> {
    return await this.appSettingsRepo.getCloudSyncAccountEmail();
  }

  async setCloudSyncAccountEmail(email: string | null): Promise<void> {
    await this.appSettingsRepo.setCloudSyncAccountEmail(email);
  }
}

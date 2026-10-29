import type { DatabaseAdapter } from "../adapter/types";
import type { AppSettingsRepository } from "../types";

export class SqlAppSettingsRepository implements AppSettingsRepository {
  constructor(private db: DatabaseAdapter) {
    void this.db;
  }

  async getSetting(_key: string): Promise<string | null> {
    throw new Error(
      "SqlAppSettingsRepository.getSetting is not implemented yet.",
    );
  }

  async setSetting(_key: string, _value: string): Promise<void> {
    throw new Error(
      "SqlAppSettingsRepository.setSetting is not implemented yet.",
    );
  }
}

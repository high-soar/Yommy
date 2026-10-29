import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb, initTestDb } from "../adapter/inMemoryDb";
import { SqlAppSettingsRepository } from "./appSettingsRepository";

describe("SqlAppSettingsRepository", () => {
  let repository: SqlAppSettingsRepository;

  beforeEach(async () => {
    const adapter = await resetTestDb();
    repository = new SqlAppSettingsRepository(adapter);
  });

  describe("getSetting", () => {
    it("初期投入されている設定値（bookshelf_sort_order = 'unread_first'）が取得できること", async () => {
      const order = await repository.getSetting("bookshelf_sort_order");
      expect(order).toBe("unread_first");
    });

    it("存在しない設定キーを指定した場合は null を返すこと", async () => {
      const value = await repository.getSetting("non_existent_key");
      expect(value).toBeNull();
    });
  });

  describe("setSetting", () => {
    it("新規の設定キーと値を保存し、getSetting で取得できること", async () => {
      await repository.setSetting("custom_key", "custom_value");
      const value = await repository.getSetting("custom_key");
      expect(value).toBe("custom_value");
    });

    it("既存の設定値を上書き（UPSERT）でき、更新日時が反映されること", async () => {
      const db = await initTestDb();

      // 初期値を確認
      const before = await repository.getSetting("bookshelf_sort_order");
      expect(before).toBe("unread_first");

      // 新しいソート順に変更
      await repository.setSetting("bookshelf_sort_order", "latest_published");
      const after = await repository.getSetting("bookshelf_sort_order");
      expect(after).toBe("latest_published");

      // DB 内の行数が1件（重複せず更新）であることを確認
      const rows = await db.query<{
        key: string;
        value: string;
        updated_at: string;
      }>("SELECT * FROM app_settings WHERE key = 'bookshelf_sort_order';");
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe("latest_published");
      expect(rows[0].updated_at).not.toBe("2026-01-01T00:00:00.000Z");
    });
  });
});

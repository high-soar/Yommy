import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb } from "../adapter/inMemoryDb";
import { SqlSettingsRepository } from "./settingsRepository";

describe("SqlSettingsRepository", () => {
  let repository: SqlSettingsRepository;

  beforeEach(async () => {
    const adapter = await resetTestDb();
    repository = new SqlSettingsRepository(adapter);
  });

  describe("getReaderSettings", () => {
    it("初期設定値（id = 1）が ReaderSettings 型として正しく取得できること", async () => {
      const settings = await repository.getReaderSettings();

      expect(settings).toEqual({
        writingMode: "vertical-rl",
        theme: "light",
        fontFamily: "biz-ud-mincho",
        fontSizePx: 18,
        lineHeight: 1.8,
        pageMarginPx: 20,
        enableTapPaging: true,
        enableVolumeKeyPaging: false,
        updatedAt: expect.any(String),
      });
    });

    it("初期行が存在しない場合に例外がスローされること", async () => {
      const adapter = await resetTestDb();
      await adapter.execute("DELETE FROM reader_settings WHERE id = 1;");
      const emptyRepo = new SqlSettingsRepository(adapter);

      await expect(emptyRepo.getReaderSettings()).rejects.toThrow(
        "reader_settings の初期行が見つかりません。",
      );
    });
  });

  describe("updateReaderSettings", () => {
    it("一部のプロパティのみ更新した場合に指定項目のみ変更され他は維持されること", async () => {
      const updated = await repository.updateReaderSettings({
        writingMode: "horizontal-tb",
        fontSizePx: 24,
      });

      expect(updated.writingMode).toBe("horizontal-tb");
      expect(updated.fontSizePx).toBe(24);
      // 他のプロパティは維持
      expect(updated.theme).toBe("light");
      expect(updated.fontFamily).toBe("biz-ud-mincho");
      expect(updated.lineHeight).toBe(1.8);
      expect(updated.pageMarginPx).toBe(20);
      expect(updated.enableTapPaging).toBe(true);
      expect(updated.enableVolumeKeyPaging).toBe(false);

      // getReaderSettings でも更新値が取得できること
      const reFetched = await repository.getReaderSettings();
      expect(reFetched).toEqual(updated);
    });

    it("真偽値フラグや全項目を更新できること", async () => {
      const customUpdatedAt = "2026-02-01T12:00:00.000Z";
      const updated = await repository.updateReaderSettings({
        writingMode: "horizontal-tb",
        theme: "dark",
        fontFamily: "klee",
        fontSizePx: 14,
        lineHeight: 2.2,
        pageMarginPx: 32,
        enableTapPaging: false,
        enableVolumeKeyPaging: true,
        updatedAt: customUpdatedAt,
      });

      expect(updated).toEqual({
        writingMode: "horizontal-tb",
        theme: "dark",
        fontFamily: "klee",
        fontSizePx: 14,
        lineHeight: 2.2,
        pageMarginPx: 32,
        enableTapPaging: false,
        enableVolumeKeyPaging: true,
        updatedAt: customUpdatedAt,
      });
    });

    it("空のパッチを渡した場合に既存の設定値が維持されること", async () => {
      const before = await repository.getReaderSettings();
      const updated = await repository.updateReaderSettings({});

      expect(updated.writingMode).toBe(before.writingMode);
      expect(updated.theme).toBe(before.theme);
      expect(updated.fontFamily).toBe(before.fontFamily);
      expect(updated.fontSizePx).toBe(before.fontSizePx);
    });

    it("各設定項目を個別に更新できること", async () => {
      let res = await repository.updateReaderSettings({ theme: "sepia" });
      expect(res.theme).toBe("sepia");

      res = await repository.updateReaderSettings({ fontFamily: "gothic" });
      expect(res.fontFamily).toBe("gothic");

      res = await repository.updateReaderSettings({ lineHeight: 2.0 });
      expect(res.lineHeight).toBe(2.0);

      res = await repository.updateReaderSettings({ pageMarginPx: 28 });
      expect(res.pageMarginPx).toBe(28);

      res = await repository.updateReaderSettings({ enableTapPaging: false });
      expect(res.enableTapPaging).toBe(false);

      res = await repository.updateReaderSettings({ enableTapPaging: true });
      expect(res.enableTapPaging).toBe(true);

      res = await repository.updateReaderSettings({
        enableVolumeKeyPaging: true,
      });
      expect(res.enableVolumeKeyPaging).toBe(true);

      res = await repository.updateReaderSettings({
        enableVolumeKeyPaging: false,
      });
      expect(res.enableVolumeKeyPaging).toBe(false);
    });
  });

  describe("クラウド同期設定キーの読み書き (AC-ST-08 / db-schema)", () => {
    describe("cloud_sync_last_synced_at", () => {
      it("初期状態（未同期）では null を返却すること", async () => {
        const lastSyncedAt = await repository.getCloudSyncLastSyncedAt();
        expect(lastSyncedAt).toBeNull();
      });

      it("最終同期日時（ミリ秒タイムスタンプ）を保存・取得できること", async () => {
        const timestamp = 1730376000000;
        await repository.setCloudSyncLastSyncedAt(timestamp);

        const fetched = await repository.getCloudSyncLastSyncedAt();
        expect(fetched).toBe(timestamp);
      });

      it("null を設定した場合は設定がクリアされ null を返却すること", async () => {
        await repository.setCloudSyncLastSyncedAt(1730376000000);
        expect(await repository.getCloudSyncLastSyncedAt()).toBe(1730376000000);

        await repository.setCloudSyncLastSyncedAt(null);
        expect(await repository.getCloudSyncLastSyncedAt()).toBeNull();
      });
    });

    describe("cloud_sync_account_email", () => {
      it("初期状態（未連携）では null を返却すること", async () => {
        const email = await repository.getCloudSyncAccountEmail();
        expect(email).toBeNull();
      });

      it("連携アカウントメールアドレスを保存・取得できること", async () => {
        const testEmail = "testuser@gmail.com";
        await repository.setCloudSyncAccountEmail(testEmail);

        const fetched = await repository.getCloudSyncAccountEmail();
        expect(fetched).toBe(testEmail);
      });

      it("null を設定した場合は設定がクリアされ null を返却すること", async () => {
        await repository.setCloudSyncAccountEmail("testuser@gmail.com");
        expect(await repository.getCloudSyncAccountEmail()).toBe(
          "testuser@gmail.com",
        );

        await repository.setCloudSyncAccountEmail(null);
        expect(await repository.getCloudSyncAccountEmail()).toBeNull();
      });
    });
  });
});

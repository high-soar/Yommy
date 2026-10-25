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
  });
});

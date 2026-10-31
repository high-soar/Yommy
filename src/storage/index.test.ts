import { describe, it, expect } from "vitest";
import * as storage from "./index";

describe("storage/index", () => {
  it("各 Repository 実装および主要アダプター・初期化関数が正しくエクスポートされていること", () => {
    expect(storage.SqlNovelRepository).toBeDefined();
    expect(storage.SqlChapterRepository).toBeDefined();
    expect(storage.SqlSettingsRepository).toBeDefined();
    expect(storage.SqlAppSettingsRepository).toBeDefined();
    expect(storage.APP_SETTING_KEYS).toBeDefined();
    expect(storage.DDL_STATEMENTS).toBeDefined();
    expect(storage.initializeDatabaseSchema).toBeDefined();
    expect(storage.createInMemoryDb).toBeDefined();
    expect(storage.resetTestDb).toBeDefined();
    expect(storage.initTestDb).toBeDefined();
    expect(storage.CapacitorSqliteAdapter).toBeDefined();
  });
});

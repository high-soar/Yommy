import type { DatabaseAdapter } from "./adapter/types";

/**
 * Yommy SQLite データベース初期化 DDL 文
 * （docs/specs/db-schema.md に準拠）
 */
export const DDL_STATEMENTS = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS novels (
  id TEXT PRIMARY KEY,
  site_type TEXT NOT NULL,
  remote_work_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  synopsis TEXT NOT NULL DEFAULT '',
  total_chapters INTEGER NOT NULL DEFAULT 0,
  cached_chapters INTEGER NOT NULL DEFAULT 0,
  total_byte_size INTEGER NOT NULL DEFAULT 0,
  bookmark_chapter_index INTEGER,
  bookmark_scroll_progress REAL NOT NULL DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  has_new_update INTEGER NOT NULL DEFAULT 0,
  latest_episode_published_at TEXT,
  last_checked_at TEXT,
  last_read_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_novels_last_read_at ON novels(last_read_at DESC);
CREATE INDEX IF NOT EXISTS idx_novels_has_new_update ON novels(has_new_update DESC);
CREATE INDEX IF NOT EXISTS idx_novels_latest_published ON novels(latest_episode_published_at DESC);
CREATE INDEX IF NOT EXISTS idx_novels_created_at ON novels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_novels_title ON novels(title COLLATE NOCASE ASC);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  novel_id TEXT NOT NULL,
  chapter_index INTEGER NOT NULL,
  remote_chapter_id TEXT NOT NULL,
  part_title TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  body_html TEXT,
  byte_size INTEGER NOT NULL DEFAULT 0,
  is_read INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  downloaded_at TEXT,
  FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
  UNIQUE (novel_id, remote_chapter_id)
);

CREATE INDEX IF NOT EXISTS idx_chapters_novel_index ON chapters(novel_id, chapter_index ASC);

CREATE TABLE IF NOT EXISTS download_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id TEXT NOT NULL,
  chapter_index INTEGER NOT NULL,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
  UNIQUE (novel_id, chapter_index)
);

CREATE INDEX IF NOT EXISTS idx_download_queue_status ON download_queue(status, id ASC);

CREATE TABLE IF NOT EXISTS reader_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  writing_mode TEXT NOT NULL DEFAULT 'vertical-rl',
  theme TEXT NOT NULL DEFAULT 'light',
  font_family TEXT NOT NULL DEFAULT 'biz-ud-mincho',
  font_size_px INTEGER NOT NULL DEFAULT 18,
  line_height REAL NOT NULL DEFAULT 1.8,
  page_margin_px INTEGER NOT NULL DEFAULT 20,
  enable_tap_paging INTEGER NOT NULL DEFAULT 1,
  enable_volume_key_paging INTEGER NOT NULL DEFAULT 0,
  paging_mode TEXT NOT NULL DEFAULT 'auto' CHECK (paging_mode IN ('auto', 'paged', 'scroll')),
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO reader_settings (
  id, writing_mode, theme, font_family, font_size_px, line_height, page_margin_px, enable_tap_paging, enable_volume_key_paging, paging_mode, updated_at
) VALUES (
  1, 'vertical-rl', 'light', 'biz-ud-mincho', 18, 1.8, 20, 1, 0, 'auto', '2026-01-01T00:00:00.000Z'
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO app_settings (
  key, value, updated_at
) VALUES (
  'bookshelf_sort_order', 'unread_first', '2026-01-01T00:00:00.000Z'
);

CREATE TABLE IF NOT EXISTS deleted_novels (
  id TEXT PRIMARY KEY,
  deleted_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deleted_novels_deleted_at ON deleted_novels(deleted_at DESC);
`;

/**
 * 汎用設定キー名定義
 * （docs/specs/db-schema.md §3.5 に準拠）
 */
export const APP_SETTING_KEYS = {
  BOOKSHELF_SORT_ORDER: "bookshelf_sort_order",
  CLOUD_SYNC_LAST_SYNCED_AT: "cloud_sync_last_synced_at",
  CLOUD_SYNC_ACCOUNT_EMAIL: "cloud_sync_account_email",
} as const;

/**
 * データベースアダプターに対してスキーマ初期化 DDL およびマイグレーションを実行する
 * （docs/specs/db-schema.md §3.6 に準拠）
 */
export async function initializeDatabaseSchema(
  db: DatabaseAdapter,
): Promise<void> {
  // 既存データベース（v0.2 以前）が存在する場合、DDL 実行時の新インデックス作成失敗を防ぐため先にカラム移行を実行
  await migrateDatabaseSchema(db);

  const statements = DDL_STATEMENTS.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await db.execute(statement);
  }
}

interface ColumnInfo {
  name: string;
}

/**
 * 既存テーブルに対するカラム追加などのスキーマ移行処理
 */
export async function migrateDatabaseSchema(
  db: DatabaseAdapter,
): Promise<void> {
  const novelColumns = await db.query<ColumnInfo>("PRAGMA table_info(novels);");
  if (novelColumns.length === 0) {
    // テーブルが存在しない（新規 DB）場合はスキップ
    return;
  }

  const columnNames = new Set(novelColumns.map((c) => c.name));

  if (!columnNames.has("has_new_update")) {
    await db.execute(
      "ALTER TABLE novels ADD COLUMN has_new_update INTEGER NOT NULL DEFAULT 0;",
    );
  }

  if (!columnNames.has("latest_episode_published_at")) {
    await db.execute(
      "ALTER TABLE novels ADD COLUMN latest_episode_published_at TEXT;",
    );
  }

  // reader_settings テーブル（v0.4 新設: Issue #122）の paging_mode カラムマイグレーション
  const readerSettingsColumns = await db.query<ColumnInfo>(
    "PRAGMA table_info(reader_settings);",
  );
  if (readerSettingsColumns.length > 0) {
    const readerColumnNames = new Set(readerSettingsColumns.map((c) => c.name));
    if (!readerColumnNames.has("paging_mode")) {
      await db.execute(
        "ALTER TABLE reader_settings ADD COLUMN paging_mode TEXT NOT NULL DEFAULT 'auto' CHECK (paging_mode IN ('auto', 'paged', 'scroll'));",
      );
    }
  }

  // deleted_novels テーブル（v0.4 新設: Issue #120）が存在しない場合は作成
  const deletedNovelsTables = await db.query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'deleted_novels';",
  );
  if (deletedNovelsTables.length === 0) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS deleted_novels (
        id TEXT PRIMARY KEY,
        deleted_at INTEGER NOT NULL
      );
    `);
    await db.execute(
      "CREATE INDEX IF NOT EXISTS idx_deleted_novels_deleted_at ON deleted_novels(deleted_at DESC);",
    );
  }
}

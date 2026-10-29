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
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO reader_settings (
  id, writing_mode, theme, font_family, font_size_px, line_height, page_margin_px, enable_tap_paging, enable_volume_key_paging, updated_at
) VALUES (
  1, 'vertical-rl', 'light', 'biz-ud-mincho', 18, 1.8, 20, 1, 0, '2026-01-01T00:00:00.000Z'
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
`;

/**
 * データベースアダプターに対してスキーマ初期化 DDL を実行する
 */
export async function initializeDatabaseSchema(
  db: DatabaseAdapter,
): Promise<void> {
  const statements = DDL_STATEMENTS.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await db.execute(statement);
  }
}

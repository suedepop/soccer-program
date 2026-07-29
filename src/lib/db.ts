import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Every account, ad, and uploaded photo lives here.
 *
 * A relative DATA_DIR resolves against the *working directory*, which is not
 * always the project folder once something else is starting the process — a
 * systemd unit, a Docker WORKDIR, a Windows service. When that happens the app
 * happily creates a brand-new empty database somewhere else and every account
 * appears to have vanished. Use an absolute path in production, and see the
 * startup line logged below to confirm which file is actually open.
 */
export const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  ensureDirs();
  const file = path.join(DATA_DIR, 'program.sqlite');
  const isNew = !fs.existsSync(file);

  const conn = new Database(file);
  conn.pragma('journal_mode = WAL');
  conn.pragma('foreign_keys = ON');
  migrate(conn);
  _db = conn;

  // Say out loud which database is open. Silently starting a fresh one is the
  // single most alarming failure this app can have, so make it impossible to
  // mistake for anything else.
  if (isNew) {
    console.warn(
      `[db] Created a NEW EMPTY database at ${file}\n` +
        `[db] If you expected existing accounts, DATA_DIR is not pointing where you think.\n` +
        `[db] Set DATA_DIR to an absolute path on persistent storage.`
    );
  } else {
    const { n } = conn.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
    console.log(`[db] ${file} (${n} account${n === 1 ? '' : 's'})`);
  }

  return conn;
}

function migrate(conn: Database.Database) {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      name          TEXT NOT NULL DEFAULT '',
      phone         TEXT NOT NULL DEFAULT '',
      is_admin      INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS files (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stored_name TEXT NOT NULL,
      orig_name   TEXT NOT NULL DEFAULT '',
      mime        TEXT NOT NULL,
      width       INTEGER NOT NULL,
      height      INTEGER NOT NULL,
      bytes       INTEGER NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id);

    CREATE TABLE IF NOT EXISTS ads (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      size          TEXT NOT NULL,
      layout_id     TEXT NOT NULL,
      background_id TEXT NOT NULL,
      team          TEXT NOT NULL DEFAULT 'both',
      player_name   TEXT NOT NULL DEFAULT '',
      message       TEXT NOT NULL DEFAULT '',
      attribution   TEXT NOT NULL DEFAULT '',
      heading_font  TEXT NOT NULL DEFAULT '',
      body_font     TEXT NOT NULL DEFAULT '',
      name_effect   TEXT NOT NULL DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'draft',
      price_cents   INTEGER NOT NULL DEFAULT 0,
      admin_notes   TEXT NOT NULL DEFAULT '',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      submitted_at  TEXT,
      paid_at       TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_ads_user ON ads(user_id);
    CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status);

    CREATE TABLE IF NOT EXISTS ad_photos (
      ad_id      INTEGER NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
      slot       INTEGER NOT NULL,
      file_id    INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      focal_x    REAL NOT NULL DEFAULT 0.5,
      focal_y    REAL NOT NULL DEFAULT 0.5,
      PRIMARY KEY (ad_id, slot)
    );
  `);

  // Added after the first release — databases created before then need them.
  addColumn(conn, 'ads', 'heading_font', "TEXT NOT NULL DEFAULT ''");
  addColumn(conn, 'ads', 'body_font', "TEXT NOT NULL DEFAULT ''");
  addColumn(conn, 'ads', 'name_effect', "TEXT NOT NULL DEFAULT ''");
}

/** SQLite has no ADD COLUMN IF NOT EXISTS, so check the table first. */
function addColumn(conn: Database.Database, table: string, column: string, ddl: string) {
  const cols = conn.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    conn.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

/** Escapes nothing — only ever call with a literal from our own code. */
export function now(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL?.trim();
export const isPostgres = Boolean(DATABASE_URL);

let sqliteDb = null;
let pgPool = null;

export function nowCn() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .replace('T', ' ');
}

export function dateCn(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function toPgSql(sql) {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

export async function initDb() {
  if (isPostgres) {
    pgPool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    });

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        share_token TEXT UNIQUE,
        font_scale TEXT NOT NULL DEFAULT 'large',
        sound_enabled INTEGER NOT NULL DEFAULT 1,
        daily_goal_minutes INTEGER NOT NULL DEFAULT 15,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS training_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        module_id TEXT NOT NULL,
        difficulty_level INTEGER NOT NULL DEFAULT 1,
        score INTEGER NOT NULL DEFAULT 0,
        accuracy DOUBLE PRECISION NOT NULL DEFAULT 0,
        avg_reaction_ms INTEGER NOT NULL DEFAULT 0,
        duration_sec INTEGER NOT NULL DEFAULT 0,
        trials_completed INTEGER NOT NULL DEFAULT 0,
        details_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_module_levels (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        module_id TEXT NOT NULL,
        current_level INTEGER NOT NULL DEFAULT 1,
        best_score INTEGER NOT NULL DEFAULT 0,
        total_sessions INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, module_id)
      );

      CREATE TABLE IF NOT EXISTS spaced_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_key TEXT NOT NULL,
        interval_days DOUBLE PRECISION NOT NULL DEFAULT 0,
        ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5,
        repetitions INTEGER NOT NULL DEFAULT 0,
        next_review_at TEXT NOT NULL,
        last_reviewed_at TEXT,
        UNIQUE(user_id, item_key)
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_date
        ON training_sessions(user_id, created_at);
    `);
    return;
  }

  const { DatabaseSync } = await import('node:sqlite');
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'memory.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  sqliteDb = new DatabaseSync(dbPath);

  sqliteDb.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      share_token TEXT,
      font_scale TEXT NOT NULL DEFAULT 'large',
      sound_enabled INTEGER NOT NULL DEFAULT 1,
      daily_goal_minutes INTEGER NOT NULL DEFAULT 15,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS training_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      module_id TEXT NOT NULL,
      difficulty_level INTEGER NOT NULL DEFAULT 1,
      score INTEGER NOT NULL DEFAULT 0,
      accuracy REAL NOT NULL DEFAULT 0,
      avg_reaction_ms INTEGER NOT NULL DEFAULT 0,
      duration_sec INTEGER NOT NULL DEFAULT 0,
      trials_completed INTEGER NOT NULL DEFAULT 0,
      details_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_module_levels (
      user_id INTEGER NOT NULL,
      module_id TEXT NOT NULL,
      current_level INTEGER NOT NULL DEFAULT 1,
      best_score INTEGER NOT NULL DEFAULT 0,
      total_sessions INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      PRIMARY KEY (user_id, module_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS spaced_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_key TEXT NOT NULL,
      interval_days REAL NOT NULL DEFAULT 0,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      repetitions INTEGER NOT NULL DEFAULT 0,
      next_review_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      last_reviewed_at TEXT,
      UNIQUE(user_id, item_key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_date
      ON training_sessions(user_id, created_at);
  `);

  const userCols = sqliteDb.prepare('PRAGMA table_info(users)').all();
  if (!userCols.some((c) => c.name === 'share_token')) {
    sqliteDb.exec('ALTER TABLE users ADD COLUMN share_token TEXT');
  }
  if (!userCols.some((c) => c.name === 'role')) {
    sqliteDb.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  }
  sqliteDb.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_share_token ON users(share_token)');
}

export async function queryOne(sql, params = []) {
  if (isPostgres) {
    const res = await pgPool.query(toPgSql(sql), params);
    return res.rows[0] || null;
  }
  return sqliteDb.prepare(sql).get(...params) || null;
}

export async function queryAll(sql, params = []) {
  if (isPostgres) {
    const res = await pgPool.query(toPgSql(sql), params);
    return res.rows;
  }
  return sqliteDb.prepare(sql).all(...params);
}

export async function execute(sql, params = [], { returningId = false } = {}) {
  if (isPostgres) {
    const finalSql = returningId ? `${toPgSql(sql)} RETURNING id` : toPgSql(sql);
    const res = await pgPool.query(finalSql, params);
    return { lastInsertRowid: res.rows[0]?.id ? Number(res.rows[0].id) : 0 };
  }
  const info = sqliteDb.prepare(sql).run(...params);
  return { lastInsertRowid: Number(info.lastInsertRowid || 0) };
}

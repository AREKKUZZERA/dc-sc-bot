import Database from 'better-sqlite3';

const db = new Database('watchlist.db');

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('track', 'artist')),
    url TEXT NOT NULL,
    label TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlist_unique
  ON watchlist(user_id, guild_id, type, url);
`);

const insertItemStmt = db.prepare(`
  INSERT INTO watchlist (user_id, guild_id, type, url, label)
  VALUES (?, ?, ?, ?, ?)
`);

const listItemsStmt = db.prepare(`
  SELECT id, type, url, label, created_at
  FROM watchlist
  WHERE user_id = ? AND guild_id = ?
  ORDER BY id DESC
`);

const deleteItemStmt = db.prepare(`
  DELETE FROM watchlist
  WHERE id = ? AND user_id = ? AND guild_id = ?
`);

const getItemStmt = db.prepare(`
  SELECT id, type, url, label, created_at
  FROM watchlist
  WHERE id = ? AND user_id = ? AND guild_id = ?
`);

export function addWatchItem({ userId, guildId, type, url, label }) {
  return insertItemStmt.run(userId, guildId, type, url, label ?? null);
}

export function listWatchItems({ userId, guildId }) {
  return listItemsStmt.all(userId, guildId);
}

export function removeWatchItem({ id, userId, guildId }) {
  return deleteItemStmt.run(id, userId, guildId);
}

export function getWatchItem({ id, userId, guildId }) {
  return getItemStmt.get(id, userId, guildId);
}
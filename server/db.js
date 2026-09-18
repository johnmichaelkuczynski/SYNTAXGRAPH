import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export function createDatabase(filename = process.env.DATABASE_PATH || './data/syntaxgraph.db') {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS style_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT, author TEXT NOT NULL, name TEXT NOT NULL,
      text TEXT NOT NULL, word_count INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT, provider TEXT NOT NULL, operation TEXT NOT NULL,
      input TEXT NOT NULL, output TEXT NOT NULL, metadata TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

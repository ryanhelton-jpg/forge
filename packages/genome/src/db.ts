// Database connection for Genome package

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';
import { join } from 'path';

// Default to data/forge.db in project root
const DB_PATH = process.env.FORGE_DB_PATH || join(process.cwd(), 'data', 'forge.db');

// Lazy initialization
let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    const sqlite = new Database(DB_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

export { schema };

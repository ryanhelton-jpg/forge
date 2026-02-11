import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../data', 'genome.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
CREATE TABLE IF NOT EXISTS genomes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  parent_id TEXT,
  lineage TEXT DEFAULT '[]',
  identity TEXT NOT NULL,
  tools TEXT DEFAULT '[]',
  skills TEXT DEFAULT '[]',
  knowledge TEXT DEFAULT '[]',
  config TEXT NOT NULL,
  fitness TEXT,
  status TEXT DEFAULT 'draft',
  visibility TEXT DEFAULT 'private',
  total_interactions INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  last_active_at INTEGER
);

CREATE INDEX IF NOT EXISTS genomes_user_idx ON genomes(user_id);
CREATE INDEX IF NOT EXISTS genomes_slug_idx ON genomes(user_id, slug);

CREATE TABLE IF NOT EXISTS mutations (
  id TEXT PRIMARY KEY,
  genome_id TEXT NOT NULL REFERENCES genomes(id),
  version TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  trigger TEXT NOT NULL,
  diff TEXT NOT NULL,
  fitness TEXT,
  status TEXT DEFAULT 'applied',
  timestamp INTEGER,
  applied_at INTEGER,
  rolled_back_at INTEGER
);

CREATE INDEX IF NOT EXISTS mutations_genome_idx ON mutations(genome_id);
`);

console.log('✅ Database initialized at', DB_PATH);
db.close();

// Drizzle schema for Agent Genome persistence

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';
import type { Identity, ToolRef, SkillRef, KnowledgeRef, AgentConfig, GenomeFitness } from '@forge/core';

export const genomes = sqliteTable('genomes', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  version: text('version').notNull().default('1.0.0'),

  parentId: text('parent_id'),
  lineage: text('lineage', { mode: 'json' }).$type<string[]>().default([]),

  identity: text('identity', { mode: 'json' }).$type<Identity>().notNull(),
  tools: text('tools', { mode: 'json' }).$type<ToolRef[]>().default([]),
  skills: text('skills', { mode: 'json' }).$type<SkillRef[]>().default([]),
  knowledge: text('knowledge', { mode: 'json' }).$type<KnowledgeRef[]>().default([]),
  config: text('config', { mode: 'json' }).$type<AgentConfig>().notNull(),

  fitness: text('fitness', { mode: 'json' }).$type<GenomeFitness>(),

  status: text('status', { enum: ['draft', 'active', 'archived'] }).default('draft'),
  visibility: text('visibility', { enum: ['private', 'unlisted', 'public'] }).default('private'),

  totalInteractions: integer('total_interactions').default(0),
  totalTokens: integer('total_tokens').default(0),
  totalCost: real('total_cost').default(0),

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  lastActiveAt: integer('last_active_at', { mode: 'timestamp' }),
}, (table) => [
  index('genomes_user_idx').on(table.userId),
  index('genomes_slug_idx').on(table.userId, table.slug),
]);

export const mutations = sqliteTable('mutations', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  genomeId: text('genome_id').notNull().references(() => genomes.id),
  version: text('version').notNull(),

  type: text('type').notNull(),
  description: text('description').notNull(),

  trigger: text('trigger', { mode: 'json' }).notNull(),
  diff: text('diff', { mode: 'json' }).notNull(),
  fitness: text('fitness', { mode: 'json' }),

  status: text('status', { enum: ['applied', 'pending', 'rolled_back'] }).default('applied'),

  timestamp: integer('timestamp', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  appliedAt: integer('applied_at', { mode: 'timestamp' }),
  rolledBackAt: integer('rolled_back_at', { mode: 'timestamp' }),
}, (table) => [
  index('mutations_genome_idx').on(table.genomeId),
]);

// Type helpers for insert/select
export type GenomeRow = typeof genomes.$inferSelect;
export type NewGenomeRow = typeof genomes.$inferInsert;
export type MutationRow = typeof mutations.$inferSelect;
export type NewMutationRow = typeof mutations.$inferInsert;

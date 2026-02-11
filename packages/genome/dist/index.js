var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/registry.ts
import { eq, desc, and } from "drizzle-orm";
import { createId as createId2 } from "@paralleldrive/cuid2";
import semver from "semver";

// src/db.ts
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

// src/schema.ts
var schema_exports = {};
__export(schema_exports, {
  genomes: () => genomes,
  mutations: () => mutations
});
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
var genomes = sqliteTable("genomes", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  version: text("version").notNull().default("1.0.0"),
  parentId: text("parent_id"),
  lineage: text("lineage", { mode: "json" }).$type().default([]),
  identity: text("identity", { mode: "json" }).$type().notNull(),
  tools: text("tools", { mode: "json" }).$type().default([]),
  skills: text("skills", { mode: "json" }).$type().default([]),
  knowledge: text("knowledge", { mode: "json" }).$type().default([]),
  config: text("config", { mode: "json" }).$type().notNull(),
  fitness: text("fitness", { mode: "json" }).$type(),
  status: text("status", { enum: ["draft", "active", "archived"] }).default("draft"),
  visibility: text("visibility", { enum: ["private", "unlisted", "public"] }).default("private"),
  totalInteractions: integer("total_interactions").default(0),
  totalTokens: integer("total_tokens").default(0),
  totalCost: real("total_cost").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => /* @__PURE__ */ new Date()),
  lastActiveAt: integer("last_active_at", { mode: "timestamp" })
}, (table) => [
  index("genomes_user_idx").on(table.userId),
  index("genomes_slug_idx").on(table.userId, table.slug)
]);
var mutations = sqliteTable("mutations", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  genomeId: text("genome_id").notNull().references(() => genomes.id),
  version: text("version").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  trigger: text("trigger", { mode: "json" }).notNull(),
  diff: text("diff", { mode: "json" }).notNull(),
  fitness: text("fitness", { mode: "json" }),
  status: text("status", { enum: ["applied", "pending", "rolled_back"] }).default("applied"),
  timestamp: integer("timestamp", { mode: "timestamp" }).$defaultFn(() => /* @__PURE__ */ new Date()),
  appliedAt: integer("applied_at", { mode: "timestamp" }),
  rolledBackAt: integer("rolled_back_at", { mode: "timestamp" })
}, (table) => [
  index("mutations_genome_idx").on(table.genomeId)
]);

// src/db.ts
import { join } from "path";
var DB_PATH = process.env.FORGE_DB_PATH || join(process.cwd(), "data", "forge.db");
var _db = null;
function getDb() {
  if (!_db) {
    const sqlite = new Database(DB_PATH);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    _db = drizzle(sqlite, { schema: schema_exports });
  }
  return _db;
}

// src/registry.ts
var { genomes: genomes2, mutations: mutations2 } = schema_exports;
var GenomeRegistry = class {
  get db() {
    return getDb();
  }
  // === CRUD Operations ===
  async create(input) {
    const id = createId2();
    const slug = this.slugify(input.name);
    const genome = {
      id,
      userId: input.userId,
      name: input.name,
      slug,
      version: "1.0.0",
      identity: input.identity,
      tools: input.tools || [],
      skills: [],
      knowledge: [],
      config: input.config || this.defaultConfig(),
      status: "draft",
      visibility: "private",
      totalInteractions: 0,
      totalTokens: 0,
      totalCost: 0
    };
    await this.db.insert(genomes2).values(genome);
    await this.recordMutation(id, "1.0.0", {
      type: "identity_update",
      description: "Agent created",
      trigger: { source: "user" },
      diff: { path: "/", before: null, after: genome }
    });
    return this.get(id);
  }
  async get(id) {
    const result = await this.db.select().from(genomes2).where(eq(genomes2.id, id));
    if (!result.length) return null;
    const row = result[0];
    const mutationHistory = await this.db.select().from(mutations2).where(eq(mutations2.genomeId, id)).orderBy(desc(mutations2.timestamp)).limit(100);
    return this.rowToGenome(row, mutationHistory);
  }
  async getBySlug(userId, slug) {
    const result = await this.db.select().from(genomes2).where(and(eq(genomes2.userId, userId), eq(genomes2.slug, slug)));
    if (!result.length) return null;
    const row = result[0];
    const mutationHistory = await this.db.select().from(mutations2).where(eq(mutations2.genomeId, row.id)).orderBy(desc(mutations2.timestamp)).limit(100);
    return this.rowToGenome(row, mutationHistory);
  }
  async list(userId) {
    const rows = await this.db.select().from(genomes2).where(eq(genomes2.userId, userId)).orderBy(desc(genomes2.updatedAt));
    return Promise.all(rows.map(async (row) => {
      const mutationHistory = await this.db.select().from(mutations2).where(eq(mutations2.genomeId, row.id)).orderBy(desc(mutations2.timestamp)).limit(10);
      return this.rowToGenome(row, mutationHistory);
    }));
  }
  async update(id, mutation) {
    const current = await this.get(id);
    if (!current) throw new Error("Genome not found");
    const newVersion = this.bumpVersion(current.version, mutation.type);
    const updated = this.applyDiff(current, mutation.diff);
    await this.db.update(genomes2).set({
      ...updated,
      version: newVersion,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(genomes2.id, id));
    await this.recordMutation(id, newVersion, mutation);
    return this.get(id);
  }
  async delete(id) {
    await this.db.delete(mutations2).where(eq(mutations2.genomeId, id));
    await this.db.delete(genomes2).where(eq(genomes2.id, id));
  }
  // === Fork & Restore ===
  async fork(id, userId, options) {
    const parent = await this.get(id);
    if (!parent) throw new Error("Genome not found");
    const forkedId = createId2();
    const forkedName = options?.name || `${parent.name} (fork)`;
    const forked = {
      id: forkedId,
      userId,
      name: forkedName,
      slug: this.slugify(forkedName),
      version: "1.0.0",
      parentId: parent.id,
      lineage: [...parent.lineage, parent.id],
      identity: parent.identity,
      tools: parent.tools,
      skills: parent.skills,
      knowledge: parent.knowledge,
      config: parent.config,
      status: "draft",
      visibility: "private",
      totalInteractions: 0,
      totalTokens: 0,
      totalCost: 0
    };
    await this.db.insert(genomes2).values(forked);
    await this.recordMutation(forkedId, "1.0.0", {
      type: "identity_update",
      description: `Forked from ${parent.name} v${parent.version}`,
      trigger: { source: "user" },
      diff: { path: "/", before: null, after: forked }
    });
    return this.get(forkedId);
  }
  async history(id, limit = 50) {
    const rows = await this.db.select().from(mutations2).where(eq(mutations2.genomeId, id)).orderBy(desc(mutations2.timestamp)).limit(limit);
    return rows.map(this.rowToMutation);
  }
  // === Private Helpers ===
  async recordMutation(genomeId, version, mutation) {
    await this.db.insert(mutations2).values({
      genomeId,
      version,
      type: mutation.type,
      description: mutation.description,
      trigger: mutation.trigger,
      diff: mutation.diff,
      fitness: mutation.fitness,
      status: "applied",
      appliedAt: /* @__PURE__ */ new Date()
    });
  }
  applyDiff(genome, diff) {
    const path = diff.path;
    if (path === "/identity") {
      return { identity: diff.after };
    }
    if (path === "/config") {
      return { config: diff.after };
    }
    if (path === "/tools") {
      return { tools: diff.after };
    }
    if (path === "/skills") {
      return { skills: diff.after };
    }
    if (path === "/knowledge") {
      return { knowledge: diff.after };
    }
    if (path === "/status") {
      return { status: diff.after };
    }
    if (path === "/visibility") {
      return { visibility: diff.after };
    }
    return {};
  }
  bumpVersion(current, mutationType) {
    const isMinor = mutationType.includes("identity") || mutationType.includes("config");
    const bump = isMinor ? "minor" : "patch";
    return semver.inc(current, bump) || current;
  }
  slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  defaultConfig() {
    return {
      model: {
        provider: "openrouter",
        model: "anthropic/claude-sonnet-4",
        temperature: 0.7,
        maxTokens: 4096
      },
      memory: {
        conversationLimit: 50,
        factRetention: "relevant",
        summarizationThreshold: 1e4
      },
      evolution: {
        enabled: true,
        autoPropose: true,
        autoApply: false,
        consentThreshold: "major",
        rollbackWindow: 24
      }
    };
  }
  rowToGenome(row, mutationRows) {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      slug: row.slug,
      version: row.version,
      parentId: row.parentId ?? void 0,
      lineage: row.lineage ?? [],
      identity: row.identity,
      tools: row.tools ?? [],
      skills: row.skills ?? [],
      knowledge: row.knowledge ?? [],
      config: row.config,
      mutations: mutationRows.map(this.rowToMutation),
      fitness: row.fitness ?? void 0,
      status: row.status,
      visibility: row.visibility,
      createdAt: row.createdAt ?? /* @__PURE__ */ new Date(),
      updatedAt: row.updatedAt ?? /* @__PURE__ */ new Date(),
      lastActiveAt: row.lastActiveAt ?? void 0,
      stats: {
        totalInteractions: row.totalInteractions ?? 0,
        totalTokens: row.totalTokens ?? 0,
        totalCost: row.totalCost ?? 0
      }
    };
  }
  rowToMutation(row) {
    return {
      id: row.id,
      genomeId: row.genomeId,
      version: row.version,
      timestamp: row.timestamp ?? /* @__PURE__ */ new Date(),
      type: row.type,
      description: row.description,
      trigger: row.trigger,
      diff: row.diff,
      fitness: row.fitness,
      status: row.status,
      appliedAt: row.appliedAt ?? void 0,
      rolledBackAt: row.rolledBackAt ?? void 0
    };
  }
};
export {
  GenomeRegistry,
  genomes,
  getDb,
  mutations,
  schema_exports as schema
};

import {
  VersioningUtils,
  __export,
  calculateRestore,
  diffGenomes,
  diffVersions,
  getPreviousVersion,
  getVersionHistory,
  reconstructAtVersion
} from "./chunk-QGGEI2F2.js";

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
  async restore(id, targetVersion) {
    const genome = await this.get(id);
    if (!genome) throw new Error("Genome not found");
    const { calculateRestore: calculateRestore2, reconstructAtVersion: reconstructAtVersion2 } = await import("./versioning-XXPNXZDA.js");
    const restoreResult = calculateRestore2(genome, targetVersion);
    if (!restoreResult.success) {
      throw new Error(restoreResult.error || "Restore failed");
    }
    const allMutations = await this.history(id, 1e3);
    const restoredState = reconstructAtVersion2(genome, allMutations, targetVersion);
    const newVersion = semver.inc(genome.version, "minor") || genome.version;
    for (const mutation of restoreResult.rollbackMutations) {
      await this.db.update(mutations2).set({
        status: "rolled_back",
        rolledBackAt: /* @__PURE__ */ new Date()
      }).where(eq(mutations2.id, mutation.id));
    }
    await this.db.update(genomes2).set({
      ...restoredState,
      version: newVersion,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(genomes2.id, id));
    await this.recordMutation(id, newVersion, {
      type: "config_change",
      description: `Restored to v${targetVersion}`,
      trigger: { source: "user", reason: "version restore" },
      diff: {
        path: "/",
        before: { version: genome.version },
        after: { version: targetVersion, restored: true }
      }
    });
    return this.get(id);
  }
  async getVersions(id) {
    const genome = await this.get(id);
    if (!genome) return [];
    const { getVersionHistory: getVersionHistory2 } = await import("./versioning-XXPNXZDA.js");
    const rollbackWindow = genome.config?.evolution?.rollbackWindow ?? 24;
    return getVersionHistory2(genome, rollbackWindow);
  }
  async diff(id, fromVersion, toVersion) {
    const genome = await this.get(id);
    if (!genome) throw new Error("Genome not found");
    const { diffVersions: diffVersions2 } = await import("./versioning-XXPNXZDA.js");
    return diffVersions2(genome, fromVersion, toVersion);
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

// src/mutations.ts
function requiresConsent(mutationType, trigger, consentLevel) {
  if (trigger.source === "user") return false;
  if (trigger.source === "system") return false;
  if (consentLevel === "none") return false;
  if (consentLevel === "all") return true;
  const majorChanges = [
    "identity_update",
    "tool_add",
    "tool_remove",
    "rule_add",
    "rule_remove",
    "trait_add",
    "trait_remove"
  ];
  return majorChanges.includes(mutationType);
}
function isWithinRollbackWindow(mutation, windowHours) {
  if (!mutation.appliedAt || mutation.status !== "applied") return false;
  const windowMs = windowHours * 60 * 60 * 1e3;
  const appliedTime = mutation.appliedAt instanceof Date ? mutation.appliedAt.getTime() : new Date(mutation.appliedAt).getTime();
  return Date.now() - appliedTime < windowMs;
}
function validateMutation(mutation, currentGenome) {
  const errors = [];
  const warnings = [];
  const validTypes = [
    "trait_add",
    "trait_remove",
    "trait_adjust",
    "rule_add",
    "rule_remove",
    "rule_modify",
    "tool_add",
    "tool_remove",
    "tool_config",
    "skill_add",
    "skill_improve",
    "skill_decay",
    "config_change",
    "identity_update"
  ];
  if (!validTypes.includes(mutation.type)) {
    errors.push(`Invalid mutation type: ${mutation.type}`);
  }
  if (mutation.type.startsWith("trait_")) {
    validateTraitMutation(mutation, errors, warnings);
  }
  if (mutation.type.startsWith("rule_")) {
    validateRuleMutation(mutation, errors, warnings);
  }
  if (mutation.type.startsWith("tool_")) {
    validateToolMutation(mutation, currentGenome, errors, warnings);
  }
  if (!mutation.trigger?.source) {
    errors.push("Mutation trigger source is required");
  }
  if (!mutation.diff) {
    errors.push("Mutation diff is required");
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
function getProp(obj, key) {
  if (obj && typeof obj === "object" && key in obj) {
    return obj[key];
  }
  return void 0;
}
function validateTraitMutation(mutation, errors, warnings) {
  const { diff, type } = mutation;
  const afterName = getProp(diff.after, "name");
  const afterWeight = getProp(diff.after, "weight");
  if (type !== "trait_remove" && !afterName) {
    errors.push("Trait mutations require a name");
  }
  if (afterWeight !== void 0) {
    if (typeof afterWeight !== "number") {
      errors.push("Trait weight must be a number");
    } else if (afterWeight < 0 || afterWeight > 1) {
      errors.push("Trait weight must be between 0 and 1");
    }
  }
  if (type === "trait_adjust" && !diff.before) {
    warnings.push("trait_adjust without before value - cannot verify change");
  }
}
function validateRuleMutation(mutation, errors, warnings) {
  const { diff, type } = mutation;
  const afterDesc = getProp(diff.after, "description");
  const afterType = getProp(diff.after, "type");
  const afterPriority = getProp(diff.after, "priority");
  if (type !== "rule_remove" && !afterDesc) {
    errors.push("Rule mutations require a description");
  }
  if (afterType) {
    const validRuleTypes = ["must", "should", "prefer", "avoid"];
    if (!validRuleTypes.includes(String(afterType))) {
      errors.push(`Invalid rule type: ${afterType}`);
    }
  }
  if (afterPriority !== void 0) {
    if (typeof afterPriority !== "number" || afterPriority < 1 || afterPriority > 10) {
      warnings.push("Rule priority should be between 1 and 10");
    }
  }
}
function validateToolMutation(mutation, genome, errors, warnings) {
  const { diff, type } = mutation;
  const afterId = getProp(diff.after, "id");
  const afterName = getProp(diff.after, "name");
  const beforeId = getProp(diff.before, "id");
  if (type === "tool_add") {
    if (!afterId && !afterName) {
      errors.push("Tool add requires tool id or name");
    }
    if (afterId && genome.tools.some((t) => t.id === afterId)) {
      warnings.push(`Tool ${afterId} already exists - will update instead of add`);
    }
  }
  if (type === "tool_remove") {
    if (beforeId && !genome.tools.some((t) => t.id === beforeId)) {
      errors.push(`Tool ${beforeId} not found in genome`);
    }
  }
}
function describeMutation(type, diff) {
  const get = (obj, key) => {
    if (obj && typeof obj === "object" && key in obj) {
      return obj[key];
    }
    return void 0;
  };
  const getName = (obj) => String(get(obj, "name") || get(obj, "id") || "unknown");
  const getDesc = (obj) => String(get(obj, "description") || "unknown");
  const getWeight = (obj) => {
    const w = get(obj, "weight");
    return typeof w === "number" ? w.toFixed(2) : "?";
  };
  const getConfidence = (obj) => {
    const c = get(obj, "confidence");
    return typeof c === "number" ? (c * 100).toFixed(0) + "%" : "?";
  };
  const descriptions = {
    trait_add: () => `Added trait: ${getName(diff.after)}`,
    trait_remove: () => `Removed trait: ${getName(diff.before)}`,
    trait_adjust: () => `Adjusted "${getName(diff.before)}": ${getWeight(diff.before)} \u2192 ${getWeight(diff.after)}`,
    rule_add: () => `Added rule: "${truncate(getDesc(diff.after), 50)}"`,
    rule_remove: () => `Removed rule: "${truncate(getDesc(diff.before), 50)}"`,
    rule_modify: () => `Modified rule: "${truncate(getDesc(diff.before), 50)}"`,
    tool_add: () => `Installed tool: ${getName(diff.after)}`,
    tool_remove: () => `Removed tool: ${getName(diff.before)}`,
    tool_config: () => `Updated tool config: ${getName(diff.before)}`,
    skill_add: () => `Learned skill: ${getName(diff.after)}`,
    skill_improve: () => `Improved "${getName(diff.before)}": ${getConfidence(diff.before)} \u2192 ${getConfidence(diff.after)}`,
    skill_decay: () => `Skill decay: "${getName(diff.before)}" (unused)`,
    config_change: () => `Configuration changed: ${diff.path}`,
    identity_update: () => `Identity updated`
  };
  return descriptions[type]?.() || `Mutation: ${type}`;
}
function truncate(str, len) {
  if (!str) return "unknown";
  return str.length > len ? str.substring(0, len - 3) + "..." : str;
}
function calculateFitnessChange(currentFitness, feedback, weight = 0.1) {
  const before = currentFitness;
  let after = currentFitness;
  switch (feedback) {
    case "positive":
      after = Math.min(1, currentFitness + weight * (1 - currentFitness));
      break;
    case "negative":
      after = Math.max(0, currentFitness - weight * currentFitness);
      break;
    case "neutral":
      after = currentFitness + (0.5 - currentFitness) * 0.01;
      break;
  }
  return { before, after: Math.round(after * 1e3) / 1e3 };
}
var MutationUtils = {
  requiresConsent,
  isWithinRollbackWindow,
  validate: validateMutation,
  describe: describeMutation,
  calculateFitnessChange
};
export {
  GenomeRegistry,
  MutationUtils,
  VersioningUtils,
  calculateFitnessChange,
  calculateRestore,
  describeMutation,
  diffGenomes,
  diffVersions,
  genomes,
  getDb,
  getPreviousVersion,
  getVersionHistory,
  isWithinRollbackWindow,
  mutations,
  reconstructAtVersion,
  requiresConsent,
  schema_exports as schema,
  validateMutation
};

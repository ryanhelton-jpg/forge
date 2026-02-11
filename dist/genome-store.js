/**
 * GenomeStore - SQLite-backed persistence for Agent Genomes
 *
 * Simplified version that works with the main forge package.
 */
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { MutationUtils } from './genome/mutations.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.FORGE_DB_PATH || join(__dirname, '../data', 'genome.db');
export class GenomeStore {
    db;
    constructor() {
        this.db = new Database(DB_PATH);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
    }
    // === CRUD Operations ===
    create(genome) {
        const now = Date.now();
        this.db.prepare(`
      INSERT INTO genomes (
        id, user_id, name, slug, version, parent_id, lineage,
        identity, tools, skills, knowledge, config, fitness,
        status, visibility, total_interactions, total_tokens, total_cost,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?
      )
    `).run(genome.id, genome.userId, genome.name, genome.slug, genome.version, genome.parentId || null, JSON.stringify(genome.lineage), JSON.stringify(genome.identity), JSON.stringify(genome.tools), JSON.stringify(genome.skills), JSON.stringify(genome.knowledge), JSON.stringify(genome.config), genome.fitness ? JSON.stringify(genome.fitness) : null, genome.status, genome.visibility, genome.stats.totalInteractions, genome.stats.totalTokens, genome.stats.totalCost, now, now);
        // Record creation mutation
        this.recordMutation(genome.id, genome.version, {
            type: 'identity_update',
            description: 'Agent created',
            trigger: { source: 'user' },
            diff: { path: '/', before: null, after: genome },
        });
        return genome;
    }
    get(id) {
        const row = this.db.prepare('SELECT * FROM genomes WHERE id = ?').get(id);
        if (!row)
            return null;
        return this.rowToGenome(row);
    }
    getBySlug(userId, slug) {
        const row = this.db.prepare('SELECT * FROM genomes WHERE user_id = ? AND slug = ?').get(userId, slug);
        if (!row)
            return null;
        return this.rowToGenome(row);
    }
    getDefault() {
        return this.get('default');
    }
    list(userId) {
        const rows = this.db.prepare('SELECT * FROM genomes WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
        return rows.map(row => this.rowToGenome(row));
    }
    update(genome) {
        const now = Date.now();
        this.db.prepare(`
      UPDATE genomes SET
        name = ?, slug = ?, version = ?,
        identity = ?, tools = ?, skills = ?, knowledge = ?, config = ?,
        fitness = ?, status = ?, visibility = ?,
        total_interactions = ?, total_tokens = ?, total_cost = ?,
        updated_at = ?
      WHERE id = ?
    `).run(genome.name, genome.slug, genome.version, JSON.stringify(genome.identity), JSON.stringify(genome.tools), JSON.stringify(genome.skills), JSON.stringify(genome.knowledge), JSON.stringify(genome.config), genome.fitness ? JSON.stringify(genome.fitness) : null, genome.status, genome.visibility, genome.stats.totalInteractions, genome.stats.totalTokens, genome.stats.totalCost, now, genome.id);
        return genome;
    }
    delete(id) {
        this.db.prepare('DELETE FROM mutations WHERE genome_id = ?').run(id);
        this.db.prepare('DELETE FROM genomes WHERE id = ?').run(id);
    }
    // === Mutation Operations ===
    addTrait(genomeId, trait) {
        const genome = this.get(genomeId);
        if (!genome)
            throw new Error('Genome not found');
        const oldTraits = [...genome.identity.personality];
        genome.identity.personality.push(trait);
        genome.version = MutationUtils.bumpVersion(genome.version, 'trait_add');
        this.update(genome);
        this.recordMutation(genomeId, genome.version, {
            type: 'trait_add',
            description: `Added trait: ${trait.name}`,
            trigger: { source: 'user' },
            diff: { path: 'identity.personality', before: oldTraits, after: genome.identity.personality },
        });
        return genome;
    }
    removeTrait(genomeId, traitId) {
        const genome = this.get(genomeId);
        if (!genome)
            throw new Error('Genome not found');
        const idx = genome.identity.personality.findIndex(t => t.id === traitId);
        if (idx === -1)
            throw new Error('Trait not found');
        const oldTraits = [...genome.identity.personality];
        const removed = genome.identity.personality.splice(idx, 1)[0];
        genome.version = MutationUtils.bumpVersion(genome.version, 'trait_remove');
        this.update(genome);
        this.recordMutation(genomeId, genome.version, {
            type: 'trait_remove',
            description: `Removed trait: ${removed.name}`,
            trigger: { source: 'user' },
            diff: { path: 'identity.personality', before: oldTraits, after: genome.identity.personality },
        });
        return genome;
    }
    addRule(genomeId, rule) {
        const genome = this.get(genomeId);
        if (!genome)
            throw new Error('Genome not found');
        const oldRules = [...genome.identity.constraints];
        genome.identity.constraints.push(rule);
        genome.version = MutationUtils.bumpVersion(genome.version, 'rule_add');
        this.update(genome);
        this.recordMutation(genomeId, genome.version, {
            type: 'rule_add',
            description: `Added rule: ${rule.description}`,
            trigger: { source: 'user' },
            diff: { path: 'identity.constraints', before: oldRules, after: genome.identity.constraints },
        });
        return genome;
    }
    removeRule(genomeId, ruleId) {
        const genome = this.get(genomeId);
        if (!genome)
            throw new Error('Genome not found');
        const idx = genome.identity.constraints.findIndex(r => r.id === ruleId);
        if (idx === -1)
            throw new Error('Rule not found');
        const oldRules = [...genome.identity.constraints];
        const removed = genome.identity.constraints.splice(idx, 1)[0];
        genome.version = MutationUtils.bumpVersion(genome.version, 'rule_remove');
        this.update(genome);
        this.recordMutation(genomeId, genome.version, {
            type: 'rule_remove',
            description: `Removed rule: ${removed.description}`,
            trigger: { source: 'user' },
            diff: { path: 'identity.constraints', before: oldRules, after: genome.identity.constraints },
        });
        return genome;
    }
    // === Mutation History ===
    getMutations(genomeId, limit = 50) {
        return this.db.prepare(`
      SELECT * FROM mutations 
      WHERE genome_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(genomeId, limit);
    }
    getVersionHistory(genomeId) {
        const mutations = this.getMutations(genomeId, 100);
        const versions = new Map();
        for (const m of mutations) {
            if (!versions.has(m.version)) {
                versions.set(m.version, {
                    version: m.version,
                    timestamp: m.timestamp,
                    description: m.description,
                });
            }
        }
        return Array.from(versions.values()).sort((a, b) => b.timestamp - a.timestamp);
    }
    // === Rollback ===
    rollback(genomeId, targetVersion) {
        const genome = this.get(genomeId);
        if (!genome)
            throw new Error('Genome not found');
        // Get all mutations after target version
        const mutations = this.getMutations(genomeId, 1000);
        const toRollback = mutations.filter(m => m.status === 'applied' && this.compareVersions(m.version, targetVersion) > 0);
        if (toRollback.length === 0) {
            throw new Error(`No mutations to rollback (already at or before ${targetVersion})`);
        }
        // Reverse mutations in order (newest first)
        for (const mutation of toRollback) {
            const diff = JSON.parse(mutation.diff);
            // Apply reverse diff
            if (diff.path === 'identity.personality') {
                genome.identity.personality = diff.before;
            }
            else if (diff.path === 'identity.constraints') {
                genome.identity.constraints = diff.before;
            }
            // Mark mutation as rolled back
            this.db.prepare(`
        UPDATE mutations SET status = 'rolled_back', rolled_back_at = ? WHERE id = ?
      `).run(Date.now(), mutation.id);
        }
        // Bump version (rollback is a new version)
        const [major, minor, patch] = genome.version.split('.').map(Number);
        genome.version = `${major}.${minor + 1}.0`;
        this.update(genome);
        this.recordMutation(genomeId, genome.version, {
            type: 'config_change',
            description: `Rolled back to v${targetVersion} (undid ${toRollback.length} mutations)`,
            trigger: { source: 'user', reason: 'rollback' },
            diff: { path: '/', before: { version: mutations[0]?.version }, after: { version: targetVersion, rolledBack: true } },
        });
        return genome;
    }
    // === Fitness Tracking ===
    recordInteraction(genomeId, result) {
        const genome = this.get(genomeId);
        if (!genome)
            return;
        genome.stats.totalInteractions++;
        genome.stats.totalTokens += result.tokens;
        genome.stats.totalCost += result.cost;
        // Update fitness if we have feedback
        if (result.userFeedback) {
            if (!genome.fitness) {
                genome.fitness = {
                    overall: 0.5,
                    metrics: {
                        taskCompletion: 0.5,
                        userSatisfaction: 0.5,
                        efficiency: 0.5,
                        reliability: 0.5,
                    },
                    sampleSize: 0,
                    lastEvaluated: new Date(),
                };
            }
            const satisfaction = genome.fitness.metrics.userSatisfaction;
            const weight = Math.min(genome.fitness.sampleSize, 20) / 20; // Smooth early samples
            const newSatisfaction = result.userFeedback === 'positive' ? 1.0 :
                result.userFeedback === 'negative' ? 0.0 : 0.5;
            genome.fitness.metrics.userSatisfaction = satisfaction * weight + newSatisfaction * (1 - weight);
            genome.fitness.metrics.taskCompletion = result.success ?
                Math.min(1.0, genome.fitness.metrics.taskCompletion + 0.02) :
                Math.max(0.0, genome.fitness.metrics.taskCompletion - 0.05);
            genome.fitness.sampleSize++;
            genome.fitness.overall = (genome.fitness.metrics.taskCompletion * 0.3 +
                genome.fitness.metrics.userSatisfaction * 0.4 +
                genome.fitness.metrics.efficiency * 0.15 +
                genome.fitness.metrics.reliability * 0.15);
            genome.fitness.lastEvaluated = new Date();
        }
        this.update(genome);
    }
    // === Evolution Proposals ===
    proposeEvolution(genomeId, context) {
        const genome = this.get(genomeId);
        if (!genome)
            return [];
        const proposals = [];
        // Analyze negative feedback patterns
        const negatives = context.recentFeedback.filter(f => f.sentiment === 'negative');
        if (negatives.length >= 3) {
            // Check for common themes
            const feedbackText = negatives.map(f => f.feedback.toLowerCase()).join(' ');
            if (feedbackText.includes('verbose') || feedbackText.includes('long') || feedbackText.includes('wordy')) {
                proposals.push({
                    type: 'trait_add',
                    description: 'more concise',
                    confidence: 0.7,
                    reason: 'Multiple users found responses too verbose',
                });
            }
            if (feedbackText.includes('confus') || feedbackText.includes('unclear')) {
                proposals.push({
                    type: 'trait_add',
                    description: 'clearer explanations',
                    confidence: 0.65,
                    reason: 'Users reported confusion with explanations',
                });
            }
        }
        // Check fitness thresholds
        if (genome.fitness && genome.fitness.sampleSize >= 10) {
            if (genome.fitness.metrics.userSatisfaction < 0.4) {
                proposals.push({
                    type: 'rule_add',
                    description: 'Ask clarifying questions before providing complex answers',
                    confidence: 0.75, // Above default threshold
                    reason: `Low user satisfaction (${Math.round(genome.fitness.metrics.userSatisfaction * 100)}%)`,
                });
            }
            if (genome.fitness.metrics.taskCompletion < 0.5) {
                proposals.push({
                    type: 'trait_add',
                    description: 'thorough',
                    confidence: 0.72,
                    reason: `Low task completion rate (${Math.round(genome.fitness.metrics.taskCompletion * 100)}%)`,
                });
            }
        }
        // Return all proposals that meet minimum confidence (don't filter here, let caller decide)
        return proposals;
    }
    // === Helper ===
    compareVersions(a, b) {
        const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
        const [bMajor, bMinor, bPatch] = b.split('.').map(Number);
        if (aMajor !== bMajor)
            return aMajor - bMajor;
        if (aMinor !== bMinor)
            return aMinor - bMinor;
        return aPatch - bPatch;
    }
    // === Private Helpers ===
    recordMutation(genomeId, version, mutation) {
        const now = Date.now();
        this.db.prepare(`
      INSERT INTO mutations (
        id, genome_id, version, type, description, trigger, diff, status, timestamp, applied_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), genomeId, version, mutation.type, mutation.description, JSON.stringify(mutation.trigger), JSON.stringify(mutation.diff), 'applied', now, now);
    }
    rowToGenome(row) {
        return {
            id: row.id,
            userId: row.user_id,
            name: row.name,
            slug: row.slug,
            version: row.version,
            parentId: row.parent_id || undefined,
            lineage: JSON.parse(row.lineage || '[]'),
            identity: JSON.parse(row.identity),
            tools: JSON.parse(row.tools || '[]'),
            skills: JSON.parse(row.skills || '[]'),
            knowledge: JSON.parse(row.knowledge || '[]'),
            config: JSON.parse(row.config),
            fitness: row.fitness ? JSON.parse(row.fitness) : undefined,
            status: row.status,
            visibility: row.visibility,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            lastActiveAt: row.last_active_at ? new Date(row.last_active_at) : undefined,
            stats: {
                totalInteractions: row.total_interactions || 0,
                totalTokens: row.total_tokens || 0,
                totalCost: row.total_cost || 0,
            },
        };
    }
    close() {
        this.db.close();
    }
}
// Singleton instance
let _store = null;
export function getGenomeStore() {
    if (!_store) {
        _store = new GenomeStore();
    }
    return _store;
}

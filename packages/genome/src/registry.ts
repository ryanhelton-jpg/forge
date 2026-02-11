// GenomeRegistry — CRUD operations for Agent Genomes

import { eq, desc, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import semver from 'semver';
import { getDb, schema } from './db.js';
import type {
  AgentGenome,
  CreateGenomeInput,
  ForkOptions,
  Mutation,
  MutationInput,
  MutationType,
  DEFAULT_CONFIG,
} from '@forge/core';

const { genomes, mutations } = schema;

export class GenomeRegistry {
  private get db() {
    return getDb();
  }

  // === CRUD Operations ===

  async create(input: CreateGenomeInput): Promise<AgentGenome> {
    const id = createId();
    const slug = this.slugify(input.name);

    const genome = {
      id,
      userId: input.userId,
      name: input.name,
      slug,
      version: '1.0.0',
      identity: input.identity,
      tools: input.tools || [],
      skills: [],
      knowledge: [],
      config: input.config || this.defaultConfig(),
      status: 'draft' as const,
      visibility: 'private' as const,
      totalInteractions: 0,
      totalTokens: 0,
      totalCost: 0,
    };

    await this.db.insert(genomes).values(genome);

    // Record creation mutation
    await this.recordMutation(id, '1.0.0', {
      type: 'identity_update',
      description: 'Agent created',
      trigger: { source: 'user' },
      diff: { path: '/', before: null, after: genome },
    });

    return this.get(id) as Promise<AgentGenome>;
  }

  async get(id: string): Promise<AgentGenome | null> {
    const result = await this.db.select().from(genomes).where(eq(genomes.id, id));
    if (!result.length) return null;

    const row = result[0];
    const mutationHistory = await this.db
      .select()
      .from(mutations)
      .where(eq(mutations.genomeId, id))
      .orderBy(desc(mutations.timestamp))
      .limit(100);

    return this.rowToGenome(row, mutationHistory);
  }

  async getBySlug(userId: string, slug: string): Promise<AgentGenome | null> {
    const result = await this.db
      .select()
      .from(genomes)
      .where(and(eq(genomes.userId, userId), eq(genomes.slug, slug)));

    if (!result.length) return null;

    const row = result[0];
    const mutationHistory = await this.db
      .select()
      .from(mutations)
      .where(eq(mutations.genomeId, row.id))
      .orderBy(desc(mutations.timestamp))
      .limit(100);

    return this.rowToGenome(row, mutationHistory);
  }

  async list(userId: string): Promise<AgentGenome[]> {
    const rows = await this.db
      .select()
      .from(genomes)
      .where(eq(genomes.userId, userId))
      .orderBy(desc(genomes.updatedAt));

    return Promise.all(rows.map(async (row) => {
      const mutationHistory = await this.db
        .select()
        .from(mutations)
        .where(eq(mutations.genomeId, row.id))
        .orderBy(desc(mutations.timestamp))
        .limit(10);
      return this.rowToGenome(row, mutationHistory);
    }));
  }

  async update(id: string, mutation: MutationInput): Promise<AgentGenome> {
    const current = await this.get(id);
    if (!current) throw new Error('Genome not found');

    const newVersion = this.bumpVersion(current.version, mutation.type);

    // Apply the mutation diff
    const updated = this.applyDiff(current, mutation.diff);

    await this.db.update(genomes)
      .set({
        ...updated,
        version: newVersion,
        updatedAt: new Date(),
      })
      .where(eq(genomes.id, id));

    await this.recordMutation(id, newVersion, mutation);

    return this.get(id) as Promise<AgentGenome>;
  }

  async delete(id: string): Promise<void> {
    // Delete mutations first (foreign key)
    await this.db.delete(mutations).where(eq(mutations.genomeId, id));
    await this.db.delete(genomes).where(eq(genomes.id, id));
  }

  // === Fork & Restore ===

  async fork(id: string, userId: string, options?: ForkOptions): Promise<AgentGenome> {
    const parent = await this.get(id);
    if (!parent) throw new Error('Genome not found');

    const forkedId = createId();
    const forkedName = options?.name || `${parent.name} (fork)`;

    const forked = {
      id: forkedId,
      userId,
      name: forkedName,
      slug: this.slugify(forkedName),
      version: '1.0.0',
      parentId: parent.id,
      lineage: [...parent.lineage, parent.id],
      identity: parent.identity,
      tools: parent.tools,
      skills: parent.skills,
      knowledge: parent.knowledge,
      config: parent.config,
      status: 'draft' as const,
      visibility: 'private' as const,
      totalInteractions: 0,
      totalTokens: 0,
      totalCost: 0,
    };

    await this.db.insert(genomes).values(forked);

    await this.recordMutation(forkedId, '1.0.0', {
      type: 'identity_update',
      description: `Forked from ${parent.name} v${parent.version}`,
      trigger: { source: 'user' },
      diff: { path: '/', before: null, after: forked },
    });

    return this.get(forkedId) as Promise<AgentGenome>;
  }

  async history(id: string, limit = 50): Promise<Mutation[]> {
    const rows = await this.db
      .select()
      .from(mutations)
      .where(eq(mutations.genomeId, id))
      .orderBy(desc(mutations.timestamp))
      .limit(limit);

    return rows.map(this.rowToMutation);
  }

  async restore(id: string, targetVersion: string): Promise<AgentGenome> {
    const genome = await this.get(id);
    if (!genome) throw new Error('Genome not found');

    // Import versioning utils inline to avoid circular deps
    const { calculateRestore, reconstructAtVersion } = await import('./versioning.js');

    // Calculate what needs to be rolled back
    const restoreResult = calculateRestore(genome, targetVersion);
    if (!restoreResult.success) {
      throw new Error(restoreResult.error || 'Restore failed');
    }

    // Reconstruct state at target version
    const allMutations = await this.history(id, 1000);
    const restoredState = reconstructAtVersion(genome, allMutations, targetVersion);

    // Bump version (this is a new version representing the restore)
    const newVersion = semver.inc(genome.version, 'minor') || genome.version;

    // Mark rolled-back mutations
    for (const mutation of restoreResult.rollbackMutations) {
      await this.db.update(mutations)
        .set({ 
          status: 'rolled_back', 
          rolledBackAt: new Date() 
        })
        .where(eq(mutations.id, mutation.id));
    }

    // Update genome with restored state
    await this.db.update(genomes)
      .set({
        ...restoredState,
        version: newVersion,
        updatedAt: new Date(),
      })
      .where(eq(genomes.id, id));

    // Record the restore as a mutation
    await this.recordMutation(id, newVersion, {
      type: 'config_change',
      description: `Restored to v${targetVersion}`,
      trigger: { source: 'user', reason: 'version restore' },
      diff: { 
        path: '/', 
        before: { version: genome.version }, 
        after: { version: targetVersion, restored: true } 
      },
    });

    return this.get(id) as Promise<AgentGenome>;
  }

  async getVersions(id: string): Promise<import('./versioning.js').VersionInfo[]> {
    const genome = await this.get(id);
    if (!genome) return [];

    const { getVersionHistory } = await import('./versioning.js');
    const rollbackWindow = genome.config?.evolution?.rollbackWindow ?? 24;
    return getVersionHistory(genome, rollbackWindow);
  }

  async diff(id: string, fromVersion: string, toVersion: string): Promise<import('./versioning.js').GenomeDiff> {
    const genome = await this.get(id);
    if (!genome) throw new Error('Genome not found');

    const { diffVersions } = await import('./versioning.js');
    return diffVersions(genome, fromVersion, toVersion);
  }

  // === Private Helpers ===

  private async recordMutation(genomeId: string, version: string, mutation: MutationInput) {
    await this.db.insert(mutations).values({
      genomeId,
      version,
      type: mutation.type,
      description: mutation.description,
      trigger: mutation.trigger,
      diff: mutation.diff,
      fitness: mutation.fitness,
      status: 'applied',
      appliedAt: new Date(),
    });
  }

  private applyDiff(genome: AgentGenome, diff: { path: string; before: unknown; after: unknown }): Partial<typeof genomes.$inferInsert> {
    // For now, direct field updates based on path
    // TODO: Implement proper JSON path diffing
    const path = diff.path;

    if (path === '/identity') {
      return { identity: diff.after as AgentGenome['identity'] };
    }
    if (path === '/config') {
      return { config: diff.after as AgentGenome['config'] };
    }
    if (path === '/tools') {
      return { tools: diff.after as AgentGenome['tools'] };
    }
    if (path === '/skills') {
      return { skills: diff.after as AgentGenome['skills'] };
    }
    if (path === '/knowledge') {
      return { knowledge: diff.after as AgentGenome['knowledge'] };
    }
    if (path === '/status') {
      return { status: diff.after as 'draft' | 'active' | 'archived' };
    }
    if (path === '/visibility') {
      return { visibility: diff.after as 'private' | 'unlisted' | 'public' };
    }

    // Default: return empty (no-op)
    return {};
  }

  private bumpVersion(current: string, mutationType: MutationType): string {
    const isMinor = mutationType.includes('identity') || mutationType.includes('config');
    const bump = isMinor ? 'minor' : 'patch';
    return semver.inc(current, bump) || current;
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private defaultConfig() {
    return {
      model: {
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet-4',
        temperature: 0.7,
        maxTokens: 4096,
      },
      memory: {
        conversationLimit: 50,
        factRetention: 'relevant' as const,
        summarizationThreshold: 10000,
      },
      evolution: {
        enabled: true,
        autoPropose: true,
        autoApply: false,
        consentThreshold: 'major' as const,
        rollbackWindow: 24,
      },
    };
  }

  private rowToGenome(row: typeof genomes.$inferSelect, mutationRows: typeof mutations.$inferSelect[]): AgentGenome {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      slug: row.slug,
      version: row.version,
      parentId: row.parentId ?? undefined,
      lineage: row.lineage ?? [],
      identity: row.identity,
      tools: row.tools ?? [],
      skills: row.skills ?? [],
      knowledge: row.knowledge ?? [],
      config: row.config,
      mutations: mutationRows.map(this.rowToMutation),
      fitness: row.fitness ?? undefined,
      status: row.status as 'draft' | 'active' | 'archived',
      visibility: row.visibility as 'private' | 'unlisted' | 'public',
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
      lastActiveAt: row.lastActiveAt ?? undefined,
      stats: {
        totalInteractions: row.totalInteractions ?? 0,
        totalTokens: row.totalTokens ?? 0,
        totalCost: row.totalCost ?? 0,
      },
    };
  }

  private rowToMutation(row: typeof mutations.$inferSelect): Mutation {
    return {
      id: row.id,
      genomeId: row.genomeId,
      version: row.version,
      timestamp: row.timestamp ?? new Date(),
      type: row.type as Mutation['type'],
      description: row.description,
      trigger: row.trigger as Mutation['trigger'],
      diff: row.diff as Mutation['diff'],
      fitness: row.fitness as Mutation['fitness'],
      status: row.status as Mutation['status'],
      appliedAt: row.appliedAt ?? undefined,
      rolledBackAt: row.rolledBackAt ?? undefined,
    };
  }
}

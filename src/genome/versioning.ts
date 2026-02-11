/**
 * Versioning Module
 * 
 * Handles forking, restoring, and diffing Agent Genomes.
 * Part of Forge 1.0 Sprint 1.
 */

import { createId } from '@paralleldrive/cuid2';
import * as semver from 'semver';
import type { Mutation, MutationDiff } from './mutations.js';

// === Types ===

export interface AgentGenome {
  id: string;
  userId: string;
  name: string;
  slug: string;
  version: string;
  parentId?: string;
  lineage: string[];
  identity: any;
  tools: any[];
  skills: any[];
  knowledge: any[];
  config: any;
  mutations: Mutation[];
  fitness?: any;
  status: 'draft' | 'active' | 'archived';
  visibility: 'private' | 'unlisted' | 'public';
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt?: Date;
  stats: {
    totalInteractions: number;
    totalTokens: number;
    totalCost: number;
  };
}

export interface ForkOptions {
  name?: string;
  slug?: string;
  includeHistory?: boolean;  // Include mutation history (default: false)
  fromVersion?: string;      // Fork from specific version (default: current)
}

export interface RestoreOptions {
  createBranch?: boolean;    // Create a new branch instead of modifying in place
  branchName?: string;
}

export interface GenomeDiff {
  fromVersion: string;
  toVersion: string;
  changes: DiffEntry[];
  summary: string;
}

export interface DiffEntry {
  path: string;
  type: 'added' | 'removed' | 'modified';
  before?: any;
  after?: any;
}

// === Forking ===

/**
 * Create a fork of an existing genome
 */
export function forkGenome(
  parent: AgentGenome,
  newUserId: string,
  options: ForkOptions = {}
): Omit<AgentGenome, 'mutations'> {
  const forkedId = createId();
  const forkedName = options.name || `${parent.name} (fork)`;
  const forkedSlug = options.slug || slugify(forkedName);
  
  // If forking from a specific version, we'd need to reconstruct that state
  // For now, we fork from current state
  
  return {
    id: forkedId,
    userId: newUserId,
    name: forkedName,
    slug: forkedSlug,
    version: '1.0.0',  // Forks start fresh
    parentId: parent.id,
    lineage: [...parent.lineage, parent.id],
    
    // Deep clone the content
    identity: structuredClone(parent.identity),
    tools: structuredClone(parent.tools),
    skills: structuredClone(parent.skills),
    knowledge: structuredClone(parent.knowledge),
    config: structuredClone(parent.config),
    
    // Inherit fitness baseline but reset stats
    fitness: parent.fitness ? { ...parent.fitness, lastEvaluated: new Date() } : undefined,
    
    status: 'draft',
    visibility: 'private',  // Forks are private by default
    
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActiveAt: undefined,
    
    stats: {
      totalInteractions: 0,
      totalTokens: 0,
      totalCost: 0,
    },
  };
}

/**
 * Check if a genome can be forked by a user
 */
export function canFork(genome: AgentGenome, userId: string): boolean {
  // Own genomes can always be forked
  if (genome.userId === userId) return true;
  
  // Public genomes can be forked
  if (genome.visibility === 'public') return true;
  
  // Unlisted genomes can be forked if you have the link (assume yes if checking)
  if (genome.visibility === 'unlisted') return true;
  
  return false;
}

// === Version Restoration ===

/**
 * Reconstruct genome state at a specific version by replaying mutations
 */
export function reconstructAtVersion(
  genome: AgentGenome,
  targetVersion: string
): Omit<AgentGenome, 'mutations'> {
  // Find mutations that were applied after the target version
  const mutationsToUndo = genome.mutations
    .filter(m => m.status === 'applied' && semver.gt(m.version, targetVersion))
    .sort((a, b) => semver.compare(b.version, a.version)); // Newest first
  
  // Start with current state and reverse mutations
  let state = structuredClone(genome);
  
  for (const mutation of mutationsToUndo) {
    state = reverseMutation(state, mutation.diff);
  }
  
  // Update version
  state.version = targetVersion;
  state.updatedAt = new Date();
  
  // Remove mutations array from return (handled separately)
  const { mutations, ...stateWithoutMutations } = state;
  return stateWithoutMutations;
}

/**
 * Get list of available versions from mutation history
 */
export function getVersionHistory(genome: AgentGenome): VersionInfo[] {
  const versions = new Map<string, VersionInfo>();
  
  // Initial version
  versions.set('1.0.0', {
    version: '1.0.0',
    timestamp: genome.createdAt,
    description: 'Initial creation',
    mutationCount: 0,
  });
  
  // Each mutation creates a version
  for (const mutation of genome.mutations) {
    if (mutation.status === 'applied') {
      const existing = versions.get(mutation.version);
      if (existing) {
        existing.mutationCount++;
      } else {
        versions.set(mutation.version, {
          version: mutation.version,
          timestamp: mutation.timestamp,
          description: mutation.description,
          mutationCount: 1,
        });
      }
    }
  }
  
  return Array.from(versions.values())
    .sort((a, b) => semver.compare(b.version, a.version)); // Newest first
}

export interface VersionInfo {
  version: string;
  timestamp: Date;
  description: string;
  mutationCount: number;
}

// === Diffing ===

/**
 * Generate a diff between two genome versions
 */
export function diffVersions(
  genome: AgentGenome,
  fromVersion: string,
  toVersion: string
): GenomeDiff {
  const mutations = genome.mutations
    .filter(m => 
      m.status === 'applied' &&
      semver.gt(m.version, fromVersion) &&
      semver.lte(m.version, toVersion)
    )
    .sort((a, b) => semver.compare(a.version, b.version));
  
  const changes: DiffEntry[] = mutations.map(m => ({
    path: m.diff.path,
    type: inferDiffType(m.diff),
    before: m.diff.before,
    after: m.diff.after,
  }));
  
  return {
    fromVersion,
    toVersion,
    changes,
    summary: generateDiffSummary(changes),
  };
}

/**
 * Compare two genomes directly (for fork comparison)
 */
export function diffGenomes(
  genome1: AgentGenome,
  genome2: AgentGenome
): GenomeDiff {
  const changes: DiffEntry[] = [];
  
  // Compare identity
  compareObjects(genome1.identity, genome2.identity, 'identity', changes);
  
  // Compare tools
  compareArrays(genome1.tools, genome2.tools, 'tools', 'id', changes);
  
  // Compare skills
  compareArrays(genome1.skills, genome2.skills, 'skills', 'id', changes);
  
  // Compare config
  compareObjects(genome1.config, genome2.config, 'config', changes);
  
  return {
    fromVersion: genome1.version,
    toVersion: genome2.version,
    changes,
    summary: generateDiffSummary(changes),
  };
}

// === Merging (for future use) ===

export interface MergeResult {
  success: boolean;
  merged?: Partial<AgentGenome>;
  conflicts?: MergeConflict[];
}

export interface MergeConflict {
  path: string;
  baseValue: any;
  ourValue: any;
  theirValue: any;
}

/**
 * Attempt to merge capabilities from another genome
 * (Used for skill/tool transplant)
 */
export function mergeCapabilities(
  target: AgentGenome,
  source: AgentGenome,
  paths: string[]  // Which paths to merge, e.g., ['tools', 'skills']
): MergeResult {
  const conflicts: MergeConflict[] = [];
  const merged: Partial<AgentGenome> = {};
  
  for (const path of paths) {
    if (path === 'tools') {
      // Merge tools by ID, detect conflicts
      const result = mergeArrayById(target.tools, source.tools, 'id');
      if (result.conflicts.length > 0) {
        conflicts.push(...result.conflicts.map(c => ({ ...c, path: `tools.${c.path}` })));
      }
      merged.tools = result.merged;
    }
    
    if (path === 'skills') {
      const result = mergeArrayById(target.skills, source.skills, 'id');
      if (result.conflicts.length > 0) {
        conflicts.push(...result.conflicts.map(c => ({ ...c, path: `skills.${c.path}` })));
      }
      merged.skills = result.merged;
    }
  }
  
  return {
    success: conflicts.length === 0,
    merged: conflicts.length === 0 ? merged : undefined,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
  };
}

// === Helper Functions ===

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 64);
}

function reverseMutation<T>(state: T, diff: MutationDiff): T {
  const result = structuredClone(state);
  setValueAtPath(result, diff.path, diff.before);
  return result;
}

function setValueAtPath(obj: any, path: string, value: any): void {
  const parts = path.split('.').filter(Boolean);
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  
  if (value === undefined) {
    delete current[parts[parts.length - 1]];
  } else {
    current[parts[parts.length - 1]] = value;
  }
}

function inferDiffType(diff: MutationDiff): 'added' | 'removed' | 'modified' {
  if (diff.before === undefined || diff.before === null) return 'added';
  if (diff.after === undefined || diff.after === null) return 'removed';
  return 'modified';
}

function compareObjects(
  obj1: any,
  obj2: any,
  basePath: string,
  changes: DiffEntry[]
): void {
  const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
  
  for (const key of keys) {
    const path = `${basePath}.${key}`;
    const val1 = obj1?.[key];
    const val2 = obj2?.[key];
    
    if (JSON.stringify(val1) !== JSON.stringify(val2)) {
      changes.push({
        path,
        type: val1 === undefined ? 'added' : val2 === undefined ? 'removed' : 'modified',
        before: val1,
        after: val2,
      });
    }
  }
}

function compareArrays(
  arr1: any[],
  arr2: any[],
  basePath: string,
  idKey: string,
  changes: DiffEntry[]
): void {
  const map1 = new Map(arr1.map(item => [item[idKey], item]));
  const map2 = new Map(arr2.map(item => [item[idKey], item]));
  
  // Find removed
  for (const [id, item] of map1) {
    if (!map2.has(id)) {
      changes.push({
        path: `${basePath}[${id}]`,
        type: 'removed',
        before: item,
      });
    }
  }
  
  // Find added and modified
  for (const [id, item] of map2) {
    const original = map1.get(id);
    if (!original) {
      changes.push({
        path: `${basePath}[${id}]`,
        type: 'added',
        after: item,
      });
    } else if (JSON.stringify(original) !== JSON.stringify(item)) {
      changes.push({
        path: `${basePath}[${id}]`,
        type: 'modified',
        before: original,
        after: item,
      });
    }
  }
}

function mergeArrayById(
  target: any[],
  source: any[],
  idKey: string
): { merged: any[]; conflicts: MergeConflict[] } {
  const conflicts: MergeConflict[] = [];
  const targetMap = new Map(target.map(item => [item[idKey], item]));
  const merged = [...target];
  
  for (const sourceItem of source) {
    const id = sourceItem[idKey];
    const existing = targetMap.get(id);
    
    if (!existing) {
      // New item, add it
      merged.push(structuredClone(sourceItem));
    } else if (JSON.stringify(existing) !== JSON.stringify(sourceItem)) {
      // Conflict: same ID, different content
      conflicts.push({
        path: id,
        baseValue: undefined,
        ourValue: existing,
        theirValue: sourceItem,
      });
    }
    // If identical, nothing to do
  }
  
  return { merged, conflicts };
}

function generateDiffSummary(changes: DiffEntry[]): string {
  const added = changes.filter(c => c.type === 'added').length;
  const removed = changes.filter(c => c.type === 'removed').length;
  const modified = changes.filter(c => c.type === 'modified').length;
  
  const parts: string[] = [];
  if (added > 0) parts.push(`+${added}`);
  if (removed > 0) parts.push(`-${removed}`);
  if (modified > 0) parts.push(`~${modified}`);
  
  return parts.join(' ') || 'No changes';
}

// === Export ===

export const VersioningUtils = {
  fork: forkGenome,
  canFork,
  reconstruct: reconstructAtVersion,
  getHistory: getVersionHistory,
  diffVersions,
  diffGenomes,
  merge: mergeCapabilities,
};

export default VersioningUtils;

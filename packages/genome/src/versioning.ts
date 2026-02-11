/**
 * Versioning Utilities
 * 
 * Restore, diff, and version history for Agent Genomes.
 */

import semver from 'semver';
import type { AgentGenome, Mutation } from '@forge/core';

// === Types ===

export interface VersionInfo {
  version: string;
  timestamp: Date;
  description: string;
  mutationType: Mutation['type'];
  trigger: Mutation['trigger']['source'];
  canRollback: boolean;
}

export interface GenomeDiff {
  fromVersion: string;
  toVersion: string;
  changes: DiffEntry[];
  summary: string;
  stats: {
    added: number;
    removed: number;
    modified: number;
  };
}

export interface DiffEntry {
  path: string;
  type: 'added' | 'removed' | 'modified';
  description: string;
  before?: unknown;
  after?: unknown;
}

export interface RestoreResult {
  success: boolean;
  version: string;
  rollbackMutations: Mutation[];
  error?: string;
}

// === Version History ===

/**
 * Get chronological version history for a genome
 */
export function getVersionHistory(
  genome: AgentGenome,
  rollbackWindowHours: number = 24
): VersionInfo[] {
  const versions = new Map<string, VersionInfo>();
  const now = Date.now();
  const rollbackWindowMs = rollbackWindowHours * 60 * 60 * 1000;
  
  // Initial version
  versions.set('1.0.0', {
    version: '1.0.0',
    timestamp: genome.createdAt,
    description: 'Initial creation',
    mutationType: 'identity_update',
    trigger: 'user',
    canRollback: false, // Can't rollback creation
  });
  
  // Add each mutation's version
  for (const mutation of genome.mutations) {
    if (mutation.status === 'applied' && mutation.version !== '1.0.0') {
      const appliedAt = mutation.appliedAt instanceof Date 
        ? mutation.appliedAt 
        : new Date(mutation.appliedAt || mutation.timestamp);
      
      const canRollback = (now - appliedAt.getTime()) < rollbackWindowMs;
      
      versions.set(mutation.version, {
        version: mutation.version,
        timestamp: mutation.timestamp instanceof Date ? mutation.timestamp : new Date(mutation.timestamp),
        description: mutation.description,
        mutationType: mutation.type,
        trigger: mutation.trigger.source,
        canRollback,
      });
    }
  }
  
  // Sort by version (newest first)
  return Array.from(versions.values())
    .sort((a, b) => semver.compare(b.version, a.version));
}

/**
 * Get the previous version before a given version
 */
export function getPreviousVersion(
  genome: AgentGenome,
  currentVersion: string
): string | null {
  const versions = getVersionHistory(genome)
    .map(v => v.version)
    .sort((a, b) => semver.compare(a, b));
  
  const currentIndex = versions.indexOf(currentVersion);
  if (currentIndex <= 0) return null;
  
  return versions[currentIndex - 1];
}

// === Restore ===

/**
 * Calculate what mutations need to be rolled back to restore to a version
 */
export function calculateRestore(
  genome: AgentGenome,
  targetVersion: string
): RestoreResult {
  // Can't restore to a version newer than current
  if (semver.gt(targetVersion, genome.version)) {
    return {
      success: false,
      version: targetVersion,
      rollbackMutations: [],
      error: `Cannot restore to future version ${targetVersion} (current: ${genome.version})`,
    };
  }
  
  // Find mutations to roll back (everything after target version)
  const toRollback = genome.mutations
    .filter(m => 
      m.status === 'applied' &&
      semver.gt(m.version, targetVersion)
    )
    .sort((a, b) => semver.compare(b.version, a.version)); // Newest first
  
  if (toRollback.length === 0 && genome.version !== targetVersion) {
    return {
      success: false,
      version: targetVersion,
      rollbackMutations: [],
      error: `No path to restore from ${genome.version} to ${targetVersion}`,
    };
  }
  
  return {
    success: true,
    version: targetVersion,
    rollbackMutations: toRollback,
  };
}

/**
 * Reconstruct genome state at a specific version
 * Returns the fields that should be updated
 */
export function reconstructAtVersion(
  genome: AgentGenome,
  mutations: Mutation[],
  targetVersion: string
): Partial<AgentGenome> {
  // Get mutations to undo (applied after target version)
  const toUndo = mutations
    .filter(m => 
      m.status === 'applied' &&
      semver.gt(m.version, targetVersion)
    )
    .sort((a, b) => semver.compare(b.version, a.version)); // Newest first (undo in reverse order)
  
  // Clone current state
  let state: Partial<AgentGenome> = {
    identity: structuredClone(genome.identity),
    tools: structuredClone(genome.tools),
    skills: structuredClone(genome.skills),
    knowledge: structuredClone(genome.knowledge),
    config: structuredClone(genome.config),
  };
  
  // Undo each mutation
  for (const mutation of toUndo) {
    state = applyReverseDiff(state, mutation.diff);
  }
  
  return state;
}

/**
 * Apply a mutation diff in reverse (restore previous value)
 */
function applyReverseDiff(
  state: Partial<AgentGenome>,
  diff: Mutation['diff']
): Partial<AgentGenome> {
  const path = diff.path;
  const before = diff.before;
  
  // Top-level field restoration with type assertions
  // The stored diff.before should match the expected type for that path
  if (path === '/identity' || path === 'identity') {
    return { ...state, identity: before as AgentGenome['identity'] };
  }
  if (path === '/tools' || path === 'tools') {
    return { ...state, tools: before as AgentGenome['tools'] };
  }
  if (path === '/skills' || path === 'skills') {
    return { ...state, skills: before as AgentGenome['skills'] };
  }
  if (path === '/knowledge' || path === 'knowledge') {
    return { ...state, knowledge: before as AgentGenome['knowledge'] };
  }
  if (path === '/config' || path === 'config') {
    return { ...state, config: before as AgentGenome['config'] };
  }
  
  // Nested path restoration (e.g., identity.personality[0])
  // For now, return state unchanged for complex paths
  // TODO: Implement proper JSON path reversal
  
  return state;
}

// === Diffing ===

/**
 * Generate diff between two versions of a genome
 */
export function diffVersions(
  genome: AgentGenome,
  fromVersion: string,
  toVersion: string
): GenomeDiff {
  // Get mutations between versions
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
    description: m.description,
    before: m.diff.before,
    after: m.diff.after,
  }));
  
  const stats = {
    added: changes.filter(c => c.type === 'added').length,
    removed: changes.filter(c => c.type === 'removed').length,
    modified: changes.filter(c => c.type === 'modified').length,
  };
  
  return {
    fromVersion,
    toVersion,
    changes,
    summary: generateSummary(stats, mutations.length),
    stats,
  };
}

/**
 * Compare two different genomes (e.g., parent and fork)
 */
export function diffGenomes(
  genome1: AgentGenome,
  genome2: AgentGenome
): GenomeDiff {
  const changes: DiffEntry[] = [];
  
  // Compare identity
  if (JSON.stringify(genome1.identity) !== JSON.stringify(genome2.identity)) {
    changes.push({
      path: '/identity',
      type: 'modified',
      description: 'Identity changed',
      before: genome1.identity,
      after: genome2.identity,
    });
  }
  
  // Compare tools
  const toolChanges = compareArrays(genome1.tools, genome2.tools, 'id', 'tools');
  changes.push(...toolChanges);
  
  // Compare skills
  const skillChanges = compareArrays(genome1.skills, genome2.skills, 'id', 'skills');
  changes.push(...skillChanges);
  
  // Compare config
  if (JSON.stringify(genome1.config) !== JSON.stringify(genome2.config)) {
    changes.push({
      path: '/config',
      type: 'modified',
      description: 'Configuration changed',
      before: genome1.config,
      after: genome2.config,
    });
  }
  
  const stats = {
    added: changes.filter(c => c.type === 'added').length,
    removed: changes.filter(c => c.type === 'removed').length,
    modified: changes.filter(c => c.type === 'modified').length,
  };
  
  return {
    fromVersion: genome1.version,
    toVersion: genome2.version,
    changes,
    summary: generateSummary(stats, changes.length),
    stats,
  };
}

// === Helpers ===

function inferDiffType(diff: Mutation['diff']): 'added' | 'removed' | 'modified' {
  if (diff.before === null || diff.before === undefined) return 'added';
  if (diff.after === null || diff.after === undefined) return 'removed';
  return 'modified';
}

function compareArrays(
  arr1: any[],
  arr2: any[],
  idKey: string,
  basePath: string
): DiffEntry[] {
  const changes: DiffEntry[] = [];
  const map1 = new Map(arr1.map(item => [item[idKey], item]));
  const map2 = new Map(arr2.map(item => [item[idKey], item]));
  
  // Find removed
  for (const [id, item] of map1) {
    if (!map2.has(id)) {
      changes.push({
        path: `/${basePath}/${id}`,
        type: 'removed',
        description: `Removed ${basePath.slice(0, -1)}: ${item.name || id}`,
        before: item,
      });
    }
  }
  
  // Find added and modified
  for (const [id, item] of map2) {
    const original = map1.get(id);
    if (!original) {
      changes.push({
        path: `/${basePath}/${id}`,
        type: 'added',
        description: `Added ${basePath.slice(0, -1)}: ${item.name || id}`,
        after: item,
      });
    } else if (JSON.stringify(original) !== JSON.stringify(item)) {
      changes.push({
        path: `/${basePath}/${id}`,
        type: 'modified',
        description: `Modified ${basePath.slice(0, -1)}: ${item.name || id}`,
        before: original,
        after: item,
      });
    }
  }
  
  return changes;
}

function generateSummary(stats: { added: number; removed: number; modified: number }, total: number): string {
  if (total === 0) return 'No changes';
  
  const parts: string[] = [];
  if (stats.added > 0) parts.push(`+${stats.added}`);
  if (stats.removed > 0) parts.push(`-${stats.removed}`);
  if (stats.modified > 0) parts.push(`~${stats.modified}`);
  
  return `${total} change${total === 1 ? '' : 's'} (${parts.join(', ')})`;
}

// === Export ===

export const VersioningUtils = {
  getHistory: getVersionHistory,
  getPreviousVersion,
  calculateRestore,
  reconstructAtVersion,
  diffVersions,
  diffGenomes,
};

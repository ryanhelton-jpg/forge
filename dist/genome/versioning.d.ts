/**
 * Versioning Module
 *
 * Handles forking, restoring, and diffing Agent Genomes.
 * Part of Forge 1.0 Sprint 1.
 */
import type { Mutation } from './mutations.js';
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
    includeHistory?: boolean;
    fromVersion?: string;
}
export interface RestoreOptions {
    createBranch?: boolean;
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
/**
 * Create a fork of an existing genome
 */
export declare function forkGenome(parent: AgentGenome, newUserId: string, options?: ForkOptions): Omit<AgentGenome, 'mutations'>;
/**
 * Check if a genome can be forked by a user
 */
export declare function canFork(genome: AgentGenome, userId: string): boolean;
/**
 * Reconstruct genome state at a specific version by replaying mutations
 */
export declare function reconstructAtVersion(genome: AgentGenome, targetVersion: string): Omit<AgentGenome, 'mutations'>;
/**
 * Get list of available versions from mutation history
 */
export declare function getVersionHistory(genome: AgentGenome): VersionInfo[];
export interface VersionInfo {
    version: string;
    timestamp: Date;
    description: string;
    mutationCount: number;
}
/**
 * Generate a diff between two genome versions
 */
export declare function diffVersions(genome: AgentGenome, fromVersion: string, toVersion: string): GenomeDiff;
/**
 * Compare two genomes directly (for fork comparison)
 */
export declare function diffGenomes(genome1: AgentGenome, genome2: AgentGenome): GenomeDiff;
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
export declare function mergeCapabilities(target: AgentGenome, source: AgentGenome, paths: string[]): MergeResult;
export declare const VersioningUtils: {
    fork: typeof forkGenome;
    canFork: typeof canFork;
    reconstruct: typeof reconstructAtVersion;
    getHistory: typeof getVersionHistory;
    diffVersions: typeof diffVersions;
    diffGenomes: typeof diffGenomes;
    merge: typeof mergeCapabilities;
};
export default VersioningUtils;

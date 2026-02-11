/**
 * GenomeStore - SQLite-backed persistence for Agent Genomes
 *
 * Simplified version that works with the main forge package.
 */
import type { AgentGenome, Trait, Rule } from './genome/types.js';
import type { MutationType } from './genome/mutations.js';
interface MutationRecord {
    id: string;
    genome_id: string;
    version: string;
    type: string;
    description: string;
    trigger: string;
    diff: string;
    fitness: string | null;
    status: string;
    timestamp: number;
    applied_at: number | null;
    rolled_back_at: number | null;
}
export declare class GenomeStore {
    private db;
    constructor();
    create(genome: AgentGenome): AgentGenome;
    get(id: string): AgentGenome | null;
    getBySlug(userId: string, slug: string): AgentGenome | null;
    getDefault(): AgentGenome | null;
    list(userId: string): AgentGenome[];
    update(genome: AgentGenome): AgentGenome;
    delete(id: string): void;
    addTrait(genomeId: string, trait: Trait): AgentGenome;
    removeTrait(genomeId: string, traitId: string): AgentGenome;
    addRule(genomeId: string, rule: Rule): AgentGenome;
    removeRule(genomeId: string, ruleId: string): AgentGenome;
    getMutations(genomeId: string, limit?: number): MutationRecord[];
    getVersionHistory(genomeId: string): {
        version: string;
        timestamp: number;
        description: string;
    }[];
    rollback(genomeId: string, targetVersion: string): AgentGenome;
    recordInteraction(genomeId: string, result: {
        success: boolean;
        tokens: number;
        cost: number;
        responseTimeMs?: number;
        userFeedback?: 'positive' | 'negative' | 'neutral';
    }): void;
    proposeEvolution(genomeId: string, context: {
        recentFeedback: Array<{
            feedback: string;
            sentiment: 'positive' | 'negative' | 'neutral';
        }>;
        recentTopics: string[];
    }): Array<{
        type: MutationType;
        description: string;
        confidence: number;
        reason: string;
    }>;
    private compareVersions;
    private recordMutation;
    private rowToGenome;
    close(): void;
}
export declare function getGenomeStore(): GenomeStore;
export {};

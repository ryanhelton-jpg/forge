/**
 * Mutation Tracking Module
 *
 * Handles recording, applying, and rolling back mutations to Agent Genomes.
 * Part of Forge 1.0 Sprint 1.
 */
export type MutationType = 'trait_add' | 'trait_remove' | 'trait_adjust' | 'rule_add' | 'rule_remove' | 'rule_modify' | 'tool_add' | 'tool_remove' | 'tool_config' | 'skill_add' | 'skill_improve' | 'skill_decay' | 'config_change' | 'identity_update';
export interface MutationTrigger {
    source: 'user' | 'evolution' | 'system' | 'inherited';
    reason?: string;
    confidence?: number;
    interactionId?: string;
}
export interface MutationDiff {
    path: string;
    before: any;
    after: any;
}
export interface FitnessChange {
    before: number;
    after: number;
    metrics?: Record<string, number>;
}
export interface Mutation {
    id: string;
    genomeId: string;
    version: string;
    timestamp: Date;
    type: MutationType;
    description: string;
    trigger: MutationTrigger;
    diff: MutationDiff;
    fitness?: FitnessChange;
    status: 'pending' | 'applied' | 'rolled_back';
    appliedAt?: Date;
    rolledBackAt?: Date;
}
export interface MutationInput {
    type: MutationType;
    description: string;
    trigger: MutationTrigger;
    diff: MutationDiff;
    fitness?: FitnessChange;
}
export declare function createMutation(genomeId: string, version: string, input: MutationInput): Mutation;
export declare function bumpVersion(current: string, mutationType: MutationType): string;
export declare function createDiff(path: string, before: any, after: any): MutationDiff;
export declare function describeMutation(type: MutationType, diff: MutationDiff): string;
/**
 * Apply a mutation to a genome object (pure function, returns new object)
 */
export declare function applyMutationToGenome<T extends object>(genome: T, diff: MutationDiff): T;
/**
 * Reverse a mutation (for rollback)
 */
export declare function reverseMutation<T extends object>(genome: T, diff: MutationDiff): T;
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export declare function validateMutation(mutation: MutationInput, currentGenome: any): ValidationResult;
export type ConsentLevel = 'none' | 'major' | 'all';
export declare function requiresConsent(mutationType: MutationType, trigger: MutationTrigger, consentLevel: ConsentLevel): boolean;
export declare function isWithinRollbackWindow(mutation: Mutation, windowHours: number): boolean;
export declare const MutationUtils: {
    create: typeof createMutation;
    bumpVersion: typeof bumpVersion;
    createDiff: typeof createDiff;
    describe: typeof describeMutation;
    apply: typeof applyMutationToGenome;
    reverse: typeof reverseMutation;
    validate: typeof validateMutation;
    requiresConsent: typeof requiresConsent;
    isWithinRollbackWindow: typeof isWithinRollbackWindow;
};
export default MutationUtils;

import { Mutation, AgentGenome, CreateGenomeInput, MutationInput, ForkOptions, Identity, ToolRef, SkillRef, KnowledgeRef, AgentConfig, GenomeFitness, MutationType } from '@forge/core';
import * as drizzle_orm_better_sqlite3 from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as drizzle_orm_sqlite_core from 'drizzle-orm/sqlite-core';

/**
 * Versioning Utilities
 *
 * Restore, diff, and version history for Agent Genomes.
 */

interface VersionInfo {
    version: string;
    timestamp: Date;
    description: string;
    mutationType: Mutation['type'];
    trigger: Mutation['trigger']['source'];
    canRollback: boolean;
}
interface GenomeDiff {
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
interface DiffEntry {
    path: string;
    type: 'added' | 'removed' | 'modified';
    description: string;
    before?: unknown;
    after?: unknown;
}
interface RestoreResult {
    success: boolean;
    version: string;
    rollbackMutations: Mutation[];
    error?: string;
}
/**
 * Get chronological version history for a genome
 */
declare function getVersionHistory(genome: AgentGenome, rollbackWindowHours?: number): VersionInfo[];
/**
 * Get the previous version before a given version
 */
declare function getPreviousVersion(genome: AgentGenome, currentVersion: string): string | null;
/**
 * Calculate what mutations need to be rolled back to restore to a version
 */
declare function calculateRestore(genome: AgentGenome, targetVersion: string): RestoreResult;
/**
 * Reconstruct genome state at a specific version
 * Returns the fields that should be updated
 */
declare function reconstructAtVersion(genome: AgentGenome, mutations: Mutation[], targetVersion: string): Partial<AgentGenome>;
/**
 * Generate diff between two versions of a genome
 */
declare function diffVersions(genome: AgentGenome, fromVersion: string, toVersion: string): GenomeDiff;
/**
 * Compare two different genomes (e.g., parent and fork)
 */
declare function diffGenomes(genome1: AgentGenome, genome2: AgentGenome): GenomeDiff;
declare const VersioningUtils: {
    getHistory: typeof getVersionHistory;
    getPreviousVersion: typeof getPreviousVersion;
    calculateRestore: typeof calculateRestore;
    reconstructAtVersion: typeof reconstructAtVersion;
    diffVersions: typeof diffVersions;
    diffGenomes: typeof diffGenomes;
};

declare class GenomeRegistry {
    private get db();
    create(input: CreateGenomeInput): Promise<AgentGenome>;
    get(id: string): Promise<AgentGenome | null>;
    getBySlug(userId: string, slug: string): Promise<AgentGenome | null>;
    list(userId: string): Promise<AgentGenome[]>;
    update(id: string, mutation: MutationInput): Promise<AgentGenome>;
    delete(id: string): Promise<void>;
    fork(id: string, userId: string, options?: ForkOptions): Promise<AgentGenome>;
    history(id: string, limit?: number): Promise<Mutation[]>;
    restore(id: string, targetVersion: string): Promise<AgentGenome>;
    getVersions(id: string): Promise<VersionInfo[]>;
    diff(id: string, fromVersion: string, toVersion: string): Promise<GenomeDiff>;
    private recordMutation;
    private applyDiff;
    private bumpVersion;
    private slugify;
    private defaultConfig;
    private rowToGenome;
    private rowToMutation;
}

declare const genomes: drizzle_orm_sqlite_core.SQLiteTableWithColumns<{
    name: "genomes";
    schema: undefined;
    columns: {
        id: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "id";
            tableName: "genomes";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: true;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        userId: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "user_id";
            tableName: "genomes";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        name: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "name";
            tableName: "genomes";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        slug: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "slug";
            tableName: "genomes";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        version: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "version";
            tableName: "genomes";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        parentId: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "parent_id";
            tableName: "genomes";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        lineage: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "lineage";
            tableName: "genomes";
            dataType: "json";
            columnType: "SQLiteTextJson";
            data: string[];
            driverParam: string;
            notNull: false;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            $type: string[];
        }>;
        identity: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "identity";
            tableName: "genomes";
            dataType: "json";
            columnType: "SQLiteTextJson";
            data: Identity;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            $type: Identity;
        }>;
        tools: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "tools";
            tableName: "genomes";
            dataType: "json";
            columnType: "SQLiteTextJson";
            data: ToolRef[];
            driverParam: string;
            notNull: false;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            $type: ToolRef[];
        }>;
        skills: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "skills";
            tableName: "genomes";
            dataType: "json";
            columnType: "SQLiteTextJson";
            data: SkillRef[];
            driverParam: string;
            notNull: false;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            $type: SkillRef[];
        }>;
        knowledge: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "knowledge";
            tableName: "genomes";
            dataType: "json";
            columnType: "SQLiteTextJson";
            data: KnowledgeRef[];
            driverParam: string;
            notNull: false;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            $type: KnowledgeRef[];
        }>;
        config: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "config";
            tableName: "genomes";
            dataType: "json";
            columnType: "SQLiteTextJson";
            data: AgentConfig;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            $type: AgentConfig;
        }>;
        fitness: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "fitness";
            tableName: "genomes";
            dataType: "json";
            columnType: "SQLiteTextJson";
            data: GenomeFitness;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            $type: GenomeFitness;
        }>;
        status: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "status";
            tableName: "genomes";
            dataType: "string";
            columnType: "SQLiteText";
            data: "draft" | "active" | "archived";
            driverParam: string;
            notNull: false;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["draft", "active", "archived"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        visibility: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "visibility";
            tableName: "genomes";
            dataType: "string";
            columnType: "SQLiteText";
            data: "private" | "unlisted" | "public";
            driverParam: string;
            notNull: false;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["private", "unlisted", "public"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        totalInteractions: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "total_interactions";
            tableName: "genomes";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: false;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        totalTokens: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "total_tokens";
            tableName: "genomes";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: false;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        totalCost: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "total_cost";
            tableName: "genomes";
            dataType: "number";
            columnType: "SQLiteReal";
            data: number;
            driverParam: number;
            notNull: false;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "created_at";
            tableName: "genomes";
            dataType: "date";
            columnType: "SQLiteTimestamp";
            data: Date;
            driverParam: number;
            notNull: false;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: true;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        updatedAt: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "updated_at";
            tableName: "genomes";
            dataType: "date";
            columnType: "SQLiteTimestamp";
            data: Date;
            driverParam: number;
            notNull: false;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: true;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        lastActiveAt: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "last_active_at";
            tableName: "genomes";
            dataType: "date";
            columnType: "SQLiteTimestamp";
            data: Date;
            driverParam: number;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "sqlite";
}>;
declare const mutations: drizzle_orm_sqlite_core.SQLiteTableWithColumns<{
    name: "mutations";
    schema: undefined;
    columns: {
        id: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "id";
            tableName: "mutations";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: true;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        genomeId: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "genome_id";
            tableName: "mutations";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        version: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "version";
            tableName: "mutations";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        type: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "type";
            tableName: "mutations";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        description: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "description";
            tableName: "mutations";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        trigger: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "trigger";
            tableName: "mutations";
            dataType: "json";
            columnType: "SQLiteTextJson";
            data: unknown;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        diff: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "diff";
            tableName: "mutations";
            dataType: "json";
            columnType: "SQLiteTextJson";
            data: unknown;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        fitness: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "fitness";
            tableName: "mutations";
            dataType: "json";
            columnType: "SQLiteTextJson";
            data: unknown;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        status: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "status";
            tableName: "mutations";
            dataType: "string";
            columnType: "SQLiteText";
            data: "applied" | "pending" | "rolled_back";
            driverParam: string;
            notNull: false;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["applied", "pending", "rolled_back"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        timestamp: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "timestamp";
            tableName: "mutations";
            dataType: "date";
            columnType: "SQLiteTimestamp";
            data: Date;
            driverParam: number;
            notNull: false;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: true;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        appliedAt: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "applied_at";
            tableName: "mutations";
            dataType: "date";
            columnType: "SQLiteTimestamp";
            data: Date;
            driverParam: number;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        rolledBackAt: drizzle_orm_sqlite_core.SQLiteColumn<{
            name: "rolled_back_at";
            tableName: "mutations";
            dataType: "date";
            columnType: "SQLiteTimestamp";
            data: Date;
            driverParam: number;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "sqlite";
}>;
type GenomeRow = typeof genomes.$inferSelect;
type NewGenomeRow = typeof genomes.$inferInsert;
type MutationRow = typeof mutations.$inferSelect;
type NewMutationRow = typeof mutations.$inferInsert;

type schema_GenomeRow = GenomeRow;
type schema_MutationRow = MutationRow;
type schema_NewGenomeRow = NewGenomeRow;
type schema_NewMutationRow = NewMutationRow;
declare const schema_genomes: typeof genomes;
declare const schema_mutations: typeof mutations;
declare namespace schema {
  export { type schema_GenomeRow as GenomeRow, type schema_MutationRow as MutationRow, type schema_NewGenomeRow as NewGenomeRow, type schema_NewMutationRow as NewMutationRow, schema_genomes as genomes, schema_mutations as mutations };
}

declare function getDb(): drizzle_orm_better_sqlite3.BetterSQLite3Database<Record<string, unknown>> & {
    $client: Database.Database;
};

/**
 * Enhanced Mutation Utilities
 *
 * Validation, consent checks, rollback windows, and mutation helpers.
 */

type ConsentLevel = 'none' | 'major' | 'all';
/**
 * Check if a mutation requires user consent before applying
 */
declare function requiresConsent(mutationType: MutationType, trigger: Mutation['trigger'], consentLevel: ConsentLevel): boolean;
/**
 * Check if a mutation can still be rolled back
 */
declare function isWithinRollbackWindow(mutation: Mutation, windowHours: number): boolean;
interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
/**
 * Validate a mutation before applying
 */
declare function validateMutation(mutation: MutationInput, currentGenome: AgentGenome): ValidationResult;
/**
 * Generate human-readable description for a mutation
 */
declare function describeMutation(type: MutationType, diff: Mutation['diff']): string;
/**
 * Calculate fitness change from interaction feedback
 */
declare function calculateFitnessChange(currentFitness: number, feedback: 'positive' | 'negative' | 'neutral', weight?: number): {
    before: number;
    after: number;
};
declare const MutationUtils: {
    requiresConsent: typeof requiresConsent;
    isWithinRollbackWindow: typeof isWithinRollbackWindow;
    validate: typeof validateMutation;
    describe: typeof describeMutation;
    calculateFitnessChange: typeof calculateFitnessChange;
};

export { type ConsentLevel, type DiffEntry, type GenomeDiff, GenomeRegistry, type GenomeRow, type MutationRow, MutationUtils, type NewGenomeRow, type NewMutationRow, type RestoreResult, type ValidationResult, type VersionInfo, VersioningUtils, calculateFitnessChange, calculateRestore, describeMutation, diffGenomes, diffVersions, genomes, getDb, getPreviousVersion, getVersionHistory, isWithinRollbackWindow, mutations, reconstructAtVersion, requiresConsent, schema, validateMutation };

import { CreateGenomeInput, AgentGenome, MutationInput, ForkOptions, Mutation, Identity, ToolRef, SkillRef, KnowledgeRef, AgentConfig, GenomeFitness } from '@forge/core';
import * as drizzle_orm_better_sqlite3 from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as drizzle_orm_sqlite_core from 'drizzle-orm/sqlite-core';

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

export { GenomeRegistry, type GenomeRow, type MutationRow, type NewGenomeRow, type NewMutationRow, genomes, getDb, mutations, schema };

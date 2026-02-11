interface Trait {
    id: string;
    name: string;
    weight: number;
    source: 'seed' | 'evolved' | 'inherited';
    addedAt: Date;
}
interface Rule {
    id: string;
    description: string;
    type: 'must' | 'should' | 'prefer' | 'avoid';
    priority: number;
    source: 'seed' | 'evolved' | 'inherited';
    addedAt: Date;
}
interface Voice {
    tone: string;
    style: string;
    examples: string[];
}
interface Identity {
    purpose: string;
    personality: Trait[];
    constraints: Rule[];
    voice?: Voice;
}

interface ToolRef {
    id: string;
    version: string;
    config?: Record<string, unknown>;
    addedAt: Date;
    addedBy: 'user' | 'self' | 'inherited';
}
interface SkillRef {
    id: string;
    name: string;
    description: string;
    learnedFrom: 'usage' | 'training' | 'inherited';
    confidence: number;
    lastUsed: Date;
}
interface KnowledgeRef {
    id: string;
    type: 'document' | 'fact' | 'preference';
    source: string;
    embedding?: number[];
    addedAt: Date;
}

interface ModelConfig {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
    fallbacks?: string[];
}
interface MemoryConfig {
    conversationLimit: number;
    factRetention: 'all' | 'recent' | 'relevant';
    summarizationThreshold: number;
}
interface EvolutionConfig {
    enabled: boolean;
    autoPropose: boolean;
    autoApply: boolean;
    consentThreshold: 'all' | 'major' | 'none';
    rollbackWindow: number;
}
interface AgentConfig {
    model: ModelConfig;
    memory: MemoryConfig;
    evolution: EvolutionConfig;
}
declare const DEFAULT_CONFIG: AgentConfig;

type MutationType = 'trait_add' | 'trait_remove' | 'trait_adjust' | 'rule_add' | 'rule_remove' | 'rule_modify' | 'tool_add' | 'tool_remove' | 'tool_config' | 'skill_add' | 'skill_improve' | 'skill_decay' | 'config_change' | 'identity_update';
interface MutationTrigger {
    source: 'user' | 'evolution' | 'system' | 'inherited';
    reason?: string;
    confidence?: number;
}
interface MutationDiff {
    path: string;
    before: unknown;
    after: unknown;
}
interface MutationFitness {
    before: number;
    after: number;
    metrics: Record<string, number>;
}
interface Mutation {
    id: string;
    genomeId: string;
    version: string;
    timestamp: Date;
    type: MutationType;
    description: string;
    trigger: MutationTrigger;
    diff: MutationDiff;
    fitness?: MutationFitness;
    status: 'applied' | 'pending' | 'rolled_back';
    appliedAt?: Date;
    rolledBackAt?: Date;
}
interface MutationInput {
    type: MutationType;
    description: string;
    trigger: MutationTrigger;
    diff: MutationDiff;
    fitness?: MutationFitness;
    version?: string;
}

interface FitnessMetrics {
    taskCompletion: number;
    userSatisfaction: number;
    efficiency: number;
}
interface GenomeFitness {
    overall: number;
    metrics: FitnessMetrics;
    lastEvaluated: Date;
}
interface GenomeStats {
    totalInteractions: number;
    totalTokens: number;
    totalCost: number;
}
type GenomeStatus = 'draft' | 'active' | 'archived';
type GenomeVisibility = 'private' | 'unlisted' | 'public';
interface AgentGenome {
    id: string;
    userId: string;
    name: string;
    slug: string;
    version: string;
    parentId?: string;
    lineage: string[];
    identity: Identity;
    tools: ToolRef[];
    skills: SkillRef[];
    knowledge: KnowledgeRef[];
    config: AgentConfig;
    mutations: Mutation[];
    fitness?: GenomeFitness;
    status: GenomeStatus;
    visibility: GenomeVisibility;
    createdAt: Date;
    updatedAt: Date;
    lastActiveAt?: Date;
    stats: GenomeStats;
}
interface CreateGenomeInput {
    userId: string;
    name: string;
    identity: Identity;
    tools?: ToolRef[];
    config?: AgentConfig;
}
interface ForkOptions {
    name?: string;
}

export { type AgentConfig, type AgentGenome, type CreateGenomeInput, DEFAULT_CONFIG, type EvolutionConfig, type FitnessMetrics, type ForkOptions, type GenomeFitness, type GenomeStats, type GenomeStatus, type GenomeVisibility, type Identity, type KnowledgeRef, type MemoryConfig, type ModelConfig, type Mutation, type MutationDiff, type MutationFitness, type MutationInput, type MutationTrigger, type MutationType, type Rule, type SkillRef, type ToolRef, type Trait, type Voice };

/**
 * Agent Genome Type Definitions
 *
 * Core data model for Forge 1.0
 * These types define the "living" agent data structure.
 */
export interface Trait {
    id: string;
    name: string;
    weight: number;
    source: 'seed' | 'evolved' | 'inherited';
    description?: string;
    addedAt: Date;
}
export interface Rule {
    id: string;
    description: string;
    type: 'must' | 'should' | 'prefer' | 'avoid';
    priority: number;
    source: 'seed' | 'evolved' | 'inherited';
    addedAt: Date;
}
export interface Voice {
    tone: string;
    style: string;
    examples?: string[];
}
export interface Identity {
    purpose: string;
    personality: Trait[];
    constraints: Rule[];
    voice?: Voice;
}
export interface ToolRef {
    id: string;
    name: string;
    version: string;
    config?: Record<string, any>;
    source: 'builtin' | 'marketplace' | 'custom' | 'self-created';
    addedAt: Date;
    addedBy: 'user' | 'self' | 'inherited';
}
export interface SkillRef {
    id: string;
    name: string;
    description: string;
    learnedFrom: 'usage' | 'training' | 'inherited';
    confidence: number;
    usageCount: number;
    lastUsed?: Date;
    addedAt: Date;
}
export interface KnowledgeRef {
    id: string;
    type: 'document' | 'fact' | 'preference' | 'memory';
    title: string;
    source: string;
    contentHash?: string;
    embedding?: number[];
    addedAt: Date;
}
export interface ModelConfig {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    fallbacks?: string[];
}
export interface MemoryConfig {
    conversationLimit: number;
    factRetention: 'all' | 'recent' | 'relevant';
    summarizationThreshold: number;
    semanticSearch: boolean;
}
export interface EvolutionConfig {
    enabled: boolean;
    autoPropose: boolean;
    autoApply: boolean;
    consentThreshold: 'all' | 'major' | 'none';
    rollbackWindow: number;
    minConfidence: number;
}
export interface AgentConfig {
    model: ModelConfig;
    memory: MemoryConfig;
    evolution: EvolutionConfig;
}
export interface FitnessMetrics {
    taskCompletion: number;
    userSatisfaction: number;
    efficiency: number;
    reliability: number;
}
export interface Fitness {
    overall: number;
    metrics: FitnessMetrics;
    sampleSize: number;
    lastEvaluated: Date;
}
export interface AgentStats {
    totalInteractions: number;
    totalTokens: number;
    totalCost: number;
    averageResponseTime?: number;
    errorRate?: number;
}
export interface AgentGenome {
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
    fitness?: Fitness;
    status: 'draft' | 'active' | 'archived';
    visibility: 'private' | 'unlisted' | 'public';
    createdAt: Date;
    updatedAt: Date;
    lastActiveAt?: Date;
    stats: AgentStats;
}
export interface CreateGenomeInput {
    userId: string;
    name: string;
    identity: Identity;
    tools?: ToolRef[];
    config?: Partial<AgentConfig>;
}
export interface UpdateGenomeInput {
    name?: string;
    identity?: Partial<Identity>;
    config?: Partial<AgentConfig>;
    status?: 'draft' | 'active' | 'archived';
    visibility?: 'private' | 'unlisted' | 'public';
}
export declare const DEFAULT_MODEL_CONFIG: ModelConfig;
export declare const DEFAULT_MEMORY_CONFIG: MemoryConfig;
export declare const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig;
export declare const DEFAULT_AGENT_CONFIG: AgentConfig;
export declare const DEFAULT_STATS: AgentStats;

/**
 * Agent Genome Type Definitions
 * 
 * Core data model for Forge 1.0
 * These types define the "living" agent data structure.
 */

// === Identity Types ===

export interface Trait {
  id: string;
  name: string;                    // e.g., "concise", "formal", "proactive"
  weight: number;                  // 0.0 to 1.0, strength of trait
  source: 'seed' | 'evolved' | 'inherited';
  description?: string;
  addedAt: Date;
}

export interface Rule {
  id: string;
  description: string;             // e.g., "Never share personal data"
  type: 'must' | 'should' | 'prefer' | 'avoid';
  priority: number;                // Higher = more important (1-10)
  source: 'seed' | 'evolved' | 'inherited';
  addedAt: Date;
}

export interface Voice {
  tone: string;                    // e.g., "friendly", "professional"
  style: string;                   // e.g., "concise", "detailed"
  examples?: string[];             // Example responses in this voice
}

export interface Identity {
  purpose: string;                 // Core mission statement
  personality: Trait[];
  constraints: Rule[];
  voice?: Voice;
}

// === Capability Types ===

export interface ToolRef {
  id: string;                      // Tool ID (from registry or custom)
  name: string;                    // Display name
  version: string;                 // Pinned version
  config?: Record<string, any>;    // Tool-specific configuration
  source: 'builtin' | 'marketplace' | 'custom' | 'self-created';
  addedAt: Date;
  addedBy: 'user' | 'self' | 'inherited';
}

export interface SkillRef {
  id: string;
  name: string;
  description: string;
  learnedFrom: 'usage' | 'training' | 'inherited';
  confidence: number;              // 0.0 to 1.0, how well it knows this
  usageCount: number;
  lastUsed?: Date;
  addedAt: Date;
}

export interface KnowledgeRef {
  id: string;
  type: 'document' | 'fact' | 'preference' | 'memory';
  title: string;
  source: string;                  // Where it came from
  contentHash?: string;            // For deduplication
  embedding?: number[];            // For semantic search (future)
  addedAt: Date;
}

// === Configuration Types ===

export interface ModelConfig {
  provider: string;                // 'openrouter' | 'openai' | 'anthropic' | etc.
  model: string;                   // Model identifier
  temperature: number;             // 0.0 to 2.0
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  fallbacks?: string[];            // Fallback models if primary fails
}

export interface MemoryConfig {
  conversationLimit: number;       // Max messages to keep in working memory
  factRetention: 'all' | 'recent' | 'relevant';
  summarizationThreshold: number;  // Token count before summarizing
  semanticSearch: boolean;         // Enable vector search (future)
}

export interface EvolutionConfig {
  enabled: boolean;                // Whether evolution is active
  autoPropose: boolean;            // Suggest mutations automatically
  autoApply: boolean;              // Apply low-risk mutations without asking
  consentThreshold: 'all' | 'major' | 'none';
  rollbackWindow: number;          // Hours before mutations are permanent
  minConfidence: number;           // Minimum confidence for auto-proposals
}

export interface AgentConfig {
  model: ModelConfig;
  memory: MemoryConfig;
  evolution: EvolutionConfig;
}

// === Fitness Types ===

export interface FitnessMetrics {
  taskCompletion: number;          // 0.0 to 1.0
  userSatisfaction: number;        // 0.0 to 1.0
  efficiency: number;              // 0.0 to 1.0 (tokens per successful task)
  reliability: number;             // 0.0 to 1.0 (error rate inverse)
}

export interface Fitness {
  overall: number;                 // 0.0 to 1.0, weighted composite
  metrics: FitnessMetrics;
  sampleSize: number;              // Number of interactions measured
  lastEvaluated: Date;
}

// === Stats Types ===

export interface AgentStats {
  totalInteractions: number;
  totalTokens: number;
  totalCost: number;               // USD
  averageResponseTime?: number;    // ms
  errorRate?: number;              // 0.0 to 1.0
}

// === Core Genome Type ===

export interface AgentGenome {
  // Identity
  id: string;                      // UUID
  userId: string;                  // Owner
  name: string;                    // Display name
  slug: string;                    // URL-friendly identifier
  version: string;                 // Semver
  
  // Lineage
  parentId?: string;               // Forked from (if applicable)
  lineage: string[];               // Full ancestry chain [grandparent, parent]
  
  // Core Data
  identity: Identity;
  tools: ToolRef[];
  skills: SkillRef[];
  knowledge: KnowledgeRef[];
  config: AgentConfig;
  
  // Fitness & Evolution
  fitness?: Fitness;
  
  // Status
  status: 'draft' | 'active' | 'archived';
  visibility: 'private' | 'unlisted' | 'public';
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt?: Date;
  
  // Usage Stats
  stats: AgentStats;
}

// === Input Types (for creation/updates) ===

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

// === Default Configurations ===

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: 'openrouter',
  model: 'anthropic/claude-sonnet-4',
  temperature: 0.7,
  maxTokens: 4096,
};

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  conversationLimit: 50,
  factRetention: 'relevant',
  summarizationThreshold: 10000,
  semanticSearch: false,
};

export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  enabled: true,
  autoPropose: true,
  autoApply: false,
  consentThreshold: 'major',
  rollbackWindow: 24,
  minConfidence: 0.7,
};

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  model: DEFAULT_MODEL_CONFIG,
  memory: DEFAULT_MEMORY_CONFIG,
  evolution: DEFAULT_EVOLUTION_CONFIG,
};

export const DEFAULT_STATS: AgentStats = {
  totalInteractions: 0,
  totalTokens: 0,
  totalCost: 0,
};

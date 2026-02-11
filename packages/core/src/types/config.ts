// Configuration types for Agent Genome

export interface ModelConfig {
  provider: string;                // 'openrouter' | 'openai' | etc.
  model: string;
  temperature: number;
  maxTokens: number;
  fallbacks?: string[];
}

export interface MemoryConfig {
  conversationLimit: number;
  factRetention: 'all' | 'recent' | 'relevant';
  summarizationThreshold: number;
}

export interface EvolutionConfig {
  enabled: boolean;
  autoPropose: boolean;            // Suggest mutations automatically
  autoApply: boolean;              // Apply low-risk mutations automatically
  consentThreshold: 'all' | 'major' | 'none';
  rollbackWindow: number;          // Hours before mutations become permanent
}

export interface AgentConfig {
  model: ModelConfig;
  memory: MemoryConfig;
  evolution: EvolutionConfig;
}

export const DEFAULT_CONFIG: AgentConfig = {
  model: {
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4',
    temperature: 0.7,
    maxTokens: 4096,
  },
  memory: {
    conversationLimit: 50,
    factRetention: 'relevant',
    summarizationThreshold: 10000,
  },
  evolution: {
    enabled: true,
    autoPropose: true,
    autoApply: false,
    consentThreshold: 'major',
    rollbackWindow: 24,
  },
};

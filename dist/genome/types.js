/**
 * Agent Genome Type Definitions
 *
 * Core data model for Forge 1.0
 * These types define the "living" agent data structure.
 */
// === Default Configurations ===
export const DEFAULT_MODEL_CONFIG = {
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4',
    temperature: 0.7,
    maxTokens: 4096,
};
export const DEFAULT_MEMORY_CONFIG = {
    conversationLimit: 50,
    factRetention: 'relevant',
    summarizationThreshold: 10000,
    semanticSearch: false,
};
export const DEFAULT_EVOLUTION_CONFIG = {
    enabled: true,
    autoPropose: true,
    autoApply: false,
    consentThreshold: 'major',
    rollbackWindow: 24,
    minConfidence: 0.7,
};
export const DEFAULT_AGENT_CONFIG = {
    model: DEFAULT_MODEL_CONFIG,
    memory: DEFAULT_MEMORY_CONFIG,
    evolution: DEFAULT_EVOLUTION_CONFIG,
};
export const DEFAULT_STATS = {
    totalInteractions: 0,
    totalTokens: 0,
    totalCost: 0,
};

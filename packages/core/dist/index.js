// src/types/config.ts
var DEFAULT_CONFIG = {
  model: {
    provider: "openrouter",
    model: "anthropic/claude-sonnet-4",
    temperature: 0.7,
    maxTokens: 4096
  },
  memory: {
    conversationLimit: 50,
    factRetention: "relevant",
    summarizationThreshold: 1e4
  },
  evolution: {
    enabled: true,
    autoPropose: true,
    autoApply: false,
    consentThreshold: "major",
    rollbackWindow: 24
  }
};
export {
  DEFAULT_CONFIG
};

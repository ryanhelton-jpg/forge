// Capability types for Agent Genome

export interface ToolRef {
  id: string;
  version: string;                 // Pinned version
  config?: Record<string, unknown>;
  addedAt: Date;
  addedBy: 'user' | 'self' | 'inherited';
}

export interface SkillRef {
  id: string;
  name: string;
  description: string;
  learnedFrom: 'usage' | 'training' | 'inherited';
  confidence: number;              // 0.0 to 1.0
  lastUsed: Date;
}

export interface KnowledgeRef {
  id: string;
  type: 'document' | 'fact' | 'preference';
  source: string;
  embedding?: number[];            // For semantic search (future)
  addedAt: Date;
}

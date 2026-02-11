// Mutation types for Agent Genome evolution

export type MutationType =
  | 'trait_add' | 'trait_remove' | 'trait_adjust'
  | 'rule_add' | 'rule_remove' | 'rule_modify'
  | 'tool_add' | 'tool_remove' | 'tool_config'
  | 'skill_add' | 'skill_improve' | 'skill_decay'
  | 'config_change'
  | 'identity_update';

export interface MutationTrigger {
  source: 'user' | 'evolution' | 'system' | 'inherited';
  reason?: string;
  confidence?: number;             // For evolution-triggered
}

export interface MutationDiff {
  path: string;                    // JSON path to changed field
  before: unknown;
  after: unknown;
}

export interface MutationFitness {
  before: number;
  after: number;
  metrics: Record<string, number>;
}

export interface Mutation {
  id: string;
  genomeId: string;
  version: string;                 // Version after this mutation
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

export interface MutationInput {
  type: MutationType;
  description: string;
  trigger: MutationTrigger;
  diff: MutationDiff;
  fitness?: MutationFitness;
  version?: string;
}

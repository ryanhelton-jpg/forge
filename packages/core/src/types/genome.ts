// Core Genome type — the complete agent definition

import type { Identity } from './identity.js';
import type { ToolRef, SkillRef, KnowledgeRef } from './capabilities.js';
import type { AgentConfig } from './config.js';
import type { Mutation } from './mutation.js';

export interface FitnessMetrics {
  taskCompletion: number;
  userSatisfaction: number;
  efficiency: number;
}

export interface GenomeFitness {
  overall: number;                 // 0.0 to 1.0
  metrics: FitnessMetrics;
  lastEvaluated: Date;
}

export interface GenomeStats {
  totalInteractions: number;
  totalTokens: number;
  totalCost: number;
}

export type GenomeStatus = 'draft' | 'active' | 'archived';
export type GenomeVisibility = 'private' | 'unlisted' | 'public';

export interface AgentGenome {
  // Identity
  id: string;
  userId: string;
  name: string;
  slug: string;
  version: string;                 // Semver

  // Lineage
  parentId?: string;
  lineage: string[];               // Full ancestry chain

  // Core data
  identity: Identity;
  tools: ToolRef[];
  skills: SkillRef[];
  knowledge: KnowledgeRef[];
  config: AgentConfig;

  // Evolution
  mutations: Mutation[];
  fitness?: GenomeFitness;

  // Metadata
  status: GenomeStatus;
  visibility: GenomeVisibility;

  createdAt: Date;
  updatedAt: Date;
  lastActiveAt?: Date;

  // Stats
  stats: GenomeStats;
}

export interface CreateGenomeInput {
  userId: string;
  name: string;
  identity: Identity;
  tools?: ToolRef[];
  config?: AgentConfig;
}

export interface ForkOptions {
  name?: string;
}

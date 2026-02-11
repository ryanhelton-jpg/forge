/**
 * Genome Module
 * 
 * The core data model for Forge 1.0 agents.
 * Agents are "living" entities with versioned history, 
 * forkable lineage, and tracked evolution.
 */

// Types
export * from './types';

// Mutations
export {
  type MutationType,
  type Mutation,
  type MutationInput,
  type MutationTrigger,
  type MutationDiff,
  type FitnessChange,
  type ValidationResult,
  type ConsentLevel,
  createMutation,
  bumpVersion,
  createDiff,
  describeMutation,
  applyMutationToGenome,
  reverseMutation,
  validateMutation,
  requiresConsent,
  isWithinRollbackWindow,
  MutationUtils,
} from './mutations';

// Versioning
export {
  type ForkOptions,
  type RestoreOptions,
  type GenomeDiff,
  type DiffEntry,
  type VersionInfo,
  type MergeResult,
  type MergeConflict,
  forkGenome,
  canFork,
  reconstructAtVersion,
  getVersionHistory,
  diffVersions,
  diffGenomes,
  mergeCapabilities,
  VersioningUtils,
} from './versioning';

// Re-export default utilities
export { default as Mutations } from './mutations';
export { default as Versioning } from './versioning';

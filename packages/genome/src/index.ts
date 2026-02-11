// @forge/genome — Agent Genome persistence and evolution

export { GenomeRegistry } from './registry.js';
export { getDb, schema } from './db.js';
export * from './schema.js';

// Mutation utilities
export {
  type ConsentLevel,
  type ValidationResult,
  requiresConsent,
  isWithinRollbackWindow,
  validateMutation,
  describeMutation,
  calculateFitnessChange,
  MutationUtils,
} from './mutations.js';

// Versioning utilities
export {
  type VersionInfo,
  type GenomeDiff,
  type DiffEntry,
  type RestoreResult,
  getVersionHistory,
  getPreviousVersion,
  calculateRestore,
  reconstructAtVersion,
  diffVersions,
  diffGenomes,
  VersioningUtils,
} from './versioning.js';

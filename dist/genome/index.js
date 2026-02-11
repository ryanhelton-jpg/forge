/**
 * Genome Module
 *
 * The core data model for Forge 1.0 agents.
 * Agents are "living" entities with versioned history,
 * forkable lineage, and tracked evolution.
 */
// Types
export * from './types.js';
// Mutations
export { createMutation, bumpVersion, createDiff, describeMutation, applyMutationToGenome, reverseMutation, validateMutation, requiresConsent, isWithinRollbackWindow, MutationUtils, } from './mutations.js';
// Versioning
export { forkGenome, canFork, reconstructAtVersion, getVersionHistory, diffVersions, diffGenomes, mergeCapabilities, VersioningUtils, } from './versioning.js';
// Re-export default utilities
export { default as Mutations } from './mutations.js';
export { default as Versioning } from './versioning.js';

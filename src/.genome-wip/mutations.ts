/**
 * Mutation Tracking Module
 * 
 * Handles recording, applying, and rolling back mutations to Agent Genomes.
 * Part of Forge 1.0 Sprint 1.
 */

import { createId } from '@paralleldrive/cuid2';
import * as semver from 'semver';

// === Types ===

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
  confidence?: number;  // For evolution-triggered mutations
  interactionId?: string;  // Link to interaction that caused this
}

export interface MutationDiff {
  path: string;  // JSON path to changed field, e.g., "identity.personality[0].weight"
  before: any;
  after: any;
}

export interface FitnessChange {
  before: number;
  after: number;
  metrics?: Record<string, number>;
}

export interface Mutation {
  id: string;
  genomeId: string;
  version: string;
  timestamp: Date;
  
  type: MutationType;
  description: string;
  
  trigger: MutationTrigger;
  diff: MutationDiff;
  fitness?: FitnessChange;
  
  status: 'pending' | 'applied' | 'rolled_back';
  appliedAt?: Date;
  rolledBackAt?: Date;
}

export interface MutationInput {
  type: MutationType;
  description: string;
  trigger: MutationTrigger;
  diff: MutationDiff;
  fitness?: FitnessChange;
}

// === Mutation Factory ===

export function createMutation(
  genomeId: string,
  version: string,
  input: MutationInput
): Mutation {
  return {
    id: createId(),
    genomeId,
    version,
    timestamp: new Date(),
    type: input.type,
    description: input.description,
    trigger: input.trigger,
    diff: input.diff,
    fitness: input.fitness,
    status: 'applied',
    appliedAt: new Date(),
  };
}

// === Version Bumping ===

export function bumpVersion(current: string, mutationType: MutationType): string {
  // Major: Breaking identity changes (rare, usually user-initiated)
  // Minor: New capabilities, significant behavior changes
  // Patch: Tweaks, adjustments, small improvements
  
  const majorTypes: MutationType[] = ['identity_update'];
  const minorTypes: MutationType[] = [
    'tool_add', 'tool_remove',
    'skill_add',
    'rule_add', 'rule_remove',
    'trait_add', 'trait_remove',
  ];
  
  if (majorTypes.includes(mutationType)) {
    return semver.inc(current, 'major') || current;
  }
  if (minorTypes.includes(mutationType)) {
    return semver.inc(current, 'minor') || current;
  }
  return semver.inc(current, 'patch') || current;
}

// === Diff Utilities ===

export function createDiff(path: string, before: any, after: any): MutationDiff {
  return { path, before, after };
}

export function describeMutation(type: MutationType, diff: MutationDiff): string {
  const descriptions: Record<MutationType, (diff: MutationDiff) => string> = {
    trait_add: (d) => `Added trait: ${d.after?.name || 'unknown'}`,
    trait_remove: (d) => `Removed trait: ${d.before?.name || 'unknown'}`,
    trait_adjust: (d) => `Adjusted trait "${d.before?.name}": weight ${d.before?.weight} → ${d.after?.weight}`,
    
    rule_add: (d) => `Added rule: "${d.after?.description || 'unknown'}"`,
    rule_remove: (d) => `Removed rule: "${d.before?.description || 'unknown'}"`,
    rule_modify: (d) => `Modified rule: "${d.before?.description}"`,
    
    tool_add: (d) => `Installed tool: ${d.after?.name || d.after?.id || 'unknown'}`,
    tool_remove: (d) => `Removed tool: ${d.before?.name || d.before?.id || 'unknown'}`,
    tool_config: (d) => `Updated tool config: ${d.before?.name || 'unknown'}`,
    
    skill_add: (d) => `Learned skill: ${d.after?.name || 'unknown'}`,
    skill_improve: (d) => `Improved skill "${d.before?.name}": confidence ${d.before?.confidence} → ${d.after?.confidence}`,
    skill_decay: (d) => `Skill decay: "${d.before?.name}" (unused)`,
    
    config_change: (d) => `Configuration changed: ${d.path}`,
    identity_update: (d) => `Identity updated`,
  };
  
  return descriptions[type]?.(diff) || `Mutation: ${type}`;
}

// === Mutation Application ===

/**
 * Apply a mutation to a genome object (pure function, returns new object)
 */
export function applyMutationToGenome<T extends object>(
  genome: T,
  diff: MutationDiff
): T {
  const result = structuredClone(genome);
  setValueAtPath(result, diff.path, diff.after);
  return result;
}

/**
 * Reverse a mutation (for rollback)
 */
export function reverseMutation<T extends object>(
  genome: T,
  diff: MutationDiff
): T {
  const result = structuredClone(genome);
  setValueAtPath(result, diff.path, diff.before);
  return result;
}

// === Path Utilities ===

function setValueAtPath(obj: any, path: string, value: any): void {
  const parts = parsePath(path);
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined) {
      // Create intermediate objects/arrays as needed
      current[part] = typeof parts[i + 1] === 'number' ? [] : {};
    }
    current = current[part];
  }
  
  const lastPart = parts[parts.length - 1];
  if (value === undefined) {
    delete current[lastPart];
  } else {
    current[lastPart] = value;
  }
}

function getValueAtPath(obj: any, path: string): any {
  const parts = parsePath(path);
  let current = obj;
  
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  
  return current;
}

function parsePath(path: string): (string | number)[] {
  // Handle paths like "identity.personality[0].weight"
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .map(part => /^\d+$/.test(part) ? parseInt(part, 10) : part);
}

// === Mutation Validation ===

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateMutation(
  mutation: MutationInput,
  currentGenome: any
): ValidationResult {
  const errors: string[] = [];
  
  // Check that the path exists for non-add operations
  if (!mutation.type.endsWith('_add')) {
    const currentValue = getValueAtPath(currentGenome, mutation.diff.path);
    if (currentValue === undefined && mutation.diff.before !== undefined) {
      errors.push(`Path "${mutation.diff.path}" does not exist in current genome`);
    }
  }
  
  // Check that before value matches current state
  if (mutation.diff.before !== undefined) {
    const currentValue = getValueAtPath(currentGenome, mutation.diff.path);
    if (JSON.stringify(currentValue) !== JSON.stringify(mutation.diff.before)) {
      errors.push(`Current value at "${mutation.diff.path}" doesn't match expected 'before' value`);
    }
  }
  
  // Type-specific validations
  if (mutation.type.startsWith('trait_')) {
    if (!mutation.diff.after?.name && mutation.type !== 'trait_remove') {
      errors.push('Trait mutations require a name');
    }
    if (mutation.diff.after?.weight !== undefined) {
      if (mutation.diff.after.weight < 0 || mutation.diff.after.weight > 1) {
        errors.push('Trait weight must be between 0 and 1');
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// === Consent & Safety ===

export type ConsentLevel = 'none' | 'major' | 'all';

export function requiresConsent(
  mutationType: MutationType,
  trigger: MutationTrigger,
  consentLevel: ConsentLevel
): boolean {
  // User-triggered mutations never need additional consent
  if (trigger.source === 'user') return false;
  
  // System mutations for logging/tracking don't need consent
  if (trigger.source === 'system') return false;
  
  // Based on consent level setting
  if (consentLevel === 'none') return false;
  if (consentLevel === 'all') return true;
  
  // 'major' level: only identity and capability changes need consent
  const majorChanges: MutationType[] = [
    'identity_update',
    'tool_add', 'tool_remove',
    'rule_add', 'rule_remove',
    'trait_add', 'trait_remove',
  ];
  
  return majorChanges.includes(mutationType);
}

export function isWithinRollbackWindow(
  mutation: Mutation,
  windowHours: number
): boolean {
  if (!mutation.appliedAt) return false;
  
  const windowMs = windowHours * 60 * 60 * 1000;
  const elapsed = Date.now() - mutation.appliedAt.getTime();
  
  return elapsed < windowMs;
}

// === Export all ===

export const MutationUtils = {
  create: createMutation,
  bumpVersion,
  createDiff,
  describe: describeMutation,
  apply: applyMutationToGenome,
  reverse: reverseMutation,
  validate: validateMutation,
  requiresConsent,
  isWithinRollbackWindow,
};

export default MutationUtils;

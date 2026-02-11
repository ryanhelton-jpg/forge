/**
 * Enhanced Mutation Utilities
 * 
 * Validation, consent checks, rollback windows, and mutation helpers.
 */

import type { Mutation, MutationInput, MutationType, AgentGenome } from '@forge/core';

// === Consent & Safety ===

export type ConsentLevel = 'none' | 'major' | 'all';

/**
 * Check if a mutation requires user consent before applying
 */
export function requiresConsent(
  mutationType: MutationType,
  trigger: Mutation['trigger'],
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

/**
 * Check if a mutation can still be rolled back
 */
export function isWithinRollbackWindow(
  mutation: Mutation,
  windowHours: number
): boolean {
  if (!mutation.appliedAt || mutation.status !== 'applied') return false;
  
  const windowMs = windowHours * 60 * 60 * 1000;
  const appliedTime = mutation.appliedAt instanceof Date 
    ? mutation.appliedAt.getTime() 
    : new Date(mutation.appliedAt).getTime();
  
  return Date.now() - appliedTime < windowMs;
}

// === Validation ===

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a mutation before applying
 */
export function validateMutation(
  mutation: MutationInput,
  currentGenome: AgentGenome
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check mutation type is valid
  const validTypes: MutationType[] = [
    'trait_add', 'trait_remove', 'trait_adjust',
    'rule_add', 'rule_remove', 'rule_modify',
    'tool_add', 'tool_remove', 'tool_config',
    'skill_add', 'skill_improve', 'skill_decay',
    'config_change', 'identity_update',
  ];
  
  if (!validTypes.includes(mutation.type)) {
    errors.push(`Invalid mutation type: ${mutation.type}`);
  }
  
  // Type-specific validations
  if (mutation.type.startsWith('trait_')) {
    validateTraitMutation(mutation, errors, warnings);
  }
  
  if (mutation.type.startsWith('rule_')) {
    validateRuleMutation(mutation, errors, warnings);
  }
  
  if (mutation.type.startsWith('tool_')) {
    validateToolMutation(mutation, currentGenome, errors, warnings);
  }
  
  // Check trigger is valid
  if (!mutation.trigger?.source) {
    errors.push('Mutation trigger source is required');
  }
  
  // Check diff is present
  if (!mutation.diff) {
    errors.push('Mutation diff is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Helper to safely get properties from unknown
function getProp(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

function validateTraitMutation(
  mutation: MutationInput,
  errors: string[],
  warnings: string[]
): void {
  const { diff, type } = mutation;
  const afterName = getProp(diff.after, 'name');
  const afterWeight = getProp(diff.after, 'weight');
  
  if (type !== 'trait_remove' && !afterName) {
    errors.push('Trait mutations require a name');
  }
  
  if (afterWeight !== undefined) {
    if (typeof afterWeight !== 'number') {
      errors.push('Trait weight must be a number');
    } else if (afterWeight < 0 || afterWeight > 1) {
      errors.push('Trait weight must be between 0 and 1');
    }
  }
  
  if (type === 'trait_adjust' && !diff.before) {
    warnings.push('trait_adjust without before value - cannot verify change');
  }
}

function validateRuleMutation(
  mutation: MutationInput,
  errors: string[],
  warnings: string[]
): void {
  const { diff, type } = mutation;
  const afterDesc = getProp(diff.after, 'description');
  const afterType = getProp(diff.after, 'type');
  const afterPriority = getProp(diff.after, 'priority');
  
  if (type !== 'rule_remove' && !afterDesc) {
    errors.push('Rule mutations require a description');
  }
  
  if (afterType) {
    const validRuleTypes = ['must', 'should', 'prefer', 'avoid'];
    if (!validRuleTypes.includes(String(afterType))) {
      errors.push(`Invalid rule type: ${afterType}`);
    }
  }
  
  if (afterPriority !== undefined) {
    if (typeof afterPriority !== 'number' || afterPriority < 1 || afterPriority > 10) {
      warnings.push('Rule priority should be between 1 and 10');
    }
  }
}

function validateToolMutation(
  mutation: MutationInput,
  genome: AgentGenome,
  errors: string[],
  warnings: string[]
): void {
  const { diff, type } = mutation;
  const afterId = getProp(diff.after, 'id');
  const afterName = getProp(diff.after, 'name');
  const beforeId = getProp(diff.before, 'id');
  
  if (type === 'tool_add') {
    if (!afterId && !afterName) {
      errors.push('Tool add requires tool id or name');
    }
    
    // Check for duplicates
    if (afterId && genome.tools.some(t => t.id === afterId)) {
      warnings.push(`Tool ${afterId} already exists - will update instead of add`);
    }
  }
  
  if (type === 'tool_remove') {
    if (beforeId && !genome.tools.some(t => t.id === beforeId)) {
      errors.push(`Tool ${beforeId} not found in genome`);
    }
  }
}

// === Mutation Description ===

/**
 * Generate human-readable description for a mutation
 */
export function describeMutation(type: MutationType, diff: Mutation['diff']): string {
  // Helper to safely get properties from unknown
  const get = (obj: unknown, key: string): unknown => {
    if (obj && typeof obj === 'object' && key in obj) {
      return (obj as Record<string, unknown>)[key];
    }
    return undefined;
  };
  
  const getName = (obj: unknown): string => String(get(obj, 'name') || get(obj, 'id') || 'unknown');
  const getDesc = (obj: unknown): string => String(get(obj, 'description') || 'unknown');
  const getWeight = (obj: unknown): string => {
    const w = get(obj, 'weight');
    return typeof w === 'number' ? w.toFixed(2) : '?';
  };
  const getConfidence = (obj: unknown): string => {
    const c = get(obj, 'confidence');
    return typeof c === 'number' ? (c * 100).toFixed(0) + '%' : '?';
  };

  const descriptions: Record<MutationType, () => string> = {
    trait_add: () => `Added trait: ${getName(diff.after)}`,
    trait_remove: () => `Removed trait: ${getName(diff.before)}`,
    trait_adjust: () => `Adjusted "${getName(diff.before)}": ${getWeight(diff.before)} → ${getWeight(diff.after)}`,
    
    rule_add: () => `Added rule: "${truncate(getDesc(diff.after), 50)}"`,
    rule_remove: () => `Removed rule: "${truncate(getDesc(diff.before), 50)}"`,
    rule_modify: () => `Modified rule: "${truncate(getDesc(diff.before), 50)}"`,
    
    tool_add: () => `Installed tool: ${getName(diff.after)}`,
    tool_remove: () => `Removed tool: ${getName(diff.before)}`,
    tool_config: () => `Updated tool config: ${getName(diff.before)}`,
    
    skill_add: () => `Learned skill: ${getName(diff.after)}`,
    skill_improve: () => `Improved "${getName(diff.before)}": ${getConfidence(diff.before)} → ${getConfidence(diff.after)}`,
    skill_decay: () => `Skill decay: "${getName(diff.before)}" (unused)`,
    
    config_change: () => `Configuration changed: ${diff.path}`,
    identity_update: () => `Identity updated`,
  };
  
  return descriptions[type]?.() || `Mutation: ${type}`;
}

function truncate(str: string | undefined, len: number): string {
  if (!str) return 'unknown';
  return str.length > len ? str.substring(0, len - 3) + '...' : str;
}

// === Fitness Calculation ===

/**
 * Calculate fitness change from interaction feedback
 */
export function calculateFitnessChange(
  currentFitness: number,
  feedback: 'positive' | 'negative' | 'neutral',
  weight: number = 0.1
): { before: number; after: number } {
  const before = currentFitness;
  let after = currentFitness;
  
  switch (feedback) {
    case 'positive':
      after = Math.min(1, currentFitness + weight * (1 - currentFitness));
      break;
    case 'negative':
      after = Math.max(0, currentFitness - weight * currentFitness);
      break;
    case 'neutral':
      // Slight decay toward 0.5 (regression to mean)
      after = currentFitness + (0.5 - currentFitness) * 0.01;
      break;
  }
  
  return { before, after: Math.round(after * 1000) / 1000 };
}

// === Export ===

export const MutationUtils = {
  requiresConsent,
  isWithinRollbackWindow,
  validate: validateMutation,
  describe: describeMutation,
  calculateFitnessChange,
};

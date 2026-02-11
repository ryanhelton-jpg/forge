/**
 * Mutation Tracking Module
 *
 * Handles recording, applying, and rolling back mutations to Agent Genomes.
 * Part of Forge 1.0 Sprint 1.
 */
import { createId } from '@paralleldrive/cuid2';
import * as semver from 'semver';
// === Mutation Factory ===
export function createMutation(genomeId, version, input) {
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
export function bumpVersion(current, mutationType) {
    // Major: Breaking identity changes (rare, usually user-initiated)
    // Minor: New capabilities, significant behavior changes
    // Patch: Tweaks, adjustments, small improvements
    const majorTypes = ['identity_update'];
    const minorTypes = [
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
export function createDiff(path, before, after) {
    return { path, before, after };
}
export function describeMutation(type, diff) {
    const descriptions = {
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
export function applyMutationToGenome(genome, diff) {
    const result = structuredClone(genome);
    setValueAtPath(result, diff.path, diff.after);
    return result;
}
/**
 * Reverse a mutation (for rollback)
 */
export function reverseMutation(genome, diff) {
    const result = structuredClone(genome);
    setValueAtPath(result, diff.path, diff.before);
    return result;
}
// === Path Utilities ===
function setValueAtPath(obj, path, value) {
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
    }
    else {
        current[lastPart] = value;
    }
}
function getValueAtPath(obj, path) {
    const parts = parsePath(path);
    let current = obj;
    for (const part of parts) {
        if (current === undefined || current === null)
            return undefined;
        current = current[part];
    }
    return current;
}
function parsePath(path) {
    // Handle paths like "identity.personality[0].weight"
    return path
        .replace(/\[(\d+)\]/g, '.$1')
        .split('.')
        .filter(Boolean)
        .map(part => /^\d+$/.test(part) ? parseInt(part, 10) : part);
}
export function validateMutation(mutation, currentGenome) {
    const errors = [];
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
export function requiresConsent(mutationType, trigger, consentLevel) {
    // User-triggered mutations never need additional consent
    if (trigger.source === 'user')
        return false;
    // System mutations for logging/tracking don't need consent
    if (trigger.source === 'system')
        return false;
    // Based on consent level setting
    if (consentLevel === 'none')
        return false;
    if (consentLevel === 'all')
        return true;
    // 'major' level: only identity and capability changes need consent
    const majorChanges = [
        'identity_update',
        'tool_add', 'tool_remove',
        'rule_add', 'rule_remove',
        'trait_add', 'trait_remove',
    ];
    return majorChanges.includes(mutationType);
}
export function isWithinRollbackWindow(mutation, windowHours) {
    if (!mutation.appliedAt)
        return false;
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

/**
 * Mutation Tracking Module
 *
 * Handles recording, applying, and rolling back mutations to Agent Genomes.
 * Part of Forge 1.0 Sprint 1.
 */
// === Mutation Factory ===
export function createMutation(genomeId, version, input) {
    return {
        id: crypto.randomUUID(),
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
    const [major, minor, patch] = current.split('.').map(Number);
    const majorTypes = ['identity_update'];
    const minorTypes = [
        'tool_add', 'tool_remove', 'skill_add',
        'rule_add', 'rule_remove', 'trait_add', 'trait_remove',
    ];
    if (majorTypes.includes(mutationType)) {
        return `${major + 1}.0.0`;
    }
    if (minorTypes.includes(mutationType)) {
        return `${major}.${minor + 1}.0`;
    }
    return `${major}.${minor}.${patch + 1}`;
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
        identity_update: () => `Identity updated`,
    };
    return descriptions[type]?.(diff) || `Mutation: ${type}`;
}
// === Mutation Application ===
export function applyMutationToGenome(genome, diff) {
    const result = structuredClone(genome);
    setValueAtPath(result, diff.path, diff.after);
    return result;
}
export function reverseMutation(genome, diff) {
    const result = structuredClone(genome);
    setValueAtPath(result, diff.path, diff.before);
    return result;
}
// === Path Utilities ===
function setValueAtPath(obj, path, value) {
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current[part] === undefined) {
            current[part] = /^\d+$/.test(parts[i + 1]) ? [] : {};
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
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
    let current = obj;
    for (const part of parts) {
        if (current === undefined || current === null)
            return undefined;
        current = current[part];
    }
    return current;
}
export function validateMutation(mutation, currentGenome) {
    const errors = [];
    if (!mutation.type.endsWith('_add')) {
        const currentValue = getValueAtPath(currentGenome, mutation.diff.path);
        if (currentValue === undefined && mutation.diff.before !== undefined) {
            errors.push(`Path "${mutation.diff.path}" does not exist`);
        }
    }
    if (mutation.type.startsWith('trait_') && mutation.diff.after?.weight !== undefined) {
        if (mutation.diff.after.weight < 0 || mutation.diff.after.weight > 1) {
            errors.push('Trait weight must be between 0 and 1');
        }
    }
    return { valid: errors.length === 0, errors };
}
export function requiresConsent(mutationType, trigger, consentLevel) {
    if (trigger.source === 'user' || trigger.source === 'system')
        return false;
    if (consentLevel === 'none')
        return false;
    if (consentLevel === 'all')
        return true;
    const majorChanges = [
        'identity_update', 'tool_add', 'tool_remove',
        'rule_add', 'rule_remove', 'trait_add', 'trait_remove',
    ];
    return majorChanges.includes(mutationType);
}
export function isWithinRollbackWindow(mutation, windowHours) {
    if (!mutation.appliedAt)
        return false;
    const windowMs = windowHours * 60 * 60 * 1000;
    return Date.now() - mutation.appliedAt.getTime() < windowMs;
}
// === Export ===
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

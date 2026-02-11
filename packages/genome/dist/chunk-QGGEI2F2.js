var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/versioning.ts
import semver from "semver";
function getVersionHistory(genome, rollbackWindowHours = 24) {
  const versions = /* @__PURE__ */ new Map();
  const now = Date.now();
  const rollbackWindowMs = rollbackWindowHours * 60 * 60 * 1e3;
  versions.set("1.0.0", {
    version: "1.0.0",
    timestamp: genome.createdAt,
    description: "Initial creation",
    mutationType: "identity_update",
    trigger: "user",
    canRollback: false
    // Can't rollback creation
  });
  for (const mutation of genome.mutations) {
    if (mutation.status === "applied" && mutation.version !== "1.0.0") {
      const appliedAt = mutation.appliedAt instanceof Date ? mutation.appliedAt : new Date(mutation.appliedAt || mutation.timestamp);
      const canRollback = now - appliedAt.getTime() < rollbackWindowMs;
      versions.set(mutation.version, {
        version: mutation.version,
        timestamp: mutation.timestamp instanceof Date ? mutation.timestamp : new Date(mutation.timestamp),
        description: mutation.description,
        mutationType: mutation.type,
        trigger: mutation.trigger.source,
        canRollback
      });
    }
  }
  return Array.from(versions.values()).sort((a, b) => semver.compare(b.version, a.version));
}
function getPreviousVersion(genome, currentVersion) {
  const versions = getVersionHistory(genome).map((v) => v.version).sort((a, b) => semver.compare(a, b));
  const currentIndex = versions.indexOf(currentVersion);
  if (currentIndex <= 0) return null;
  return versions[currentIndex - 1];
}
function calculateRestore(genome, targetVersion) {
  if (semver.gt(targetVersion, genome.version)) {
    return {
      success: false,
      version: targetVersion,
      rollbackMutations: [],
      error: `Cannot restore to future version ${targetVersion} (current: ${genome.version})`
    };
  }
  const toRollback = genome.mutations.filter(
    (m) => m.status === "applied" && semver.gt(m.version, targetVersion)
  ).sort((a, b) => semver.compare(b.version, a.version));
  if (toRollback.length === 0 && genome.version !== targetVersion) {
    return {
      success: false,
      version: targetVersion,
      rollbackMutations: [],
      error: `No path to restore from ${genome.version} to ${targetVersion}`
    };
  }
  return {
    success: true,
    version: targetVersion,
    rollbackMutations: toRollback
  };
}
function reconstructAtVersion(genome, mutations, targetVersion) {
  const toUndo = mutations.filter(
    (m) => m.status === "applied" && semver.gt(m.version, targetVersion)
  ).sort((a, b) => semver.compare(b.version, a.version));
  let state = {
    identity: structuredClone(genome.identity),
    tools: structuredClone(genome.tools),
    skills: structuredClone(genome.skills),
    knowledge: structuredClone(genome.knowledge),
    config: structuredClone(genome.config)
  };
  for (const mutation of toUndo) {
    state = applyReverseDiff(state, mutation.diff);
  }
  return state;
}
function applyReverseDiff(state, diff) {
  const path = diff.path;
  const before = diff.before;
  if (path === "/identity" || path === "identity") {
    return { ...state, identity: before };
  }
  if (path === "/tools" || path === "tools") {
    return { ...state, tools: before };
  }
  if (path === "/skills" || path === "skills") {
    return { ...state, skills: before };
  }
  if (path === "/knowledge" || path === "knowledge") {
    return { ...state, knowledge: before };
  }
  if (path === "/config" || path === "config") {
    return { ...state, config: before };
  }
  return state;
}
function diffVersions(genome, fromVersion, toVersion) {
  const mutations = genome.mutations.filter(
    (m) => m.status === "applied" && semver.gt(m.version, fromVersion) && semver.lte(m.version, toVersion)
  ).sort((a, b) => semver.compare(a.version, b.version));
  const changes = mutations.map((m) => ({
    path: m.diff.path,
    type: inferDiffType(m.diff),
    description: m.description,
    before: m.diff.before,
    after: m.diff.after
  }));
  const stats = {
    added: changes.filter((c) => c.type === "added").length,
    removed: changes.filter((c) => c.type === "removed").length,
    modified: changes.filter((c) => c.type === "modified").length
  };
  return {
    fromVersion,
    toVersion,
    changes,
    summary: generateSummary(stats, mutations.length),
    stats
  };
}
function diffGenomes(genome1, genome2) {
  const changes = [];
  if (JSON.stringify(genome1.identity) !== JSON.stringify(genome2.identity)) {
    changes.push({
      path: "/identity",
      type: "modified",
      description: "Identity changed",
      before: genome1.identity,
      after: genome2.identity
    });
  }
  const toolChanges = compareArrays(genome1.tools, genome2.tools, "id", "tools");
  changes.push(...toolChanges);
  const skillChanges = compareArrays(genome1.skills, genome2.skills, "id", "skills");
  changes.push(...skillChanges);
  if (JSON.stringify(genome1.config) !== JSON.stringify(genome2.config)) {
    changes.push({
      path: "/config",
      type: "modified",
      description: "Configuration changed",
      before: genome1.config,
      after: genome2.config
    });
  }
  const stats = {
    added: changes.filter((c) => c.type === "added").length,
    removed: changes.filter((c) => c.type === "removed").length,
    modified: changes.filter((c) => c.type === "modified").length
  };
  return {
    fromVersion: genome1.version,
    toVersion: genome2.version,
    changes,
    summary: generateSummary(stats, changes.length),
    stats
  };
}
function inferDiffType(diff) {
  if (diff.before === null || diff.before === void 0) return "added";
  if (diff.after === null || diff.after === void 0) return "removed";
  return "modified";
}
function compareArrays(arr1, arr2, idKey, basePath) {
  const changes = [];
  const map1 = new Map(arr1.map((item) => [item[idKey], item]));
  const map2 = new Map(arr2.map((item) => [item[idKey], item]));
  for (const [id, item] of map1) {
    if (!map2.has(id)) {
      changes.push({
        path: `/${basePath}/${id}`,
        type: "removed",
        description: `Removed ${basePath.slice(0, -1)}: ${item.name || id}`,
        before: item
      });
    }
  }
  for (const [id, item] of map2) {
    const original = map1.get(id);
    if (!original) {
      changes.push({
        path: `/${basePath}/${id}`,
        type: "added",
        description: `Added ${basePath.slice(0, -1)}: ${item.name || id}`,
        after: item
      });
    } else if (JSON.stringify(original) !== JSON.stringify(item)) {
      changes.push({
        path: `/${basePath}/${id}`,
        type: "modified",
        description: `Modified ${basePath.slice(0, -1)}: ${item.name || id}`,
        before: original,
        after: item
      });
    }
  }
  return changes;
}
function generateSummary(stats, total) {
  if (total === 0) return "No changes";
  const parts = [];
  if (stats.added > 0) parts.push(`+${stats.added}`);
  if (stats.removed > 0) parts.push(`-${stats.removed}`);
  if (stats.modified > 0) parts.push(`~${stats.modified}`);
  return `${total} change${total === 1 ? "" : "s"} (${parts.join(", ")})`;
}
var VersioningUtils = {
  getHistory: getVersionHistory,
  getPreviousVersion,
  calculateRestore,
  reconstructAtVersion,
  diffVersions,
  diffGenomes
};

export {
  __export,
  getVersionHistory,
  getPreviousVersion,
  calculateRestore,
  reconstructAtVersion,
  diffVersions,
  diffGenomes,
  VersioningUtils
};

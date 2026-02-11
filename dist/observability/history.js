// Execution history - persistent logging for all agent runs
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
const EMPTY_USAGE = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
    model: 'unknown',
};
/**
 * ExecutionLogger - tracks a single execution and saves to disk
 */
export class ExecutionLogger {
    id;
    startedAt;
    llmCalls = [];
    events = [];
    dataDir;
    constructor(dataDir) {
        this.id = randomUUID();
        this.startedAt = Date.now();
        this.dataDir = dataDir;
        // Ensure runs directory exists
        const runsDir = join(dataDir, 'runs');
        if (!existsSync(runsDir)) {
            mkdirSync(runsDir, { recursive: true });
        }
    }
    getId() {
        return this.id;
    }
    /**
     * Record an LLM call
     */
    recordLLMCall(call) {
        this.llmCalls.push({
            ...call,
            id: randomUUID(),
        });
    }
    /**
     * Record an event
     */
    recordEvent(event) {
        this.events.push({
            ...event,
            timestamp: Date.now(),
        });
    }
    /**
     * Finalize and save a chat execution
     */
    saveChatLog(log, success, error) {
        const completedAt = Date.now();
        const totalUsage = this.aggregateUsage();
        const executionLog = {
            id: this.id,
            startedAt: this.startedAt,
            completedAt,
            durationMs: completedAt - this.startedAt,
            success,
            error,
            totalUsage,
            run: {
                ...log,
                type: 'chat',
                llmCalls: this.llmCalls,
                events: this.events,
            },
        };
        this.persist(executionLog);
        return executionLog;
    }
    /**
     * Finalize and save a swarm execution
     */
    saveSwarmLog(log, success, error) {
        const completedAt = Date.now();
        const totalUsage = this.aggregateUsage();
        const executionLog = {
            id: this.id,
            startedAt: this.startedAt,
            completedAt,
            durationMs: completedAt - this.startedAt,
            success,
            error,
            totalUsage,
            run: {
                ...log,
                type: 'swarm',
                llmCalls: this.llmCalls,
                events: this.events,
            },
        };
        this.persist(executionLog);
        return executionLog;
    }
    /**
     * Aggregate usage across all LLM calls
     */
    aggregateUsage() {
        if (this.llmCalls.length === 0) {
            return EMPTY_USAGE;
        }
        const usage = this.llmCalls.reduce((acc, call) => {
            if (call.usage) {
                acc.promptTokens += call.usage.promptTokens;
                acc.completionTokens += call.usage.completionTokens;
                acc.totalTokens += call.usage.totalTokens;
                acc.estimatedCost += call.usage.estimatedCost;
            }
            return acc;
        }, { ...EMPTY_USAGE });
        // Use the model from the first call
        usage.model = this.llmCalls[0]?.model || 'unknown';
        return usage;
    }
    /**
     * Save log to disk
     */
    persist(log) {
        const filename = `${log.id}.json`;
        const filepath = join(this.dataDir, 'runs', filename);
        writeFileSync(filepath, JSON.stringify(log, null, 2));
    }
}
/**
 * HistoryStore - read and query execution logs
 */
export class HistoryStore {
    dataDir;
    constructor(dataDir) {
        this.dataDir = dataDir;
        // Ensure runs directory exists
        const runsDir = join(dataDir, 'runs');
        if (!existsSync(runsDir)) {
            mkdirSync(runsDir, { recursive: true });
        }
    }
    /**
     * List all execution logs (most recent first)
     */
    list(limit = 50, type) {
        const runsDir = join(this.dataDir, 'runs');
        if (!existsSync(runsDir)) {
            return [];
        }
        const files = readdirSync(runsDir)
            .filter(f => f.endsWith('.json'))
            .sort()
            .reverse(); // Most recent first (UUID has timestamp-like properties)
        const summaries = [];
        for (const file of files) {
            if (summaries.length >= limit)
                break;
            try {
                const log = this.get(file.replace('.json', ''));
                if (!log)
                    continue;
                if (type && log.run.type !== type)
                    continue;
                summaries.push(this.toSummary(log));
            }
            catch {
                // Skip corrupted files
            }
        }
        // Sort by startedAt (most recent first)
        return summaries.sort((a, b) => b.startedAt - a.startedAt);
    }
    /**
     * Get a specific execution log by ID
     */
    get(id) {
        const filepath = join(this.dataDir, 'runs', `${id}.json`);
        if (!existsSync(filepath)) {
            return null;
        }
        try {
            const content = readFileSync(filepath, 'utf-8');
            return JSON.parse(content);
        }
        catch {
            return null;
        }
    }
    /**
     * Get runs within a time range
     */
    getByTimeRange(startMs, endMs) {
        return this.list(1000)
            .filter(s => s.startedAt >= startMs && s.startedAt <= endMs)
            .map(s => this.get(s.id))
            .filter((log) => log !== null);
    }
    /**
     * Get aggregate stats
     */
    getStats(sinceMs) {
        const summaries = this.list(10000);
        const filtered = sinceMs
            ? summaries.filter(s => s.startedAt >= sinceMs)
            : summaries;
        if (filtered.length === 0) {
            return {
                totalRuns: 0,
                chatRuns: 0,
                swarmRuns: 0,
                totalTokens: 0,
                totalCost: 0,
                successRate: 0,
                avgDurationMs: 0,
            };
        }
        const chatRuns = filtered.filter(s => s.type === 'chat').length;
        const swarmRuns = filtered.filter(s => s.type === 'swarm').length;
        const successCount = filtered.filter(s => s.success).length;
        const totalTokens = filtered.reduce((sum, s) => sum + s.totalTokens, 0);
        const totalCost = filtered.reduce((sum, s) => sum + s.estimatedCost, 0);
        const totalDuration = filtered.reduce((sum, s) => sum + s.durationMs, 0);
        return {
            totalRuns: filtered.length,
            chatRuns,
            swarmRuns,
            totalTokens,
            totalCost,
            successRate: successCount / filtered.length,
            avgDurationMs: totalDuration / filtered.length,
        };
    }
    /**
     * Convert full log to summary
     */
    toSummary(log) {
        const preview = log.run.type === 'chat'
            ? log.run.userMessage.slice(0, 100)
            : log.run.goal.slice(0, 100);
        const agentCount = log.run.type === 'swarm'
            ? log.run.agentRuns?.length
            : undefined;
        return {
            id: log.id,
            type: log.run.type,
            startedAt: log.startedAt,
            durationMs: log.durationMs,
            success: log.success,
            preview,
            totalTokens: log.totalUsage.totalTokens,
            estimatedCost: log.totalUsage.estimatedCost,
            agentCount,
        };
    }
}

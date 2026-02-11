import type { ExecutionLog, ExecutionLogSummary, ChatLog, SwarmLog, UsageStats, LLMCall, AgentEvent } from './types.js';
/**
 * ExecutionLogger - tracks a single execution and saves to disk
 */
export declare class ExecutionLogger {
    private id;
    private startedAt;
    private llmCalls;
    private events;
    private dataDir;
    constructor(dataDir: string);
    getId(): string;
    /**
     * Record an LLM call
     */
    recordLLMCall(call: Omit<LLMCall, 'id'>): void;
    /**
     * Record an event
     */
    recordEvent(event: Omit<AgentEvent, 'timestamp'>): void;
    /**
     * Finalize and save a chat execution
     */
    saveChatLog(log: Omit<ChatLog, 'type' | 'llmCalls' | 'events'>, success: boolean, error?: string): ExecutionLog;
    /**
     * Finalize and save a swarm execution
     */
    saveSwarmLog(log: Omit<SwarmLog, 'type' | 'llmCalls' | 'events'>, success: boolean, error?: string): ExecutionLog;
    /**
     * Aggregate usage across all LLM calls
     */
    private aggregateUsage;
    /**
     * Save log to disk
     */
    private persist;
}
/**
 * HistoryStore - read and query execution logs
 */
export declare class HistoryStore {
    private dataDir;
    constructor(dataDir: string);
    /**
     * List all execution logs (most recent first)
     */
    list(limit?: number, type?: 'chat' | 'swarm'): ExecutionLogSummary[];
    /**
     * Get a specific execution log by ID
     */
    get(id: string): ExecutionLog | null;
    /**
     * Get runs within a time range
     */
    getByTimeRange(startMs: number, endMs: number): ExecutionLog[];
    /**
     * Get aggregate stats
     */
    getStats(sinceMs?: number): {
        totalRuns: number;
        chatRuns: number;
        swarmRuns: number;
        totalTokens: number;
        totalCost: number;
        successRate: number;
        avgDurationMs: number;
    };
    /**
     * Convert full log to summary
     */
    private toSummary;
}
export type { ExecutionLog, ExecutionLogSummary, ChatLog, SwarmLog, UsageStats, LLMCall, AgentEvent };

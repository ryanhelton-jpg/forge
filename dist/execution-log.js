// Execution History - Day 1 of v0.4 Observability Sprint
// Logs all agent runs for debugging, cost tracking, and analysis
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
export class ExecutionLog {
    dataDir;
    logFile;
    runs = [];
    activeRuns = new Map();
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.logFile = join(dataDir, 'execution-log.json');
        this.load();
    }
    load() {
        if (!existsSync(this.dataDir)) {
            mkdirSync(this.dataDir, { recursive: true });
        }
        if (existsSync(this.logFile)) {
            try {
                const data = JSON.parse(readFileSync(this.logFile, 'utf-8'));
                this.runs = data.runs || [];
            }
            catch (e) {
                console.error('Failed to load execution log:', e);
                this.runs = [];
            }
        }
    }
    save() {
        try {
            writeFileSync(this.logFile, JSON.stringify({
                version: '1.0',
                runs: this.runs.slice(-1000) // Keep last 1000 runs
            }, null, 2));
        }
        catch (e) {
            console.error('Failed to save execution log:', e);
        }
    }
    // Start a new execution run
    startRun(type, input, sessionId) {
        const id = randomUUID();
        const run = {
            id,
            type,
            sessionId,
            startedAt: new Date().toISOString(),
            status: 'running',
            input,
        };
        this.activeRuns.set(id, run);
        return id;
    }
    // Update run with model/token info
    updateRunModel(runId, model, tokens) {
        const run = this.activeRuns.get(runId);
        if (run) {
            run.model = model;
            if (tokens) {
                run.tokens = tokens;
            }
        }
    }
    // Add tool call to run
    addToolCall(runId, toolCall) {
        const run = this.activeRuns.get(runId);
        if (run) {
            if (!run.toolCalls) {
                run.toolCalls = [];
            }
            run.toolCalls.push(toolCall);
        }
    }
    // Complete a run successfully
    completeRun(runId, output) {
        const run = this.activeRuns.get(runId);
        if (!run)
            return null;
        run.completedAt = new Date().toISOString();
        run.durationMs = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
        run.status = 'success';
        run.output = output;
        this.runs.push(run);
        this.activeRuns.delete(runId);
        this.save();
        return run;
    }
    // Fail a run
    failRun(runId, error) {
        const run = this.activeRuns.get(runId);
        if (!run)
            return null;
        run.completedAt = new Date().toISOString();
        run.durationMs = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
        run.status = 'error';
        run.output = { error };
        this.runs.push(run);
        this.activeRuns.delete(runId);
        this.save();
        return run;
    }
    // Update swarm-specific info
    updateSwarmInfo(runId, swarmInfo) {
        const run = this.activeRuns.get(runId);
        if (run) {
            run.swarm = swarmInfo;
        }
    }
    // Get a specific run
    getRun(runId) {
        return this.runs.find(r => r.id === runId) || this.activeRuns.get(runId);
    }
    // List runs with optional filters
    listRuns(options = {}) {
        let filtered = [...this.runs];
        if (options.type) {
            filtered = filtered.filter(r => r.type === options.type);
        }
        if (options.sessionId) {
            filtered = filtered.filter(r => r.sessionId === options.sessionId);
        }
        if (options.status) {
            filtered = filtered.filter(r => r.status === options.status);
        }
        if (options.since) {
            const sinceDate = new Date(options.since);
            filtered = filtered.filter(r => new Date(r.startedAt) >= sinceDate);
        }
        // Add active runs
        for (const run of this.activeRuns.values()) {
            if (!options.type || run.type === options.type) {
                if (!options.sessionId || run.sessionId === options.sessionId) {
                    filtered.push(run);
                }
            }
        }
        // Sort by startedAt descending
        filtered.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        // Apply limit
        const limit = options.limit || 50;
        filtered = filtered.slice(0, limit);
        // Map to summaries
        return filtered.map(r => ({
            id: r.id,
            type: r.type,
            sessionId: r.sessionId,
            startedAt: r.startedAt,
            durationMs: r.durationMs,
            status: r.status,
            preview: this.getPreview(r),
            model: r.model,
            tokenTotal: r.tokens?.total,
        }));
    }
    getPreview(run) {
        if (run.input.message) {
            return run.input.message.slice(0, 100);
        }
        if (run.input.goal) {
            return run.input.goal.slice(0, 100);
        }
        return '(no preview)';
    }
    // Get aggregate stats
    getStats(since) {
        let runs = this.runs;
        if (since) {
            const sinceDate = new Date(since);
            runs = runs.filter(r => new Date(r.startedAt) >= sinceDate);
        }
        const chatRuns = runs.filter(r => r.type === 'chat').length;
        const swarmRuns = runs.filter(r => r.type === 'swarm').length;
        const successRuns = runs.filter(r => r.status === 'success').length;
        const durations = runs.filter(r => r.durationMs).map(r => r.durationMs);
        const tokens = runs.filter(r => r.tokens?.total).map(r => r.tokens.total);
        return {
            totalRuns: runs.length,
            chatRuns,
            swarmRuns,
            successRate: runs.length > 0 ? successRuns / runs.length : 0,
            avgDurationMs: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
            totalTokens: tokens.reduce((a, b) => a + b, 0),
        };
    }
}

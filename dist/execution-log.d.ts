export interface ExecutionRun {
    id: string;
    type: 'chat' | 'swarm';
    sessionId?: string;
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
    status: 'running' | 'success' | 'error';
    input: {
        message?: string;
        goal?: string;
        plan?: unknown;
    };
    output?: {
        response?: string;
        thinking?: string;
        result?: unknown;
        error?: string;
    };
    model?: string;
    tokens?: {
        prompt?: number;
        completion?: number;
        total?: number;
    };
    toolCalls?: Array<{
        name: string;
        input: unknown;
        output: unknown;
        durationMs: number;
    }>;
    swarm?: {
        protocol?: string;
        tasksCount?: number;
        agentsUsed?: string[];
    };
}
export interface ExecutionSummary {
    id: string;
    type: 'chat' | 'swarm';
    sessionId?: string;
    startedAt: string;
    durationMs?: number;
    status: 'running' | 'success' | 'error';
    preview: string;
    model?: string;
    tokenTotal?: number;
}
export declare class ExecutionLog {
    private dataDir;
    private logFile;
    private runs;
    private activeRuns;
    constructor(dataDir: string);
    private load;
    private save;
    startRun(type: 'chat' | 'swarm', input: ExecutionRun['input'], sessionId?: string): string;
    updateRunModel(runId: string, model: string, tokens?: ExecutionRun['tokens']): void;
    addToolCall(runId: string, toolCall: NonNullable<ExecutionRun['toolCalls']>[0]): void;
    completeRun(runId: string, output: ExecutionRun['output']): ExecutionRun | null;
    failRun(runId: string, error: string): ExecutionRun | null;
    updateSwarmInfo(runId: string, swarmInfo: ExecutionRun['swarm']): void;
    getRun(runId: string): ExecutionRun | undefined;
    listRuns(options?: {
        limit?: number;
        type?: 'chat' | 'swarm';
        sessionId?: string;
        status?: ExecutionRun['status'];
        since?: string;
    }): ExecutionSummary[];
    private getPreview;
    getStats(since?: string): {
        totalRuns: number;
        chatRuns: number;
        swarmRuns: number;
        successRate: number;
        avgDurationMs: number;
        totalTokens: number;
    };
}

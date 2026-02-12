export interface PersistedSwarm {
    runId: string;
    goal: string;
    status: 'running' | 'complete' | 'error';
    startedAt: number;
    completedAt?: number;
    currentAgent?: string;
    currentTask?: string;
    completedTasks: number;
    totalTasks: number;
    blackboardEntries: number;
    result?: {
        success: boolean;
        finalOutput: string;
        tasks?: Array<{
            id: string;
            description: string;
            status: string;
            result?: string;
        }>;
    };
    error?: string;
}
export declare class SwarmPersistence {
    private dir;
    private cache;
    constructor(dataDir: string);
    private getPath;
    private loadAll;
    save(swarm: PersistedSwarm): void;
    get(runId: string): PersistedSwarm | undefined;
    delete(runId: string): void;
    cleanup(): number;
    getAll(): PersistedSwarm[];
    start(runId: string, goal: string): void;
    updateProgress(runId: string, updates: Partial<PersistedSwarm>): void;
    complete(runId: string, result: PersistedSwarm['result']): void;
    error(runId: string, error: string): void;
}

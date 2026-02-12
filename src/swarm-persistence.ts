// Swarm Persistence - Survive server restarts
// Writes swarm state to disk so results aren't lost on restart

import { join } from 'path';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';

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
    tasks?: Array<{ id: string; description: string; status: string; result?: string }>;
  };
  error?: string;
}

export class SwarmPersistence {
  private dir: string;
  private cache: Map<string, PersistedSwarm> = new Map();

  constructor(dataDir: string) {
    this.dir = join(dataDir, 'swarms');
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
    this.loadAll();
  }

  private getPath(runId: string): string {
    return join(this.dir, `${runId}.json`);
  }

  private loadAll(): void {
    try {
      const files = readdirSync(this.dir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const data = readFileSync(join(this.dir, file), 'utf-8');
          const swarm = JSON.parse(data) as PersistedSwarm;
          this.cache.set(swarm.runId, swarm);
        } catch {
          // Skip corrupted files
        }
      }
      console.log(`   Loaded ${this.cache.size} persisted swarm states`);
    } catch {
      // Dir doesn't exist yet, that's fine
    }
  }

  save(swarm: PersistedSwarm): void {
    this.cache.set(swarm.runId, swarm);
    try {
      writeFileSync(this.getPath(swarm.runId), JSON.stringify(swarm, null, 2));
    } catch (e) {
      console.error(`Failed to persist swarm ${swarm.runId}:`, e);
    }
  }

  get(runId: string): PersistedSwarm | undefined {
    return this.cache.get(runId);
  }

  delete(runId: string): void {
    this.cache.delete(runId);
    try {
      const path = this.getPath(runId);
      if (existsSync(path)) {
        unlinkSync(path);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  // Clean up old completed/errored swarms (> 1 hour old)
  cleanup(): number {
    const cutoff = Date.now() - 3600000; // 1 hour
    let cleaned = 0;
    for (const [runId, swarm] of this.cache) {
      if (swarm.status !== 'running' && swarm.startedAt < cutoff) {
        this.delete(runId);
        cleaned++;
      }
    }
    return cleaned;
  }

  // Get all active/recent swarms
  getAll(): PersistedSwarm[] {
    return Array.from(this.cache.values());
  }

  // Mark a swarm as running (called on start)
  start(runId: string, goal: string): void {
    this.save({
      runId,
      goal,
      status: 'running',
      startedAt: Date.now(),
      completedTasks: 0,
      totalTasks: 0,
      blackboardEntries: 0,
    });
  }

  // Update progress
  updateProgress(runId: string, updates: Partial<PersistedSwarm>): void {
    const existing = this.get(runId);
    if (existing) {
      this.save({ ...existing, ...updates });
    }
  }

  // Mark complete with result
  complete(runId: string, result: PersistedSwarm['result']): void {
    const existing = this.get(runId);
    if (existing) {
      this.save({
        ...existing,
        status: 'complete',
        completedAt: Date.now(),
        result,
      });
    }
  }

  // Mark errored
  error(runId: string, error: string): void {
    const existing = this.get(runId);
    if (existing) {
      this.save({
        ...existing,
        status: 'error',
        completedAt: Date.now(),
        error,
      });
    }
  }
}

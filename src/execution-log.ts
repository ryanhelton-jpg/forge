// Execution History - Day 1 of v0.4 Observability Sprint
// Logs all agent runs for debugging, cost tracking, and analysis

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

// Model pricing ($ per 1M tokens) - synced with llm.ts
const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  'anthropic/claude-sonnet-4': { prompt: 3.0, completion: 15.0 },
  'anthropic/claude-opus-4': { prompt: 15.0, completion: 75.0 },
  'anthropic/claude-3.5-sonnet': { prompt: 3.0, completion: 15.0 },
  'anthropic/claude-3-opus': { prompt: 15.0, completion: 75.0 },
  'anthropic/claude-3-haiku': { prompt: 0.25, completion: 1.25 },
  'openai/gpt-4o': { prompt: 2.5, completion: 10.0 },
  'openai/gpt-4-turbo': { prompt: 10.0, completion: 30.0 },
  'openai/gpt-3.5-turbo': { prompt: 0.5, completion: 1.5 },
  'google/gemini-2.0-flash-exp': { prompt: 0.0, completion: 0.0 },
  'google/gemini-pro': { prompt: 0.125, completion: 0.375 },
  'meta-llama/llama-3.1-70b-instruct': { prompt: 0.59, completion: 0.79 },
  'meta-llama/llama-3.1-405b-instruct': { prompt: 2.7, completion: 2.7 },
};

function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    return ((promptTokens * 1.0) + (completionTokens * 3.0)) / 1_000_000;
  }
  return ((promptTokens * pricing.prompt) + (completionTokens * pricing.completion)) / 1_000_000;
}

export interface ExecutionRun {
  id: string;
  type: 'chat' | 'swarm';
  sessionId?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  status: 'running' | 'success' | 'error';
  
  // Input
  input: {
    message?: string;
    goal?: string;
    plan?: unknown;
  };
  
  // Output
  output?: {
    response?: string;
    thinking?: string;
    result?: unknown;
    error?: string;
  };
  
  // Model info and cost tracking
  model?: string;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  cost?: number; // Estimated cost in USD
  
  // Tool usage
  toolCalls?: Array<{
    name: string;
    input: unknown;
    output: unknown;
    durationMs: number;
  }>;
  
  // Swarm-specific
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
  cost?: number;
}

export class ExecutionLog {
  private dataDir: string;
  private logFile: string;
  private runs: ExecutionRun[] = [];
  private activeRuns: Map<string, ExecutionRun> = new Map();
  
  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.logFile = join(dataDir, 'execution-log.json');
    this.load();
  }
  
  private load(): void {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
    
    if (existsSync(this.logFile)) {
      try {
        const data = JSON.parse(readFileSync(this.logFile, 'utf-8'));
        this.runs = data.runs || [];
      } catch (e) {
        console.error('Failed to load execution log:', e);
        this.runs = [];
      }
    }
  }
  
  private save(): void {
    try {
      writeFileSync(this.logFile, JSON.stringify({ 
        version: '1.0',
        runs: this.runs.slice(-1000) // Keep last 1000 runs
      }, null, 2));
    } catch (e) {
      console.error('Failed to save execution log:', e);
    }
  }
  
  // Start a new execution run
  startRun(type: 'chat' | 'swarm', input: ExecutionRun['input'], sessionId?: string): string {
    const id = randomUUID();
    const run: ExecutionRun = {
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
  
  // Update run with model/token info and calculate cost
  updateRunModel(runId: string, model: string, tokens?: ExecutionRun['tokens']): void {
    const run = this.activeRuns.get(runId);
    if (run) {
      run.model = model;
      if (tokens) {
        run.tokens = tokens;
        // Calculate cost based on model pricing
        run.cost = calculateCost(
          model, 
          tokens.prompt || 0, 
          tokens.completion || 0
        );
      }
    }
  }
  
  // Add tool call to run
  addToolCall(runId: string, toolCall: NonNullable<ExecutionRun['toolCalls']>[0]): void {
    const run = this.activeRuns.get(runId);
    if (run) {
      if (!run.toolCalls) {
        run.toolCalls = [];
      }
      run.toolCalls.push(toolCall);
    }
  }
  
  // Complete a run successfully
  completeRun(runId: string, output: ExecutionRun['output']): ExecutionRun | null {
    const run = this.activeRuns.get(runId);
    if (!run) return null;
    
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
  failRun(runId: string, error: string): ExecutionRun | null {
    const run = this.activeRuns.get(runId);
    if (!run) return null;
    
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
  updateSwarmInfo(runId: string, swarmInfo: ExecutionRun['swarm']): void {
    const run = this.activeRuns.get(runId);
    if (run) {
      run.swarm = swarmInfo;
    }
  }
  
  // Get a specific run
  getRun(runId: string): ExecutionRun | undefined {
    return this.runs.find(r => r.id === runId) || this.activeRuns.get(runId);
  }
  
  // List runs with optional filters
  listRuns(options: {
    limit?: number;
    type?: 'chat' | 'swarm';
    sessionId?: string;
    status?: ExecutionRun['status'];
    since?: string;
  } = {}): ExecutionSummary[] {
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
      cost: r.cost,
    }));
  }
  
  private getPreview(run: ExecutionRun): string {
    if (run.input.message) {
      return run.input.message.slice(0, 100);
    }
    if (run.input.goal) {
      return run.input.goal.slice(0, 100);
    }
    return '(no preview)';
  }
  
  // Get aggregate stats
  getStats(since?: string): {
    totalRuns: number;
    chatRuns: number;
    swarmRuns: number;
    successRate: number;
    avgDurationMs: number;
    totalTokens: number;
    totalCost: number;
  } {
    let runs = this.runs;
    if (since) {
      const sinceDate = new Date(since);
      runs = runs.filter(r => new Date(r.startedAt) >= sinceDate);
    }
    
    const chatRuns = runs.filter(r => r.type === 'chat').length;
    const swarmRuns = runs.filter(r => r.type === 'swarm').length;
    const successRuns = runs.filter(r => r.status === 'success').length;
    const durations = runs.filter(r => r.durationMs).map(r => r.durationMs!);
    const tokens = runs.filter(r => r.tokens?.total).map(r => r.tokens!.total!);
    const costs = runs.filter(r => r.cost !== undefined).map(r => r.cost!);
    
    return {
      totalRuns: runs.length,
      chatRuns,
      swarmRuns,
      successRate: runs.length > 0 ? successRuns / runs.length : 0,
      avgDurationMs: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      totalTokens: tokens.reduce((a, b) => a + b, 0),
      totalCost: costs.reduce((a, b) => a + b, 0),
    };
  }
}

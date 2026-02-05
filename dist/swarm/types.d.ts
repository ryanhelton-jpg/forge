import type { Tool, Message } from '../types.js';
/**
 * Agent role definition - specialized agent configuration
 */
export interface AgentRole {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    tools?: Tool[];
    temperature?: number;
    model?: string;
}
/**
 * Task that gets assigned to agents
 */
export interface SwarmTask {
    id: string;
    description: string;
    assignedTo?: string;
    dependencies?: string[];
    status: 'pending' | 'running' | 'complete' | 'failed';
    result?: string;
    error?: string;
}
/**
 * Blackboard entry - shared knowledge between agents
 */
export interface BlackboardEntry {
    id: string;
    author: string;
    type: 'finding' | 'artifact' | 'question' | 'decision' | 'critique';
    content: string;
    timestamp: number;
    tags?: string[];
    references?: string[];
}
/**
 * Swarm execution plan
 */
export interface SwarmPlan {
    goal: string;
    tasks: SwarmTask[];
    protocol: 'sequential' | 'parallel' | 'debate' | 'custom';
}
/**
 * Agent execution context
 */
export interface AgentContext {
    role: AgentRole;
    task: SwarmTask;
    blackboard: BlackboardEntry[];
    history: Message[];
}
/**
 * Swarm configuration
 */
export interface SwarmConfig {
    apiKey: string;
    defaultModel: string;
    roles: AgentRole[];
    maxTurnsPerAgent?: number;
    maxTotalTurns?: number;
    onThinking?: (roleId: string, thinking: string) => void;
    onAgentStart?: (roleId: string, task: SwarmTask) => void;
    onAgentComplete?: (roleId: string, task: SwarmTask, result: string) => void;
    onBlackboardUpdate?: (entry: BlackboardEntry) => void;
}
/**
 * Swarm execution result
 */
export interface SwarmResult {
    success: boolean;
    goal: string;
    finalOutput: string;
    blackboard: BlackboardEntry[];
    tasks: SwarmTask[];
    totalTurns: number;
    timing: {
        startedAt: number;
        completedAt: number;
        durationMs: number;
    };
}

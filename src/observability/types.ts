// Observability types for Forge agent framework

import type { Message } from '../types.js';
import type { SwarmTask, BlackboardEntry } from '../swarm/types.js';

/**
 * Token usage from LLM call
 */
export interface UsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number; // USD
  model: string;
}

/**
 * Individual LLM call record
 */
export interface LLMCall {
  id: string;
  timestamp: number;
  model: string;
  messages: Message[];
  response: string;
  thinking?: string;
  usage?: UsageStats;
  durationMs: number;
  error?: string;
}

/**
 * Agent event during execution
 */
export interface AgentEvent {
  timestamp: number;
  type: 'start' | 'thinking' | 'tool_call' | 'tool_result' | 'complete' | 'error';
  agentId?: string; // Role ID for swarm agents
  data: Record<string, unknown>;
}

/**
 * Chat execution log
 */
export interface ChatLog {
  type: 'chat';
  sessionId: string;
  userMessage: string;
  response: string;
  thinking?: string;
  toolCalls?: Array<{
    name: string;
    params: Record<string, unknown>;
    result: string;
    durationMs: number;
  }>;
  llmCalls: LLMCall[];
  events: AgentEvent[];
}

/**
 * Swarm execution log
 */
export interface SwarmLog {
  type: 'swarm';
  goal: string;
  protocol: 'sequential' | 'parallel' | 'debate' | 'custom';
  plan: {
    tasks: SwarmTask[];
  };
  blackboard: BlackboardEntry[];
  llmCalls: LLMCall[];
  events: AgentEvent[];
  agentRuns: Array<{
    roleId: string;
    taskId: string;
    response: string;
    thinking?: string;
    durationMs: number;
  }>;
}

/**
 * Execution log - unified type for all run types
 */
export interface ExecutionLog {
  id: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  success: boolean;
  error?: string;
  
  // Total usage across all LLM calls
  totalUsage: UsageStats;
  
  // Run-specific data
  run: ChatLog | SwarmLog;
}

/**
 * Execution log summary (for list views)
 */
export interface ExecutionLogSummary {
  id: string;
  type: 'chat' | 'swarm';
  startedAt: number;
  durationMs: number;
  success: boolean;
  preview: string; // First 100 chars of goal/message
  totalTokens: number;
  estimatedCost: number;
  agentCount?: number; // For swarm runs
}

import type { Message, AgentConfig, Tool } from './types.js';
import type { UsageStats } from './observability/types.js';
export interface ThinkingCallback {
    (thinking: string): void;
}
export interface ChatResult {
    response: string;
    thinking: string | null;
    usage: UsageStats;
    toolCalls?: Array<{
        name: string;
        params: Record<string, unknown>;
        result: string;
        durationMs: number;
    }>;
}
export declare class Agent {
    private config;
    private state;
    private tools;
    private thinkingCallback?;
    constructor(config: AgentConfig);
    onThinking(callback: ThinkingCallback): void;
    updateSystemPrompt(newPrompt: string): void;
    registerTool(tool: Tool): void;
    removeTool(name: string): boolean;
    getRegisteredTools(): string[];
    private getToolDescriptions;
    private parseToolCalls;
    private executeTool;
    chat(userInput: string): Promise<ChatResult>;
    chatSimple(userInput: string): Promise<string>;
    getHistory(): Message[];
    clearHistory(): void;
}

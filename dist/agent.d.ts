import type { Message, AgentConfig, Tool } from './types.js';
export interface ThinkingCallback {
    (thinking: string): void;
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
    chat(userInput: string): Promise<{
        response: string;
        thinking: string | null;
    }>;
    chatSimple(userInput: string): Promise<string>;
    getHistory(): Message[];
    clearHistory(): void;
}

export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface Tool {
    name: string;
    description: string;
    parameters: Record<string, ToolParameter>;
    execute: (params: Record<string, unknown>) => Promise<string>;
}
export interface ToolParameter {
    type: 'string' | 'number' | 'boolean';
    description: string;
    required?: boolean;
}
export interface ToolCall {
    name: string;
    params: Record<string, unknown>;
}
export interface AgentConfig {
    model: string;
    apiKey: string;
    systemPrompt?: string;
    maxTurns?: number;
    maxTokens?: number;
}
export interface AgentState {
    messages: Message[];
    turnCount: number;
}

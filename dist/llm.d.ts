import type { Message } from './types.js';
import type { UsageStats } from './observability/types.js';
interface StreamCallback {
    onThinking?: (text: string) => void;
    onContent?: (text: string) => void;
    onDone?: () => void;
}
/**
 * Result from LLM call including usage stats
 */
export interface LLMResult {
    content: string;
    usage: UsageStats;
    durationMs: number;
}
/**
 * Call LLM and return content with usage stats
 */
export declare function callLLMWithUsage(messages: Message[], apiKey: string, model?: string, maxTokens?: number): Promise<LLMResult>;
/**
 * Call LLM (legacy - returns content only)
 */
export declare function callLLM(messages: Message[], apiKey: string, model?: string, maxTokens?: number): Promise<string>;
export declare function callLLMStream(messages: Message[], apiKey: string, model?: string, callbacks?: StreamCallback, maxTokens?: number): Promise<string>;
export declare function parseThinking(content: string): {
    thinking: string | null;
    response: string;
};
export {};

import type { Message } from './types.js';
interface StreamCallback {
    onThinking?: (text: string) => void;
    onContent?: (text: string) => void;
    onDone?: () => void;
}
export declare function callLLM(messages: Message[], apiKey: string, model?: string): Promise<string>;
export declare function callLLMStream(messages: Message[], apiKey: string, model?: string, callbacks?: StreamCallback): Promise<string>;
export declare function parseThinking(content: string): {
    thinking: string | null;
    response: string;
};
export {};

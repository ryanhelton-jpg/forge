// LLM interface - OpenRouter with streaming support and usage tracking
// Model pricing ($ per 1M tokens) - top models
// Source: https://openrouter.ai/docs#models
const MODEL_PRICING = {
    'anthropic/claude-sonnet-4': { prompt: 3.0, completion: 15.0 },
    'anthropic/claude-opus-4': { prompt: 15.0, completion: 75.0 },
    'anthropic/claude-3.5-sonnet': { prompt: 3.0, completion: 15.0 },
    'anthropic/claude-3-opus': { prompt: 15.0, completion: 75.0 },
    'anthropic/claude-3-haiku': { prompt: 0.25, completion: 1.25 },
    'openai/gpt-4o': { prompt: 2.5, completion: 10.0 },
    'openai/gpt-4-turbo': { prompt: 10.0, completion: 30.0 },
    'openai/gpt-3.5-turbo': { prompt: 0.5, completion: 1.5 },
    'google/gemini-2.0-flash-exp': { prompt: 0.0, completion: 0.0 }, // Free during preview
    'google/gemini-pro': { prompt: 0.125, completion: 0.375 },
    'meta-llama/llama-3.1-70b-instruct': { prompt: 0.59, completion: 0.79 },
    'meta-llama/llama-3.1-405b-instruct': { prompt: 2.7, completion: 2.7 },
};
/**
 * Calculate estimated cost for token usage
 */
function calculateCost(model, promptTokens, completionTokens) {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
        // Default fallback pricing
        return ((promptTokens * 1.0) + (completionTokens * 3.0)) / 1_000_000;
    }
    return ((promptTokens * pricing.prompt) + (completionTokens * pricing.completion)) / 1_000_000;
}
/**
 * Parse usage from OpenRouter response
 */
function parseUsage(response, model) {
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    return {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        estimatedCost: calculateCost(model, usage.prompt_tokens, usage.completion_tokens),
        model,
    };
}
/**
 * Call LLM and return content with usage stats
 */
export async function callLLMWithUsage(messages, apiKey, model = 'anthropic/claude-sonnet-4') {
    const startTime = Date.now();
    const formattedMessages = messages.map(m => ({
        role: m.role,
        content: m.content,
    }));
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://github.com/forge-agent',
            'X-Title': 'Forge Agent Framework',
        },
        body: JSON.stringify({
            model,
            max_tokens: 1024,
            messages: formattedMessages,
        }),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`LLM call failed: ${response.status} - ${error}`);
    }
    const data = (await response.json());
    const content = data.choices[0]?.message?.content || '';
    const usage = parseUsage(data, model);
    const durationMs = Date.now() - startTime;
    return { content, usage, durationMs };
}
/**
 * Call LLM (legacy - returns content only)
 */
export async function callLLM(messages, apiKey, model = 'anthropic/claude-sonnet-4') {
    const result = await callLLMWithUsage(messages, apiKey, model);
    return result.content;
}
// Streaming version for thinking display
export async function callLLMStream(messages, apiKey, model = 'anthropic/claude-sonnet-4', callbacks = {}) {
    const formattedMessages = messages.map(m => ({
        role: m.role,
        content: m.content,
    }));
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://github.com/forge-agent',
            'X-Title': 'Forge Agent Framework',
        },
        body: JSON.stringify({
            model,
            max_tokens: 1024,
            messages: formattedMessages,
            stream: true,
        }),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`LLM call failed: ${response.status} - ${error}`);
    }
    const reader = response.body?.getReader();
    if (!reader)
        throw new Error('No response body');
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                    callbacks.onDone?.();
                    continue;
                }
                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                        fullContent += delta;
                        // Check if we're in a thinking block
                        if (fullContent.includes('<thinking>') && !fullContent.includes('</thinking>')) {
                            callbacks.onThinking?.(delta);
                        }
                        else {
                            callbacks.onContent?.(delta);
                        }
                    }
                }
                catch { }
            }
        }
    }
    return fullContent;
}
// Parse thinking from response
export function parseThinking(content) {
    const thinkingMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/);
    if (thinkingMatch) {
        const thinking = thinkingMatch[1].trim();
        const response = content.replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim();
        return { thinking, response };
    }
    return { thinking: null, response: content };
}

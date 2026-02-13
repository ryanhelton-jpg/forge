// The Agent - core loop with thinking support and usage tracking
import { callLLMWithUsage, parseThinking } from './llm.js';
// Empty usage for initialization
const EMPTY_USAGE = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
    model: 'unknown',
    source: 'estimated',
};
// Aggregate multiple usage stats
function aggregateUsage(stats) {
    if (stats.length === 0)
        return EMPTY_USAGE;
    // Determine source: body if any are body, then headers, then estimated
    const hasBody = stats.some(s => s.source === 'body');
    const hasHeaders = stats.some(s => s.source === 'headers');
    const source = hasBody ? 'body' : hasHeaders ? 'headers' : 'estimated';
    return stats.reduce((acc, s) => ({
        promptTokens: acc.promptTokens + s.promptTokens,
        completionTokens: acc.completionTokens + s.completionTokens,
        totalTokens: acc.totalTokens + s.totalTokens,
        estimatedCost: acc.estimatedCost + s.estimatedCost,
        model: s.model, // Use last model
        source,
    }), { ...EMPTY_USAGE });
}
export class Agent {
    config;
    state;
    tools = new Map();
    thinkingCallback;
    constructor(config) {
        this.config = config;
        this.state = {
            messages: [],
            turnCount: 0,
        };
        if (config.systemPrompt) {
            this.state.messages.push({
                role: 'system',
                content: config.systemPrompt,
            });
        }
    }
    // Set callback for thinking stream
    onThinking(callback) {
        this.thinkingCallback = callback;
    }
    // Update system prompt (for self-evolution)
    updateSystemPrompt(newPrompt) {
        const sysIdx = this.state.messages.findIndex(m => m.role === 'system');
        if (sysIdx >= 0) {
            this.state.messages[sysIdx].content = newPrompt;
        }
        else {
            this.state.messages.unshift({ role: 'system', content: newPrompt });
        }
    }
    registerTool(tool) {
        this.tools.set(tool.name, tool);
    }
    removeTool(name) {
        return this.tools.delete(name);
    }
    getRegisteredTools() {
        return Array.from(this.tools.keys());
    }
    getToolDescriptions() {
        if (this.tools.size === 0)
            return '';
        const toolDocs = Array.from(this.tools.values())
            .map(tool => {
            const params = Object.entries(tool.parameters)
                .map(([name, p]) => `    - ${name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`)
                .join('\n');
            return `<tool name="${tool.name}">\n  ${tool.description}\n  Parameters:\n${params}\n</tool>`;
        })
            .join('\n\n');
        return `\n\nYou have access to these tools:\n\n${toolDocs}\n\nTo use a tool, respond with:\n<tool_call name="tool_name">\n<param name="param_name">value</param>\n</tool_call>\n\nYou can also share your thinking process by wrapping it in <thinking>...</thinking> tags before your response. This helps users understand your reasoning.`;
    }
    parseToolCalls(response) {
        const calls = [];
        const toolCallRegex = /<tool_call name="([^"]+)">([\s\S]*?)<\/tool_call>/g;
        const paramRegex = /<param name="([^"]+)">([^<]*)<\/param>/g;
        let match;
        while ((match = toolCallRegex.exec(response)) !== null) {
            const [, name, body] = match;
            const params = {};
            let paramMatch;
            while ((paramMatch = paramRegex.exec(body)) !== null) {
                const [, paramName, paramValue] = paramMatch;
                params[paramName] = paramValue;
            }
            calls.push({ name, params });
        }
        return calls;
    }
    async executeTool(call) {
        const tool = this.tools.get(call.name);
        if (!tool) {
            return `Error: Unknown tool "${call.name}"`;
        }
        try {
            return await tool.execute(call.params);
        }
        catch (error) {
            return `Error executing ${call.name}: ${error}`;
        }
    }
    // Main chat method with thinking support and usage tracking
    async chat(userInput) {
        this.state.messages.push({
            role: 'user',
            content: userInput,
        });
        const maxTurns = this.config.maxTurns || 10;
        let lastThinking = null;
        const usageStats = [];
        const toolCallResults = [];
        while (this.state.turnCount < maxTurns) {
            this.state.turnCount++;
            const messagesWithTools = [...this.state.messages];
            if (this.tools.size > 0 && messagesWithTools[0]?.role === 'system') {
                messagesWithTools[0] = {
                    ...messagesWithTools[0],
                    content: messagesWithTools[0].content + this.getToolDescriptions(),
                };
            }
            const llmResult = await callLLMWithUsage(messagesWithTools, this.config.apiKey, this.config.model, this.config.maxTokens || 4096);
            usageStats.push(llmResult.usage);
            // Parse thinking from response
            const { thinking, response } = parseThinking(llmResult.content);
            if (thinking) {
                lastThinking = thinking;
                this.thinkingCallback?.(thinking);
            }
            const toolCalls = this.parseToolCalls(response);
            if (toolCalls.length === 0) {
                this.state.messages.push({
                    role: 'assistant',
                    content: response,
                });
                this.state.turnCount = 0;
                return {
                    response,
                    thinking: lastThinking,
                    usage: aggregateUsage(usageStats),
                    toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined,
                };
            }
            const toolResults = [];
            for (const call of toolCalls) {
                const toolStart = Date.now();
                const result = await this.executeTool(call);
                const toolDuration = Date.now() - toolStart;
                toolCallResults.push({
                    name: call.name,
                    params: call.params,
                    result,
                    durationMs: toolDuration,
                });
                toolResults.push(`<tool_result name="${call.name}">\n${result}\n</tool_result>`);
            }
            this.state.messages.push({
                role: 'assistant',
                content: llmResult.content,
            });
            this.state.messages.push({
                role: 'user',
                content: toolResults.join('\n\n'),
            });
        }
        return {
            response: 'Max turns reached. Stopping.',
            thinking: lastThinking,
            usage: aggregateUsage(usageStats),
            toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined,
        };
    }
    // Legacy method for backwards compatibility
    async chatSimple(userInput) {
        const result = await this.chat(userInput);
        return result.response;
    }
    getHistory() {
        return this.state.messages;
    }
    clearHistory() {
        const systemPrompt = this.state.messages.find(m => m.role === 'system');
        this.state.messages = systemPrompt ? [systemPrompt] : [];
        this.state.turnCount = 0;
    }
}

// LLM interface - OpenRouter with streaming support and usage tracking

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Message } from './types.js';
import type { UsageStats } from './observability/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface OpenRouterUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenRouterResponse {
  choices: Array<{ message: { content: string } }>;
  usage?: OpenRouterUsage;
  model?: string;
}

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

// Pricing data structure
interface PricingData {
  lastUpdated: string;
  models: Record<string, { input: number; output: number }>;
  fallback: { input: number; output: number };
}

// Load pricing from file (cached)
let pricingCache: PricingData | null = null;

function loadPricing(): PricingData {
  if (pricingCache) return pricingCache;
  
  const pricingPath = join(__dirname, 'pricing.json');
  if (existsSync(pricingPath)) {
    try {
      pricingCache = JSON.parse(readFileSync(pricingPath, 'utf-8'));
      return pricingCache!;
    } catch (e) {
      console.warn('Failed to load pricing.json, using defaults');
    }
  }
  
  // Fallback if file doesn't exist
  pricingCache = {
    lastUpdated: 'builtin',
    models: {
      'anthropic/claude-sonnet-4': { input: 3.0, output: 15.0 },
      'openai/gpt-4o': { input: 2.5, output: 10.0 },
    },
    fallback: { input: 1.0, output: 3.0 },
  };
  return pricingCache;
}

/**
 * Calculate estimated cost for token usage
 */
function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = loadPricing();
  const modelPricing = pricing.models[model] || pricing.fallback;
  return ((promptTokens * modelPricing.input) + (completionTokens * modelPricing.output)) / 1_000_000;
}

/**
 * Parse usage from OpenRouter response headers (fallback)
 */
function parseUsageFromHeaders(headers: Headers): Partial<OpenRouterUsage> | null {
  // OpenRouter may include usage in headers for some requests
  const promptTokens = headers.get('x-prompt-tokens');
  const completionTokens = headers.get('x-completion-tokens');
  
  if (promptTokens || completionTokens) {
    return {
      prompt_tokens: parseInt(promptTokens || '0', 10),
      completion_tokens: parseInt(completionTokens || '0', 10),
      total_tokens: parseInt(promptTokens || '0', 10) + parseInt(completionTokens || '0', 10),
    };
  }
  return null;
}

/**
 * Parse usage from OpenRouter response (body first, then headers, then estimate)
 */
function parseUsage(response: OpenRouterResponse, headers: Headers, model: string): UsageStats {
  // Try body first (canonical source)
  if (response.usage && response.usage.total_tokens > 0) {
    return {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
      estimatedCost: calculateCost(model, response.usage.prompt_tokens, response.usage.completion_tokens),
      model,
      source: 'body',
    };
  }
  
  // Try headers as fallback
  const headerUsage = parseUsageFromHeaders(headers);
  if (headerUsage && headerUsage.total_tokens && headerUsage.total_tokens > 0) {
    return {
      promptTokens: headerUsage.prompt_tokens || 0,
      completionTokens: headerUsage.completion_tokens || 0,
      totalTokens: headerUsage.total_tokens,
      estimatedCost: calculateCost(model, headerUsage.prompt_tokens || 0, headerUsage.completion_tokens || 0),
      model,
      source: 'headers',
    };
  }
  
  // Estimate based on response length (rough heuristic: 4 chars ≈ 1 token)
  const estimatedCompletion = Math.ceil((response.choices[0]?.message?.content?.length || 0) / 4);
  return {
    promptTokens: 0,
    completionTokens: estimatedCompletion,
    totalTokens: estimatedCompletion,
    estimatedCost: calculateCost(model, 0, estimatedCompletion),
    model,
    source: 'estimated',
  };
}

/**
 * Call LLM and return content with usage stats
 */
export async function callLLMWithUsage(
  messages: Message[],
  apiKey: string,
  model: string = 'anthropic/claude-sonnet-4',
  maxTokens: number = 4096
): Promise<LLMResult> {
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
      max_tokens: maxTokens,
      messages: formattedMessages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM call failed: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  const content = data.choices[0]?.message?.content || '';
  const usage = parseUsage(data, response.headers, model);
  const durationMs = Date.now() - startTime;

  return { content, usage, durationMs };
}

/**
 * Call LLM (legacy - returns content only)
 */
export async function callLLM(
  messages: Message[],
  apiKey: string,
  model: string = 'anthropic/claude-sonnet-4',
  maxTokens: number = 4096
): Promise<string> {
  const result = await callLLMWithUsage(messages, apiKey, model, maxTokens);
  return result.content;
}

// Streaming version for thinking display
export async function callLLMStream(
  messages: Message[],
  apiKey: string,
  model: string = 'anthropic/claude-sonnet-4',
  callbacks: StreamCallback = {},
  maxTokens: number = 4096
): Promise<string> {
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
      max_tokens: maxTokens,
      messages: formattedMessages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM call failed: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

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
            } else {
              callbacks.onContent?.(delta);
            }
          }
        } catch {}
      }
    }
  }

  return fullContent;
}

// Parse thinking from response
export function parseThinking(content: string): { thinking: string | null; response: string } {
  const thinkingMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/);
  
  if (thinkingMatch) {
    const thinking = thinkingMatch[1].trim();
    const response = content.replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim();
    return { thinking, response };
  }
  
  return { thinking: null, response: content };
}

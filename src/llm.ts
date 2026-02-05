// LLM interface - OpenRouter with streaming support

import type { Message } from './types.js';

interface OpenRouterResponse {
  choices: Array<{ message: { content: string } }>;
}

interface StreamCallback {
  onThinking?: (text: string) => void;
  onContent?: (text: string) => void;
  onDone?: () => void;
}

export async function callLLM(
  messages: Message[],
  apiKey: string,
  model: string = 'anthropic/claude-sonnet-4'
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
      max_tokens: 1024,
      messages: formattedMessages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM call failed: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  return data.choices[0]?.message?.content || '';
}

// Streaming version for thinking display
export async function callLLMStream(
  messages: Message[],
  apiKey: string,
  model: string = 'anthropic/claude-sonnet-4',
  callbacks: StreamCallback = {}
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

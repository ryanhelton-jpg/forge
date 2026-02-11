// HTTP Fetch tool - make web requests and extract content

import type { Tool } from '../types.js';

export const httpFetchTool: Tool = {
  name: 'http_fetch',
  description: 'Fetch content from a URL. Returns the response body. Useful for reading web pages, APIs, or downloading data.',
  parameters: {
    url: {
      type: 'string',
      description: 'The URL to fetch',
      required: true,
    },
    method: {
      type: 'string',
      description: 'HTTP method: GET, POST, PUT, DELETE (default GET)',
      required: false,
    },
    headers: {
      type: 'string',
      description: 'JSON string of headers to send (e.g., {"Authorization": "Bearer ..."})',
      required: false,
    },
    body: {
      type: 'string',
      description: 'Request body for POST/PUT requests',
      required: false,
    },
    extract_text: {
      type: 'boolean',
      description: 'If true, strip HTML tags and return plain text (default true for HTML)',
      required: false,
    },
  },
  execute: async (params) => {
    const url = params.url as string;
    const method = ((params.method as string) || 'GET').toUpperCase();
    const extractText = params.extract_text !== false;

    // Validate URL
    try {
      new URL(url);
    } catch {
      return 'Error: Invalid URL';
    }

    // Parse headers
    let headers: Record<string, string> = {
      'User-Agent': 'Forge/0.5 (AI Agent Framework)',
    };
    if (params.headers) {
      try {
        const parsed = JSON.parse(params.headers as string);
        headers = { ...headers, ...parsed };
      } catch {
        return 'Error: Invalid headers JSON';
      }
    }

    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
      };

      if (params.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        fetchOptions.body = params.body as string;
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
      }

      const response = await fetch(url, fetchOptions);
      const contentType = response.headers.get('content-type') || '';
      
      // Get response body
      let body = await response.text();
      
      // Truncate if too long
      const MAX_LENGTH = 50000;
      if (body.length > MAX_LENGTH) {
        body = body.slice(0, MAX_LENGTH) + '\n\n[... truncated]';
      }

      // Extract text from HTML if requested
      if (extractText && contentType.includes('text/html')) {
        body = extractTextFromHtml(body);
      }

      const statusInfo = response.ok ? '' : ` (${response.statusText})`;
      return `HTTP ${response.status}${statusInfo}\n\n${body}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return `Error fetching URL: ${message}`;
    }
  },
};

// Simple HTML text extraction (no external dependencies)
function extractTextFromHtml(html: string): string {
  // Remove scripts and styles
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Convert common block elements to newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br)[^>]*>/gi, '\n');
  text = text.replace(/<(br|hr)[^>]*\/?>/gi, '\n');
  
  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
  
  // Clean up whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n\n');
  text = text.trim();
  
  return text;
}

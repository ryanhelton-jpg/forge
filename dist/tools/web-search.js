// Web Search tool - search the internet via Brave Search API
export const webSearchTool = {
    name: 'web_search',
    description: 'Search the web for information. Returns titles, URLs, and snippets from search results. Use for current events, facts, documentation, etc.',
    parameters: {
        query: {
            type: 'string',
            description: 'The search query',
            required: true,
        },
        count: {
            type: 'number',
            description: 'Number of results to return (1-10, default 5)',
            required: false,
        },
    },
    execute: async (params) => {
        const query = params.query;
        const count = Math.min(10, Math.max(1, params.count || 5));
        const apiKey = process.env.BRAVE_API_KEY;
        if (!apiKey) {
            return 'Error: BRAVE_API_KEY not set. Get one free at https://brave.com/search/api/';
        }
        try {
            const url = new URL('https://api.search.brave.com/res/v1/web/search');
            url.searchParams.set('q', query);
            url.searchParams.set('count', String(count));
            const response = await fetch(url.toString(), {
                headers: {
                    'Accept': 'application/json',
                    'X-Subscription-Token': apiKey,
                },
            });
            if (!response.ok) {
                if (response.status === 401) {
                    return 'Error: Invalid BRAVE_API_KEY';
                }
                return `Error: Search failed (${response.status})`;
            }
            const data = await response.json();
            const results = data.web?.results || [];
            if (results.length === 0) {
                return `No results found for "${query}"`;
            }
            const formatted = results.map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.description}`).join('\n\n');
            return `Search results for "${query}":\n\n${formatted}`;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return `Error searching: ${message}`;
        }
    },
};

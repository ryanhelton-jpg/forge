// Memory tool - allows agent to store and recall information
export function createMemoryTool(memory) {
    return {
        name: 'memory',
        description: 'Store or recall information from long-term memory. Use this to remember facts about the user or recall previously stored information.',
        parameters: {
            action: {
                type: 'string',
                description: 'Action: "store" to save, "recall" to search, "list" to show all',
                required: true,
            },
            text: {
                type: 'string',
                description: 'For store: the fact to remember. For recall: search query.',
                required: false,
            },
            category: {
                type: 'string',
                description: 'Category: "preference", "fact", or "context"',
                required: false,
            },
        },
        execute: async (params) => {
            const action = params.action;
            const text = params.text;
            const category = params.category || 'fact';
            if (action === 'store') {
                if (!text)
                    return 'Error: text required for store action';
                const fact = memory.addFact(text, category);
                return `Stored: "${text}" (category: ${category}, id: ${fact.id})`;
            }
            if (action === 'recall') {
                const facts = text ? memory.searchFacts(text) : memory.getFacts();
                if (facts.length === 0)
                    return 'No matching memories found.';
                return facts.map(f => `[${f.category}] ${f.text}`).join('\n');
            }
            if (action === 'list') {
                const facts = memory.getFacts();
                if (facts.length === 0)
                    return 'Memory is empty.';
                return facts.map(f => `[${f.category}] ${f.text}`).join('\n');
            }
            return `Unknown action: ${action}`;
        },
    };
}

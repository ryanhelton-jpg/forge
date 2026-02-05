// Example tool: DateTime
export const datetimeTool = {
    name: 'datetime',
    description: 'Get the current date and time, or calculate date differences.',
    parameters: {
        action: {
            type: 'string',
            description: 'Action: "now" for current time, "diff" for date difference',
            required: true,
        },
        date1: {
            type: 'string',
            description: 'First date (ISO format) for diff calculation',
            required: false,
        },
        date2: {
            type: 'string',
            description: 'Second date (ISO format) for diff calculation',
            required: false,
        },
    },
    execute: async (params) => {
        const action = params.action;
        if (action === 'now') {
            const now = new Date();
            return `Current time: ${now.toISOString()}\nLocal: ${now.toLocaleString()}`;
        }
        if (action === 'diff') {
            const d1 = new Date(params.date1);
            const d2 = new Date(params.date2);
            const diffMs = Math.abs(d2.getTime() - d1.getTime());
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            return `Difference: ${diffDays} days (${diffHours} hours)`;
        }
        return `Unknown action: ${action}`;
    },
};

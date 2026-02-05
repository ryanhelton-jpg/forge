// Tool Creator - Agent can create new tools at runtime
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
const CONFIG_DIR = process.env.DATA_DIR || './data';
const TOOLS_PATH = join(CONFIG_DIR, 'custom-tools.json');
function loadCustomTools() {
    if (existsSync(TOOLS_PATH)) {
        try {
            return JSON.parse(readFileSync(TOOLS_PATH, 'utf-8'));
        }
        catch { }
    }
    return [];
}
function saveCustomTools(tools) {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(TOOLS_PATH, JSON.stringify(tools, null, 2));
}
// Convert a custom tool definition into an executable Tool
export function hydrateCustomTool(def) {
    return {
        name: def.name,
        description: def.description,
        parameters: def.parameters,
        execute: async (params) => {
            try {
                // Create a sandboxed function from the code
                // The code should be a function body that returns a string
                const fn = new Function('params', `
          "use strict";
          ${def.code}
        `);
                const result = fn(params);
                return typeof result === 'string' ? result : JSON.stringify(result);
            }
            catch (error) {
                return `Tool execution error: ${error}`;
            }
        },
    };
}
// Load all custom tools as executable Tools
export function loadAllCustomTools() {
    return loadCustomTools().map(hydrateCustomTool);
}
// The meta-tool that creates other tools
export const toolCreatorTool = {
    name: 'create_tool',
    description: `Create a new tool that you can use in future conversations.

Provide:
- name: Tool name (lowercase, no spaces)
- description: What the tool does
- parameters: JSON object of parameters (e.g., {"query": {"type": "string", "description": "...", "required": true}})
- code: JavaScript function body that takes 'params' object and returns a string

Example code: "const x = params.number; return 'Result: ' + (x * 2);"

The tool will be saved and available in future sessions.
IMPORTANT: Keep code simple. No async, no external imports. Just pure computation.`,
    parameters: {
        action: {
            type: 'string',
            description: 'Action: "create", "list", "delete", "test"',
            required: true,
        },
        name: {
            type: 'string',
            description: 'Tool name',
            required: false,
        },
        description: {
            type: 'string',
            description: 'Tool description',
            required: false,
        },
        parameters: {
            type: 'string',
            description: 'JSON string of parameter definitions',
            required: false,
        },
        code: {
            type: 'string',
            description: 'JavaScript function body',
            required: false,
        },
        test_params: {
            type: 'string',
            description: 'JSON string of test parameters',
            required: false,
        },
    },
    execute: async (params) => {
        const action = params.action;
        const tools = loadCustomTools();
        switch (action) {
            case 'list':
                if (tools.length === 0)
                    return 'No custom tools created yet.';
                return tools.map(t => `**${t.name}**: ${t.description}`).join('\n\n');
            case 'create': {
                const name = params.name;
                const description = params.description;
                const parametersJson = params.parameters;
                const code = params.code;
                if (!name || !description || !code) {
                    return 'Error: name, description, and code are required';
                }
                // Validate name
                if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
                    return 'Error: name must be lowercase letters, numbers, and underscores only';
                }
                // Check for existing tool
                if (tools.find(t => t.name === name)) {
                    return `Error: tool "${name}" already exists. Delete it first to recreate.`;
                }
                // Parse parameters
                let toolParams = {};
                if (parametersJson) {
                    try {
                        toolParams = JSON.parse(parametersJson);
                    }
                    catch {
                        return 'Error: parameters must be valid JSON';
                    }
                }
                // Validate code (basic safety check)
                const forbidden = ['require', 'import', 'eval', 'Function', 'process', 'global', '__dirname', '__filename'];
                for (const word of forbidden) {
                    if (code.includes(word)) {
                        return `Error: code contains forbidden word "${word}"`;
                    }
                }
                // Test the code
                try {
                    const testFn = new Function('params', `"use strict"; ${code}`);
                    testFn({}); // Dry run
                }
                catch (error) {
                    return `Error: code failed validation: ${error}`;
                }
                const newTool = {
                    name,
                    description,
                    parameters: toolParams,
                    code,
                    createdAt: new Date().toISOString(),
                };
                tools.push(newTool);
                saveCustomTools(tools);
                return `✅ Tool "${name}" created successfully!

Description: ${description}
Parameters: ${Object.keys(toolParams).join(', ') || 'none'}

The tool is now available. Try using it!`;
            }
            case 'delete': {
                const name = params.name;
                if (!name)
                    return 'Error: name required';
                const idx = tools.findIndex(t => t.name === name);
                if (idx === -1)
                    return `Tool "${name}" not found`;
                tools.splice(idx, 1);
                saveCustomTools(tools);
                return `Tool "${name}" deleted.`;
            }
            case 'test': {
                const name = params.name;
                const testParamsJson = params.test_params;
                if (!name)
                    return 'Error: name required';
                const tool = tools.find(t => t.name === name);
                if (!tool)
                    return `Tool "${name}" not found`;
                let testParams = {};
                if (testParamsJson) {
                    try {
                        testParams = JSON.parse(testParamsJson);
                    }
                    catch {
                        return 'Error: test_params must be valid JSON';
                    }
                }
                try {
                    const fn = new Function('params', `"use strict"; ${tool.code}`);
                    const result = fn(testParams);
                    return `Test result: ${typeof result === 'string' ? result : JSON.stringify(result)}`;
                }
                catch (error) {
                    return `Test failed: ${error}`;
                }
            }
            default:
                return `Unknown action: ${action}. Use: create, list, delete, test`;
        }
    },
};

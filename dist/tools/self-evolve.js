// Self-Evolution tool - Agent can modify its own behavior
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
const CONFIG_DIR = process.env.DATA_DIR || './data';
const CONFIG_PATH = join(CONFIG_DIR, 'persona.json');
function loadPersona() {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }
    if (existsSync(CONFIG_PATH)) {
        try {
            return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
        }
        catch { }
    }
    // Default persona
    return {
        systemPrompt: `You are Forge, a capable AI assistant built from scratch.
You're direct, helpful, and slightly witty.
Keep responses concise unless asked for detail.`,
        traits: ['direct', 'helpful', 'witty', 'concise'],
        rules: [],
        updatedAt: new Date().toISOString(),
        version: 1,
    };
}
function savePersona(config) {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
// Export for use by server
export function getPersona() {
    return loadPersona();
}
export const selfEvolveTool = {
    name: 'evolve',
    description: `Modify your own behavior, personality, or rules. Use this to:
- Add new traits or remove existing ones
- Add rules for yourself (e.g., "always ask clarifying questions")
- Rewrite your system prompt entirely
- View your current configuration

Changes persist across sessions. Use thoughtfully.`,
    parameters: {
        action: {
            type: 'string',
            description: 'Action: "view", "add_trait", "remove_trait", "add_rule", "remove_rule", "set_prompt"',
            required: true,
        },
        value: {
            type: 'string',
            description: 'The trait, rule, or prompt to add/set',
            required: false,
        },
    },
    execute: async (params) => {
        const action = params.action;
        const value = params.value;
        const config = loadPersona();
        switch (action) {
            case 'view':
                return `**Current Persona (v${config.version})**

System Prompt:
${config.systemPrompt}

Traits: ${config.traits.join(', ') || 'none'}

Rules:
${config.rules.length > 0 ? config.rules.map((r, i) => `${i + 1}. ${r}`).join('\n') : 'none'}

Last updated: ${config.updatedAt}`;
            case 'add_trait':
                if (!value)
                    return 'Error: value required';
                if (config.traits.includes(value))
                    return `Trait "${value}" already exists`;
                config.traits.push(value);
                config.version++;
                config.updatedAt = new Date().toISOString();
                savePersona(config);
                return `Added trait: "${value}". I'll embody this going forward.`;
            case 'remove_trait':
                if (!value)
                    return 'Error: value required';
                const traitIdx = config.traits.indexOf(value);
                if (traitIdx === -1)
                    return `Trait "${value}" not found`;
                config.traits.splice(traitIdx, 1);
                config.version++;
                config.updatedAt = new Date().toISOString();
                savePersona(config);
                return `Removed trait: "${value}". Adjusting personality.`;
            case 'add_rule':
                if (!value)
                    return 'Error: value required';
                config.rules.push(value);
                config.version++;
                config.updatedAt = new Date().toISOString();
                savePersona(config);
                return `Added rule: "${value}". I'll follow this from now on.`;
            case 'remove_rule':
                if (!value)
                    return 'Error: value required';
                const ruleIdx = config.rules.findIndex(r => r.toLowerCase().includes(value.toLowerCase()));
                if (ruleIdx === -1)
                    return `No rule matching "${value}" found`;
                const removed = config.rules.splice(ruleIdx, 1)[0];
                config.version++;
                config.updatedAt = new Date().toISOString();
                savePersona(config);
                return `Removed rule: "${removed}"`;
            case 'set_prompt':
                if (!value)
                    return 'Error: value required';
                config.systemPrompt = value;
                config.version++;
                config.updatedAt = new Date().toISOString();
                savePersona(config);
                return `System prompt updated. This changes my core identity. New prompt:\n\n${value}`;
            default:
                return `Unknown action: ${action}. Use: view, add_trait, remove_trait, add_rule, remove_rule, set_prompt`;
        }
    },
};

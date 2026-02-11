#!/usr/bin/env node
// Forge CLI - Interactive chat with your agent
import 'dotenv/config';
import * as readline from 'readline';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Agent } from './agent.js';
import { calculatorTool } from './tools/calculator.js';
import { datetimeTool } from './tools/datetime.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// Handle CLI commands
const args = process.argv.slice(2);
if (args[0] === 'update-pricing') {
    updatePricing()
        .then(() => process.exit(0))
        .catch(e => {
        console.error('Failed to update pricing:', e);
        process.exit(1);
    });
}
else if (args[0] === 'serve' || args[0] === 'server') {
    console.log('Starting server... Run: npx tsx src/server.ts');
    process.exit(0);
}
else if (args[0] === 'help' || args[0] === '--help') {
    console.log(`
⚒️  Forge CLI

Commands:
  forge                   Start interactive chat
  forge update-pricing    Fetch latest model pricing from OpenRouter
  forge serve             Start the web server
  forge help              Show this help

Interactive commands:
  /clear    Reset conversation
  /history  Show message history
  /quit     Exit
`);
    process.exit(0);
}
else {
    // Start interactive mode
    startInteractiveMode();
}
/**
 * Fetch current pricing from OpenRouter API and update pricing.json
 */
async function updatePricing() {
    console.log('⚒️  Fetching current model pricing from OpenRouter...\n');
    const response = await fetch('https://openrouter.ai/api/v1/models');
    if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
    }
    const data = await response.json();
    // Filter to popular models
    const popularPrefixes = ['anthropic/', 'openai/', 'google/', 'meta-llama/', 'mistral/', 'deepseek/'];
    const models = {};
    for (const model of data.data) {
        if (popularPrefixes.some(p => model.id.startsWith(p))) {
            // OpenRouter returns price per token, convert to per 1M tokens
            const inputPrice = parseFloat(model.pricing.prompt) * 1_000_000;
            const outputPrice = parseFloat(model.pricing.completion) * 1_000_000;
            models[model.id] = {
                input: Math.round(inputPrice * 100) / 100, // Round to 2 decimal places
                output: Math.round(outputPrice * 100) / 100,
            };
        }
    }
    const pricing = {
        "$schema": "pricing.schema.json",
        "$comment": "Model pricing in USD per 1M tokens. Run 'forge update-pricing' to refresh.",
        lastUpdated: new Date().toISOString().split('T')[0],
        models,
        fallback: { input: 1.0, output: 3.0, "$comment": "Used for unknown models" },
    };
    const pricingPath = join(__dirname, 'pricing.json');
    writeFileSync(pricingPath, JSON.stringify(pricing, null, 2));
    console.log(`✅ Updated pricing.json with ${Object.keys(models).length} models`);
    console.log(`   Last updated: ${pricing.lastUpdated}`);
    console.log('\nSample prices (per 1M tokens):');
    const samples = ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'anthropic/claude-3-haiku'];
    for (const id of samples) {
        const m = models[id];
        if (m) {
            console.log(`   ${id}: $${m.input} input / $${m.output} output`);
        }
    }
}
/**
 * Start interactive chat mode
 */
function startInteractiveMode() {
    if (!OPENROUTER_API_KEY) {
        console.error('Error: OPENROUTER_API_KEY environment variable not set');
        process.exit(1);
    }
    // Create the agent
    const agent = new Agent({
        apiKey: OPENROUTER_API_KEY,
        model: 'anthropic/claude-sonnet-4',
        systemPrompt: `You are Forge, a capable AI assistant built from scratch.
You're direct, helpful, and slightly witty.
When you need to perform calculations or check the time, use your tools.
Keep responses concise unless asked for detail.`,
        maxTurns: 5,
    });
    // Register tools
    agent.registerTool(calculatorTool);
    agent.registerTool(datetimeTool);
    // CLI interface
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    console.log('\n⚒️  Forge v0.4 - Your agent, from scratch\n');
    console.log('Commands: /clear (reset), /history (show), /quit (exit)\n');
    function prompt() {
        rl.question('You: ', async (input) => {
            const trimmed = input.trim();
            if (!trimmed) {
                prompt();
                return;
            }
            // Handle commands
            if (trimmed === '/quit' || trimmed === '/exit') {
                console.log('\nGoodbye! 🔥\n');
                rl.close();
                process.exit(0);
            }
            if (trimmed === '/clear') {
                agent.clearHistory();
                console.log('\n[History cleared]\n');
                prompt();
                return;
            }
            if (trimmed === '/history') {
                const history = agent.getHistory();
                console.log('\n--- History ---');
                history.forEach((m, i) => {
                    const preview = m.content.slice(0, 100) + (m.content.length > 100 ? '...' : '');
                    console.log(`${i + 1}. [${m.role}] ${preview}`);
                });
                console.log('---------------\n');
                prompt();
                return;
            }
            // Chat with agent
            try {
                console.log('\nForge: thinking...');
                const result = await agent.chat(trimmed);
                console.log(`\nForge: ${result.response}`);
                if (result.usage.totalTokens > 0) {
                    console.log(`[${result.usage.totalTokens} tokens, $${result.usage.estimatedCost.toFixed(4)}, source: ${result.usage.source}]\n`);
                }
            }
            catch (error) {
                console.error(`\nError: ${error}\n`);
            }
            prompt();
        });
    }
    prompt();
}

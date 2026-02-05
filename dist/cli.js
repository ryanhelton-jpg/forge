#!/usr/bin/env node
// Forge CLI - Interactive chat with your agent
import 'dotenv/config';
import * as readline from 'readline';
import { Agent } from './agent.js';
import { calculatorTool } from './tools/calculator.js';
import { datetimeTool } from './tools/datetime.js';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
    console.error('Error: OPENROUTER_API_KEY environment variable not set');
    process.exit(1);
}
// Create the agent
const agent = new Agent({
    apiKey: OPENROUTER_API_KEY,
    model: 'anthropic/claude-sonnet-4', // OpenRouter model ID
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
console.log('\n⚒️  Forge v0.1 - Your agent, from scratch\n');
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
            const response = await agent.chat(trimmed);
            console.log(`\nForge: ${response}\n`);
        }
        catch (error) {
            console.error(`\nError: ${error}\n`);
        }
        prompt();
    });
}
prompt();

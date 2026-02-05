#!/usr/bin/env npx ts-node
/**
 * Swarm Demo - Multi-agent collaboration example
 * 
 * Run: npx ts-node examples/swarm-demo.ts
 */

import { Orchestrator, builtInRoles } from '../src/swarm/index.js';

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) {
  console.error('Set OPENROUTER_API_KEY environment variable');
  process.exit(1);
}

async function main() {
  console.log('🐝 Forge Swarm Demo\n');

  const orchestrator = new Orchestrator({
    apiKey: API_KEY,
    defaultModel: 'anthropic/claude-sonnet-4',
    roles: [],
    maxTurnsPerAgent: 5,
    maxTotalTurns: 20,
    onThinking: (roleId, thinking) => {
      console.log(`\n💭 [${roleId}] thinking:\n${thinking.slice(0, 200)}...\n`);
    },
    onAgentStart: (roleId, task) => {
      console.log(`\n▶️  [${roleId.toUpperCase()}] ${task.description}`);
    },
    onAgentComplete: (roleId, task) => {
      console.log(`✅ [${roleId}] complete`);
    },
    onBlackboardUpdate: (entry) => {
      console.log(`📝 Blackboard: [${entry.type}] from ${entry.author}`);
    },
  });

  // Example: Build a simple utility
  const goal = `
    Create a TypeScript function that validates email addresses.
    Requirements:
    - Handle common edge cases
    - Return structured result (valid: boolean, reason?: string)
    - Include unit test examples
  `;

  console.log(`Goal: ${goal.trim()}\n`);
  console.log('─'.repeat(60));

  const result = await orchestrator.execute(goal);

  console.log('\n' + '─'.repeat(60));
  console.log('\n📊 RESULTS\n');
  console.log(`Success: ${result.success}`);
  console.log(`Total turns: ${result.totalTurns}`);
  console.log(`Duration: ${result.timing.durationMs}ms`);
  console.log(`Tasks: ${result.tasks.length}`);
  console.log(`Blackboard entries: ${result.blackboard.length}`);
  
  console.log('\n📋 FINAL OUTPUT:\n');
  console.log(result.finalOutput);
}

main().catch(console.error);

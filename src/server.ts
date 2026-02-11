#!/usr/bin/env node
// Forge Web Server v0.5 - Self-evolving agent with thinking stream

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { Agent } from './agent.js';
import { Memory } from './memory.js';
import { calculatorTool } from './tools/calculator.js';
import { datetimeTool } from './tools/datetime.js';
import { createMemoryTool } from './tools/memory-tool.js';
import { selfEvolveTool, getPersona } from './tools/self-evolve.js';
import { toolCreatorTool, loadAllCustomTools } from './tools/tool-creator.js';
import { webSearchTool } from './tools/web-search.js';
import { httpFetchTool } from './tools/http-fetch.js';
import { readFileTool, writeFileTool, listFilesTool } from './tools/file-ops.js';
import { rateLimit, sanitizeInput, securityHeaders, generateToken, tokenAuth } from './security.js';
import { Orchestrator, builtInRoles } from './swarm/index.js';
import type { SwarmPlan, SwarmTask, BlackboardEntry } from './swarm/types.js';
import { ExecutionLog } from './execution-log.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const PORT = parseInt(process.env.PORT || '3030');
const AUTH_TOKEN = process.env.FORGE_TOKEN || generateToken();
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '../data');

// Set DATA_DIR for tools
process.env.DATA_DIR = DATA_DIR;

if (!OPENROUTER_API_KEY) {
  console.error('Error: OPENROUTER_API_KEY not set');
  process.exit(1);
}

const memory = new Memory(DATA_DIR);
const executionLog = new ExecutionLog(DATA_DIR);
const sessions = new Map<string, { agent: Agent; lastAccess: Date }>();

// Swarm event tracking for live polling
interface SwarmEvent {
  timestamp: number;
  type: 'start' | 'thinking' | 'complete' | 'blackboard' | 'error';
  roleId?: string;
  taskId?: string;
  data?: Record<string, unknown>;
}

interface ActiveSwarm {
  runId: string;
  goal: string;
  status: 'running' | 'complete' | 'error';
  startedAt: number;
  events: SwarmEvent[];
  currentAgent?: string;
  currentTask?: string;
  completedTasks: number;
  totalTasks: number;
  blackboardEntries: number;
}

const activeSwarms = new Map<string, ActiveSwarm>();

// Cleanup old swarm tracking (runs that finished > 5 min ago)
setInterval(() => {
  const now = Date.now();
  for (const [runId, swarm] of activeSwarms) {
    if (swarm.status !== 'running' && now - swarm.startedAt > 300000) {
      activeSwarms.delete(runId);
    }
  }
}, 60000);

function buildSystemPrompt(): string {
  const persona = getPersona();
  const memoryContext = memory.buildContext();
  
  let prompt = persona.systemPrompt;
  
  // Add traits
  if (persona.traits.length > 0) {
    prompt += `\n\nYour personality traits: ${persona.traits.join(', ')}.`;
  }
  
  // Add rules
  if (persona.rules.length > 0) {
    prompt += `\n\nRules you follow:\n${persona.rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
  }
  
  // Add memory context
  if (memoryContext) {
    prompt += `\n\nFrom your memory:\n${memoryContext}`;
  }
  
  // Add thinking instruction
  prompt += `\n\nIMPORTANT: When solving complex problems, share your reasoning by wrapping it in <thinking>...</thinking> tags before your response. This helps users understand your thought process.`;
  
  return prompt;
}

function getOrCreateSession(sessionId: string): Agent {
  let session = sessions.get(sessionId);
  
  if (!session) {
    const savedConv = memory.getConversation(sessionId);
    
    const agent = new Agent({
      apiKey: OPENROUTER_API_KEY!,
      model: 'anthropic/claude-sonnet-4',
      systemPrompt: buildSystemPrompt(),
      maxTurns: 5,
    });

    // Register core tools
    agent.registerTool(calculatorTool);
    agent.registerTool(datetimeTool);
    agent.registerTool(createMemoryTool(memory));
    agent.registerTool(selfEvolveTool);
    agent.registerTool(toolCreatorTool);
    
    // External tools (v0.5)
    agent.registerTool(webSearchTool);
    agent.registerTool(httpFetchTool);
    agent.registerTool(readFileTool);
    agent.registerTool(writeFileTool);
    agent.registerTool(listFilesTool);

    // Load and register custom tools
    const customTools = loadAllCustomTools();
    for (const tool of customTools) {
      agent.registerTool(tool);
    }

    // Restore conversation history
    if (savedConv && savedConv.messages.length > 0) {
      for (const msg of savedConv.messages) {
        if (msg.role !== 'system') {
          agent.getHistory().push(msg);
        }
      }
    }

    session = { agent, lastAccess: new Date() };
    sessions.set(sessionId, session);
  } else {
    // Update system prompt in case persona changed
    session.agent.updateSystemPrompt(buildSystemPrompt());
  }

  session.lastAccess = new Date();
  return session.agent;
}

// Session cleanup
setInterval(() => {
  const now = new Date();
  for (const [id, session] of sessions) {
    if (now.getTime() - session.lastAccess.getTime() > 3600000) {
      const conv = memory.getConversation(id);
      if (conv) {
        memory.updateConversation(id, session.agent.getHistory());
      }
      sessions.delete(id);
    }
  }
}, 300000);

const app = express();

app.use(securityHeaders);
app.use(rateLimit);
app.use(cors({
  origin: true, // Allow all origins (token auth protects API)
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(join(__dirname, '../public')));

// Token auth for API endpoints
app.use('/api', tokenAuth(AUTH_TOKEN));

// Chat endpoint with thinking
app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }

  const cleanMessage = sanitizeInput(message);
  if (!cleanMessage) {
    return res.status(400).json({ error: 'Invalid message' });
  }

  const sid = sessionId || randomUUID();
  const agent = getOrCreateSession(sid);

  if (!memory.getConversation(sid)) {
    memory.createConversation(sid);
  }

  // Start execution logging
  const runId = executionLog.startRun('chat', { message: cleanMessage }, sid);
  executionLog.updateRunModel(runId, 'anthropic/claude-sonnet-4');

  try {
    const { response, thinking, usage, toolCalls } = await agent.chat(cleanMessage);
    memory.updateConversation(sid, agent.getHistory());
    
    // Update execution log with token usage
    executionLog.updateRunModel(runId, usage.model, {
      prompt: usage.promptTokens,
      completion: usage.completionTokens,
      total: usage.totalTokens,
    });
    
    // Add tool calls to execution log
    if (toolCalls) {
      for (const tc of toolCalls) {
        executionLog.addToolCall(runId, {
          name: tc.name,
          input: tc.params,
          output: tc.result,
          durationMs: tc.durationMs,
        });
      }
    }
    
    // Reload custom tools in case new ones were created
    const customTools = loadAllCustomTools();
    for (const tool of customTools) {
      if (!agent.getRegisteredTools().includes(tool.name)) {
        agent.registerTool(tool);
      }
    }
    
    // Complete execution logging
    executionLog.completeRun(runId, { response, thinking: thinking ?? undefined });
    
    // Record interaction to genome fitness (success, tokens, cost)
    try {
      const store = getGenomeStore();
      const genome = getOrCreateDefaultGenome();
      store.recordInteraction(genome.id, {
        success: true,
        tokens: usage.totalTokens || 0,
        cost: usage.estimatedCost || 0,
      });
      
      // Check for pending evolution proposals
      const proposals = store.proposeEvolution(genome.id, { recentFeedback: [], recentTopics: [] });
      if (proposals.length > 0 && genome.config.evolution.autoPropose) {
        // Include proposals in response for user awareness
        res.json({ 
          response, 
          thinking, 
          sessionId: sid, 
          runId,
          usage: {
            tokens: usage.totalTokens,
            cost: usage.estimatedCost,
            model: usage.model,
          },
          evolutionProposals: proposals,
        });
        return;
      }
    } catch (e) {
      // Non-fatal, don't block response
      console.error('Genome tracking error:', e);
    }
    
    res.json({ 
      response, 
      thinking, 
      sessionId: sid, 
      runId,
      usage: {
        tokens: usage.totalTokens,
        cost: usage.estimatedCost,
        model: usage.model,
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    executionLog.failRun(runId, error instanceof Error ? error.message : 'Unknown error');
    
    // Record failed interaction
    try {
      const store = getGenomeStore();
      const genome = getOrCreateDefaultGenome();
      store.recordInteraction(genome.id, { success: false, tokens: 0, cost: 0 });
    } catch (e) {}
    
    res.status(500).json({ error: 'Chat failed. Try again.' });
  }
});

// Get persona config
app.get('/api/persona', (req, res) => {
  res.json(getPersona());
});

// Get custom tools
app.get('/api/tools', (req, res) => {
  const customTools = loadAllCustomTools();
  res.json(customTools.map(t => ({ name: t.name, description: t.description })));
});

// Conversation history
app.get('/api/history/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const conv = memory.getConversation(sessionId);
  if (!conv) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  res.json(conv);
});

// List conversations
app.get('/api/conversations', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const conversations = memory.listConversations(limit).map(c => ({
    id: c.id,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount: c.messages.length,
    preview: c.messages.find(m => m.role === 'user')?.content.slice(0, 100) || '',
  }));
  res.json(conversations);
});

// Clear session
app.post('/api/clear', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) {
    sessions.delete(sessionId);
    memory.deleteConversation(sessionId);
  }
  res.json({ success: true });
});

// Memory endpoints
app.get('/api/memory', (req, res) => {
  res.json(memory.getFacts());
});

app.post('/api/memory', (req, res) => {
  const { text, category } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text required' });
  }
  const fact = memory.addFact(sanitizeInput(text), category || 'fact');
  res.json(fact);
});

app.delete('/api/memory/:id', (req, res) => {
  const deleted = memory.deleteFact(req.params.id);
  res.json({ success: deleted });
});

// Swarm execution endpoint
app.post('/api/swarm', async (req, res) => {
  const { goal, plan, protocol } = req.body;

  if (!goal && !plan) {
    return res.status(400).json({ error: 'Goal or plan required' });
  }

  // Start execution logging
  const runId = executionLog.startRun('swarm', { 
    goal: goal || plan?.goal, 
    plan 
  });
  executionLog.updateRunModel(runId, 'anthropic/claude-sonnet-4');

  const agentsUsed: string[] = [];
  
  // Initialize swarm tracking for polling
  const swarmGoal = goal || plan?.goal || 'Unknown goal';
  const totalTasks = plan?.tasks?.length || 0;
  
  activeSwarms.set(runId, {
    runId,
    goal: swarmGoal,
    status: 'running',
    startedAt: Date.now(),
    events: [],
    completedTasks: 0,
    totalTasks,
    blackboardEntries: 0,
  });
  
  const addSwarmEvent = (event: Omit<SwarmEvent, 'timestamp'>) => {
    const swarm = activeSwarms.get(runId);
    if (swarm) {
      swarm.events.push({ ...event, timestamp: Date.now() });
      // Keep only last 100 events
      if (swarm.events.length > 100) {
        swarm.events = swarm.events.slice(-100);
      }
    }
  };

  const orchestrator = new Orchestrator({
    apiKey: OPENROUTER_API_KEY!,
    defaultModel: 'anthropic/claude-sonnet-4',
    roles: [], // Use built-in roles
    maxTurnsPerAgent: 5,
    maxTotalTurns: 30,
    onThinking: (roleId, thinking) => {
      console.log(`[${roleId}] thinking...`);
      addSwarmEvent({ type: 'thinking', roleId, data: { preview: thinking.slice(0, 200) } });
    },
    onAgentStart: (roleId, task) => {
      console.log(`[${roleId}] starting: ${task.description}`);
      if (!agentsUsed.includes(roleId)) {
        agentsUsed.push(roleId);
      }
      const swarm = activeSwarms.get(runId);
      if (swarm) {
        swarm.currentAgent = roleId;
        swarm.currentTask = task.description;
      }
      addSwarmEvent({ type: 'start', roleId, taskId: task.id, data: { description: task.description } });
    },
    onAgentComplete: (roleId, task) => {
      console.log(`[${roleId}] complete`);
      const swarm = activeSwarms.get(runId);
      if (swarm) {
        swarm.completedTasks++;
        swarm.currentAgent = undefined;
        swarm.currentTask = undefined;
      }
      addSwarmEvent({ type: 'complete', roleId, taskId: task.id });
    },
    onBlackboardUpdate: (entry) => {
      const swarm = activeSwarms.get(runId);
      if (swarm) {
        swarm.blackboardEntries++;
      }
      addSwarmEvent({ type: 'blackboard', data: { type: entry.type, author: entry.author, preview: entry.content.slice(0, 100) } });
    },
  });

  try {
    let result;
    if (plan) {
      // Execute provided plan
      const swarmPlan: SwarmPlan = {
        goal: plan.goal || goal,
        protocol: plan.protocol || protocol || 'sequential',
        tasks: (plan.tasks || []).map((t: Partial<SwarmTask>, i: number) => ({
          id: t.id || `t${i + 1}`,
          description: t.description || '',
          assignedTo: t.assignedTo || 'coder',
          dependencies: t.dependencies || [],
          status: 'pending' as const,
        })),
      };
      
      executionLog.updateSwarmInfo(runId, {
        protocol: swarmPlan.protocol,
        tasksCount: swarmPlan.tasks.length,
      });
      
      result = await orchestrator.executePlan(swarmPlan);
      result = { ...result, timing: { startedAt: Date.now(), completedAt: Date.now(), durationMs: 0 } };
    } else {
      // Auto-plan and execute
      executionLog.updateSwarmInfo(runId, { protocol: 'auto' });
      result = await orchestrator.execute(sanitizeInput(goal));
    }

    // Update swarm info with agents used
    executionLog.updateSwarmInfo(runId, {
      protocol: plan?.protocol || protocol || 'auto',
      tasksCount: result.tasks?.length || 0,
      agentsUsed,
    });

    // Complete execution logging
    executionLog.completeRun(runId, { result });
    
    // Mark swarm as complete
    const swarm = activeSwarms.get(runId);
    if (swarm) {
      swarm.status = 'complete';
      swarm.totalTasks = result.tasks?.length || swarm.totalTasks;
      addSwarmEvent({ type: 'complete', data: { success: result.success } });
    }

    res.json({ ...result, runId });
  } catch (error) {
    console.error('Swarm error:', error);
    executionLog.failRun(runId, error instanceof Error ? error.message : 'Unknown error');
    
    // Mark swarm as error
    const swarm = activeSwarms.get(runId);
    if (swarm) {
      swarm.status = 'error';
      addSwarmEvent({ type: 'error', data: { message: error instanceof Error ? error.message : 'Unknown error' } });
    }
    
    res.status(500).json({ error: 'Swarm execution failed' });
  }
});

// Get available swarm roles
app.get('/api/swarm/roles', (req, res) => {
  res.json(Object.values(builtInRoles).map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
  })));
});

// List active swarm executions (for polling)
app.get('/api/swarm/active', (req, res) => {
  const swarms = Array.from(activeSwarms.values()).map(s => ({
    runId: s.runId,
    goal: s.goal,
    status: s.status,
    startedAt: s.startedAt,
    currentAgent: s.currentAgent,
    currentTask: s.currentTask,
    completedTasks: s.completedTasks,
    totalTasks: s.totalTasks,
    blackboardEntries: s.blackboardEntries,
    eventCount: s.events.length,
  }));
  res.json(swarms);
});

// Get swarm status (for polling during execution)
app.get('/api/swarm/:runId/status', (req, res) => {
  const swarm = activeSwarms.get(req.params.runId);
  if (!swarm) {
    // Check if it's in execution history
    const run = executionLog.getRun(req.params.runId);
    if (run && run.type === 'swarm') {
      return res.json({
        runId: run.id,
        status: run.status === 'success' ? 'complete' : run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        durationMs: run.durationMs,
        historical: true,
      });
    }
    return res.status(404).json({ error: 'Swarm run not found' });
  }
  
  res.json({
    runId: swarm.runId,
    goal: swarm.goal,
    status: swarm.status,
    startedAt: swarm.startedAt,
    elapsedMs: Date.now() - swarm.startedAt,
    currentAgent: swarm.currentAgent,
    currentTask: swarm.currentTask,
    completedTasks: swarm.completedTasks,
    totalTasks: swarm.totalTasks,
    blackboardEntries: swarm.blackboardEntries,
  });
});

// Get swarm events (for polling - returns events since lastEventIndex)
app.get('/api/swarm/:runId/events', (req, res) => {
  const swarm = activeSwarms.get(req.params.runId);
  if (!swarm) {
    return res.status(404).json({ error: 'Swarm run not found' });
  }
  
  const since = parseInt(req.query.since as string) || 0;
  const events = swarm.events.slice(since);
  
  res.json({
    events,
    nextIndex: swarm.events.length,
    status: swarm.status,
  });
});

// Execution history endpoints
app.get('/api/runs', (req, res) => {
  const options = {
    limit: parseInt(req.query.limit as string) || 50,
    type: req.query.type as 'chat' | 'swarm' | undefined,
    sessionId: req.query.sessionId as string | undefined,
    status: req.query.status as 'running' | 'success' | 'error' | undefined,
    since: req.query.since as string | undefined,
  };
  
  const runs = executionLog.listRuns(options);
  res.json(runs);
});

app.get('/api/runs/stats', (req, res) => {
  const since = req.query.since as string | undefined;
  const stats = executionLog.getStats(since);
  res.json(stats);
});

app.get('/api/runs/:runId', (req, res) => {
  const run = executionLog.getRun(req.params.runId);
  if (!run) {
    return res.status(404).json({ error: 'Run not found' });
  }
  res.json(run);
});

// === Genome API (v0.5.0) ===
import { 
  AgentGenome, 
  Trait, 
  Rule, 
  ToolRef,
  MutationUtils 
} from './genome/index.js';
import { getGenomeStore } from './genome-store.js';

// Initialize default genome from current persona if not exists
function getOrCreateDefaultGenome(): AgentGenome {
  const store = getGenomeStore();
  let genome = store.getDefault();
  
  if (!genome) {
    const persona = getPersona();
    genome = {
      id: 'default',
      userId: 'local',
      name: 'Forge',
      slug: 'forge',
      version: '1.0.0',
      lineage: [],
      identity: {
        purpose: persona.systemPrompt,
        personality: persona.traits.map((t, i) => ({
          id: `trait-${i}`,
          name: t,
          weight: 1.0,
          source: 'seed' as const,
          addedAt: new Date(),
        })),
        constraints: persona.rules.map((r, i) => ({
          id: `rule-${i}`,
          description: r,
          type: 'must' as const,
          priority: 5,
          source: 'seed' as const,
          addedAt: new Date(),
        })),
      },
      tools: [],
      skills: [],
      knowledge: [],
      config: {
        model: {
          provider: 'openrouter',
          model: 'anthropic/claude-sonnet-4',
          temperature: 0.7,
          maxTokens: 4096,
        },
        memory: {
          conversationLimit: 50,
          factRetention: 'relevant',
          summarizationThreshold: 10000,
          semanticSearch: false,
        },
        evolution: {
          enabled: true,
          autoPropose: true,
          autoApply: false,
          consentThreshold: 'major',
          rollbackWindow: 24,
          minConfidence: 0.7,
        },
      },
      status: 'active',
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
      stats: {
        totalInteractions: 0,
        totalTokens: 0,
        totalCost: 0,
      },
    };
    genome = store.create(genome);
  }
  
  return genome;
}

// Sync genome traits to persona file
function syncGenomeToPersona(genome: AgentGenome): void {
  const currentPersona = getPersona();
  
  // Dynamically import setPersona to avoid circular deps
  import('./tools/self-evolve.js').then(({ setPersona }) => {
    setPersona({
      ...currentPersona,
      traits: genome.identity.personality.map(t => t.name),
      rules: genome.identity.constraints.map(r => r.description),
      updatedAt: new Date().toISOString(),
      version: currentPersona.version + 1,
    });
  });
}

// GET /api/genome - Get current genome
app.get('/api/genome', (req, res) => {
  try {
    const genome = getOrCreateDefaultGenome();
    res.json(genome);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/genome/versions - Get version history
app.get('/api/genome/versions', (req, res) => {
  try {
    const store = getGenomeStore();
    const genome = getOrCreateDefaultGenome();
    const versions = store.getVersionHistory(genome.id);
    res.json({
      current: genome.version,
      versions: versions.length > 0 ? versions : [{ version: genome.version, timestamp: Date.now(), description: 'Current' }],
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/genome/mutations - Get mutation history
app.get('/api/genome/mutations', (req, res) => {
  try {
    const store = getGenomeStore();
    const genome = getOrCreateDefaultGenome();
    const mutations = store.getMutations(genome.id, 50);
    res.json(mutations.map(m => ({
      ...m,
      trigger: JSON.parse(m.trigger),
      diff: JSON.parse(m.diff),
    })));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/genome/trait - Add a trait
app.post('/api/genome/trait', (req, res) => {
  try {
    const { name, weight = 1.0, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'name required' });
    }
    
    const store = getGenomeStore();
    const genome = getOrCreateDefaultGenome();
    
    const trait: Trait = {
      id: `trait-${Date.now()}`,
      name,
      weight,
      source: 'evolved',
      description,
      addedAt: new Date(),
    };
    
    const updated = store.addTrait(genome.id, trait);
    syncGenomeToPersona(updated);
    
    res.json({ success: true, trait, genome: updated });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /api/genome/trait/:id - Remove a trait
app.delete('/api/genome/trait/:id', (req, res) => {
  try {
    const store = getGenomeStore();
    const genome = getOrCreateDefaultGenome();
    
    const updated = store.removeTrait(genome.id, req.params.id);
    syncGenomeToPersona(updated);
    
    res.json({ success: true, genome: updated });
  } catch (error) {
    if ((error as Error).message === 'Trait not found') {
      return res.status(404).json({ error: 'Trait not found' });
    }
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/genome/rule - Add a rule
app.post('/api/genome/rule', (req, res) => {
  try {
    const { description, type = 'should', priority = 5 } = req.body;
    
    if (!description) {
      return res.status(400).json({ error: 'description required' });
    }
    
    const store = getGenomeStore();
    const genome = getOrCreateDefaultGenome();
    
    const rule: Rule = {
      id: `rule-${Date.now()}`,
      description,
      type: type as 'must' | 'should' | 'prefer' | 'avoid',
      priority,
      source: 'evolved',
      addedAt: new Date(),
    };
    
    const updated = store.addRule(genome.id, rule);
    syncGenomeToPersona(updated);
    
    res.json({ success: true, rule, genome: updated });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /api/genome/rule/:id - Remove a rule
app.delete('/api/genome/rule/:id', (req, res) => {
  try {
    const store = getGenomeStore();
    const genome = getOrCreateDefaultGenome();
    
    const updated = store.removeRule(genome.id, req.params.id);
    syncGenomeToPersona(updated);
    
    res.json({ success: true, genome: updated });
  } catch (error) {
    if ((error as Error).message === 'Rule not found') {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/genome/rollback - Rollback to a previous version
app.post('/api/genome/rollback', (req, res) => {
  try {
    const { targetVersion } = req.body;
    
    if (!targetVersion) {
      return res.status(400).json({ error: 'targetVersion required' });
    }
    
    const store = getGenomeStore();
    const genome = getOrCreateDefaultGenome();
    
    const updated = store.rollback(genome.id, targetVersion);
    syncGenomeToPersona(updated);
    
    res.json({ 
      success: true, 
      message: `Rolled back to v${targetVersion}`,
      genome: updated 
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/genome/feedback - Record interaction feedback for fitness
app.post('/api/genome/feedback', (req, res) => {
  try {
    const { feedback, tokens = 0, cost = 0, success = true } = req.body;
    
    if (!feedback || !['positive', 'negative', 'neutral'].includes(feedback)) {
      return res.status(400).json({ error: 'feedback must be positive, negative, or neutral' });
    }
    
    const store = getGenomeStore();
    const genome = getOrCreateDefaultGenome();
    
    store.recordInteraction(genome.id, {
      success,
      tokens,
      cost,
      userFeedback: feedback,
    });
    
    const updated = store.get(genome.id);
    
    res.json({ 
      success: true, 
      fitness: updated?.fitness,
      stats: updated?.stats,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/genome/fitness - Get current fitness metrics
app.get('/api/genome/fitness', (req, res) => {
  try {
    const genome = getOrCreateDefaultGenome();
    
    res.json({
      fitness: genome.fitness || {
        overall: 0.5,
        metrics: {
          taskCompletion: 0.5,
          userSatisfaction: 0.5,
          efficiency: 0.5,
          reliability: 0.5,
        },
        sampleSize: 0,
        lastEvaluated: null,
      },
      stats: genome.stats,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/genome/proposals - Get evolution proposals based on feedback
app.get('/api/genome/proposals', (req, res) => {
  try {
    const store = getGenomeStore();
    const genome = getOrCreateDefaultGenome();
    
    // In a real implementation, this would pull from recent conversation history
    // For now, return based on fitness thresholds
    const proposals = store.proposeEvolution(genome.id, {
      recentFeedback: [],
      recentTopics: [],
    });
    
    res.json({ proposals });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/genome/evolve - Apply an evolution proposal
app.post('/api/genome/evolve', (req, res) => {
  try {
    const { type, description, reason } = req.body;
    
    if (!type || !description) {
      return res.status(400).json({ error: 'type and description required' });
    }
    
    const store = getGenomeStore();
    const genome = getOrCreateDefaultGenome();
    
    let updated: typeof genome;
    
    if (type === 'trait_add') {
      updated = store.addTrait(genome.id, {
        id: `trait-${Date.now()}`,
        name: description,
        weight: 0.8, // Evolved traits start slightly lower
        source: 'evolved',
        description: reason,
        addedAt: new Date(),
      });
    } else if (type === 'rule_add') {
      updated = store.addRule(genome.id, {
        id: `rule-${Date.now()}`,
        description,
        type: 'should',
        priority: 5,
        source: 'evolved',
        addedAt: new Date(),
      });
    } else {
      return res.status(400).json({ error: 'Unsupported evolution type' });
    }
    
    syncGenomeToPersona(updated);
    
    res.json({ 
      success: true, 
      message: `Evolution applied: ${description}`,
      genome: updated 
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Helper: get nested value by path
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

// Helper: set nested value by path
function setNestedValue(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  const last = parts.pop()!;
  const target = parts.reduce((o, k) => o[k] = o[k] || {}, obj);
  target[last] = value;
}

// Health check
app.get('/api/health', (req, res) => {
  const persona = getPersona();
  const customTools = loadAllCustomTools();
  const execStats = executionLog.getStats();
  
  res.json({ 
    status: 'ok', 
    version: '0.5.0',
    model: 'anthropic/claude-sonnet-4',
    sessions: sessions.size,
    facts: memory.getFacts().length,
    persona: {
      version: persona.version,
      traits: persona.traits,
      rulesCount: persona.rules.length,
    },
    customTools: customTools.length,
    swarm: {
      enabled: true,
      roles: Object.keys(builtInRoles),
      protocols: ['sequential', 'parallel', 'debate'],
    },
    execution: {
      totalRuns: execStats.totalRuns,
      successRate: Math.round(execStats.successRate * 100) + '%',
      avgDurationMs: Math.round(execStats.avgDurationMs),
      totalTokens: execStats.totalTokens,
      totalCost: `$${execStats.totalCost.toFixed(4)}`,
    },
  });
});

app.listen(PORT, '0.0.0.0', () => {
  const persona = getPersona();
  const customTools = loadAllCustomTools();
  const execStats = executionLog.getStats();
  
  console.log(`\n⚒️  Forge v0.5.0 running at http://localhost:${PORT}`);
  console.log(`   Features: self-evolution, thinking stream, tool creation, agent swarm, cost tracking`);
  console.log(`   Swarm roles: ${Object.keys(builtInRoles).join(', ')}`);
  console.log(`   Protocols: sequential, parallel, debate`);
  console.log(`   Persona: v${persona.version} (${persona.traits.join(', ')})`);
  console.log(`   Memory: ${memory.getFacts().length} facts`);
  console.log(`   Custom tools: ${customTools.length}`);
  console.log(`   Execution: ${execStats.totalRuns} runs, ${execStats.totalTokens} tokens, $${execStats.totalCost.toFixed(4)} total`);
  console.log(`   Data: ${DATA_DIR}\n`);
});

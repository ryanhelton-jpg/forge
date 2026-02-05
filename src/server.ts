#!/usr/bin/env node
// Forge Web Server v0.3 - Self-evolving agent with thinking stream

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
import { rateLimit, sanitizeInput, securityHeaders, generateToken, tokenAuth } from './security.js';

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
const sessions = new Map<string, { agent: Agent; lastAccess: Date }>();

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

  try {
    const { response, thinking } = await agent.chat(cleanMessage);
    memory.updateConversation(sid, agent.getHistory());
    
    // Reload custom tools in case new ones were created
    const customTools = loadAllCustomTools();
    for (const tool of customTools) {
      if (!agent.getRegisteredTools().includes(tool.name)) {
        agent.registerTool(tool);
      }
    }
    
    res.json({ response, thinking, sessionId: sid });
  } catch (error) {
    console.error('Chat error:', error);
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

// Health check
app.get('/api/health', (req, res) => {
  const persona = getPersona();
  const customTools = loadAllCustomTools();
  res.json({ 
    status: 'ok', 
    version: '0.3.0',
    model: 'anthropic/claude-sonnet-4',
    sessions: sessions.size,
    facts: memory.getFacts().length,
    persona: {
      version: persona.version,
      traits: persona.traits,
      rulesCount: persona.rules.length,
    },
    customTools: customTools.length,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  const persona = getPersona();
  const customTools = loadAllCustomTools();
  
  console.log(`\n⚒️  Forge v0.3 running at http://localhost:${PORT}`);
  console.log(`   Features: self-evolution, thinking stream, tool creation`);
  console.log(`   Persona: v${persona.version} (${persona.traits.join(', ')})`);
  console.log(`   Memory: ${memory.getFacts().length} facts`);
  console.log(`   Custom tools: ${customTools.length}`);
  console.log(`   Data: ${DATA_DIR}\n`);
});

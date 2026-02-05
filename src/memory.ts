// Persistent memory system for Forge

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { Message } from './types.js';

export interface Conversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  metadata?: Record<string, unknown>;
}

export interface MemoryStore {
  conversations: Conversation[];
  facts: Fact[];
}

export interface Fact {
  id: string;
  text: string;
  category: 'preference' | 'fact' | 'context';
  createdAt: string;
}

export class Memory {
  private storePath: string;
  private store: MemoryStore;

  constructor(dataDir: string = './data') {
    // Ensure data directory exists
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    this.storePath = join(dataDir, 'memory.json');
    this.store = this.load();
  }

  private load(): MemoryStore {
    if (existsSync(this.storePath)) {
      try {
        const data = readFileSync(this.storePath, 'utf-8');
        return JSON.parse(data);
      } catch {
        console.error('Failed to load memory, starting fresh');
      }
    }
    return { conversations: [], facts: [] };
  }

  private save(): void {
    writeFileSync(this.storePath, JSON.stringify(this.store, null, 2));
  }

  // Conversation management
  createConversation(id: string): Conversation {
    const conv: Conversation = {
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    this.store.conversations.push(conv);
    this.save();
    return conv;
  }

  getConversation(id: string): Conversation | undefined {
    return this.store.conversations.find(c => c.id === id);
  }

  updateConversation(id: string, messages: Message[]): void {
    const conv = this.store.conversations.find(c => c.id === id);
    if (conv) {
      conv.messages = messages;
      conv.updatedAt = new Date().toISOString();
      this.save();
    }
  }

  listConversations(limit: number = 10): Conversation[] {
    return this.store.conversations
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  deleteConversation(id: string): boolean {
    const idx = this.store.conversations.findIndex(c => c.id === id);
    if (idx >= 0) {
      this.store.conversations.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // Facts/long-term memory
  addFact(text: string, category: Fact['category'] = 'fact'): Fact {
    const fact: Fact = {
      id: crypto.randomUUID(),
      text,
      category,
      createdAt: new Date().toISOString(),
    };
    this.store.facts.push(fact);
    this.save();
    return fact;
  }

  getFacts(category?: Fact['category']): Fact[] {
    if (category) {
      return this.store.facts.filter(f => f.category === category);
    }
    return this.store.facts;
  }

  searchFacts(query: string): Fact[] {
    const lower = query.toLowerCase();
    return this.store.facts.filter(f => 
      f.text.toLowerCase().includes(lower)
    );
  }

  deleteFact(id: string): boolean {
    const idx = this.store.facts.findIndex(f => f.id === id);
    if (idx >= 0) {
      this.store.facts.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // Build context from memory for the agent
  buildContext(): string {
    const facts = this.store.facts;
    if (facts.length === 0) return '';

    const sections: string[] = [];
    
    const preferences = facts.filter(f => f.category === 'preference');
    if (preferences.length > 0) {
      sections.push('User preferences:\n' + preferences.map(f => `- ${f.text}`).join('\n'));
    }

    const contextFacts = facts.filter(f => f.category === 'context');
    if (contextFacts.length > 0) {
      sections.push('Context:\n' + contextFacts.map(f => `- ${f.text}`).join('\n'));
    }

    const generalFacts = facts.filter(f => f.category === 'fact');
    if (generalFacts.length > 0) {
      sections.push('Known facts:\n' + generalFacts.map(f => `- ${f.text}`).join('\n'));
    }

    return sections.join('\n\n');
  }
}

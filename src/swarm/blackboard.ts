// Blackboard - shared workspace for agent communication

import type { BlackboardEntry } from './types.js';

/**
 * Blackboard - shared memory all agents can read and write
 * 
 * Think of it as a whiteboard in a meeting room where
 * agents post their findings, artifacts, and critiques.
 */
export class Blackboard {
  private entries: BlackboardEntry[] = [];
  private listeners: Array<(entry: BlackboardEntry) => void> = [];

  /**
   * Post a new entry to the blackboard
   */
  post(entry: Omit<BlackboardEntry, 'id' | 'timestamp'>): BlackboardEntry {
    const fullEntry: BlackboardEntry = {
      ...entry,
      id: `bb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    
    this.entries.push(fullEntry);
    this.listeners.forEach(cb => cb(fullEntry));
    return fullEntry;
  }

  /**
   * Get all entries
   */
  getAll(): BlackboardEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries by type
   */
  getByType(type: BlackboardEntry['type']): BlackboardEntry[] {
    return this.entries.filter(e => e.type === type);
  }

  /**
   * Get entries by author (role ID)
   */
  getByAuthor(author: string): BlackboardEntry[] {
    return this.entries.filter(e => e.author === author);
  }

  /**
   * Get entries with specific tag
   */
  getByTag(tag: string): BlackboardEntry[] {
    return this.entries.filter(e => e.tags?.includes(tag));
  }

  /**
   * Get recent entries (last N)
   */
  getRecent(count: number): BlackboardEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * Format blackboard for inclusion in agent context
   */
  formatForContext(options?: { 
    types?: BlackboardEntry['type'][];
    authors?: string[];
    maxEntries?: number;
  }): string {
    let filtered = this.entries;

    if (options?.types) {
      filtered = filtered.filter(e => options.types!.includes(e.type));
    }
    if (options?.authors) {
      filtered = filtered.filter(e => options.authors!.includes(e.author));
    }
    if (options?.maxEntries) {
      filtered = filtered.slice(-options.maxEntries);
    }

    if (filtered.length === 0) {
      return '<blackboard>\n(empty)\n</blackboard>';
    }

    const formatted = filtered.map(e => {
      const tags = e.tags?.length ? ` tags="${e.tags.join(',')}"` : '';
      return `<entry type="${e.type}" author="${e.author}"${tags}>\n${e.content}\n</entry>`;
    }).join('\n\n');

    return `<blackboard>\n${formatted}\n</blackboard>`;
  }

  /**
   * Parse blackboard entries from agent response
   */
  static parseFromResponse(response: string, author: string): Array<Omit<BlackboardEntry, 'id' | 'timestamp'>> {
    const entries: Array<Omit<BlackboardEntry, 'id' | 'timestamp'>> = [];
    const regex = /<blackboard type="([^"]+)"(?:\s+tags="([^"]*)")?>([\s\S]*?)<\/blackboard>/g;

    let match;
    while ((match = regex.exec(response)) !== null) {
      const [, type, tags, content] = match;
      entries.push({
        author,
        type: type as BlackboardEntry['type'],
        content: content.trim(),
        tags: tags ? tags.split(',').map(t => t.trim()) : undefined,
      });
    }

    return entries;
  }

  /**
   * Clear the blackboard
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Subscribe to new entries
   */
  onEntry(callback: (entry: BlackboardEntry) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Export for persistence
   */
  export(): BlackboardEntry[] {
    return [...this.entries];
  }

  /**
   * Import from persistence
   */
  import(entries: BlackboardEntry[]): void {
    this.entries = [...entries];
  }
}

import type { BlackboardEntry } from './types.js';
/**
 * Blackboard - shared memory all agents can read and write
 *
 * Think of it as a whiteboard in a meeting room where
 * agents post their findings, artifacts, and critiques.
 */
export declare class Blackboard {
    private entries;
    private listeners;
    /**
     * Post a new entry to the blackboard
     */
    post(entry: Omit<BlackboardEntry, 'id' | 'timestamp'>): BlackboardEntry;
    /**
     * Get all entries
     */
    getAll(): BlackboardEntry[];
    /**
     * Get entries by type
     */
    getByType(type: BlackboardEntry['type']): BlackboardEntry[];
    /**
     * Get entries by author (role ID)
     */
    getByAuthor(author: string): BlackboardEntry[];
    /**
     * Get entries with specific tag
     */
    getByTag(tag: string): BlackboardEntry[];
    /**
     * Get recent entries (last N)
     */
    getRecent(count: number): BlackboardEntry[];
    /**
     * Format blackboard for inclusion in agent context
     */
    formatForContext(options?: {
        types?: BlackboardEntry['type'][];
        authors?: string[];
        maxEntries?: number;
    }): string;
    /**
     * Parse blackboard entries from agent response
     */
    static parseFromResponse(response: string, author: string): Array<Omit<BlackboardEntry, 'id' | 'timestamp'>>;
    /**
     * Clear the blackboard
     */
    clear(): void;
    /**
     * Subscribe to new entries
     */
    onEntry(callback: (entry: BlackboardEntry) => void): () => void;
    /**
     * Export for persistence
     */
    export(): BlackboardEntry[];
    /**
     * Import from persistence
     */
    import(entries: BlackboardEntry[]): void;
}

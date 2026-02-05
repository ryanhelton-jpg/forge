// Blackboard - shared workspace for agent communication
/**
 * Blackboard - shared memory all agents can read and write
 *
 * Think of it as a whiteboard in a meeting room where
 * agents post their findings, artifacts, and critiques.
 */
export class Blackboard {
    entries = [];
    listeners = [];
    /**
     * Post a new entry to the blackboard
     */
    post(entry) {
        const fullEntry = {
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
    getAll() {
        return [...this.entries];
    }
    /**
     * Get entries by type
     */
    getByType(type) {
        return this.entries.filter(e => e.type === type);
    }
    /**
     * Get entries by author (role ID)
     */
    getByAuthor(author) {
        return this.entries.filter(e => e.author === author);
    }
    /**
     * Get entries with specific tag
     */
    getByTag(tag) {
        return this.entries.filter(e => e.tags?.includes(tag));
    }
    /**
     * Get recent entries (last N)
     */
    getRecent(count) {
        return this.entries.slice(-count);
    }
    /**
     * Format blackboard for inclusion in agent context
     */
    formatForContext(options) {
        let filtered = this.entries;
        if (options?.types) {
            filtered = filtered.filter(e => options.types.includes(e.type));
        }
        if (options?.authors) {
            filtered = filtered.filter(e => options.authors.includes(e.author));
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
    static parseFromResponse(response, author) {
        const entries = [];
        const regex = /<blackboard type="([^"]+)"(?:\s+tags="([^"]*)")?>([\s\S]*?)<\/blackboard>/g;
        let match;
        while ((match = regex.exec(response)) !== null) {
            const [, type, tags, content] = match;
            entries.push({
                author,
                type: type,
                content: content.trim(),
                tags: tags ? tags.split(',').map(t => t.trim()) : undefined,
            });
        }
        return entries;
    }
    /**
     * Clear the blackboard
     */
    clear() {
        this.entries = [];
    }
    /**
     * Subscribe to new entries
     */
    onEntry(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }
    /**
     * Export for persistence
     */
    export() {
        return [...this.entries];
    }
    /**
     * Import from persistence
     */
    import(entries) {
        this.entries = [...entries];
    }
}

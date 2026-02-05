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
export declare class Memory {
    private storePath;
    private store;
    constructor(dataDir?: string);
    private load;
    private save;
    createConversation(id: string): Conversation;
    getConversation(id: string): Conversation | undefined;
    updateConversation(id: string, messages: Message[]): void;
    listConversations(limit?: number): Conversation[];
    deleteConversation(id: string): boolean;
    addFact(text: string, category?: Fact['category']): Fact;
    getFacts(category?: Fact['category']): Fact[];
    searchFacts(query: string): Fact[];
    deleteFact(id: string): boolean;
    buildContext(): string;
}

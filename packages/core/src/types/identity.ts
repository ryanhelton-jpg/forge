// Identity types for Agent Genome

export interface Trait {
  id: string;
  name: string;                    // e.g., "concise", "formal", "proactive"
  weight: number;                  // 0.0 to 1.0, strength of trait
  source: 'seed' | 'evolved' | 'inherited';
  addedAt: Date;
}

export interface Rule {
  id: string;
  description: string;             // e.g., "Never share personal data"
  type: 'must' | 'should' | 'prefer' | 'avoid';
  priority: number;                // Higher = more important
  source: 'seed' | 'evolved' | 'inherited';
  addedAt: Date;
}

export interface Voice {
  tone: string;
  style: string;
  examples: string[];
}

export interface Identity {
  purpose: string;                 // Core mission statement
  personality: Trait[];
  constraints: Rule[];
  voice?: Voice;
}

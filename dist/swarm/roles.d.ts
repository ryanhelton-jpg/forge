import type { AgentRole } from './types.js';
/**
 * Researcher - gathers information, explores approaches
 */
export declare const researcher: AgentRole;
/**
 * Coder - implements solutions
 */
export declare const coder: AgentRole;
/**
 * Critic - reviews and challenges
 */
export declare const critic: AgentRole;
/**
 * Synthesizer - combines outputs into coherent result
 */
export declare const synthesizer: AgentRole;
/**
 * Planner - decomposes tasks
 */
export declare const planner: AgentRole;
/**
 * All built-in roles
 */
export declare const builtInRoles: Record<string, AgentRole>;
/**
 * Create a custom role
 */
export declare function createRole(config: Partial<AgentRole> & {
    id: string;
    systemPrompt: string;
}): AgentRole;

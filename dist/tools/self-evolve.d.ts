import type { Tool } from '../types.js';
export interface PersonaConfig {
    systemPrompt: string;
    traits: string[];
    rules: string[];
    updatedAt: string;
    version: number;
}
export declare function getPersona(): PersonaConfig;
export declare function setPersona(config: PersonaConfig): void;
export declare const selfEvolveTool: Tool;

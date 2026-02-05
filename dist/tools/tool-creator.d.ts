import type { Tool, ToolParameter } from '../types.js';
export interface CustomToolDef {
    name: string;
    description: string;
    parameters: Record<string, ToolParameter>;
    code: string;
    createdAt: string;
}
export declare function hydrateCustomTool(def: CustomToolDef): Tool;
export declare function loadAllCustomTools(): Tool[];
export declare const toolCreatorTool: Tool;

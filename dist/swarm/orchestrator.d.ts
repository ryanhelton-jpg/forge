import type { SwarmConfig, SwarmResult, SwarmPlan, AgentRole } from './types.js';
import { Blackboard } from './blackboard.js';
/**
 * Swarm Orchestrator
 *
 * Coordinates multiple specialized agents working together on a task.
 * Handles task decomposition, agent spawning, and result synthesis.
 */
export declare class Orchestrator {
    private config;
    private blackboard;
    private roles;
    private totalTurns;
    constructor(config: SwarmConfig);
    /**
     * Execute a swarm task with automatic planning
     */
    execute(goal: string): Promise<SwarmResult>;
    /**
     * Execute a pre-defined plan
     */
    executePlan(plan: SwarmPlan): Promise<Omit<SwarmResult, 'timing'>>;
    /**
     * Plan a task using the planner agent
     */
    private planTask;
    /**
     * Sequential execution - tasks run one after another
     */
    private executeSequential;
    /**
     * Parallel execution - independent tasks run concurrently
     */
    private executeParallel;
    /**
     * Debate execution - propose/critique/refine loop
     */
    private executeDebate;
    /**
     * Execute a single task with an agent
     */
    private executeTask;
    /**
     * Create an agent instance for a role
     */
    private createAgent;
    /**
     * Build context string for a task
     */
    private buildTaskContext;
    /**
     * Topological sort of tasks by dependencies
     */
    private topologicalSort;
    /**
     * Group tasks by dependency level for parallel execution
     */
    private groupByDependencyLevel;
    /**
     * Get current blackboard
     */
    getBlackboard(): Blackboard;
    /**
     * Get registered roles
     */
    getRoles(): AgentRole[];
}

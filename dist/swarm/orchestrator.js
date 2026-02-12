// Swarm Orchestrator - coordinates multi-agent execution
import { Agent } from '../agent.js';
import { Blackboard } from './blackboard.js';
import { builtInRoles } from './roles.js';
/**
 * Swarm Orchestrator
 *
 * Coordinates multiple specialized agents working together on a task.
 * Handles task decomposition, agent spawning, and result synthesis.
 */
export class Orchestrator {
    config;
    blackboard;
    roles;
    totalTurns = 0;
    constructor(config) {
        this.config = config;
        this.blackboard = new Blackboard();
        this.roles = new Map();
        // Register built-in roles
        Object.values(builtInRoles).forEach(role => {
            this.roles.set(role.id, role);
        });
        // Register custom roles (override built-ins if same ID)
        config.roles.forEach(role => {
            this.roles.set(role.id, role);
        });
        // Subscribe to blackboard updates
        if (config.onBlackboardUpdate) {
            this.blackboard.onEntry(config.onBlackboardUpdate);
        }
    }
    /**
     * Execute a swarm task with automatic planning
     */
    async execute(goal) {
        const startedAt = Date.now();
        // Use planner to decompose the task
        const plan = await this.planTask(goal);
        // Notify that plan is ready
        this.config.onPlanReady?.(plan);
        // Execute the plan
        const result = await this.executePlan(plan);
        return {
            ...result,
            timing: {
                startedAt,
                completedAt: Date.now(),
                durationMs: Date.now() - startedAt,
            },
        };
    }
    /**
     * Execute a pre-defined plan
     */
    async executePlan(plan) {
        const startedAt = Date.now();
        switch (plan.protocol) {
            case 'sequential':
                return this.executeSequential(plan);
            case 'parallel':
                return this.executeParallel(plan);
            case 'debate':
                return this.executeDebate(plan);
            default:
                return this.executeSequential(plan);
        }
    }
    /**
     * Plan a task using the planner agent
     */
    async planTask(goal) {
        const plannerRole = this.roles.get('planner');
        if (!plannerRole) {
            // Default simple plan if no planner
            return {
                goal,
                protocol: 'sequential',
                tasks: [
                    { id: 't1', description: goal, assignedTo: 'coder', status: 'pending' },
                ],
            };
        }
        const planner = this.createAgent(plannerRole);
        const response = await planner.chat(`Create an execution plan for this goal:\n\n${goal}\n\nConsider what research might be needed, what needs to be built, and what should be reviewed.`);
        // Extract JSON plan from response
        try {
            const jsonMatch = response.response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    goal: parsed.goal || goal,
                    protocol: parsed.protocol || 'sequential',
                    tasks: (parsed.tasks || []).map((t, i) => ({
                        id: t.id || `t${i + 1}`,
                        description: t.description || '',
                        assignedTo: t.assignedTo || 'coder',
                        dependencies: t.dependencies || [],
                        status: 'pending',
                    })),
                };
            }
        }
        catch {
            // Fall through to default
        }
        // Default plan if parsing fails
        return {
            goal,
            protocol: 'sequential',
            tasks: [
                { id: 't1', description: `Research: ${goal}`, assignedTo: 'researcher', status: 'pending', dependencies: [] },
                { id: 't2', description: `Implement: ${goal}`, assignedTo: 'coder', status: 'pending', dependencies: ['t1'] },
                { id: 't3', description: 'Review implementation', assignedTo: 'critic', status: 'pending', dependencies: ['t2'] },
                { id: 't4', description: 'Final synthesis', assignedTo: 'synthesizer', status: 'pending', dependencies: ['t3'] },
            ],
        };
    }
    /**
     * Sequential execution - tasks run one after another
     */
    async executeSequential(plan) {
        const completedTasks = new Map();
        // Sort tasks by dependencies
        const sortedTasks = this.topologicalSort(plan.tasks);
        for (const task of sortedTasks) {
            // Check dependencies
            const depsComplete = (task.dependencies || []).every(depId => completedTasks.get(depId)?.status === 'complete');
            if (!depsComplete) {
                task.status = 'failed';
                task.error = 'Dependencies not met';
                continue;
            }
            // Execute task
            await this.executeTask(task, plan);
            completedTasks.set(task.id, task);
            // Check for max turns
            if (this.totalTurns >= (this.config.maxTotalTurns || 50)) {
                break;
            }
        }
        // Get final output from synthesizer or last task
        const lastComplete = sortedTasks.filter(t => t.status === 'complete').pop();
        const finalOutput = lastComplete?.result || 'No output produced';
        return {
            success: sortedTasks.every(t => t.status === 'complete'),
            goal: plan.goal,
            finalOutput,
            blackboard: this.blackboard.getAll(),
            tasks: plan.tasks,
            totalTurns: this.totalTurns,
        };
    }
    /**
     * Parallel execution - independent tasks run concurrently
     */
    async executeParallel(plan) {
        // Group tasks by dependency level
        const levels = this.groupByDependencyLevel(plan.tasks);
        for (const level of levels) {
            // Run all tasks in this level concurrently
            await Promise.all(level.map(task => this.executeTask(task, plan)));
            if (this.totalTurns >= (this.config.maxTotalTurns || 50)) {
                break;
            }
        }
        const lastComplete = plan.tasks.filter(t => t.status === 'complete').pop();
        const finalOutput = lastComplete?.result || 'No output produced';
        return {
            success: plan.tasks.every(t => t.status === 'complete'),
            goal: plan.goal,
            finalOutput,
            blackboard: this.blackboard.getAll(),
            tasks: plan.tasks,
            totalTurns: this.totalTurns,
        };
    }
    /**
     * Debate execution - propose/critique/refine loop
     */
    async executeDebate(plan) {
        const maxRounds = 3;
        // Initial proposal
        const proposer = plan.tasks.find(t => t.assignedTo === 'coder') || plan.tasks[0];
        await this.executeTask(proposer, plan);
        // Debate rounds
        for (let round = 0; round < maxRounds; round++) {
            // Critique
            const critiqueTask = {
                id: `critique_${round}`,
                description: `Review and critique the current proposal (round ${round + 1})`,
                assignedTo: 'critic',
                status: 'pending',
            };
            await this.executeTask(critiqueTask, plan);
            plan.tasks.push(critiqueTask);
            // Check if critic approved
            const critiques = this.blackboard.getByType('critique');
            const lastCritique = critiques[critiques.length - 1];
            if (lastCritique?.content.toLowerCase().includes('approved') ||
                lastCritique?.content.toLowerCase().includes('no major issues')) {
                break;
            }
            // Refine based on critique
            const refineTask = {
                id: `refine_${round}`,
                description: `Address the critique and refine the solution (round ${round + 1})`,
                assignedTo: 'coder',
                status: 'pending',
            };
            await this.executeTask(refineTask, plan);
            plan.tasks.push(refineTask);
        }
        // Final synthesis
        const synthTask = {
            id: 'final_synthesis',
            description: 'Produce final synthesized output',
            assignedTo: 'synthesizer',
            status: 'pending',
        };
        await this.executeTask(synthTask, plan);
        plan.tasks.push(synthTask);
        return {
            success: true,
            goal: plan.goal,
            finalOutput: synthTask.result || 'No output produced',
            blackboard: this.blackboard.getAll(),
            tasks: plan.tasks,
            totalTurns: this.totalTurns,
        };
    }
    /**
     * Execute a single task with an agent
     */
    async executeTask(task, plan) {
        const roleId = task.assignedTo || 'coder';
        const role = this.roles.get(roleId);
        if (!role) {
            task.status = 'failed';
            task.error = `Unknown role: ${roleId}`;
            return;
        }
        task.status = 'running';
        this.config.onAgentStart?.(roleId, task);
        try {
            const agent = this.createAgent(role);
            // Build context with blackboard
            const context = this.buildTaskContext(task, plan);
            const result = await agent.chat(context);
            this.totalTurns++;
            // Parse and post blackboard entries
            const entries = Blackboard.parseFromResponse(result.response, roleId);
            entries.forEach(entry => this.blackboard.post(entry));
            // Emit thinking if present
            if (result.thinking) {
                this.config.onThinking?.(roleId, result.thinking);
            }
            task.status = 'complete';
            task.result = result.response;
            this.config.onAgentComplete?.(roleId, task, result.response);
        }
        catch (error) {
            task.status = 'failed';
            task.error = error instanceof Error ? error.message : String(error);
        }
    }
    /**
     * Create an agent instance for a role
     */
    createAgent(role) {
        const agent = new Agent({
            model: role.model || this.config.defaultModel,
            apiKey: this.config.apiKey,
            systemPrompt: role.systemPrompt,
            maxTurns: this.config.maxTurnsPerAgent || 5,
        });
        // Register role-specific tools
        role.tools?.forEach(tool => agent.registerTool(tool));
        return agent;
    }
    /**
     * Build context string for a task
     */
    buildTaskContext(task, plan) {
        const parts = [];
        parts.push(`## Goal\n${plan.goal}`);
        parts.push(`\n## Your Task\n${task.description}`);
        // Include relevant blackboard entries
        const bbContext = this.blackboard.formatForContext({ maxEntries: 10 });
        if (!bbContext.includes('(empty)')) {
            parts.push(`\n## Previous Work\n${bbContext}`);
        }
        return parts.join('\n');
    }
    /**
     * Topological sort of tasks by dependencies
     */
    topologicalSort(tasks) {
        const sorted = [];
        const visited = new Set();
        const taskMap = new Map(tasks.map(t => [t.id, t]));
        const visit = (task) => {
            if (visited.has(task.id))
                return;
            visited.add(task.id);
            (task.dependencies || []).forEach(depId => {
                const dep = taskMap.get(depId);
                if (dep)
                    visit(dep);
            });
            sorted.push(task);
        };
        tasks.forEach(task => visit(task));
        return sorted;
    }
    /**
     * Group tasks by dependency level for parallel execution
     */
    groupByDependencyLevel(tasks) {
        const levels = [];
        const completed = new Set();
        while (completed.size < tasks.length) {
            const level = tasks.filter(task => {
                if (completed.has(task.id))
                    return false;
                return (task.dependencies || []).every(d => completed.has(d));
            });
            if (level.length === 0)
                break; // Circular dependency
            level.forEach(t => completed.add(t.id));
            levels.push(level);
        }
        return levels;
    }
    /**
     * Get current blackboard
     */
    getBlackboard() {
        return this.blackboard;
    }
    /**
     * Get registered roles
     */
    getRoles() {
        return Array.from(this.roles.values());
    }
}

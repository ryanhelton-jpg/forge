# ⚒️ Forge

> **⚠️ Archived — Feb 2026**
> This project has been archived. Development has moved to [OpenClaw](https://github.com/openclaw/openclaw).
> The ideas explored here (genome/fitness tracking, agent swarm orchestration, self-evolving personas) were good ones — they just got absorbed into a better-resourced system.

---

**Self-evolving AI agent framework — built from scratch.**

An AI agent that can modify its own personality, create its own tools, track its fitness, and evolve based on feedback. No magic. No bloat.

## What Was Interesting Here

### 🧬 Genome System
A living config that defined the agent's identity — traits with weights, behavioral rules, learned skills — all tracked as mutations with semantic versioning. Rollback to any prior version. The idea: an agent's personality should be versioned and auditable, not a black box prompt.

### 📊 Fitness Tracking
Every interaction scored on task completion, user satisfaction, token efficiency, and error rate. Low fitness → evolution proposals. The insight: continuous feedback loops matter more than prompt engineering.

### 🐝 Agent Swarm
Multi-agent collaboration with defined roles: planner, researcher, coder, critic, synthesizer. State persisted to disk for restart recovery. The lesson: role specialization beats a single generalist agent for complex tasks.

### 🔧 Live Tool Creation
Agents describing what they need → writing the code → persisting tools for future sessions. Self-extending capability without redeployment.

---

*Built Feb 2026. MIT License.*

# ⚒️ Forge

**Self-evolving AI agent framework — built from scratch.**

An AI agent that can modify its own personality, create its own tools, track its fitness, and evolve based on feedback. No magic. No bloat.

## Quick Start

```bash
# Install globally
npm install -g @ryanhelton/forge

# Configure (first time)
forge setup

# Start the server
forge start
```

Then open `http://localhost:3030` and enter your auth token.

## Features

### 🧬 Genome System (v0.5+)
Forge has a living "genome" that defines its identity:

- **Traits** — Personality characteristics with weights (e.g., "concise" at 90%)
- **Rules** — Behavioral constraints (must/should/prefer/avoid)
- **Skills** — Learned capabilities tracked over time
- **Config** — Model settings, memory limits, evolution preferences

All changes are tracked as **mutations** with semantic versioning.

### 📊 Fitness Tracking
Every interaction is measured:
- **Task completion** — Did it successfully help?
- **User satisfaction** — 👍/👎 feedback from users
- **Efficiency** — Tokens per successful task
- **Reliability** — Error rate

Low fitness triggers **evolution proposals** — suggested changes to improve.

### 🔄 Version Control
- Full mutation history with diffs
- **Rollback** to any previous version
- **Fork** genomes to experiment
- Semantic versioning (major.minor.patch)

### 🧠 Thinking Stream
See how Forge reasons through problems:
- Internal monologue displayed before answers
- Understand the "why" behind responses

### 🔧 Live Tool Creation
Forge can build its own tools:
- Describe what you need → it writes the code
- Tools persist and work in future sessions

### 🐝 Agent Swarm (v0.4+)
Multiple specialized agents collaborate:

| Role | Purpose |
|------|---------|
| `planner` | Decomposes tasks into subtasks |
| `researcher` | Gathers information |
| `coder` | Implements solutions |
| `critic` | Reviews work, identifies issues |
| `synthesizer` | Combines outputs into final result |

### 🌐 External Tools (v0.5+)
| Tool | Purpose |
|------|---------|
| `web_search` | Search the internet (Brave Search) |
| `http_fetch` | Make HTTP requests |
| `read_file` | Read files from disk |
| `write_file` | Write files to disk |
| `list_files` | List directory contents |

## API Endpoints

### Chat
```bash
POST /api/chat
# Body: { "message": "Hello", "sessionId": "optional-uuid" }
# Returns: { response, thinking, usage, evolutionProposals? }
```

### Genome
```bash
GET  /api/genome              # Get full genome
GET  /api/genome/versions     # Version history
GET  /api/genome/mutations    # Mutation log
GET  /api/genome/fitness      # Fitness metrics
GET  /api/genome/proposals    # Evolution proposals

POST /api/genome/trait        # Add trait: { name, weight?, description? }
DELETE /api/genome/trait/:id  # Remove trait

POST /api/genome/rule         # Add rule: { description, type?, priority? }
DELETE /api/genome/rule/:id   # Remove rule

POST /api/genome/feedback     # Record feedback: { feedback: "positive"|"negative" }
POST /api/genome/rollback     # Rollback: { targetVersion: "1.0.0" }
POST /api/genome/evolve       # Apply proposal: { type, description }
```

### Swarm
```bash
POST /api/swarm               # Run swarm: { goal: "Build a REST API" }
GET  /api/swarm/roles         # List available roles
GET  /api/swarm/active        # Check running swarms
GET  /api/swarm/:runId/status # Swarm status
```

### Other
```bash
GET  /api/health              # Health check + stats
GET  /api/persona             # Current persona
GET  /api/tools               # Available tools
GET  /api/memory              # Stored facts
GET  /api/runs                # Execution history
```

## Configuration

Config stored in `~/.forge/`:
- `config.json` — API key, port, auth token
- `data/` — Memory, personas, custom tools, genome.db

### Environment Variables
| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | API key for OpenRouter |
| `BRAVE_API_KEY` | API key for web search (optional) |
| `PORT` | Server port (default: 3030) |
| `FORGE_TOKEN` | Auth token for web UI |
| `DATA_DIR` | Data storage directory |

## Architecture

```
forge/
├── bin/forge.js           # CLI entry point
├── src/
│   ├── server.ts          # Express server + API routes
│   ├── agent.ts           # Core agent loop
│   ├── genome-store.ts    # SQLite genome persistence
│   ├── genome/            # Genome types, mutations, versioning
│   ├── llm.ts             # LLM interface
│   ├── memory.ts          # Persistent memory
│   ├── tools/             # Built-in tools
│   └── swarm/             # Multi-agent orchestration
├── public/                # Web UI
├── data/                  # Runtime data
│   ├── genome.db          # SQLite database
│   └── persona.json       # Active persona
└── packages/              # Monorepo packages (WIP)
    ├── core/              # Shared types
    ├── genome/            # Genome package
    ├── api/               # API server (planned)
    └── runtime/           # Agent runtime (planned)
```

## Evolution Flow

```
Interaction → Track success/tokens/cost
                    ↓
            User gives feedback (👍/👎)
                    ↓
            Fitness metrics update
                    ↓
            If fitness < threshold
                    ↓
            Generate proposals
                    ↓
            User applies or dismisses
                    ↓
            Mutation recorded → Version bumps
                    ↓
            Persona syncs
```

## Development

```bash
# Clone
git clone https://github.com/ryanhelton/forge.git
cd forge

# Install deps
npm install

# Run in dev mode
npm run dev

# Build for production
npm run build

# Initialize database
node scripts/init-db.js
```

## Why "Forge"?

Because we're building tools. And forging new paths in AI.

---

**Built for learning. Built for fun. Built to evolve.**

MIT License • [Ryan Helton](https://github.com/ryanhelton)

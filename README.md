# ⚒️ Forge

**Self-evolving AI agent framework — built from scratch.**

An AI agent that can modify its own personality, create its own tools, and show you its thinking. No magic. No bloat.

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

### 🧬 Self-Evolution
Forge can modify its own behavior:
- **Add traits** — "Be more sarcastic" 
- **Add rules** — "Always ask clarifying questions"
- **Rewrite its core identity** — Full system prompt changes
- Changes persist across sessions

### 🧠 Thinking Stream
See how Forge reasons through problems:
- Internal monologue displayed before answers
- Understand the "why" behind responses
- Great for learning and debugging

### 🔧 Live Tool Creation
Forge can build its own tools:
- Describe what you need → it writes the code
- Tools persist and work in future sessions
- Self-extending capabilities

### 🔒 Security
- Token-based authentication
- Rate limiting
- Input sanitization
- Security headers

## Commands

```bash
forge start     # Start the server
forge setup     # Configure API key, port, token
forge config    # Show current configuration
forge version   # Show version
forge help      # Show help
```

## Configuration

Config is stored in `~/.forge/`:
- `config.json` — API key, port, auth token
- `data/` — Memory, personas, custom tools

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | API key for OpenRouter |
| `PORT` | Server port (default: 3030) |
| `FORGE_TOKEN` | Auth token for web UI |
| `DATA_DIR` | Data storage directory |

## How It Works

```
User Input
    ↓
Build Context (persona + memory + tools)
    ↓
Call LLM (via OpenRouter)
    ↓
Parse for Tool Calls
    ↓
Execute Tools (if any) → Loop back
    ↓
Return Response + Thinking
    ↓
Save to Memory
```

## Example Interactions

**Self-evolution:**
```
You: Be more concise from now on
Forge: Added rule: "Keep responses brief and to the point."
       I'll follow this going forward.
```

**Tool creation:**
```
You: Create a tool that converts Celsius to Fahrenheit
Forge: ✅ Tool "celsius_to_fahrenheit" created!
       Try: "Convert 25°C to Fahrenheit"
```

**Thinking:**
```
You: What's the best sorting algorithm?

🧠 Thinking:
This depends on context. For general purpose, quicksort 
is often fastest on average. For nearly-sorted data, 
insertion sort wins. For stability needs, mergesort...

Forge: It depends on your use case. For general purpose,
       quicksort (O(n log n) average). For stability, 
       mergesort. For small/nearly-sorted data, insertion sort.
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
```

## Architecture

```
forge/
├── bin/forge.js       # CLI entry point
├── src/
│   ├── agent.ts       # Core agent loop
│   ├── llm.ts         # LLM interface
│   ├── memory.ts      # Persistent memory
│   ├── security.ts    # Auth & rate limiting
│   ├── server.ts      # Express server
│   └── tools/         # Built-in tools
├── public/            # Web UI
└── package.json
```

## Why "Forge"?

Because we're building tools. And because it sounds cool.

---

**Built for learning. Built for fun.**

MIT License • [Ryan Helton](https://github.com/ryanhelton)

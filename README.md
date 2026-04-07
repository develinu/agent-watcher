# Agent Watcher

Real-time monitoring and visualization dashboard for [Claude Code](https://claude.ai/claude-code) sessions.

Agent Watcher reads Claude Code's local session logs, analyzes workflow phases using AI, and presents everything in an interactive web UI with live updates.

> **Your data never leaves your machine.**
> Agent Watcher reads `~/.claude` directly on your local filesystem — no cloud sync, no telemetry, no external servers involved. Your session history, prompts, and code context stay entirely private.

## Why Agent Watcher?

- **100% local & private** — Reads session files directly from disk. Nothing is uploaded or transmitted anywhere.
- **No API key required** — Works out of the box with built-in regex-based analysis. Add an LLM key only if you want richer AI summaries and phase classification.
- **Works offline** — Full monitoring, workflow visualization, and token tracking work without any internet connection.
- **Dual interface** — Browser-based dashboard for rich visuals, or a lightweight terminal UI (`aw tui`) for keyboard-driven workflows.
- **Open source & self-hosted** — MIT licensed. You own and control the entire stack.

## Features

- **Real-time monitoring** — Watches `~/.claude` for session activity via WebSocket
- **Workflow visualization** — Interactive flow diagrams of session phases (React Flow + dagre)
- **AI-powered analysis** — Automatically classifies work phases (feature, bugfix, refactor, debug, etc.)
- **Multi-provider LLM** — Supports Anthropic, OpenAI, and Google Gemini for analysis
- **Token & cost tracking** — Per-session and per-model usage analytics
- **Project organization** — Sessions grouped by project with aggregated views
- **Multi-language support** — Analysis adapts to the language of user messages

## Tech Stack

| Layer    | Technology                                           |
| -------- | ---------------------------------------------------- |
| Frontend | React 19, React Flow, Recharts, Tailwind CSS 4, Vite |
| Backend  | Node.js, Express, WebSocket (ws), chokidar           |
| Shared   | TypeScript 5.8, npm workspaces monorepo              |
| AI       | Anthropic SDK, OpenAI SDK, Google Generative AI SDK  |

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- [Claude Code](https://claude.ai/claude-code) installed (generates session logs at `~/.claude`)

## Quick Start

```bash
# Clone
git clone https://github.com/develinu/agent-watcher.git
cd agent-watcher

# Install
npm install

# Configure
cp .env.example .env
# Edit .env — add your API key for session analysis (optional)

# Run
npm run dev
```

Open http://localhost:9999 in your browser.

## TUI (CLI Monitor)

Agent Watcher includes a terminal UI for monitoring sessions without a browser.

```bash
npm run tui
```

> The server must be running (`npm run dev` or `aw start`) before the TUI can connect.

The TUI connects to the running server and shows sessions grouped by project, with real-time workflow visualization in the terminal.

## aw Scripts

Install a global `aw` command for managing the server and TUI from any directory:

```bash
bash scripts/install.sh
```

Then use from any project directory:

```bash
aw start    # Start server in background
aw stop     # Stop server
aw restart  # Restart server
aw status   # Show server status
aw logs     # Tail server log (Ctrl+C to exit)
aw tui      # Launch TUI monitor (auto-starts server if needed)
```

> `aw tui` automatically starts the server if it is not already running.

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Claude Code session directory
CLAUDE_DIR=~/.claude

# Server port
SERVER_PORT=3001

# Session active threshold (ms, default: 60000 = 1min)
ACTIVE_THRESHOLD_MS=60000

# Analysis provider: anthropic | openai | gemini
ANALYSIS_PROVIDER=anthropic

# Leave ANALYSIS_MODEL empty to use provider defaults:
#   anthropic → claude-haiku-4-5-20251001
#   openai    → gpt-4o-mini
#   gemini    → gemini-2.0-flash
ANALYSIS_MODEL=

# Debounce (ms) before LLM workflow re-analysis (default: 3000)
VITE_ANALYSIS_DEBOUNCE_MS=3000

# Provider API keys (only the selected provider's key is required)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
```

> Analysis is optional. Without an API key, Agent Watcher uses regex-based fallback for summaries and phase detection.

## Production

```bash
npm run build
npm start        # NODE_ENV=production, binds to 127.0.0.1
```

Or with Docker:

```bash
docker compose up -d
```

See [Deployment Guide](docs/DEPLOYMENT.md) for nginx, PM2, and security details.

## Development

```bash
# Run dev server (server + client concurrently)
npm run dev

# Type check
npm run typecheck -w server
npm run typecheck -w client

# Run tests
npm test

# Build for production
npm run build
```

### Project Structure

```
agent-watcher/
├── client/          # React frontend (Vite)
│   └── src/
│       ├── components/   # UI components
│       ├── hooks/        # Custom React hooks
│       ├── lib/          # Utilities & graph logic
│       └── pages/        # Route pages
├── server/          # Express backend
│   └── src/
│       ├── routes/       # REST API endpoints
│       ├── services/     # Business logic
│       └── watchers/     # File watcher & WebSocket
├── tui/             # Terminal UI (Ink)
├── shared/          # Shared TypeScript types
└── package.json     # Workspace root
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design, data flow, module map
- [API Reference](docs/API.md) — REST endpoints and WebSocket events
- [Deployment](docs/DEPLOYMENT.md) — Production setup, Docker, reverse proxy
- [Changelog](CHANGELOG.md) — Version history

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)

# Contributing to Agent Watcher

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js >= 18
- npm >= 9

### Getting Started

```bash
git clone https://github.com/develinu/agent-watcher.git
cd agent-watcher
npm install
cp .env.example .env
npm run dev
```

The dev server runs at http://localhost:5173 with API proxy to http://localhost:3001.

## How to Contribute

### Reporting Bugs

1. Search [existing issues](https://github.com/develinu/agent-watcher/issues) first
2. Open a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node.js version)

### Suggesting Features

Open an issue with the `enhancement` label describing:

- The problem you want to solve
- Your proposed solution
- Any alternatives considered

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Ensure checks pass:
   ```bash
   npm run typecheck -w server && npm run typecheck -w client
   npm test
   ```
5. Commit with [conventional commits](https://www.conventionalcommits.org/):
   ```
   feat: add session export feature
   fix: correct token calculation for cached inputs
   ```
6. Push and open a PR against `main`

### Commit Message Format

```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

## Project Architecture

```
shared/    → TypeScript types (Session, Project, Analytics, etc.)
server/    → Express API + file watcher + WebSocket broadcaster
client/    → React SPA with React Flow visualization
```

- **Monorepo** managed with npm workspaces
- **Shared types** are imported by both server and client
- **Real-time updates** flow: file watcher → WebSocket → React hooks

## Code Style

- TypeScript strict mode
- Immutable data patterns (spread operator, no mutation)
- Small focused files (< 400 lines)
- No `any` — use `unknown` and narrow

## Questions?

Open a [discussion](https://github.com/develinu/agent-watcher/discussions) or reach out via issues.

# `aw` Control Scripts Design

**Date:** 2026-04-07  
**Status:** Approved

## Overview

A unified shell command `aw` installed to `~/.local/bin/` that controls the agent-watcher server (background) and launches the TUI — runnable from any project directory.

## Commands

| Subcommand       | Description                                        |
| ---------------- | -------------------------------------------------- |
| `aw start`       | Start server in background (dev mode: `tsx watch`) |
| `aw stop`        | Stop server via PID file                           |
| `aw restart`     | stop → start                                       |
| `aw status`      | Show running state, PID, and port                  |
| `aw logs`        | Tail server log in real time                       |
| `aw tui [flags]` | Launch TUI; extra flags forwarded to agent-watch   |

## Architecture

### Files Created

```
agent-watcher/
├── scripts/
│   ├── aw          # Main command script
│   └── install.sh  # Installs aw to ~/.local/bin/
```

### Runtime State

| Path                          | Purpose                          |
| ----------------------------- | -------------------------------- |
| `~/.agent-watcher/server.pid` | PID of background server process |
| `~/.agent-watcher/server.log` | Server stdout + stderr           |

### Process Management

- **Start:** `nohup npx tsx watch <project>/server/src/index.ts >> log 2>&1 &` then save `$!` to PID file
- **Stop:** `kill $(cat PID_FILE)` then remove PID file; falls back to `pkill` if PID stale
- **Status:** checks `kill -0 <pid>` liveness + optional HTTP ping to `/api/status`

### Installation

`install.sh` runs from the repo root, bakes the absolute project path into a copy of `aw`, and places it at `~/.local/bin/aw`. One-time setup:

```bash
cd ~/devinu-project/agent-watcher
./scripts/install.sh
```

After that, `aw` is available in any directory without additional PATH changes (assuming `~/.local/bin` is already in PATH, which is standard on most Linux distros).

## Error Handling

- `aw start` when already running → warn and exit 1
- `aw stop` when not running → warn and exit 0 (idempotent)
- `aw tui` checks server health first; exits with helpful message if server is down
- Stale PID file (process died without cleanup) → detect via `kill -0`, clean up automatically

## Non-Goals

- Production build support (out of scope; dev mode only)
- Windows/PowerShell support
- Auto-start on boot

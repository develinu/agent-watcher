# Deployment Guide

## Quick Start (Development)

```bash
npm install
cp .env.example .env
npm run dev
```

Server: http://localhost:3001 | Client: http://localhost:5173

---

## Production Build

```bash
npm run build
```

This builds all three workspaces:

1. `shared/` → `shared/dist/` (TypeScript declarations)
2. `server/` → `server/dist/` (Node.js)
3. `client/` → `client/dist/` (static assets)

### Running Production Server

```bash
node server/dist/index.js
```

The server serves the API on the configured port. You need to serve `client/dist/` separately via a reverse proxy or static file server.

---

## Docker

### Build and Run

```bash
docker compose up -d
```

This mounts `~/.claude` as read-only into the container and exposes port 3001.

### Environment Variables

Pass API keys and settings via environment or `.env` file:

```bash
ANALYSIS_PROVIDER=openai OPENAI_API_KEY=sk-... docker compose up -d
```

### Custom Build

```bash
docker build -t agent-watcher .
docker run -d \
  -p 3001:3001 \
  -v ~/.claude:/root/.claude:ro \
  -e ANALYSIS_PROVIDER=anthropic \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  agent-watcher
```

---

## Reverse Proxy (nginx)

For production, serve the client static files and proxy API/WebSocket to the server:

```nginx
server {
    listen 80;
    server_name agent-watcher.example.com;

    # Client static files
    root /path/to/agent-watcher/client/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

---

## PM2 (Process Manager)

```bash
npm run build

NODE_ENV=production pm2 start server/dist/index.js --name agent-watcher
pm2 save
pm2 startup
```

---

## Environment Variables

| Variable                    | Default        | Description                                   |
| --------------------------- | -------------- | --------------------------------------------- |
| `CLAUDE_DIR`                | `~/.claude`    | Path to Claude Code session directory         |
| `SERVER_PORT`               | `3001`         | Express server port                           |
| `ACTIVE_THRESHOLD_MS`       | `60000`        | Time (ms) to consider a session active        |
| `ANALYSIS_PROVIDER`         | `anthropic`    | LLM provider: `anthropic`, `openai`, `gemini` |
| `ANALYSIS_MODEL`            | (per provider) | Override default model                        |
| `ANTHROPIC_API_KEY`         | —              | Anthropic API key                             |
| `OPENAI_API_KEY`            | —              | OpenAI API key                                |
| `GEMINI_API_KEY`            | —              | Google Gemini API key                         |
| `VITE_ANALYSIS_DEBOUNCE_MS` | `3000`         | Workflow re-analysis debounce (build-time)    |

> `VITE_*` variables are embedded at build time by Vite. Changes require a rebuild.

---

## Built-in Security

The following security measures are enabled automatically:

| Feature                    | Detail                                                           |
| -------------------------- | ---------------------------------------------------------------- |
| **helmet**                 | Security headers (X-Content-Type-Options, X-Frame-Options, etc.) |
| **CORS**                   | Production: disabled. Dev: localhost only                        |
| **Rate limiting**          | API: 120 req/min. `/analyze`: 10 req/min                         |
| **Localhost binding**      | Production binds to `127.0.0.1` (not `0.0.0.0`)                  |
| **WebSocket origin check** | Rejects connections from unknown origins                         |
| **Parameter validation**   | projectId/sessionId validated against safe character pattern     |
| **Graceful shutdown**      | SIGINT + SIGTERM handled, 5s drain timeout                       |

## Additional Security Considerations

- Agent Watcher reads local session files — do **not** expose it to the public internet without authentication
- API keys are stored in `.env` (excluded from git via `.gitignore`)
- Mount `~/.claude` as **read-only** in Docker (`ro` flag)
- Consider adding HTTP basic auth or running behind a VPN for remote access

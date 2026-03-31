# API Reference

Base URL: `http://localhost:3001`

## REST Endpoints

### Status

#### `GET /api/status`

Health check.

**Response:**

```json
{
  "status": "ok",
  "claudeDir": "/home/user/.claude"
}
```

---

### Projects

#### `GET /api/projects`

List all projects.

**Response:** `ProjectSummary[]`

```json
[
  {
    "id": "-home-user-myproject",
    "path": "/home/user/myproject",
    "sessionCount": 5,
    "totalInputTokens": 150000,
    "totalOutputTokens": 45000,
    "lastActiveAt": "2026-03-31T10:00:00Z"
  }
]
```

#### `GET /api/projects/:projectId`

Get project detail with all session summaries.

**Response:** `ProjectDetail`

```json
{
  "id": "-home-user-myproject",
  "path": "/home/user/myproject",
  "sessions": [
    {
      "id": "abc123",
      "projectId": "-home-user-myproject",
      "summary": "Add WebSocket real-time monitoring",
      "messageCount": 24,
      "totalInputTokens": 50000,
      "totalOutputTokens": 12000,
      "model": "claude-sonnet-4-6",
      "isActive": true,
      "startedAt": "2026-03-31T09:00:00Z",
      "lastActiveAt": "2026-03-31T10:00:00Z"
    }
  ]
}
```

---

### Sessions

All session endpoints require `?projectId=<id>` query parameter.

#### `GET /api/sessions/:sessionId?projectId=<id>`

Get full session with messages and subagents.

**Response:** `Session`

```json
{
  "id": "abc123",
  "projectId": "-home-user-myproject",
  "summary": "Add WebSocket real-time monitoring",
  "messageCount": 24,
  "messages": [
    {
      "uuid": "msg-1",
      "type": "user",
      "timestamp": "2026-03-31T09:00:00Z",
      "content": "Add real-time updates",
      "isSidechain": false
    },
    {
      "uuid": "msg-2",
      "type": "assistant",
      "timestamp": "2026-03-31T09:00:05Z",
      "content": [{ "type": "text", "text": "I'll implement..." }],
      "model": "claude-sonnet-4-6",
      "usage": {
        "input_tokens": 5000,
        "output_tokens": 1200
      },
      "isSidechain": false
    }
  ],
  "subagents": [
    {
      "agentId": "agent-xyz",
      "agentType": "code-reviewer",
      "description": "Review code changes",
      "messageCount": 8,
      "totalInputTokens": 10000,
      "totalOutputTokens": 3000
    }
  ]
}
```

#### `GET /api/sessions/:sessionId/timeline?projectId=<id>`

Get cumulative token usage timeline for charting.

**Response:** `SessionTokenTimeline`

```json
{
  "sessionId": "abc123",
  "points": [
    {
      "timestamp": "2026-03-31T09:00:05Z",
      "cumulativeInput": 5000,
      "cumulativeOutput": 1200,
      "model": "claude-sonnet-4-6"
    },
    {
      "timestamp": "2026-03-31T09:01:10Z",
      "cumulativeInput": 12000,
      "cumulativeOutput": 3500,
      "model": "claude-sonnet-4-6"
    }
  ]
}
```

#### `GET /api/sessions/:sessionId/analyze?projectId=<id>`

AI-powered workflow phase analysis. Requires a configured LLM provider API key.

**Response:** `SessionAnalysis`

```json
{
  "sessionId": "abc123",
  "phases": [
    {
      "id": "p0",
      "turnIndices": [0, 1, 2],
      "phaseType": "feature",
      "title": "WebSocket server setup",
      "summary": "Implement WebSocket broadcaster with chokidar file watcher",
      "dependsOn": []
    },
    {
      "id": "p1",
      "turnIndices": [3, 4],
      "phaseType": "test",
      "title": "Add unit tests",
      "summary": "Write vitest tests for WebSocket and file watcher",
      "dependsOn": ["p0"]
    }
  ],
  "analyzedAt": "2026-03-31T10:05:00Z"
}
```

**Error (503):** LLM provider not configured

```json
{ "error": "ANTHROPIC_API_KEY not configured" }
```

---

### Analytics

#### `GET /api/analytics/tokens?from=<date>&to=<date>`

Token usage analytics with optional date range filter.

**Query parameters:**

- `from` (optional): ISO date string, e.g. `2026-03-01`
- `to` (optional): ISO date string, e.g. `2026-03-31`

**Response:** `TokenAnalytics`

```json
{
  "daily": [
    {
      "date": "2026-03-31",
      "totalInput": 250000,
      "totalOutput": 75000,
      "models": {
        "claude-sonnet-4-6": { "input": 200000, "output": 60000 },
        "claude-haiku-4-5-20251001": { "input": 50000, "output": 15000 }
      }
    }
  ],
  "totalCost": 1.85
}
```

#### `GET /api/analytics/active`

Currently active sessions.

**Response:**

```json
[{ "sessionId": "abc123", "projectId": "-home-user-myproject" }]
```

---

## WebSocket Events

Connect to `ws://localhost:3001/ws` for real-time updates.

All messages are JSON-encoded `WsEvent` objects with a `type` discriminator.

### `session:update`

Pushed when new messages are written to a session file.

```json
{
  "type": "session:update",
  "projectId": "-home-user-myproject",
  "sessionId": "abc123",
  "newMessages": [
    { "uuid": "msg-5", "type": "assistant", "timestamp": "...", "content": [...] }
  ],
  "tokenDelta": {
    "input": 3000,
    "output": 800
  }
}
```

### `session:new`

Pushed when a new session file is detected.

```json
{
  "type": "session:new",
  "projectId": "-home-user-myproject",
  "session": { "id": "def456", "summary": "...", "...": "..." }
}
```

### `session:active`

Broadcasted every 10 seconds with the list of currently active sessions.

```json
{
  "type": "session:active",
  "activeSessions": [{ "sessionId": "abc123", "projectId": "-home-user-myproject" }]
}
```

### `analytics:update`

Token usage delta for live analytics updating.

```json
{
  "type": "analytics:update",
  "tokenDelta": { "input": 3000, "output": 800 }
}
```

---

## Error Format

All error responses follow:

```json
{ "error": "Human-readable error message" }
```

| Status | Meaning                          |
| ------ | -------------------------------- |
| 400    | Missing required query parameter |
| 404    | Project or session not found     |
| 500    | Internal server error            |
| 503    | LLM provider not configured      |

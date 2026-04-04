# API Reference

Base URL: `http://localhost:3001`

## REST Endpoints

### Status

#### `GET /api/status`

Health check.

**Response:**

```json
{
  "status": "ok"
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
    "name": "myproject",
    "sessionCount": 5,
    "totalInputTokens": 150000,
    "totalOutputTokens": 45000,
    "lastActiveAt": "2026-03-31T10:00:00Z",
    "activeSessionCount": 1
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
  "name": "myproject",
  "sessionCount": 5,
  "totalInputTokens": 150000,
  "totalOutputTokens": 45000,
  "lastActiveAt": "2026-03-31T10:00:00Z",
  "activeSessionCount": 1,
  "sessions": [
    {
      "id": "abc123",
      "projectId": "-home-user-myproject",
      "aiTitle": "WebSocket real-time monitoring",
      "slug": null,
      "summary": "Add WebSocket real-time monitoring",
      "entrypoint": "claude",
      "cwd": "/home/user/myproject",
      "version": "1.0.26",
      "gitBranch": "main",
      "startedAt": "2026-03-31T09:00:00Z",
      "lastActiveAt": "2026-03-31T10:00:00Z",
      "messageCount": 24,
      "model": "claude-sonnet-4-6",
      "models": ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
      "totalInputTokens": 50000,
      "totalOutputTokens": 12000,
      "totalCacheCreationTokens": 8000,
      "totalCacheReadTokens": 30000,
      "estimatedCost": 0.45,
      "subagentCount": 2,
      "isActive": true
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
  "aiTitle": "WebSocket real-time monitoring",
  "slug": null,
  "summary": "Add WebSocket real-time monitoring",
  "entrypoint": "claude",
  "cwd": "/home/user/myproject",
  "version": "1.0.26",
  "gitBranch": "main",
  "startedAt": "2026-03-31T09:00:00Z",
  "lastActiveAt": "2026-03-31T10:00:00Z",
  "messageCount": 24,
  "model": "claude-sonnet-4-6",
  "models": ["claude-sonnet-4-6"],
  "totalInputTokens": 50000,
  "totalOutputTokens": 12000,
  "totalCacheCreationTokens": 8000,
  "totalCacheReadTokens": 30000,
  "estimatedCost": 0.45,
  "subagentCount": 2,
  "isActive": true,
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
        "output_tokens": 1200,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 3000
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
      "totalOutputTokens": 3000,
      "model": "claude-sonnet-4-6",
      "lastActiveAt": "2026-03-31T09:30:00Z"
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
      "messageIndex": 1,
      "cumulativeInput": 5000,
      "cumulativeOutput": 1200,
      "cumulativeCacheCreation": 0,
      "cumulativeCacheRead": 3000,
      "model": "claude-sonnet-4-6"
    },
    {
      "timestamp": "2026-03-31T09:01:10Z",
      "messageIndex": 3,
      "cumulativeInput": 12000,
      "cumulativeOutput": 3500,
      "cumulativeCacheCreation": 500,
      "cumulativeCacheRead": 8000,
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
      "inputTokens": 250000,
      "outputTokens": 75000,
      "cacheCreationTokens": 15000,
      "cacheReadTokens": 120000,
      "sessionCount": 3
    }
  ],
  "byModel": [
    {
      "model": "claude-sonnet-4-6",
      "inputTokens": 200000,
      "outputTokens": 60000,
      "estimatedCost": 1.5
    },
    {
      "model": "claude-haiku-4-5-20251001",
      "inputTokens": 50000,
      "outputTokens": 15000,
      "estimatedCost": 0.1
    }
  ],
  "totalInput": 250000,
  "totalOutput": 75000,
  "totalEstimatedCost": 1.6
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
    {
      "uuid": "msg-5",
      "type": "assistant",
      "timestamp": "2026-03-31T09:05:00Z",
      "content": [{ "type": "text", "text": "Done." }],
      "model": "claude-sonnet-4-6",
      "usage": { "input_tokens": 3000, "output_tokens": 800 },
      "agentId": null,
      "isSidechain": false
    }
  ],
  "tokenDelta": {
    "input": 3000,
    "output": 800
  }
}
```

### `session:active`

Broadcasted on initial connection and every 10 seconds with the list of currently active sessions.

```json
{
  "type": "session:active",
  "activeSessions": [{ "sessionId": "abc123", "projectId": "-home-user-myproject" }]
}
```

> **Note:** The shared type definitions also include `session:new` and `analytics:update` event types for future extensibility. These are not currently emitted by the server.

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

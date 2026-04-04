# Architecture

## System Overview

```
~/.claude/projects/          Agent Watcher Server           Client (Browser)
 ┌──────────────┐           ┌─────────────────┐           ┌──────────────┐
 │  JSONL logs   │──watch──▶│  FileWatcher     │           │  React SPA   │
 │  (session     │  chokidar│  (100ms debounce)│           │              │
 │   files)      │          │       │          │    WS     │  Dashboard   │
 └──────────────┘          │       ▼          │◀─────────▶│  Project     │
                            │  WsBroadcaster   │   push    │  Session     │
                            │       │          │           │  Analytics   │
                            │       ▼          │   REST    │              │
                            │  Express API     │◀─────────▶│  WorkflowGraph│
                            │  (routes)        │           │  (React Flow)│
                            │       │          │           └──────────────┘
                            │       ▼          │
                            │  LLM Provider    │
                            │  (Anthropic /    │
                            │   OpenAI /       │
                            │   Gemini)        │
                            └─────────────────┘
```

## Monorepo Structure

```
agent-watcher/
├── shared/     # TypeScript types shared between server and client
├── server/     # Express backend + file watcher + WebSocket
└── client/     # React frontend (Vite)
```

All three packages are linked via npm workspaces. `shared` is built first and imported by both `server` and `client`.

## Data Flow

### 1. File Watch → Real-time Push

```
Claude Code writes JSONL ──▶ chokidar detects change
                                     │
                              100ms debounce
                                     │
                              parseJsonlTail()  ── reads only new bytes (offset tracking)
                                     │
                              WsBroadcaster.broadcast()
                                     │
                              WebSocket push ──▶ Client hooks update state
```

- **chokidar** watches `~/.claude/projects/` with `depth: 4`
- **Tail parsing** avoids re-reading entire files; tracks byte offsets per file
- **Debounce** (100ms) batches rapid writes within a single Claude Code turn

### 2. REST API Request

```
Client page load ──▶ GET /api/projects ──▶ project-service (parallel)
                     GET /api/sessions/:id ──▶ cache check ──▶ parseJsonlFile() if miss
                     GET /api/sessions/:id/analyze ──▶ LLM analysis (cached)
```

#### Caching Strategy

```
Request ──▶ Memory cache hit? ──yes──▶ return (stat validated)
                  │ no
            Disk cache hit?   ──yes──▶ promote to memory, return
                  │ no
            Parse JSONL ──▶ generate summary ──▶ populate both caches
                                │
                         LLM cache hit? ──yes──▶ use LLM summary
                                │ no
                         return fallback + fire background LLM
```

- **Memory cache** — `Map<sessionId, {summary, fileSize, mtimeMs}>`, validated by `stat()`
- **Disk cache** — `~/.claude/.agent-watcher/summary-cache/{sessionId}.json`, survives restarts
- **Invalidation** — `WsBroadcaster` evicts memory cache on `session-updated` events
- **Parallelism** — Projects (6), sessions (10), subagents (8) loaded concurrently via `parallelMap`

### 3. Workflow Analysis

```
New messages arrive (WebSocket) ──▶ SessionWorkflow detects length change
                                           │
                                    debounce (VITE_ANALYSIS_DEBOUNCE_MS)
                                           │
                                    GET /api/sessions/:id/analyze
                                           │
                                    ┌──────┴──────┐
                                    │ Cache hit?   │
                                    └──────┬──────┘
                                     yes   │   no
                                     │     │
                              return cache │
                                           │
                                    ┌──────┴──────────┐
                                    │ Has prior phases?│
                                    └──────┬──────────┘
                                     yes   │   no
                                     │     │
                              incremental  full
                              analysis     analysis
                                     │     │
                                     ▼     ▼
                              LLM Provider (callLlm)
                                     │
                              Cache result to disk
```

- **Cache**: stored at `~/.claude/.agent-watcher/analysis/{sessionId}_analysis.json`
- **Incremental**: only sends new turns + last phase context to LLM
- **Fallback**: if no API key, uses regex-based phase detection (git commit boundaries + time gaps)

## Module Map

### Server

| Module                          | Responsibility                                           |
| ------------------------------- | -------------------------------------------------------- |
| `config.ts`                     | Environment variables, model pricing, cost estimation    |
| `middleware/validate-params.ts` | Parameter validation (projectId, sessionId regex check)  |
| `routes/projects.ts`            | `GET /api/projects`, `GET /api/projects/:id`             |
| `routes/sessions.ts`            | `GET /api/sessions/:id`, `/timeline`, `/analyze`         |
| `routes/analytics.ts`           | `GET /api/analytics/tokens`, `/active`                   |
| `services/project-service.ts`   | Scans filesystem, builds project index (parallel)        |
| `services/session-service.ts`   | Parses sessions, two-tier caching, summary generation    |
| `services/file-scanner.ts`      | Project/session/subagent filesystem scanning             |
| `services/jsonl-parser.ts`      | JSONL parsing (full + tail with offset tracking)         |
| `services/llm-provider.ts`      | Multi-provider LLM abstraction (Anthropic/OpenAI/Gemini) |
| `services/llm-analyzer.ts`      | Workflow phase analysis, session summaries               |
| `services/analytics-service.ts` | Token analytics, cost aggregation                        |
| `services/active-detector.ts`   | Active session detection                                 |
| `watchers/file-watcher.ts`      | chokidar filesystem watcher with debounce                |
| `watchers/ws-broadcaster.ts`    | WebSocket server, event broadcasting                     |

### Client

| Module                                 | Responsibility                                  |
| -------------------------------------- | ----------------------------------------------- |
| `pages/DashboardPage`                  | Project list overview                           |
| `pages/ProjectPage`                    | Single project with session list/workflow graph |
| `pages/SessionPage`                    | Session detail with phase workflow graph        |
| `pages/AnalyticsPage`                  | Token usage charts and cost analysis            |
| `components/workflow/WorkflowGraph`    | Core React Flow graph renderer                  |
| `components/workflow/PhaseNode`        | Phase node in session workflow                  |
| `components/workflow/SessionFlowNode`  | Session node in project workflow                |
| `components/workflow/SessionWorkflow`  | Session-level phase visualization               |
| `components/workflow/ProjectWorkflow`  | Project-level session visualization             |
| `components/workflow/DetailPanel`      | Phase/session detail sidebar                    |
| `components/workflow/AutoFollowToggle` | Auto-focus toggle for latest node               |
| `components/common/Badge`              | Status badge with color variants                |
| `components/common/StatusIndicator`    | Active/inactive status dot                      |
| `components/common/LoadingSpinner`     | Loading state indicator                         |
| `components/layout/Layout`             | Root layout with sidebar                        |
| `components/layout/Sidebar`            | Navigation sidebar with connection status       |
| `hooks/useWebSocket`                   | WebSocket connection with auto-reconnect        |
| `hooks/useWsContext`                   | WebSocket React context provider/consumer       |
| `lib/api.ts`                           | Typed HTTP client for REST API                  |
| `lib/workflow-graph.ts`                | Phase detection, graph layout (dagre)           |
| `lib/cost-calculator.ts`               | Client-side cost estimation                     |
| `lib/format.ts`                        | Number/date formatting utilities                |

### Shared Types

| File           | Types                                                                                                                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session.ts`   | `JournalRecord`, `UserRecord`, `AssistantRecord`, `SystemRecord`, `AiTitleRecord`, `FileHistorySnapshot`, `QueueOperationRecord`, `TokenUsage`, `ContentBlock` (`TextBlock`, `ToolUseBlock`, `ToolResultBlock`, `ThinkingBlock`), `AssistantMessage` |
| `analytics.ts` | `Session`, `SessionSummary`, `ParsedMessage`, `Subagent`, `SubagentMeta`, `CostRecord`, `TokenAnalytics`, `CostAnalytics`, `SessionTokenTimeline`, `TokenTimelinePoint`, `DailyTokenUsage`, `ModelBreakdown`, `ModelPricing`                         |
| `project.ts`   | `Project`, `ProjectSummary`, `ProjectDetail`                                                                                                                                                                                                         |
| `phase.ts`     | `PhaseType`, `AnalyzedPhase`, `SessionAnalysis`                                                                                                                                                                                                      |
| `events.ts`    | `WsEvent`, `SessionUpdateEvent`, `SessionNewEvent`, `ActiveSessionsEvent`, `AnalyticsUpdateEvent`                                                                                                                                                    |

## Key Design Decisions

1. **Filesystem as source of truth** — No database. All data is derived from Claude Code's JSONL logs at `~/.claude`.
2. **Tail parsing with offset tracking** — Avoids re-parsing entire session files on every change.
3. **Incremental LLM analysis** — Only new turns are sent to the LLM, with previous phase context for continuity.
4. **Persistent analysis cache** — LLM results cached to disk, keyed by session ID and turn count.
5. **Provider abstraction** — LLM provider is swappable via environment variable without code changes.
6. **Regex fallback** — Workflow detection works without any API key using git commit boundaries and time gaps.
7. **Two-tier session cache** — Memory (stat-validated) + disk (restart-safe) caching eliminates redundant JSONL parsing.
8. **Non-blocking LLM summaries** — Regex fallback returned immediately; LLM results populate cache in the background.
9. **Parallel data loading** — Concurrent `parallelMap` with bounded workers prevents sequential I/O bottlenecks.
10. **Language auto-detection** — Unicode range detection (Korean, Japanese, Chinese) injects explicit language constraints into LLM prompts.

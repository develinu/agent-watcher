# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Session summary caching** — Two-tier cache (memory + disk) validated by file stat; eliminates redundant JSONL parsing on repeated requests and survives server restarts
- **Parallel data loading** — Project, session, and subagent loops now use concurrent `parallelMap` (6/10/8 workers) instead of sequential `for...of`
- **Non-blocking LLM summaries** — Summary requests return regex fallback immediately; LLM results are generated in the background and served on the next request
- **Cache invalidation** — WebSocket file-change events automatically evict stale session summary caches
- **Language-aware LLM prompts** — Auto-detect user language (Korean/Japanese/Chinese) from messages and inject explicit language constraint into all LLM prompts (workflow phases, session summaries)

## [0.1.0] - 2026-03-31

### Added

- Real-time session monitoring via filesystem watch + WebSocket push
- Project and session listing from `~/.claude/projects/`
- Session detail view with message timeline
- Workflow visualization with interactive flow diagrams (React Flow + dagre)
- AI-powered workflow phase analysis (incremental + full)
  - Phase types: feature, bugfix, refactor, debug, review, config, docs, test, explore, planning, commit, chore
  - Persistent file-based analysis cache
- Multi-provider LLM support (Anthropic, OpenAI, Google Gemini)
  - Default models: claude-haiku-4-5, gpt-4o-mini, gemini-2.0-flash
- Token usage and cost tracking per session and model
- Analytics dashboard with daily token trends and cost breakdown
- Active session detection with configurable threshold
- Auto-follow toggle for workflow graph (focus latest node)
- Configurable analysis debounce via `VITE_ANALYSIS_DEBOUNCE_MS`
- Multi-language support (Korean NLP normalization + language-adaptive LLM prompts)
- Regex-based fallback when LLM analysis is unavailable
- Docker support (multi-stage Dockerfile + docker-compose)
- GitHub Actions CI (Node 18/20/22 matrix)
- ESLint + Prettier + Husky pre-commit hooks

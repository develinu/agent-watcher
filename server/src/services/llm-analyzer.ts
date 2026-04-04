import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  JournalRecord,
  PhaseType,
  AnalyzedPhase,
  SessionAnalysis,
} from "@agent-watcher/shared";
import { config } from "../config.js";
import { callLlm, isAnalysisAvailable } from "./llm-provider.js";

// ─── Persistent file cache ─────────────────────────────────

function getCacheDir(): string {
  return join(config.claudeDir, ".agent-watcher", "analysis");
}

async function ensureCacheDir(): Promise<void> {
  await mkdir(getCacheDir(), { recursive: true });
}

interface CachedAnalysis {
  readonly analysis: SessionAnalysis;
  readonly turnCount: number;
}

function analysisCachePath(sessionId: string): string {
  return join(getCacheDir(), `${sessionId}_analysis.json`);
}

async function readCachedAnalysis(sessionId: string): Promise<CachedAnalysis | null> {
  try {
    const data = await readFile(analysisCachePath(sessionId), "utf-8");
    return JSON.parse(data) as CachedAnalysis;
  } catch {
    return null;
  }
}

async function writeCachedAnalysis(cached: CachedAnalysis): Promise<void> {
  await ensureCacheDir();
  await writeFile(
    analysisCachePath(cached.analysis.sessionId),
    JSON.stringify(cached, null, 2),
    "utf-8"
  );
}

// ─── Turn condensation ─────────────────────────────────────

interface CondensedTurn {
  readonly index: number;
  readonly userMessage: string;
  readonly toolsUsed: readonly string[];
  readonly filesChanged: readonly string[];
  readonly hasGitCommit: boolean;
  readonly commitMessage: string | null;
  readonly hasSubagent: boolean;
  readonly subagentType: string | null;
  readonly timestamp: string;
}

function stripSystemTags(text: string): string {
  return text
    .replace(/<[a-z-]+[\s\S]*?<\/[a-z-]+>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}

function extractUserText(record: JournalRecord): string {
  if (record.type !== "user") return "";
  const content = record.message.content;
  if (typeof content === "string") return stripSystemTags(content);
  return content
    .filter((b) => b.type === "text")
    .map((b) => stripSystemTags((b as { type: "text"; text: string }).text))
    .filter((t) => t.length > 0)
    .join(" ");
}

function condenseTurns(records: readonly JournalRecord[]): readonly CondensedTurn[] {
  const turns: CondensedTurn[] = [];
  let current: {
    userMessage: string;
    toolsUsed: Set<string>;
    filesChanged: Set<string>;
    hasGitCommit: boolean;
    commitMessage: string | null;
    hasSubagent: boolean;
    subagentType: string | null;
    timestamp: string;
  } | null = null;

  function flush() {
    if (!current) return;
    turns.push({
      index: turns.length,
      userMessage: current.userMessage.slice(0, 200),
      toolsUsed: [...current.toolsUsed],
      filesChanged: [...current.filesChanged],
      hasGitCommit: current.hasGitCommit,
      commitMessage: current.commitMessage,
      hasSubagent: current.hasSubagent,
      subagentType: current.subagentType,
      timestamp: current.timestamp,
    });
    current = null;
  }

  for (const record of records) {
    if (record.type === "user" && !record.isSidechain) {
      flush();
      current = {
        userMessage: extractUserText(record),
        toolsUsed: new Set(),
        filesChanged: new Set(),
        hasGitCommit: false,
        commitMessage: null,
        hasSubagent: false,
        subagentType: null,
        timestamp: record.timestamp,
      };
    } else if (record.type === "assistant" && !record.isSidechain && current) {
      for (const block of record.message.content) {
        if (block.type === "tool_use") {
          current.toolsUsed.add(block.name);
          const input = block.input as Record<string, unknown>;

          if (
            ["Edit", "Write", "Read"].includes(block.name) &&
            typeof input.file_path === "string"
          ) {
            const parts = (input.file_path as string).split("/");
            current.filesChanged.add(parts.slice(-2).join("/"));
          }

          if (block.name === "Bash" && typeof input.command === "string") {
            if (input.command.includes("git commit")) {
              current.hasGitCommit = true;
              const heredoc = input.command.match(
                /git commit.*?-m\s+"\$\(cat\s+<<['"]?EOF['"]?\s*\n([\s\S]*?)\n\s*EOF/
              );
              if (heredoc) {
                current.commitMessage = heredoc[1].trim().split("\n")[0];
              } else {
                const simple = input.command.match(/git commit.*?-m\s+["']([^"']+)["']/);
                if (simple) current.commitMessage = simple[1];
              }
            }
          }

          if (block.name === "Agent") {
            current.hasSubagent = true;
            if (typeof input.subagent_type === "string") {
              current.subagentType = input.subagent_type;
            }
          }
        }
      }
      if (record.agentId) {
        current.hasSubagent = true;
      }
    }
  }
  flush();

  return turns;
}

// ─── Language detection ───────────────────────────────────

function containsKorean(text: string): boolean {
  return /[\uAC00-\uD7A3]/.test(text);
}

function containsJapanese(text: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF]/.test(text);
}

function containsChinese(text: string): boolean {
  return /[\u4E00-\u9FFF]/.test(text) && !containsJapanese(text);
}

type DetectedLang = "ko" | "ja" | "zh" | "en";

function detectLanguage(texts: readonly string[]): DetectedLang {
  const joined = texts.join(" ");
  if (containsKorean(joined)) return "ko";
  if (containsJapanese(joined)) return "ja";
  if (containsChinese(joined)) return "zh";
  return "en";
}

const LANG_NAMES: Record<DetectedLang, string> = {
  ko: "Korean",
  ja: "Japanese",
  zh: "Chinese",
  en: "English",
};

function langInstruction(lang: DetectedLang): string {
  if (lang === "en") return "";
  return `\n\n⚠️ CRITICAL: The user messages are in ${LANG_NAMES[lang]}. You MUST write ALL summaries and titles in ${LANG_NAMES[lang]}. Do NOT use English.`;
}

// ─── Prompts ───────────────────────────────────────────────

const PHASE_TYPES: readonly PhaseType[] = [
  "feature",
  "bugfix",
  "refactor",
  "debug",
  "review",
  "config",
  "docs",
  "test",
  "explore",
  "planning",
  "commit",
  "chore",
];

function turnsToJson(turns: readonly CondensedTurn[]) {
  return turns.map((t) => ({
    i: t.index,
    user: t.userMessage,
    tools: t.toolsUsed,
    files: t.filesChanged,
    commit: t.hasGitCommit ? (t.commitMessage ?? true) : undefined,
    agent: t.hasSubagent ? (t.subagentType ?? true) : undefined,
    ts: t.timestamp,
  }));
}

function buildFullPrompt(turns: readonly CondensedTurn[], lang: DetectedLang): string {
  return `You are a workflow analyzer for a Claude Code session. Analyze the conversation turns and group them into semantic phases that represent distinct units of work.

## Input
A JSON array of conversation turns from a coding session:
${JSON.stringify(turnsToJson(turns), null, 2)}

## Task
1. **Group turns into phases** — each phase is a coherent unit of work. Consider:
   - Semantic shifts: when the user switches to a different task
   - Git commits naturally end a phase
   - Subagent work (agent field) may represent parallel branches
   - Don't split too finely — group related turns together for readability

2. **Classify each phase** with one of: ${PHASE_TYPES.join(", ")}
   - feature: implementing new functionality
   - bugfix: fixing a bug or error
   - refactor: restructuring existing code without changing behavior
   - debug: investigating issues, reading logs, diagnosing problems
   - review: code review, PR review
   - config: setup, configuration, environment changes
   - docs: documentation updates
   - test: writing or fixing tests
   - explore: exploring codebase, research, reading code
   - planning: discussing plans, architecture, design decisions
   - commit: git commit (use only when the phase is primarily about committing)
   - chore: maintenance, cleanup, dependency updates

3. **Generate a concise summary** for each phase as a bullet-point style phrase (not a sentence). Examples:
   - "Implement JWT auth middleware validation"
   - "Unify API response format and improve error handling"
   - "인증 미들웨어 JWT 검증 로직 구현"
   - "API 응답 포맷 통일 및 에러 핸들링 개선"
   Match the language of the user messages (Korean summary for Korean input, English for English, etc.).

4. **Identify dependencies** — if phases branch (e.g., parallel subagent work) or must follow a sequence, express this via dependsOn.

## Output
Return ONLY a JSON array (no markdown fence, no explanation):
[
  {
    "id": "p0",
    "turnIndices": [0, 1, 2],
    "phaseType": "feature",
    "title": "Short title",
    "summary": "Bullet-point summary",
    "dependsOn": []
  }
]

Rules:
- Every turn index must appear in exactly one phase
- Turn indices within a phase must be contiguous unless representing branched work
- dependsOn references other phase ids (use [] for the first phase)
- Keep titles under 60 characters
- Summaries should be concise bullet-point style (no period at end)${langInstruction(lang)}`;
}

function buildIncrementalPrompt(
  previousPhases: readonly AnalyzedPhase[],
  lastPhaseTurns: readonly CondensedTurn[],
  newTurns: readonly CondensedTurn[],
  lang: DetectedLang
): string {
  const phasesSummary = previousPhases.map((p) => ({
    id: p.id,
    type: p.phaseType,
    title: p.title,
    turns: `${p.turnIndices[0]}-${p.turnIndices[p.turnIndices.length - 1]}`,
  }));

  const lastPhase = previousPhases[previousPhases.length - 1];

  return `You are a workflow analyzer for a Claude Code session. New conversation turns have been added to an ongoing session. Decide how they relate to the existing workflow.

## Existing phases (already analyzed)
${JSON.stringify(phasesSummary, null, 2)}

## Last phase detail
ID: ${lastPhase.id}
Type: ${lastPhase.phaseType}
Title: ${lastPhase.title}
Summary: ${lastPhase.summary}
Recent turns in this phase:
${JSON.stringify(turnsToJson(lastPhaseTurns), null, 2)}

## New turns (to be classified)
${JSON.stringify(turnsToJson(newTurns), null, 2)}

## Task
Decide how the new turns fit into the workflow:

1. **Should any new turns be merged into the last phase ("${lastPhase.title}")?**
   - Merge if they continue the same unit of work
   - Don't merge if the user switched to a different task

2. **Create new phases for remaining turns** using the same rules:
   - Phase types: ${PHASE_TYPES.join(", ")}
   - Concise bullet-point summary (match the language of the user messages)
   - dependsOn should reference "${lastPhase.id}" or other new phase ids

## Output
Return ONLY a JSON object (no markdown fence, no explanation):
{
  "lastPhaseUpdate": {
    "mergedTurnIndices": [],
    "summary": "updated summary if turns were merged, or original summary if not"
  },
  "newPhases": [
    {
      "id": "p${previousPhases.length}",
      "turnIndices": [10, 11],
      "phaseType": "test",
      "title": "Short title",
      "summary": "Bullet-point summary",
      "dependsOn": ["${lastPhase.id}"]
    }
  ]
}

Rules:
- lastPhaseUpdate.mergedTurnIndices: turn indices from new turns that merge into the last phase (can be empty [])
- Every new turn index must appear in either mergedTurnIndices or exactly one newPhases entry
- Keep titles under 60 characters
- Summaries should be concise bullet-point style (no period at end)${langInstruction(lang)}`;
}

// ─── Response parsing ──────────────────────────────────────

function cleanJsonResponse(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();
}

/**
 * Attempt to repair truncated/malformed JSON from LLM output.
 * Handles: trailing commas, unterminated strings, unclosed brackets/braces.
 */
function repairJson(text: string): string {
  let s = text;

  // Remove trailing commas before ] or }
  s = s.replace(/,\s*([}\]])/g, "$1");

  // Track open brackets to detect truncation
  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "[" || ch === "{") stack.push(ch);
    else if (ch === "]" || ch === "}") stack.pop();
  }

  // Close unterminated string
  if (inString) {
    // Trim back to the last complete key-value pair
    const lastQuote = s.lastIndexOf('"');
    if (lastQuote > 0) {
      // Find the last complete entry by looking for the last '}' or ']' before this quote
      const lastCloseBrace = s.lastIndexOf("}", lastQuote);
      const lastCloseBracket = s.lastIndexOf("]", lastQuote);
      const cutPoint = Math.max(lastCloseBrace, lastCloseBracket);
      if (cutPoint > 0) {
        s = s.slice(0, cutPoint + 1);
        // Recalculate stack
        inString = false;
        escape = false;
        stack.length = 0;
        for (let i = 0; i < s.length; i++) {
          const ch = s[i];
          if (escape) {
            escape = false;
            continue;
          }
          if (ch === "\\") {
            escape = true;
            continue;
          }
          if (ch === '"') {
            inString = !inString;
            continue;
          }
          if (inString) continue;
          if (ch === "[" || ch === "{") stack.push(ch);
          else if (ch === "]" || ch === "}") stack.pop();
        }
      } else {
        s += '"';
      }
    }
  }

  // Remove dangling comma after trim
  s = s.replace(/,\s*$/, "");

  // Close remaining open brackets/braces
  while (stack.length > 0) {
    const open = stack.pop();
    s += open === "[" ? "]" : "}";
  }

  return s;
}

function safeJsonParse(text: string): unknown {
  const cleaned = cleanJsonResponse(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    return JSON.parse(repairJson(cleaned));
  }
}

function parseFullResponse(text: string): readonly AnalyzedPhase[] {
  const raw: unknown = safeJsonParse(text);
  if (!Array.isArray(raw)) {
    throw new Error("LLM response is not an array");
  }

  return raw.map(
    (item: {
      id: string;
      turnIndices: number[];
      phaseType: string;
      title: string;
      summary: string;
      dependsOn: string[];
    }) => ({
      id: String(item.id),
      turnIndices: item.turnIndices,
      phaseType: PHASE_TYPES.includes(item.phaseType as PhaseType)
        ? (item.phaseType as PhaseType)
        : "chore",
      title: String(item.title),
      summary: String(item.summary),
      dependsOn: item.dependsOn ?? [],
    })
  );
}

interface IncrementalResponse {
  readonly lastPhaseUpdate: {
    readonly mergedTurnIndices: readonly number[];
    readonly summary: string;
  };
  readonly newPhases: readonly AnalyzedPhase[];
}

function parseIncrementalResponse(text: string): IncrementalResponse {
  const raw = safeJsonParse(text) as {
    lastPhaseUpdate: { mergedTurnIndices: number[]; summary: string };
    newPhases: Array<{
      id: string;
      turnIndices: number[];
      phaseType: string;
      title: string;
      summary: string;
      dependsOn: string[];
    }>;
  };

  return {
    lastPhaseUpdate: {
      mergedTurnIndices: raw.lastPhaseUpdate?.mergedTurnIndices ?? [],
      summary: raw.lastPhaseUpdate?.summary ?? "",
    },
    newPhases: (raw.newPhases ?? []).map((item) => ({
      id: String(item.id),
      turnIndices: item.turnIndices,
      phaseType: PHASE_TYPES.includes(item.phaseType as PhaseType)
        ? (item.phaseType as PhaseType)
        : "chore",
      title: String(item.title),
      summary: String(item.summary),
      dependsOn: item.dependsOn ?? [],
    })),
  };
}

// ─── Merge logic ───────────────────────────────────────────

function mergeIncrementalResult(
  previousPhases: readonly AnalyzedPhase[],
  incremental: IncrementalResponse
): readonly AnalyzedPhase[] {
  const merged = [...previousPhases];

  // Update last phase if turns were merged
  const lastIdx = merged.length - 1;
  const lastPhase = merged[lastIdx];

  if (incremental.lastPhaseUpdate.mergedTurnIndices.length > 0) {
    merged[lastIdx] = {
      ...lastPhase,
      turnIndices: [...lastPhase.turnIndices, ...incremental.lastPhaseUpdate.mergedTurnIndices],
      summary: incremental.lastPhaseUpdate.summary || lastPhase.summary,
    };
  }

  // Append new phases
  for (const newPhase of incremental.newPhases) {
    merged.push(newPhase);
  }

  return merged;
}

// ─── Main entry point ──────────────────────────────────────

export async function analyzeSession(
  sessionId: string,
  records: readonly JournalRecord[]
): Promise<SessionAnalysis> {
  const turns = condenseTurns(records);

  if (turns.length === 0) {
    const empty: SessionAnalysis = {
      sessionId,
      phases: [],
      analyzedAt: new Date().toISOString(),
    };
    return empty;
  }

  const cached = await readCachedAnalysis(sessionId);

  // Cache hit — no new turns
  if (cached && cached.turnCount === turns.length) {
    return cached.analysis;
  }

  const lang = detectLanguage(turns.map((t) => t.userMessage));
  let phases: readonly AnalyzedPhase[];

  // Incremental analysis — previous analysis exists with fewer turns
  if (cached && cached.turnCount < turns.length && cached.analysis.phases.length > 0) {
    phases = await runIncrementalAnalysis(cached.analysis.phases, cached.turnCount, turns, lang);
  } else {
    // Full analysis — first time or cache is invalid
    const text = await callLlm(buildFullPrompt(turns, lang), 4096);
    phases = parseFullResponse(text);
  }

  const result: SessionAnalysis = {
    sessionId,
    phases,
    analyzedAt: new Date().toISOString(),
  };

  await writeCachedAnalysis({ analysis: result, turnCount: turns.length });
  return result;
}

async function runIncrementalAnalysis(
  previousPhases: readonly AnalyzedPhase[],
  previousTurnCount: number,
  allTurns: readonly CondensedTurn[],
  lang: DetectedLang
): Promise<readonly AnalyzedPhase[]> {
  const newTurns = allTurns.slice(previousTurnCount);
  if (newTurns.length === 0) return previousPhases;

  // Get last few turns from the last phase for context
  const lastPhase = previousPhases[previousPhases.length - 1];
  const lastPhaseTurnIndices = lastPhase.turnIndices;
  const contextStartIdx = Math.max(
    lastPhaseTurnIndices[0],
    lastPhaseTurnIndices[lastPhaseTurnIndices.length - 1] - 2
  );
  const lastPhaseTurns = allTurns.slice(contextStartIdx, previousTurnCount);

  const prompt = buildIncrementalPrompt(previousPhases, lastPhaseTurns, newTurns, lang);
  const text = await callLlm(prompt, 2048);
  const incremental = parseIncrementalResponse(text);

  return mergeIncrementalResult(previousPhases, incremental);
}

// ─── Session summary ───────────────────────────────────────

async function readCachedSummary(sessionId: string, messageCount: number): Promise<string | null> {
  try {
    const path = join(getCacheDir(), `${sessionId}_${messageCount}_summary.txt`);
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

async function writeCachedSummary(
  sessionId: string,
  messageCount: number,
  summary: string
): Promise<void> {
  await ensureCacheDir();
  const path = join(getCacheDir(), `${sessionId}_${messageCount}_summary.txt`);
  await writeFile(path, summary, "utf-8");
}

/**
 * Returns cached LLM summary if available. Does NOT trigger LLM call.
 * Use this in the hot path (project/session listing) to avoid blocking.
 */
export async function generateSessionSummaryLlm(
  sessionId: string,
  records: readonly JournalRecord[]
): Promise<string | null> {
  if (!isAnalysisAvailable()) return null;

  const messageCount = records.filter((r) => r.type === "user" || r.type === "assistant").length;
  return readCachedSummary(sessionId, messageCount);
}

// Track in-flight LLM summary requests to prevent duplicates
const inflightSummaries = new Set<string>();

/**
 * Generate LLM summary in the background (fire-and-forget).
 * Skips if already cached or if a request is in-flight.
 */
export async function generateSessionSummaryLlmBackground(
  sessionId: string,
  records: readonly JournalRecord[]
): Promise<void> {
  if (!isAnalysisAvailable()) return;

  const messageCount = records.filter((r) => r.type === "user" || r.type === "assistant").length;

  const cached = await readCachedSummary(sessionId, messageCount);
  if (cached) return;

  const key = `${sessionId}_${messageCount}`;
  if (inflightSummaries.has(key)) return;
  inflightSummaries.add(key);

  try {
    const userMessages: string[] = [];
    for (const record of records) {
      if (record.type === "user" && !record.isSidechain) {
        const text = extractUserText(record);
        if (text.length > 0) {
          userMessages.push(text.slice(0, 150));
        }
      }
    }

    if (userMessages.length === 0) return;

    const lang = detectLanguage(userMessages);

    const summary = await callLlm(
      `Summarize this coding session in ONE concise bullet-point phrase (not a sentence, no period).
Match the language of the user messages (Korean for Korean, English for English, etc.).
Keep it under 80 characters. Focus on what was accomplished, not process.

Examples:
- "Add WebSocket real-time session monitoring"
- "Fix authentication middleware token validation"
- "JWT 인증 미들웨어 구현 및 세션 관리 추가"
- "API 응답 포맷 통일, 에러 핸들링 개선"

User messages from the session:
${userMessages.map((m, i) => `[${i + 1}] ${m}`).join("\n")}

Return ONLY the summary phrase, nothing else.${langInstruction(lang)}`,
      256
    );

    const trimmed = summary.trim();
    if (trimmed.length > 0) {
      await writeCachedSummary(sessionId, messageCount, trimmed);
    }
  } finally {
    inflightSummaries.delete(key);
  }
}

export { isAnalysisAvailable } from "./llm-provider.js";

import type {
  ParsedMessage,
  ContentBlock,
  SessionAnalysis,
  PhaseType,
} from "@agent-watcher/shared";

// ─── Helpers (ported from client/src/lib/workflow-graph.ts) ───

function extractToolCalls(
  content: string | readonly ContentBlock[]
): readonly { name: string; input: Record<string, unknown> }[] {
  if (typeof content === "string") return [];
  return content
    .filter(
      (b): b is ContentBlock & { type: "tool_use"; name: string; input: Record<string, unknown> } =>
        b.type === "tool_use"
    )
    .map((b) => ({ name: b.name, input: b.input }));
}

function extractFilePaths(
  toolCalls: readonly { name: string; input: Record<string, unknown> }[]
): readonly string[] {
  const paths = new Set<string>();
  for (const tc of toolCalls) {
    if (["Edit", "Write", "Read"].includes(tc.name) && typeof tc.input?.file_path === "string") {
      const parts = tc.input.file_path.split("/");
      paths.add(parts.slice(-2).join("/"));
    }
  }
  return [...paths];
}

// ─── Turn ───────────────────────────────────────────────────

export interface Turn {
  readonly index: number;
  readonly userMessage: ParsedMessage | null;
  readonly assistantMessages: readonly ParsedMessage[];
  readonly toolCalls: readonly { name: string; input: Record<string, unknown> }[];
  readonly subagentIds: ReadonlySet<string>;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly timestamp: string;
}

export function groupMessagesIntoTurns(messages: readonly ParsedMessage[]): readonly Turn[] {
  const mainMessages = messages.filter((m) => m.type !== "system" && !m.isSidechain);
  const turns: Turn[] = [];
  let current: {
    userMessage: ParsedMessage | null;
    assistantMessages: ParsedMessage[];
    toolCalls: { name: string; input: Record<string, unknown> }[];
    subagentIds: Set<string>;
    inputTokens: number;
    outputTokens: number;
    timestamp: string;
  } | null = null;

  function flush() {
    if (!current) return;
    turns.push({
      index: turns.length,
      userMessage: current.userMessage,
      assistantMessages: current.assistantMessages,
      toolCalls: current.toolCalls,
      subagentIds: current.subagentIds,
      totalInputTokens: current.inputTokens,
      totalOutputTokens: current.outputTokens,
      timestamp: current.timestamp,
    });
    current = null;
  }

  for (const msg of mainMessages) {
    if (msg.type === "user") {
      flush();
      current = {
        userMessage: msg,
        assistantMessages: [],
        toolCalls: [],
        subagentIds: new Set(),
        inputTokens: 0,
        outputTokens: 0,
        timestamp: msg.timestamp,
      };
    } else if (msg.type === "assistant") {
      if (!current) {
        current = {
          userMessage: null,
          assistantMessages: [],
          toolCalls: [],
          subagentIds: new Set(),
          inputTokens: 0,
          outputTokens: 0,
          timestamp: msg.timestamp,
        };
      }
      current.assistantMessages.push(msg);
      current.toolCalls.push(...extractToolCalls(msg.content));
      if (msg.agentId) current.subagentIds.add(msg.agentId);
      if (msg.usage) {
        current.inputTokens += msg.usage.input_tokens;
        current.outputTokens += msg.usage.output_tokens;
      }
    }
  }
  flush();

  return turns;
}

// ─── Phase ──────────────────────────────────────────────────

export interface Phase {
  readonly index: number;
  readonly title: string;
  readonly summary: string;
  readonly phaseType: PhaseType;
  readonly turns: readonly Turn[];
  readonly toolSummary: Readonly<Record<string, number>>;
  readonly filesChanged: readonly string[];
  readonly subagentIds: readonly string[];
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly dependsOn: readonly number[];
}

function buildPhase(
  index: number,
  turns: readonly Turn[],
  phaseType: PhaseType,
  title: string,
  dependsOn: readonly number[],
  summary: string
): Phase {
  const toolSummary: Record<string, number> = {};
  const allToolCalls: { name: string; input: Record<string, unknown> }[] = [];
  const subIds = new Set<string>();
  let inputTok = 0;
  let outputTok = 0;

  for (const turn of turns) {
    for (const tc of turn.toolCalls) {
      toolSummary[tc.name] = (toolSummary[tc.name] ?? 0) + 1;
      allToolCalls.push(tc);
    }
    for (const id of turn.subagentIds) subIds.add(id);
    inputTok += turn.totalInputTokens;
    outputTok += turn.totalOutputTokens;
  }

  const filesChanged = extractFilePaths(allToolCalls);

  return {
    index,
    title,
    summary,
    phaseType,
    turns,
    toolSummary,
    filesChanged,
    subagentIds: [...subIds],
    totalInputTokens: inputTok,
    totalOutputTokens: outputTok,
    startTime: turns[0]?.timestamp ?? new Date().toISOString(),
    endTime: turns[turns.length - 1]?.timestamp ?? new Date().toISOString(),
    dependsOn,
  };
}

export function buildPhasesFromAnalysis(
  analysis: SessionAnalysis,
  messages: readonly ParsedMessage[]
): readonly Phase[] {
  const allTurns = groupMessagesIntoTurns(messages);
  const idToIndex = new Map<string, number>();

  analysis.phases.forEach((ap, i) => {
    idToIndex.set(ap.id, i);
  });

  return analysis.phases.map((ap, i) => {
    const turns = ap.turnIndices.filter((idx) => idx < allTurns.length).map((idx) => allTurns[idx]);

    if (turns.length === 0 && allTurns.length > 0) {
      turns.push(allTurns[0]);
    }

    const depIndices = ap.dependsOn
      .map((depId) => idToIndex.get(depId))
      .filter((idx): idx is number => idx !== undefined);

    return buildPhase(i, turns, ap.phaseType, ap.title, depIndices, ap.summary);
  });
}

// ─── Fallback: heuristic phase detection (no LLM) ──────────

function extractText(content: string | readonly ContentBlock[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((b): b is ContentBlock & { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\n/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

const TIME_GAP_MS = 3 * 60 * 1000;

export function detectPhases(messages: readonly ParsedMessage[]): readonly Phase[] {
  const turns = groupMessagesIntoTurns(messages);
  if (turns.length === 0) return [];

  const phases: Phase[] = [];
  let bucket: Turn[] = [];

  function flushBucket() {
    if (bucket.length === 0) return;
    const firstUser = bucket.find((t) => t.userMessage);
    const title = firstUser
      ? truncate(extractText(firstUser.userMessage!.content), 80)
      : `Task ${phases.length + 1}`;

    phases.push(buildPhase(phases.length, bucket, "feature", title, [], title));
    bucket = [];
  }

  for (const turn of turns) {
    if (bucket.length > 0) {
      const prevTime = new Date(bucket[bucket.length - 1].timestamp).getTime();
      const currTime = new Date(turn.timestamp).getTime();
      if (currTime - prevTime > TIME_GAP_MS) {
        flushBucket();
      }
    }
    bucket.push(turn);
  }
  flushBucket();

  return phases;
}

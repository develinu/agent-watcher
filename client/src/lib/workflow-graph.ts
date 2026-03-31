import type { Node, Edge } from "@xyflow/react";
import type {
  ParsedMessage,
  Subagent,
  SessionSummary,
  ContentBlock,
  PhaseType,
  SessionAnalysis,
} from "@agent-watcher/shared";
import dagre from "@dagrejs/dagre";

// ─── Helpers ────────────────────────────────────────────────

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

function stripSystemTags(text: string): string {
  // Remove XML-like system tags (local-command-caveat, system-reminder, etc.)
  return text
    .replace(/<[a-z-]+[\s\S]*?<\/[a-z-]+>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}

export function extractText(content: string | readonly ContentBlock[]): string {
  if (typeof content === "string") return stripSystemTags(content);
  return content
    .filter((b): b is ContentBlock & { type: "text"; text: string } => b.type === "text")
    .map((b) => stripSystemTags(b.text))
    .filter((text) => text.length > 0)
    .join("\n");
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\n/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

// ─── Turn (internal grouping unit) ──────────────────────────

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

function groupMessagesIntoTurns(messages: readonly ParsedMessage[]): readonly Turn[] {
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

// ─── Phase (high-level work unit) ───────────────────────────

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

function extractCommitMessage(command: string): string | null {
  // heredoc: git commit -m "$(cat <<'EOF' ...)"
  const heredoc = command.match(
    /git commit.*?-m\s+"\$\(cat\s+<<['"]?EOF['"]?\s*\n([\s\S]*?)\n\s*EOF/
  );
  if (heredoc) return heredoc[1].trim().split("\n")[0];

  // simple: git commit -m "message" or -m 'message'
  const simple = command.match(/git commit.*?-m\s+["']([^"']+)["']/);
  if (simple) return simple[1];

  return null;
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

function hasGitCommit(toolCalls: readonly { name: string; input: Record<string, unknown> }[]): {
  isCommit: boolean;
  message: string | null;
} {
  for (const tc of toolCalls) {
    if (tc.name === "Bash" && typeof tc.input?.command === "string") {
      if (tc.input.command.includes("git commit")) {
        return { isCommit: true, message: extractCommitMessage(tc.input.command) };
      }
    }
  }
  return { isCommit: false, message: null };
}

function containsKorean(text: string): boolean {
  return /[\uAC00-\uD7A3]/.test(text);
}

function toBulletStyle(text: string): string {
  let s = text.replace(/\n/g, " ").trim();

  // 1. Truncate early to keep concise
  if (s.length > 100) s = s.slice(0, 100);

  // 2. Strip trailing punctuation
  s = s.replace(/[.。!??\s]+$/, "");

  // 3. English polite prefixes
  s = s.replace(/^(please|plz|can you|could you)\s+/i, "");

  // 4. Korean-specific normalization (only applied to Korean text)
  if (containsKorean(s)) {
    s = s.replace(
      /(좀|조금|간단하게|간단히|자세하게|자세히|빠르게|우선|먼저|일단|그리고|그래서|또한)\s*/g,
      ""
    );

    s = s.replace(/보여\s*주?[면도].*$/, " 표시");
    s = s.replace(/보여\s*줘.*$/, " 표시");
    s = s.replace(/보여\s*주세요.*$/, " 표시");
    s = s.replace(/만들어\s*줘.*$/, " 생성");
    s = s.replace(/만들어\s*주세요.*$/, " 생성");
    s = s.replace(/넣어\s*줘.*$/, " 추가");
    s = s.replace(/고쳐\s*줘.*$/, " 수정");
    s = s.replace(/알려\s*줘.*$/, " 확인");

    s = s.replace(/해\s*줘.*$/, "");
    s = s.replace(/해\s*주세요.*$/, "");
    s = s.replace(/해\s*줄[래게].*$/, "");
    s = s.replace(/해\s*달[라].*$/, "");

    s = s.replace(/하도록.*$/, "");
    s = s.replace(/되도록.*$/, "");
    s = s.replace(/합니다.*$/, "");
    s = s.replace(/했습니다.*$/, "");
    s = s.replace(/하겠습니다.*$/, "");
    s = s.replace(/하세요.*$/, "");
    s = s.replace(/됩니다.*$/, "");
    s = s.replace(/되었.*$/, "");
    s = s.replace(/입니다.*$/, "");
    s = s.replace(/[으면]*\s*돼.*$/, "");
    s = s.replace(/이야.*$/, "");
    s = s.replace(/인데.*$/, "");
    s = s.replace(/거든.*$/, "");
    s = s.replace(/잖아.*$/, "");

    s = s.replace(/하고,?\s+/g, ", ");
    s = s.replace(/하며,?\s+/g, ", ");
    s = s.replace(/할\s*필요\s*없이/g, "");
    s = s.replace(/[을를이가은는의에서으로]+$/, "");
  }

  // Cleanup
  s = s
    .replace(/[,\s]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return s;
}

function generatePhaseSummary(turns: readonly Turn[], _filesChanged: readonly string[]): string {
  // Pick the longest user message as the most representative content
  let best = "";
  for (const turn of turns) {
    if (turn.userMessage) {
      const raw = extractText(turn.userMessage.content);
      if (raw.length > best.length) {
        best = raw;
      }
    }
  }

  if (best.length === 0) return "No changes";

  return toBulletStyle(best);
}

const TIME_GAP_MS = 3 * 60 * 1000; // 3 minutes

function buildPhase(
  index: number,
  turns: readonly Turn[],
  phaseType: PhaseType,
  title: string,
  dependsOn: readonly number[] = [],
  summaryOverride?: string
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
  const summary = summaryOverride ?? generatePhaseSummary(turns, filesChanged);

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
    startTime: turns[0].timestamp,
    endTime: turns[turns.length - 1].timestamp,
    dependsOn,
  };
}

export function detectPhases(
  messages: readonly ParsedMessage[],
  _subagents: readonly Subagent[]
): readonly Phase[] {
  const turns = groupMessagesIntoTurns(messages);
  if (turns.length === 0) return [];

  const phases: Phase[] = [];
  let bucket: Turn[] = [];

  function flushBucket(isCommit: boolean, commitMsg: string | null) {
    if (bucket.length === 0) return;

    let title: string;
    let type: PhaseType;

    if (isCommit && commitMsg) {
      title = truncate(commitMsg, 80);
      type = "commit";
    } else if (isCommit) {
      title = "Commit";
      type = "commit";
    } else {
      // Use first user prompt as title
      const firstUser = bucket.find((t) => t.userMessage);
      title = firstUser
        ? truncate(extractText(firstUser.userMessage!.content), 80)
        : `Task ${phases.length + 1}`;
      type = "feature";
    }

    phases.push(buildPhase(phases.length, bucket, type, title));
    bucket = [];
  }

  for (const turn of turns) {
    // Check for git commit in this turn
    const commit = hasGitCommit(turn.toolCalls);

    // Check time gap from previous turn
    if (bucket.length > 0) {
      const prevTime = new Date(bucket[bucket.length - 1].timestamp).getTime();
      const currTime = new Date(turn.timestamp).getTime();
      if (currTime - prevTime > TIME_GAP_MS) {
        flushBucket(false, null);
      }
    }

    bucket.push(turn);

    if (commit.isCommit) {
      flushBucket(true, commit.message);
    }
  }

  // Remaining turns
  flushBucket(false, null);

  return phases;
}

// ─── Node data interfaces ───────────────────────────────────

export interface PhaseNodeData {
  readonly phaseIndex: number;
  readonly title: string;
  readonly summary: string;
  readonly phaseType: PhaseType;
  readonly turnCount: number;
  readonly toolNames: readonly string[];
  readonly fileCount: number;
  readonly totalTokens: number;
  readonly subagentCount: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly isLatest: boolean;
}

export interface SessionFlowNodeData {
  readonly sessionIndex: number;
  readonly session: SessionSummary;
  readonly projectId: string;
  readonly isLatest: boolean;
}

// ─── dagre layout ───────────────────────────────────────────

const NODE_SIZES: Record<string, { width: number; height: number }> = {
  phaseNode: { width: 340, height: 200 },
  sessionFlowNode: { width: 340, height: 130 },
};

function applyDagreLayout(nodes: Node[], edges: Edge[], direction: "TB" | "LR" = "TB"): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, nodesep: 50, ranksep: 60 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    const size = NODE_SIZES[node.type ?? "phaseNode"] ?? { width: 300, height: 100 };
    g.setNode(node.id, { width: size.width, height: size.height });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    const size = NODE_SIZES[node.type ?? "phaseNode"] ?? { width: 300, height: 100 };
    return {
      ...node,
      position: { x: pos.x - size.width / 2, y: pos.y - size.height / 2 },
    };
  });
}

// ─── Build phases from LLM analysis ────────────────────────

export function buildPhasesFromAnalysis(
  analysis: SessionAnalysis,
  messages: readonly ParsedMessage[],
  _subagents: readonly Subagent[]
): readonly Phase[] {
  const allTurns = groupMessagesIntoTurns(messages);
  const idToIndex = new Map<string, number>();

  analysis.phases.forEach((ap, i) => {
    idToIndex.set(ap.id, i);
  });

  return analysis.phases.map((ap, i) => {
    const turns = ap.turnIndices.filter((idx) => idx < allTurns.length).map((idx) => allTurns[idx]);

    if (turns.length === 0 && allTurns.length > 0) {
      // Fallback: if LLM returned invalid indices, use at least the first turn
      turns.push(allTurns[0]);
    }

    const depIndices = ap.dependsOn
      .map((depId) => idToIndex.get(depId))
      .filter((idx): idx is number => idx !== undefined);

    return buildPhase(i, turns, ap.phaseType, ap.title, depIndices, ap.summary);
  });
}

// ─── Session graph (phase-based) ────────────────────────────

export function buildSessionGraph(phases: readonly Phase[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = phases.map((phase, i) => ({
    id: `phase-${phase.index}`,
    type: "phaseNode",
    position: { x: 0, y: 0 },
    data: {
      phaseIndex: phase.index,
      title: phase.title,
      summary: phase.summary,
      phaseType: phase.phaseType,
      turnCount: phase.turns.length,
      toolNames: Object.keys(phase.toolSummary),
      fileCount: phase.filesChanged.length,
      totalTokens: phase.totalInputTokens + phase.totalOutputTokens,
      subagentCount: phase.subagentIds.length,
      startTime: phase.startTime,
      endTime: phase.endTime,
      isLatest: i === phases.length - 1,
    } satisfies PhaseNodeData,
  }));

  // Build edges from dependsOn (branching) or sequential fallback
  const edges: Edge[] = [];
  const hasIncoming = new Set<number>();

  for (const phase of phases) {
    for (const depIdx of phase.dependsOn) {
      edges.push({
        id: `e-phase-${depIdx}-${phase.index}`,
        source: `phase-${depIdx}`,
        target: `phase-${phase.index}`,
        type: "smoothstep",
      });
      hasIncoming.add(phase.index);
    }
  }

  // For phases without explicit dependencies, connect sequentially
  for (let i = 1; i < phases.length; i++) {
    if (!hasIncoming.has(i)) {
      edges.push({
        id: `e-phase-${i - 1}-${i}`,
        source: `phase-${i - 1}`,
        target: `phase-${i}`,
        type: "smoothstep",
      });
    }
  }

  const layoutNodes = applyDagreLayout(nodes, edges);
  return { nodes: layoutNodes, edges };
}

// ─── Project graph ──────────────────────────────────────────

export function buildProjectGraph(
  sessions: readonly SessionSummary[],
  projectId: string
): { nodes: Node[]; edges: Edge[] } {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  const nodes: Node[] = sorted.map((session, i) => ({
    id: `session-${i}`,
    type: "sessionFlowNode",
    position: { x: 0, y: 0 },
    data: {
      sessionIndex: i,
      session,
      projectId,
      isLatest: i === sorted.length - 1,
    } satisfies SessionFlowNodeData,
  }));

  const edges: Edge[] = sorted.slice(1).map((_, i) => ({
    id: `e-session-${i}-${i + 1}`,
    source: `session-${i}`,
    target: `session-${i + 1}`,
    type: "smoothstep",
  }));

  const layoutNodes = applyDagreLayout(nodes, edges);
  return { nodes: layoutNodes, edges };
}

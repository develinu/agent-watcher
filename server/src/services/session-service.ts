import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Session, SessionSummary, ParsedMessage, Subagent } from "@agent-watcher/shared";
import type { JournalRecord, UserRecord } from "@agent-watcher/shared";
import { parseJsonlFile } from "./jsonl-parser.js";
import { scanSubagents, readSubagentMeta } from "./file-scanner.js";
import { generateSessionSummaryLlm, generateSessionSummaryLlmBackground } from "./llm-analyzer.js";
import { config } from "../config.js";

// ─── Concurrency helper ──────────────────────────────────

async function parallelMap<T, R>(
  items: readonly T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ─── SessionSummary cache ─────────────────────────────────

interface CachedSummaryEntry {
  readonly summary: SessionSummary;
  readonly fileSize: number;
  readonly mtimeMs: number;
}

const summaryCache = new Map<string, CachedSummaryEntry>();

async function getCachedSummary(
  sessionId: string,
  filePath: string
): Promise<SessionSummary | null> {
  const cached = summaryCache.get(sessionId);
  if (!cached) return null;

  try {
    const s = await stat(filePath);
    if (s.size === cached.fileSize && s.mtimeMs === cached.mtimeMs) {
      // Update isActive (may change without file modification)
      return { ...cached.summary, isActive: isSessionActive(cached.summary.lastActiveAt) };
    }
  } catch {
    // File gone — evict
    summaryCache.delete(sessionId);
  }
  return null;
}

function setCachedSummary(
  sessionId: string,
  summary: SessionSummary,
  fileSize: number,
  mtimeMs: number
): void {
  summaryCache.set(sessionId, { summary, fileSize, mtimeMs });
}

export function invalidateSummaryCache(sessionId: string): void {
  summaryCache.delete(sessionId);
}

// ─── Disk-based summary cache (survives restarts) ─────────

function getDiskCacheDir(): string {
  return join(config.claudeDir, ".agent-watcher", "summary-cache");
}

function diskCachePath(sessionId: string): string {
  return join(getDiskCacheDir(), `${sessionId}.json`);
}

interface DiskCachedSummary {
  readonly summary: SessionSummary;
  readonly fileSize: number;
  readonly mtimeMs: number;
}

async function readDiskCache(sessionId: string): Promise<DiskCachedSummary | null> {
  try {
    const raw = await readFile(diskCachePath(sessionId), "utf-8");
    return JSON.parse(raw) as DiskCachedSummary;
  } catch {
    return null;
  }
}

async function writeDiskCache(sessionId: string, entry: DiskCachedSummary): Promise<void> {
  try {
    await mkdir(getDiskCacheDir(), { recursive: true });
    await writeFile(diskCachePath(sessionId), JSON.stringify(entry), "utf-8");
  } catch {
    // Best-effort — don't fail the request
  }
}

function extractMessages(records: readonly JournalRecord[]): readonly ParsedMessage[] {
  const messages: ParsedMessage[] = [];

  for (const record of records) {
    if (record.type === "user") {
      messages.push({
        uuid: record.uuid,
        type: "user",
        timestamp: record.timestamp,
        content: record.message.content,
        isSidechain: record.isSidechain,
      });
    } else if (record.type === "assistant") {
      const toolUseBlocks = record.message.content.filter((b) => b.type === "tool_use");
      messages.push({
        uuid: record.uuid,
        type: "assistant",
        timestamp: record.timestamp,
        content: record.message.content,
        model: record.message.model,
        usage: record.message.usage,
        toolName: toolUseBlocks.length > 0 ? toolUseBlocks[0].name : undefined,
        agentId: record.agentId,
        isSidechain: record.isSidechain,
      });
    } else if (record.type === "system") {
      messages.push({
        uuid: record.uuid,
        type: "system",
        timestamp: record.timestamp,
        content: "",
        isSidechain: false,
      });
    }
  }

  return messages;
}

function aggregateTokens(records: readonly JournalRecord[]): {
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
} {
  let input = 0;
  let output = 0;
  let cacheCreation = 0;
  let cacheRead = 0;

  for (const record of records) {
    if (record.type === "assistant" && record.message.usage) {
      input += record.message.usage.input_tokens;
      output += record.message.usage.output_tokens;
      cacheCreation += record.message.usage.cache_creation_input_tokens ?? 0;
      cacheRead += record.message.usage.cache_read_input_tokens ?? 0;
    }
  }

  return { input, output, cacheCreation, cacheRead };
}

function extractMetadata(records: readonly JournalRecord[]): {
  aiTitle: string | null;
  slug: string | null;
  entrypoint: string | null;
  cwd: string;
  version: string | null;
  gitBranch: string | null;
  model: string | null;
  startedAt: string;
  lastActiveAt: string;
} {
  let aiTitle: string | null = null;
  let slug: string | null = null;
  let entrypoint: string | null = null;
  let cwd = "";
  let version: string | null = null;
  let gitBranch: string | null = null;
  let model: string | null = null;
  let startedAt = "";
  let lastActiveAt = "";

  for (const record of records) {
    if (record.type === "ai-title") {
      aiTitle = record.aiTitle;
    } else if (record.type === "user") {
      if (!cwd) cwd = record.cwd;
      if (!version) version = record.version;
      if (!gitBranch && record.gitBranch) gitBranch = record.gitBranch;
      if (!slug && record.slug) slug = record.slug;
      if (!entrypoint && record.entrypoint) entrypoint = record.entrypoint;
      if (!startedAt) startedAt = record.timestamp;
      lastActiveAt = record.timestamp;
    } else if (record.type === "assistant") {
      if (!model) model = record.message.model;
      lastActiveAt = record.timestamp;
    }
  }

  return { aiTitle, slug, entrypoint, cwd, version, gitBranch, model, startedAt, lastActiveAt };
}

export async function getSession(
  projectId: string,
  sessionId: string,
  sessionFilePath: string,
  subagentDir: string | null
): Promise<Session> {
  const records = await parseJsonlFile(sessionFilePath);
  const messages = extractMessages(records);
  const tokens = aggregateTokens(records);
  const meta = extractMetadata(records);
  const subagents = subagentDir ? await loadSubagents(subagentDir) : [];

  const isActive = isSessionActive(meta.lastActiveAt);

  const summary = await generateSessionSummary(sessionId, records);

  return {
    id: sessionId,
    projectId,
    ...meta,
    summary,
    messageCount: messages.length,
    totalInputTokens: tokens.input,
    totalOutputTokens: tokens.output,
    totalCacheCreationTokens: tokens.cacheCreation,
    totalCacheReadTokens: tokens.cacheRead,
    subagentCount: subagents.length,
    isActive,
    messages,
    subagents,
  };
}

export async function getSessionSummary(
  projectId: string,
  sessionId: string,
  sessionFilePath: string,
  subagentDir: string | null
): Promise<SessionSummary> {
  // 1. Memory cache (fastest)
  const memCached = await getCachedSummary(sessionId, sessionFilePath);
  if (memCached) return memCached;

  // 2. Disk cache (survives restarts)
  const fileStat = await stat(sessionFilePath);
  const diskCached = await readDiskCache(sessionId);
  if (
    diskCached &&
    diskCached.fileSize === fileStat.size &&
    diskCached.mtimeMs === fileStat.mtimeMs
  ) {
    const restored = {
      ...diskCached.summary,
      isActive: isSessionActive(diskCached.summary.lastActiveAt),
    };
    setCachedSummary(sessionId, restored, fileStat.size, fileStat.mtimeMs);
    return restored;
  }

  // 3. Full parse (cold start)
  const records = await parseJsonlFile(sessionFilePath);
  const tokens = aggregateTokens(records);
  const meta = extractMetadata(records);
  const messageCount = records.filter((r) => r.type === "user" || r.type === "assistant").length;
  let subagentCount = 0;

  if (subagentDir) {
    const subs = await scanSubagents(subagentDir);
    subagentCount = subs.filter((s) => !s.agentId.startsWith("acompact-")).length;
  }

  const summaryText = await generateSessionSummary(sessionId, records);

  const result: SessionSummary = {
    id: sessionId,
    projectId,
    ...meta,
    summary: summaryText,
    messageCount,
    totalInputTokens: tokens.input,
    totalOutputTokens: tokens.output,
    totalCacheCreationTokens: tokens.cacheCreation,
    totalCacheReadTokens: tokens.cacheRead,
    subagentCount,
    isActive: isSessionActive(meta.lastActiveAt),
  };

  // Populate both caches
  setCachedSummary(sessionId, result, fileStat.size, fileStat.mtimeMs);
  writeDiskCache(sessionId, {
    summary: result,
    fileSize: fileStat.size,
    mtimeMs: fileStat.mtimeMs,
  }).catch(() => {});

  return result;
}

async function loadSubagents(subagentDir: string): Promise<readonly Subagent[]> {
  const files = await scanSubagents(subagentDir);
  const filtered = files.filter((f) => !f.agentId.startsWith("acompact-"));

  return parallelMap(
    filtered,
    async (file) => {
      const meta = file.metaPath ? await readSubagentMeta(file.metaPath) : null;
      let messageCount = 0;
      let totalInput = 0;
      let totalOutput = 0;
      let agentModel: string | undefined;
      let lastActive: string | null = null;

      if (file.logPath) {
        const records = await parseJsonlFile(file.logPath);
        messageCount = records.filter((r) => r.type === "user" || r.type === "assistant").length;
        const tokens = aggregateTokens(records);
        totalInput = tokens.input;
        totalOutput = tokens.output;

        for (const r of records) {
          if (r.type === "assistant") {
            if (!agentModel) agentModel = r.message.model;
            lastActive = r.timestamp;
          }
        }
      }

      return {
        agentId: file.agentId,
        agentType: meta?.agentType ?? "unknown",
        description: meta?.description ?? "",
        messageCount,
        totalInputTokens: totalInput,
        totalOutputTokens: totalOutput,
        model: agentModel,
        lastActiveAt: lastActive,
      };
    },
    8
  );
}

function stripSystemTags(text: string): string {
  return text
    .replace(/<[a-z-]+[\s\S]*?<\/[a-z-]+>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}

function extractUserText(record: UserRecord): string {
  const content = record.message.content;
  if (typeof content === "string") return stripSystemTags(content);
  return content
    .filter((b) => b.type === "text")
    .map((b) => stripSystemTags((b as { type: "text"; text: string }).text))
    .filter((t) => t.length > 0)
    .join(" ");
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

function generateSessionSummaryFallback(records: readonly JournalRecord[]): string {
  let best = "";
  for (const record of records) {
    if (record.type === "user" && !record.isSidechain) {
      const raw = extractUserText(record);
      if (raw.length > best.length) {
        best = raw;
      }
    }
  }

  if (best.length === 0) return "No content";

  return toBulletStyle(best);
}

async function generateSessionSummary(
  sessionId: string,
  records: readonly JournalRecord[]
): Promise<string> {
  // Try cached LLM summary (cache lookup only — no blocking LLM call)
  try {
    const llmSummary = await generateSessionSummaryLlm(sessionId, records);
    if (llmSummary) return llmSummary;
  } catch {
    // LLM unavailable — fall through to regex fallback
  }

  // Return fallback immediately, trigger LLM in background for next request
  generateSessionSummaryLlmBackground(sessionId, records).catch(() => {
    /* best-effort */
  });

  return generateSessionSummaryFallback(records);
}

function isSessionActive(lastActiveAt: string): boolean {
  if (!lastActiveAt) return false;
  const lastActive = new Date(lastActiveAt).getTime();
  return Date.now() - lastActive < config.activeThresholdMs;
}

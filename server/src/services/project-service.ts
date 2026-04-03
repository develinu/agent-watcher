import type { ProjectSummary, Project, SessionSummary } from "@agent-watcher/shared";
import { scanProjects, type ProjectIndex } from "./file-scanner.js";
import { getSessionSummary } from "./session-service.js";
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

let projectCache: ReadonlyMap<string, ProjectIndex> | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10_000; // 10 seconds, synced with ws-broadcaster interval

export async function refreshProjectIndex(): Promise<ReadonlyMap<string, ProjectIndex>> {
  projectCache = await scanProjects(config.claudeDir);
  lastCacheTime = Date.now();
  return projectCache;
}

export async function getProjectIndex(): Promise<ReadonlyMap<string, ProjectIndex>> {
  const now = Date.now();
  if (!projectCache || now - lastCacheTime > CACHE_TTL_MS) {
    return refreshProjectIndex();
  }
  return projectCache;
}

export async function getProjects(): Promise<readonly ProjectSummary[]> {
  const index = await getProjectIndex();
  const entries = Array.from(index.entries());

  const summaries = await parallelMap(
    entries,
    async ([projectId, project]) => {
      const sessionSummaries = await getSessionSummariesForProject(projectId, project);
      const totalInput = sessionSummaries.reduce((sum, s) => sum + s.totalInputTokens, 0);
      const totalOutput = sessionSummaries.reduce((sum, s) => sum + s.totalOutputTokens, 0);
      const activeCount = sessionSummaries.filter((s) => s.isActive).length;

      const lastActiveSession = sessionSummaries
        .filter((s) => s.lastActiveAt)
        .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime())[0];

      const cwd = sessionSummaries[0]?.cwd ?? "";
      const name = cwd ? cwd.split("/").slice(-2).join("/") : decodeProjectId(projectId);

      return {
        id: projectId,
        path: cwd,
        name,
        sessionCount: sessionSummaries.length,
        totalInputTokens: totalInput,
        totalOutputTokens: totalOutput,
        lastActiveAt: lastActiveSession?.lastActiveAt ?? null,
        activeSessionCount: activeCount,
      };
    },
    6
  );

  return summaries.sort((a, b) => {
    if (a.activeSessionCount !== b.activeSessionCount)
      return b.activeSessionCount - a.activeSessionCount;
    const aTime = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
    const bTime = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
    return bTime - aTime;
  });
}

export async function getProject(projectId: string): Promise<Project | null> {
  const index = await getProjectIndex();
  const project = index.get(projectId);
  if (!project) return null;

  const sessionSummaries = await getSessionSummariesForProject(projectId, project);
  const totalInput = sessionSummaries.reduce((sum, s) => sum + s.totalInputTokens, 0);
  const totalOutput = sessionSummaries.reduce((sum, s) => sum + s.totalOutputTokens, 0);
  const activeCount = sessionSummaries.filter((s) => s.isActive).length;

  const lastActiveSession = sessionSummaries
    .filter((s) => s.lastActiveAt)
    .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime())[0];

  const cwd = sessionSummaries[0]?.cwd ?? "";
  const name = cwd ? cwd.split("/").slice(-2).join("/") : decodeProjectId(projectId);

  return {
    id: projectId,
    path: cwd,
    name,
    sessionCount: sessionSummaries.length,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    lastActiveAt: lastActiveSession?.lastActiveAt ?? null,
    activeSessionCount: activeCount,
    sessions: sessionSummaries.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    ),
  };
}

async function getSessionSummariesForProject(
  projectId: string,
  project: ProjectIndex
): Promise<SessionSummary[]> {
  const entries = Array.from(project.sessions.entries());

  const results = await parallelMap(
    entries,
    async ([sessionId, meta]) => {
      try {
        return await getSessionSummary(projectId, sessionId, meta.filePath, meta.subagentDir);
      } catch {
        return null; // Skip unreadable sessions
      }
    },
    10
  );

  return results.filter((s): s is SessionSummary => s !== null);
}

function decodeProjectId(id: string): string {
  // Project IDs are encoded paths with leading dash and dashes replacing slashes
  // This is lossy, so just return the last segment as a readable name
  const parts = id.split("-").filter(Boolean);
  return parts.slice(-2).join("/");
}

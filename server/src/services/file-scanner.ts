import { readdir, stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

export interface SessionMeta {
  readonly sessionId: string;
  readonly filePath: string;
  readonly fileSize: number;
  readonly lastModified: number;
  readonly hasSubagents: boolean;
  readonly subagentDir: string | null;
}

export interface ProjectIndex {
  readonly id: string;
  readonly dirPath: string;
  readonly sessions: ReadonlyMap<string, SessionMeta>;
}

export async function scanProjects(claudeDir: string): Promise<ReadonlyMap<string, ProjectIndex>> {
  const projectsDir = join(claudeDir, "projects");
  const projects = new Map<string, ProjectIndex>();

  if (!existsSync(projectsDir)) return projects;

  const entries = await readdir(projectsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectId = entry.name;
    const projectPath = join(projectsDir, projectId);
    const sessions = await scanSessions(projectPath);

    projects.set(projectId, {
      id: projectId,
      dirPath: projectPath,
      sessions,
    });
  }

  return projects;
}

async function scanSessions(projectDir: string): Promise<ReadonlyMap<string, SessionMeta>> {
  const sessions = new Map<string, SessionMeta>();
  const entries = await readdir(projectDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      const sessionId = entry.name.replace(".jsonl", "");
      const filePath = join(projectDir, entry.name);
      const fileStat = await stat(filePath);
      const subagentDir = join(projectDir, sessionId, "subagents");
      const hasSubagents = existsSync(subagentDir);

      sessions.set(sessionId, {
        sessionId,
        filePath,
        fileSize: fileStat.size,
        lastModified: fileStat.mtimeMs,
        hasSubagents,
        subagentDir: hasSubagents ? subagentDir : null,
      });
    }
  }

  return sessions;
}

export interface SubagentFile {
  readonly agentId: string;
  readonly metaPath: string | null;
  readonly logPath: string | null;
}

export async function scanSubagents(subagentDir: string): Promise<readonly SubagentFile[]> {
  if (!existsSync(subagentDir)) return [];

  const entries = await readdir(subagentDir);
  const agentMap = new Map<string, { metaPath: string | null; logPath: string | null }>();

  for (const entry of entries) {
    const match = entry.match(/^agent-(.+)\.(meta\.json|jsonl)$/);
    if (!match) continue;
    const [, agentId, ext] = match;
    const existing = agentMap.get(agentId) ?? { metaPath: null, logPath: null };

    if (ext === "meta.json") {
      agentMap.set(agentId, { ...existing, metaPath: join(subagentDir, entry) });
    } else {
      agentMap.set(agentId, { ...existing, logPath: join(subagentDir, entry) });
    }
  }

  return Array.from(agentMap.entries()).map(([agentId, files]) => ({
    agentId,
    ...files,
  }));
}

export async function readSubagentMeta(
  metaPath: string
): Promise<{ agentType: string; description: string } | null> {
  try {
    const content = await readFile(metaPath, "utf-8");
    const parsed = JSON.parse(content) as { agentType?: string; description?: string };
    return {
      agentType: parsed.agentType ?? "unknown",
      description: parsed.description ?? "",
    };
  } catch {
    return null;
  }
}

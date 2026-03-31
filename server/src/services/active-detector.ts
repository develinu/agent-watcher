import { stat } from "node:fs/promises";
import { getProjectIndex } from "./project-service.js";
import { config } from "../config.js";

export interface ActiveSession {
  readonly sessionId: string;
  readonly projectId: string;
  readonly lastModified: number;
}

export async function getActiveSessions(): Promise<readonly ActiveSession[]> {
  const index = await getProjectIndex();
  const now = Date.now();
  const active: ActiveSession[] = [];

  for (const [projectId, project] of index) {
    for (const [sessionId, meta] of project.sessions) {
      try {
        const fileStat = await stat(meta.filePath);
        if (now - fileStat.mtimeMs < config.activeThresholdMs) {
          active.push({
            sessionId,
            projectId,
            lastModified: fileStat.mtimeMs,
          });
        }
      } catch {
        // Skip inaccessible files
      }
    }
  }

  return active;
}

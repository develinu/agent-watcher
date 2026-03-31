import type { SessionSummary } from "./analytics.js";

export interface ProjectSummary {
  readonly id: string;
  readonly path: string;
  readonly name: string;
  readonly sessionCount: number;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly lastActiveAt: string | null;
  readonly activeSessionCount: number;
}

export interface Project extends ProjectSummary {
  readonly sessions: readonly SessionSummary[];
}

export type ProjectDetail = Project;

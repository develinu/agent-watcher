export type PhaseType =
  | "feature"
  | "bugfix"
  | "refactor"
  | "debug"
  | "review"
  | "config"
  | "docs"
  | "test"
  | "explore"
  | "planning"
  | "commit"
  | "chore";

export interface AnalyzedPhase {
  readonly id: string;
  readonly turnIndices: readonly number[];
  readonly phaseType: PhaseType;
  readonly title: string;
  readonly summary: string;
  readonly dependsOn: readonly string[];
}

export interface SessionAnalysis {
  readonly sessionId: string;
  readonly phases: readonly AnalyzedPhase[];
  readonly analyzedAt: string;
}

import type { PhaseType } from "@agent-watcher/shared";

interface PhaseStyle {
  readonly label: string;
  readonly color: string;
}

const PHASE_STYLES: Record<PhaseType, PhaseStyle> = {
  feature: { label: "feat", color: "cyan" },
  bugfix: { label: "fix", color: "red" },
  refactor: { label: "refac", color: "yellow" },
  debug: { label: "debug", color: "magenta" },
  review: { label: "review", color: "blue" },
  config: { label: "config", color: "gray" },
  docs: { label: "docs", color: "green" },
  test: { label: "test", color: "yellow" },
  explore: { label: "explore", color: "cyan" },
  planning: { label: "plan", color: "blue" },
  commit: { label: "commit", color: "green" },
  chore: { label: "chore", color: "gray" },
};

export function getPhaseStyle(phaseType: PhaseType): PhaseStyle {
  return PHASE_STYLES[phaseType];
}

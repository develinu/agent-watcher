import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { PhaseNodeData } from "../../lib/workflow-graph.js";
import type { PhaseType } from "@agent-watcher/shared";
import { Badge } from "../common/Badge.js";
import { formatTokenCount, formatDuration } from "../../lib/format.js";

type BadgeVariant = "default" | "blue" | "green" | "yellow" | "purple" | "red";

const phaseConfig: Record<PhaseType, { label: string; variant: BadgeVariant }> = {
  feature: { label: "Feature", variant: "blue" },
  bugfix: { label: "Bugfix", variant: "red" },
  refactor: { label: "Refactor", variant: "yellow" },
  debug: { label: "Debug", variant: "red" },
  review: { label: "Review", variant: "purple" },
  config: { label: "Config", variant: "default" },
  docs: { label: "Docs", variant: "default" },
  test: { label: "Test", variant: "yellow" },
  explore: { label: "Explore", variant: "purple" },
  planning: { label: "Planning", variant: "blue" },
  commit: { label: "Commit", variant: "green" },
  chore: { label: "Chore", variant: "default" },
};

export function PhaseNode({ data, selected }: NodeProps) {
  const d = data as unknown as PhaseNodeData;

  const topTools = d.toolNames.slice(0, 4);
  const cfg = phaseConfig[d.phaseType] ?? { label: d.phaseType, variant: "default" as const };

  const borderClass = selected
    ? "border-blue-500 ring-1 ring-blue-500/40"
    : d.isLatest
      ? "border-emerald-500 ring-2 ring-emerald-500/30"
      : "border-gray-700 hover:border-gray-600";

  return (
    <div
      className={`w-[320px] rounded-lg border bg-gray-900 p-3 shadow-lg transition-colors ${borderClass}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />

      {/* Phase Type Badge + Latest indicator */}
      <div className="mb-2 flex items-center gap-1.5">
        <Badge variant={cfg.variant}>{cfg.label}</Badge>
        {d.isLatest && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Latest
          </span>
        )}
      </div>

      {/* Summary */}
      {d.summary && (
        <div className="mb-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-300">
          {d.summary}
        </div>
      )}

      {/* Tools */}
      {topTools.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {topTools.map((t) => (
            <span key={t} className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400">
              {t}
            </span>
          ))}
          {d.toolNames.length > 4 && (
            <span className="text-xs text-gray-500">+{d.toolNames.length - 4}</span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
        <span>{d.turnCount} turns</span>
        <span>{formatTokenCount(d.totalTokens)}</span>
        {d.fileCount > 0 && <span>{d.fileCount} files</span>}
        {d.subagentCount > 0 && <Badge variant="purple">{d.subagentCount} agents</Badge>}
        {d.startTime && d.endTime && d.startTime !== d.endTime && (
          <span>{formatDuration(d.startTime, d.endTime)}</span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  );
}

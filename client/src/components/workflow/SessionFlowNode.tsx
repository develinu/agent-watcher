import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { SessionFlowNodeData } from "../../lib/workflow-graph.js";
import { Badge } from "../common/Badge.js";
import { StatusIndicator } from "../common/StatusIndicator.js";
import { formatTokenCount, formatRelativeTime, formatDuration } from "../../lib/format.js";

export function SessionFlowNode({ data, selected }: NodeProps) {
  const d = data as unknown as SessionFlowNodeData;
  const { session } = d;

  const modelLabels = (
    session.models?.length ? session.models : session.model ? [session.model] : []
  ).map((m) => m.replace("claude-", "").split("-").slice(0, 2).join("-"));
  const totalTokens = session.totalInputTokens + session.totalOutputTokens;

  const borderClass = selected
    ? "border-blue-500 ring-1 ring-blue-500/40"
    : d.isLatest
      ? "border-emerald-500 ring-2 ring-emerald-500/30"
      : session.isActive
        ? "border-emerald-700 hover:border-emerald-600"
        : "border-gray-700 hover:border-gray-600";

  return (
    <div
      className={`w-[320px] cursor-pointer rounded-lg border bg-gray-900 p-4 shadow-lg transition-colors ${borderClass}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />

      {/* Badges */}
      <div className="mb-2 flex flex-wrap items-center gap-1">
        <StatusIndicator active={session.isActive} />
        {d.isLatest && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Latest
          </span>
        )}
        {modelLabels.length > 0 ? (
          modelLabels.map((label) => (
            <Badge key={label} variant="blue">
              {label}
            </Badge>
          ))
        ) : (
          <Badge variant="blue">unknown</Badge>
        )}
        {session.entrypoint && <Badge>{session.entrypoint}</Badge>}
        {session.subagentCount > 0 && (
          <Badge variant="purple">{session.subagentCount} agents</Badge>
        )}
      </div>

      {/* Summary */}
      <div className="mb-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-300">
        {session.summary}
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        <span>{formatRelativeTime(session.startedAt)}</span>
        {session.startedAt && session.lastActiveAt && (
          <span>{formatDuration(session.startedAt, session.lastActiveAt)}</span>
        )}
        <span>{session.messageCount} msgs</span>
        <span>{formatTokenCount(totalTokens)}</span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  );
}

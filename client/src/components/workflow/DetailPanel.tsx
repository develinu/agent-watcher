import { Link } from "react-router-dom";
import type { SessionSummary, Subagent, PhaseType } from "@agent-watcher/shared";
import type { Phase } from "../../lib/workflow-graph.js";
import { extractText } from "../../lib/workflow-graph.js";
import { Badge } from "../common/Badge.js";
import { StatusIndicator } from "../common/StatusIndicator.js";
import {
  formatTokenCount,
  formatRelativeTime,
  formatDuration,
  formatDateTime,
} from "../../lib/format.js";

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

// ─── Discriminated union for detail data ────────────────────

export type DetailData =
  | { readonly type: "phase"; readonly phase: Phase; readonly subagents: readonly Subagent[] }
  | { readonly type: "session"; readonly session: SessionSummary; readonly projectId: string }
  | null;

interface DetailPanelProps {
  readonly data: DetailData;
  readonly onClose: () => void;
}

export function DetailPanel({ data, onClose }: DetailPanelProps) {
  if (!data) return null;

  return (
    <div className="flex w-96 flex-col border-l border-gray-800 bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 p-3">
        <h3 className="text-sm font-semibold text-gray-200">Details</h3>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {data.type === "phase" ? (
          <PhaseDetail phase={data.phase} subagents={data.subagents} />
        ) : (
          <SessionDetail session={data.session} projectId={data.projectId} />
        )}
      </div>
    </div>
  );
}

// ─── Phase detail ───────────────────────────────────────────

function PhaseDetail({ phase, subagents }: { phase: Phase; subagents: readonly Subagent[] }) {
  const subMap = new Map(subagents.map((s) => [s.agentId, s]));
  const relatedSubs = phase.subagentIds
    .map((id) => subMap.get(id))
    .filter((s): s is Subagent => s != null);

  return (
    <div className="space-y-4 p-3">
      {/* Phase header + summary */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Badge variant={(phaseConfig[phase.phaseType] ?? phaseConfig.chore).variant}>
            {(phaseConfig[phase.phaseType] ?? phaseConfig.chore).label}
          </Badge>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-200">{phase.summary}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
          <span>{formatDateTime(phase.startTime)}</span>
          {phase.startTime !== phase.endTime && (
            <span>{formatDuration(phase.startTime, phase.endTime)}</span>
          )}
          <span>{formatTokenCount(phase.totalInputTokens + phase.totalOutputTokens)} tokens</span>
        </div>
      </div>

      {/* Tool summary */}
      {Object.keys(phase.toolSummary).length > 0 && (
        <Section title="Tools">
          <div className="flex flex-wrap gap-1">
            {Object.entries(phase.toolSummary).map(([name, count]) => (
              <span
                key={name}
                className="rounded bg-yellow-900/20 px-2 py-0.5 text-xs text-yellow-300"
              >
                {name} <span className="text-yellow-600">x{count}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Files changed */}
      {phase.filesChanged.length > 0 && (
        <Section title={`Files (${phase.filesChanged.length})`}>
          <div className="space-y-0.5">
            {phase.filesChanged.map((f) => (
              <p key={f} className="truncate font-mono text-xs text-gray-400">
                {f}
              </p>
            ))}
          </div>
        </Section>
      )}

      {/* Subagents */}
      {relatedSubs.length > 0 && (
        <Section title="Subagents">
          <div className="space-y-2">
            {relatedSubs.map((sub) => (
              <div key={sub.agentId} className="rounded border border-gray-800 bg-gray-900 p-2">
                <div className="flex items-center gap-1">
                  <Badge variant="purple">{sub.agentType}</Badge>
                  <span className="truncate text-xs text-gray-300">{sub.description}</span>
                </div>
                <div className="mt-1 flex gap-2 text-xs text-gray-500">
                  <span>{sub.messageCount} msgs</span>
                  <span>{formatTokenCount(sub.totalInputTokens + sub.totalOutputTokens)}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Conversation turns */}
      <Section title={`Conversation (${phase.turns.length} turns)`}>
        <div className="space-y-3">
          {phase.turns.map((turn, i) => {
            const userText = turn.userMessage ? extractText(turn.userMessage.content) : null;
            const assistantTexts = turn.assistantMessages.map((m) => extractText(m.content));
            const toolCalls = turn.toolCalls;

            return (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <span>Turn {i + 1}</span>
                  <span>{formatRelativeTime(turn.timestamp)}</span>
                </div>

                {/* User */}
                {userText && (
                  <div className="rounded bg-blue-900/20 px-2 py-1.5">
                    <p className="whitespace-pre-wrap text-xs text-blue-200">
                      {userText.slice(0, 500)}
                      {userText.length > 500 ? "..." : ""}
                    </p>
                  </div>
                )}

                {/* Assistant */}
                {assistantTexts.map((text, j) =>
                  text ? (
                    <div key={j} className="rounded bg-gray-800 px-2 py-1.5">
                      <p className="whitespace-pre-wrap text-xs text-gray-300">
                        {text.slice(0, 800)}
                        {text.length > 800 ? "..." : ""}
                      </p>
                    </div>
                  ) : null
                )}

                {/* Tool calls */}
                {toolCalls.length > 0 && (
                  <div className="space-y-1">
                    {toolCalls.map((tc, k) => (
                      <div key={k} className="rounded border border-gray-800 bg-gray-900 px-2 py-1">
                        <Badge variant="yellow">{tc.name}</Badge>
                        <pre className="mt-0.5 max-h-24 overflow-auto font-mono text-xs text-gray-500">
                          {JSON.stringify(tc.input, null, 2).slice(0, 300)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ─── Session detail (project view) ──────────────────────────

function SessionDetail({ session, projectId }: { session: SessionSummary; projectId: string }) {
  const modelLabels = (
    session.models?.length ? session.models : session.model ? [session.model] : []
  ).map((m) => m.replace("claude-", "").split("-").slice(0, 2).join("-"));
  const totalTokens = session.totalInputTokens + session.totalOutputTokens;

  return (
    <div className="space-y-4 p-3">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-1">
          <StatusIndicator active={session.isActive} size="md" />
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
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-200">
          {session.summary}
        </p>
      </div>

      <Section title="Info">
        <div className="space-y-1 text-xs text-gray-400">
          <Row label="Started" value={formatDateTime(session.startedAt)} />
          <Row label="Last active" value={formatRelativeTime(session.lastActiveAt)} />
          {session.startedAt && session.lastActiveAt && (
            <Row label="Duration" value={formatDuration(session.startedAt, session.lastActiveAt)} />
          )}
          <Row label="Messages" value={String(session.messageCount)} />
          <Row label="Tokens" value={formatTokenCount(totalTokens)} />
          {session.gitBranch && <Row label="Branch" value={session.gitBranch} />}
          {session.cwd && <Row label="CWD" value={session.cwd} />}
        </div>
      </Section>

      <Section title="Token Breakdown">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded bg-gray-900 p-2">
            <div className="text-gray-500">Input</div>
            <div className="font-mono text-blue-400">
              {formatTokenCount(session.totalInputTokens)}
            </div>
          </div>
          <div className="rounded bg-gray-900 p-2">
            <div className="text-gray-500">Output</div>
            <div className="font-mono text-green-400">
              {formatTokenCount(session.totalOutputTokens)}
            </div>
          </div>
          <div className="rounded bg-gray-900 p-2">
            <div className="text-gray-500">Cache Write</div>
            <div className="font-mono text-yellow-400">
              {formatTokenCount(session.totalCacheCreationTokens)}
            </div>
          </div>
          <div className="rounded bg-gray-900 p-2">
            <div className="text-gray-500">Cache Read</div>
            <div className="font-mono text-purple-400">
              {formatTokenCount(session.totalCacheReadTokens)}
            </div>
          </div>
        </div>
      </Section>

      <Link
        to={`/sessions/${encodeURIComponent(session.id)}?projectId=${encodeURIComponent(projectId)}`}
        className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-700"
      >
        Session Workflow
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

// ─── Shared UI ──────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300">{value}</span>
    </div>
  );
}

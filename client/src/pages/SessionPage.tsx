import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type {
  Session,
  ParsedMessage,
  SessionTokenTimeline,
  ContentBlock,
} from "@agent-watcher/shared";
import { api } from "../lib/api.js";
import { useWs } from "../hooks/useWsContext.js";
import {
  formatTokenCount,
  formatRelativeTime,
  formatDuration,
  formatDateTime,
} from "../lib/format.js";
import { estimateCost } from "../lib/cost-calculator.js";
import { StatusIndicator } from "../components/common/StatusIndicator.js";
import { Badge } from "../components/common/Badge.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";
import { SessionWorkflow } from "../components/workflow/SessionWorkflow.js";

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";
  const [session, setSession] = useState<Session | null>(null);
  const [timeline, setTimeline] = useState<SessionTokenTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [showToolUse, setShowToolUse] = useState(true);
  const [showThinking, setShowThinking] = useState(false);
  const [activeTab, setActiveTab] = useState<"workflow" | "messages" | "tokens" | "subagents">(
    "workflow"
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { subscribe } = useWs();

  const loadSession = useCallback(async () => {
    if (!sessionId || !projectId) return;
    try {
      const [sessionData, timelineData] = await Promise.all([
        api.getSession(sessionId, projectId),
        api.getSessionTimeline(sessionId, projectId),
      ]);
      setSession(sessionData);
      setTimeline(timelineData);
    } catch (err) {
      console.error("Failed to load session:", err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, projectId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    return subscribe((event) => {
      if (event.type === "session:update" && event.sessionId === sessionId) {
        loadSession();
      }
    });
  }, [subscribe, sessionId, loadSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length]);

  if (loading) return <LoadingSpinner />;
  if (!session) return <div className="p-6 text-gray-400">Session not found</div>;

  const title = session.aiTitle ?? session.slug ?? session.id.slice(0, 8);
  const modelShort = session.model?.replace("claude-", "") ?? "unknown";
  const totalTokens = session.totalInputTokens + session.totalOutputTokens;
  const cost = session.model
    ? estimateCost(session.model, {
        input_tokens: session.totalInputTokens,
        output_tokens: session.totalOutputTokens,
        cache_creation_input_tokens: session.totalCacheCreationTokens,
        cache_read_input_tokens: session.totalCacheReadTokens,
      })
    : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 p-4">
        <div className="mb-1 text-sm text-gray-500">
          <Link to="/" className="hover:text-gray-300">
            Dashboard
          </Link>
          {" / "}
          <Link to={`/projects/${encodeURIComponent(projectId)}`} className="hover:text-gray-300">
            Project
          </Link>
          {" / Session"}
        </div>
        <div className="flex items-center gap-3">
          <StatusIndicator active={session.isActive} size="md" />
          <h1 className="text-xl font-bold">{title}</h1>
          <Badge variant="blue">{modelShort}</Badge>
          {session.entrypoint && <Badge>{session.entrypoint}</Badge>}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-400">
          <span>Started {formatDateTime(session.startedAt)}</span>
          {session.startedAt && session.lastActiveAt && (
            <span>Duration: {formatDuration(session.startedAt, session.lastActiveAt)}</span>
          )}
          <span>{session.messageCount} messages</span>
          <span>{formatTokenCount(totalTokens)} tokens</span>
          <span>${cost.toFixed(3)} est.</span>
          {session.gitBranch && <span>Branch: {session.gitBranch}</span>}
        </div>

        {/* Token summary bar */}
        <div className="mt-3 grid grid-cols-4 gap-3 text-xs">
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
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800 px-4">
        {(["workflow", "messages", "tokens", "subagents"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 px-4 py-2 text-sm capitalize transition-colors ${
              activeTab === tab
                ? "border-blue-500 text-white"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab}
            {tab === "subagents" && session.subagents.length > 0 && (
              <span className="ml-1 text-xs text-gray-500">({session.subagents.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "messages" && (
          <MessagePanel
            messages={session.messages}
            showToolUse={showToolUse}
            showThinking={showThinking}
            onToggleToolUse={() => setShowToolUse(!showToolUse)}
            onToggleThinking={() => setShowThinking(!showThinking)}
            messagesEndRef={messagesEndRef}
          />
        )}
        {activeTab === "tokens" && timeline && <TokenChart timeline={timeline} />}
        {activeTab === "subagents" && <SubagentList subagents={session.subagents} />}
        {activeTab === "workflow" && (
          <SessionWorkflow
            messages={session.messages}
            subagents={session.subagents}
            sessionId={session.id}
            projectId={projectId}
          />
        )}
      </div>
    </div>
  );
}

function MessagePanel({
  messages,
  showToolUse,
  showThinking,
  onToggleToolUse,
  onToggleThinking,
  messagesEndRef,
}: {
  messages: readonly ParsedMessage[];
  showToolUse: boolean;
  showThinking: boolean;
  onToggleToolUse: () => void;
  onToggleThinking: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="p-4">
      <div className="mb-3 flex gap-3">
        <label className="flex items-center gap-1 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={showToolUse}
            onChange={onToggleToolUse}
            className="rounded"
          />
          Tool Use
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={showThinking}
            onChange={onToggleThinking}
            className="rounded"
          />
          Thinking
        </label>
      </div>
      <div className="space-y-3">
        {messages
          .filter((m) => !m.isSidechain)
          .map((msg) => (
            <MessageBubble
              key={msg.uuid}
              message={msg}
              showToolUse={showToolUse}
              showThinking={showThinking}
            />
          ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  showToolUse,
  showThinking,
}: {
  message: ParsedMessage;
  showToolUse: boolean;
  showThinking: boolean;
}) {
  if (message.type === "system") return null;

  if (message.type === "user") {
    const text =
      typeof message.content === "string"
        ? message.content
        : (message.content as readonly ContentBlock[])
            .filter((b): b is { type: "text"; text: string } => b.type === "text")
            .map((b) => b.text)
            .join("\n");

    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg bg-blue-900/30 px-4 py-2">
          <pre className="whitespace-pre-wrap text-sm text-blue-100">
            {text.slice(0, 500)}
            {text.length > 500 ? "..." : ""}
          </pre>
          <div className="mt-1 text-right text-xs text-gray-500">
            {formatRelativeTime(message.timestamp)}
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  const blocks = message.content as readonly ContentBlock[];
  const textBlocks = blocks.filter((b): b is { type: "text"; text: string } => b.type === "text");
  const toolBlocks = blocks.filter(
    (b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
      b.type === "tool_use"
  );
  const thinkingBlocks = blocks.filter(
    (b): b is { type: "thinking"; thinking: string } => b.type === "thinking"
  );

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] space-y-2">
        {showThinking &&
          thinkingBlocks.map((b, i) => (
            <div key={i} className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-2">
              <div className="mb-1 text-xs text-gray-500">Thinking</div>
              <pre className="whitespace-pre-wrap text-sm italic text-gray-400">
                {b.thinking.slice(0, 300)}
                {b.thinking.length > 300 ? "..." : ""}
              </pre>
            </div>
          ))}
        {textBlocks.map((b, i) => (
          <div key={i} className="rounded-lg bg-gray-800 px-4 py-2">
            <pre className="whitespace-pre-wrap text-sm text-gray-200">
              {b.text.slice(0, 1000)}
              {b.text.length > 1000 ? "..." : ""}
            </pre>
          </div>
        ))}
        {showToolUse &&
          toolBlocks.map((b, i) => (
            <div key={i} className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2">
              <Badge variant="yellow">{b.name}</Badge>
              <pre className="mt-1 max-h-32 overflow-auto text-xs text-gray-400">
                {JSON.stringify(b.input, null, 2).slice(0, 500)}
              </pre>
            </div>
          ))}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{formatRelativeTime(message.timestamp)}</span>
          {message.usage && (
            <span>
              {formatTokenCount(message.usage.input_tokens + message.usage.output_tokens)} tokens
            </span>
          )}
          {message.agentId && <Badge variant="purple">agent</Badge>}
        </div>
      </div>
    </div>
  );
}

function TokenChart({ timeline }: { timeline: SessionTokenTimeline }) {
  const data = timeline.points.map((p) => ({
    index: p.messageIndex,
    input: p.cumulativeInput,
    output: p.cumulativeOutput,
    cacheWrite: p.cumulativeCacheCreation,
    cacheRead: p.cumulativeCacheRead,
  }));

  return (
    <div className="p-6">
      <h3 className="mb-4 text-lg font-semibold">Cumulative Token Usage</h3>
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="index"
            stroke="#6b7280"
            label={{ value: "Message #", position: "insideBottom", offset: -5 }}
          />
          <YAxis stroke="#6b7280" tickFormatter={(v: number) => formatTokenCount(v)} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "8px",
            }}
            labelFormatter={(label: number) => `Message #${label}`}
            formatter={(value: number) => [formatTokenCount(value), ""]}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="input"
            stackId="1"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.3}
            name="Input"
          />
          <Area
            type="monotone"
            dataKey="output"
            stackId="1"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.3}
            name="Output"
          />
          <Area
            type="monotone"
            dataKey="cacheWrite"
            stackId="1"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.3}
            name="Cache Write"
          />
          <Area
            type="monotone"
            dataKey="cacheRead"
            stackId="1"
            stroke="#8b5cf6"
            fill="#8b5cf6"
            fillOpacity={0.3}
            name="Cache Read"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SubagentList({ subagents }: { subagents: Session["subagents"] }) {
  if (subagents.length === 0) {
    return <div className="p-6 text-gray-500">No subagents in this session</div>;
  }

  return (
    <div className="space-y-3 p-6">
      {subagents.map((agent) => (
        <div key={agent.agentId} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <div className="flex items-center gap-2">
            <Badge variant="purple">{agent.agentType}</Badge>
            <span className="text-sm font-medium">{agent.description}</span>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-gray-400">
            <span>{agent.messageCount} messages</span>
            <span>{formatTokenCount(agent.totalInputTokens + agent.totalOutputTokens)} tokens</span>
            {agent.model && <span>{agent.model.replace("claude-", "")}</span>}
            {agent.lastActiveAt && <span>{formatRelativeTime(agent.lastActiveAt)}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

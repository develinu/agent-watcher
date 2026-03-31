import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import type { Project, SessionSummary } from "@agent-watcher/shared";
import { api } from "../lib/api.js";
import { useWs } from "../hooks/useWsContext.js";
import { formatTokenCount, formatRelativeTime, formatDuration } from "../lib/format.js";
import { StatusIndicator } from "../components/common/StatusIndicator.js";
import { Badge } from "../components/common/Badge.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";
import { ProjectWorkflow } from "../components/workflow/ProjectWorkflow.js";

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"date" | "tokens">("date");
  const [view, setView] = useState<"list" | "workflow">("workflow");
  const { subscribe } = useWs();

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await api.getProject(projectId);
      setProject(data);
    } catch (err) {
      console.error("Failed to load project:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    return subscribe((event) => {
      if (event.type === "session:update" && event.projectId === projectId) {
        loadProject();
      }
    });
  }, [subscribe, projectId, loadProject]);

  if (loading) return <LoadingSpinner />;
  if (!project) return <div className="p-6 text-gray-400">Project not found</div>;

  const sorted = [...project.sessions].sort((a, b) => {
    if (sortBy === "tokens") {
      return b.totalInputTokens + b.totalOutputTokens - (a.totalInputTokens + a.totalOutputTokens);
    }
    return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
  });

  return (
    <div className="p-6">
      <div className="mb-1 text-sm text-gray-500">
        <Link to="/" className="hover:text-gray-300">
          Dashboard
        </Link>{" "}
        / Project
      </div>
      <h1 className="mb-1 text-2xl font-bold">{project.name}</h1>
      <p className="mb-6 text-sm text-gray-500">{project.path}</p>

      <div className="mb-4 flex items-center gap-4">
        <span className="text-sm text-gray-400">{project.sessionCount} sessions</span>
        <span className="text-sm text-gray-400">
          {formatTokenCount(project.totalInputTokens + project.totalOutputTokens)} total tokens
        </span>
        <div className="ml-auto flex gap-2">
          <div className="mr-3 flex gap-1 border-r border-gray-700 pr-3">
            <button
              onClick={() => setView("workflow")}
              className={`rounded px-3 py-1 text-xs ${view === "workflow" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Workflow
            </button>
            <button
              onClick={() => setView("list")}
              className={`rounded px-3 py-1 text-xs ${view === "list" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"}`}
            >
              List
            </button>
          </div>
          {view === "list" && (
            <>
              <button
                onClick={() => setSortBy("date")}
                className={`rounded px-3 py-1 text-xs ${sortBy === "date" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"}`}
              >
                By Date
              </button>
              <button
                onClick={() => setSortBy("tokens")}
                className={`rounded px-3 py-1 text-xs ${sortBy === "tokens" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"}`}
              >
                By Tokens
              </button>
            </>
          )}
        </div>
      </div>

      {view === "list" ? (
        <div className="space-y-2">
          {sorted.map((session) => (
            <SessionRow key={session.id} session={session} projectId={project.id} />
          ))}
        </div>
      ) : (
        <ProjectWorkflow sessions={project.sessions} projectId={project.id} />
      )}
    </div>
  );
}

function SessionRow({ session, projectId }: { session: SessionSummary; projectId: string }) {
  const title = session.aiTitle ?? session.slug ?? session.id.slice(0, 8);
  const modelShort =
    session.model?.replace("claude-", "").split("-").slice(0, 2).join("-") ?? "unknown";

  return (
    <Link
      to={`/sessions/${encodeURIComponent(session.id)}?projectId=${encodeURIComponent(projectId)}`}
      className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700"
    >
      <StatusIndicator active={session.isActive} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{title}</span>
          <Badge variant="blue">{modelShort}</Badge>
          {session.entrypoint && <Badge>{session.entrypoint}</Badge>}
          {session.subagentCount > 0 && (
            <Badge variant="purple">{session.subagentCount} agents</Badge>
          )}
        </div>
        <div className="mt-1 flex gap-4 text-xs text-gray-500">
          <span>{formatRelativeTime(session.startedAt)}</span>
          {session.startedAt && session.lastActiveAt && (
            <span>{formatDuration(session.startedAt, session.lastActiveAt)}</span>
          )}
          {session.gitBranch && <span>{session.gitBranch}</span>}
        </div>
      </div>
      <div className="text-right text-sm">
        <div className="text-gray-300">
          {formatTokenCount(session.totalInputTokens + session.totalOutputTokens)}
        </div>
        <div className="text-xs text-gray-500">{session.messageCount} msgs</div>
      </div>
    </Link>
  );
}

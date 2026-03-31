import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import type { ProjectSummary } from "@agent-watcher/shared";
import { api } from "../lib/api.js";
import { useWs } from "../hooks/useWsContext.js";
import { formatTokenCount, formatRelativeTime } from "../lib/format.js";
import { StatusIndicator } from "../components/common/StatusIndicator.js";
import { Badge } from "../components/common/Badge.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";

export function DashboardPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { subscribe } = useWs();

  const loadProjects = useCallback(async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    return subscribe((event) => {
      if (event.type === "session:update" || event.type === "session:active") {
        loadProjects();
      }
    });
  }, [subscribe, loadProjects]);

  const totalTokens = projects.reduce(
    (sum, p) => sum + p.totalInputTokens + p.totalOutputTokens,
    0
  );
  const totalSessions = projects.reduce((sum, p) => sum + p.sessionCount, 0);
  const activeSessions = projects.reduce((sum, p) => sum + p.activeSessionCount, 0);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Projects" value={projects.length.toString()} />
        <StatCard label="Total Sessions" value={totalSessions.toString()} />
        <StatCard
          label="Active Sessions"
          value={activeSessions.toString()}
          highlight={activeSessions > 0}
        />
        <StatCard label="Total Tokens" value={formatTokenCount(totalTokens)} />
      </div>

      {/* Active Sessions */}
      {activeSessions > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-emerald-400">Active Sessions</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {projects
              .filter((p) => p.activeSessionCount > 0)
              .map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${encodeURIComponent(p.id)}`}
                  className="rounded-lg border border-emerald-800/50 bg-gray-900 p-4 transition-colors hover:border-emerald-700"
                >
                  <div className="flex items-center gap-2">
                    <StatusIndicator active />
                    <span className="font-medium">{p.name}</span>
                    <Badge variant="green">{p.activeSessionCount} active</Badge>
                  </div>
                  <p className="mt-1 text-sm text-gray-400">{p.path}</p>
                </Link>
              ))}
          </div>
        </section>
      )}

      {/* All Projects */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Projects</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${encodeURIComponent(p.id)}`}
              className="rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{p.name}</span>
                {p.activeSessionCount > 0 && <StatusIndicator active />}
              </div>
              <p className="mt-1 truncate text-sm text-gray-500">{p.path}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                <span>{p.sessionCount} sessions</span>
                <span>{formatTokenCount(p.totalInputTokens + p.totalOutputTokens)} tokens</span>
                {p.lastActiveAt && <span>{formatRelativeTime(p.lastActiveAt)}</span>}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="text-sm text-gray-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${highlight ? "text-emerald-400" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { TokenAnalytics } from "@agent-watcher/shared";
import { api } from "../lib/api.js";
import { formatTokenCount, formatCost } from "../lib/format.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

type DateRange = "7d" | "30d" | "90d" | "all";

export function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<TokenAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>("30d");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const from = range !== "all" ? getFromDate(range) : undefined;
        const data = await api.getTokenAnalytics(from);
        setAnalytics(data);
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [range]);

  if (loading) return <LoadingSpinner />;
  if (!analytics) return <div className="p-6 text-gray-400">Failed to load analytics</div>;

  return (
    <div className="p-6">
      <div className="mb-1 text-sm text-gray-500">
        <Link to="/" className="hover:text-gray-300">
          Dashboard
        </Link>{" "}
        / Analytics
      </div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Token Analytics</h1>
        <div className="flex gap-1 rounded-lg bg-gray-900 p-1">
          {(["7d", "30d", "90d", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1 text-xs ${
                range === r ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {r === "all" ? "All" : r}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Total Input Tokens</div>
          <div className="mt-1 text-2xl font-bold text-blue-400">
            {formatTokenCount(analytics.totalInput)}
          </div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Total Output Tokens</div>
          <div className="mt-1 text-2xl font-bold text-green-400">
            {formatTokenCount(analytics.totalOutput)}
          </div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <div className="text-sm text-gray-400">Estimated Cost</div>
          <div className="mt-1 text-2xl font-bold text-yellow-400">
            {formatCost(analytics.totalEstimatedCost)}
          </div>
        </div>
      </div>

      {/* Daily Usage Chart */}
      {analytics.daily.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">Daily Token Usage</h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={[...analytics.daily]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} />
              <YAxis stroke="#6b7280" tickFormatter={(v: number) => formatTokenCount(v)} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [formatTokenCount(value), ""]}
              />
              <Legend />
              <Bar dataKey="inputTokens" fill="#3b82f6" name="Input" stackId="tokens" />
              <Bar dataKey="outputTokens" fill="#10b981" name="Output" stackId="tokens" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Model Distribution */}
      {analytics.byModel.length > 0 && (
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-lg font-semibold">Token Distribution by Model</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.byModel.map((m) => ({
                    name: m.model.replace("claude-", ""),
                    value: m.inputTokens + m.outputTokens,
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }: { name: string; percent: number }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {analytics.byModel.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [formatTokenCount(value), "tokens"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold">Cost by Model</h2>
            <div className="space-y-3">
              {[...analytics.byModel]
                .sort((a, b) => b.estimatedCost - a.estimatedCost)
                .map((m, i) => (
                  <div key={m.model} className="rounded-lg border border-gray-800 bg-gray-900 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-sm font-medium">
                          {m.model.replace("claude-", "")}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-yellow-400">
                        {formatCost(m.estimatedCost)}
                      </span>
                    </div>
                    <div className="mt-1 flex gap-4 text-xs text-gray-400">
                      <span>In: {formatTokenCount(m.inputTokens)}</span>
                      <span>Out: {formatTokenCount(m.outputTokens)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function getFromDate(range: "7d" | "30d" | "90d"): string {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

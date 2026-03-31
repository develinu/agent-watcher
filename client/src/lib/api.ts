const BASE_URL = "/api";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getProjects: () => fetchJson<import("@agent-watcher/shared").ProjectSummary[]>("/projects"),

  getProject: (projectId: string) =>
    fetchJson<import("@agent-watcher/shared").Project>(
      `/projects/${encodeURIComponent(projectId)}`
    ),

  getSession: (sessionId: string, projectId: string) =>
    fetchJson<import("@agent-watcher/shared").Session>(
      `/sessions/${encodeURIComponent(sessionId)}?projectId=${encodeURIComponent(projectId)}`
    ),

  getSessionTimeline: (sessionId: string, projectId: string) =>
    fetchJson<import("@agent-watcher/shared").SessionTokenTimeline>(
      `/sessions/${encodeURIComponent(sessionId)}/timeline?projectId=${encodeURIComponent(projectId)}`
    ),

  getTokenAnalytics: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return fetchJson<import("@agent-watcher/shared").TokenAnalytics>(
      `/analytics/tokens${qs ? `?${qs}` : ""}`
    );
  },

  getActiveSessions: () =>
    fetchJson<{ sessionId: string; projectId: string; lastModified: number }[]>(
      "/analytics/active"
    ),

  analyzeSession: (sessionId: string, projectId: string) =>
    fetchJson<import("@agent-watcher/shared").SessionAnalysis>(
      `/sessions/${encodeURIComponent(sessionId)}/analyze?projectId=${encodeURIComponent(projectId)}`
    ),
};

import { useState, useEffect, useCallback } from "react";
import type { Project } from "@agent-watcher/shared";

function cwdToProjectId(cwd: string): string {
  return cwd.replace(/\//g, "-");
}

interface UseProjectResult {
  readonly projectId: string | null;
  readonly project: Project | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
}

export function useProject(
  host: string,
  port: number,
  projectIdOverride?: string
): UseProjectResult {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(
        `http://${host}:${port}/api/projects/${encodeURIComponent(projectId)}`
      );
      if (res.ok) setProject((await res.json()) as Project);
    } catch {
      // ignore transient errors on background refetch
    }
  }, [host, port, projectId]);

  useEffect(() => {
    const base = `http://${host}:${port}/api`;
    const derivedId = projectIdOverride ?? cwdToProjectId(process.cwd());
    const controller = new AbortController();
    const { signal } = controller;

    async function detect() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`${base}/projects/${encodeURIComponent(derivedId)}`, { signal });
        if (signal.aborted) return;
        if (res.ok) {
          const data = (await res.json()) as Project;
          if (signal.aborted) return;
          setProjectId(derivedId);
          setProject(data);
          setIsLoading(false);
          return;
        }

        // Fallback: search all projects by path
        if (!projectIdOverride) {
          const cwd = process.cwd();
          const allRes = await fetch(`${base}/projects`, { signal });
          if (signal.aborted) return;
          if (allRes.ok) {
            const projects = (await allRes.json()) as Project[];
            if (signal.aborted) return;
            const match = projects.find((p) => p.path === cwd);
            if (match) {
              setProjectId(match.id);
              setProject(match);
              setIsLoading(false);
              return;
            }
          }
        }

        setError(
          `No sessions found for this directory.\nHave you used Claude Code in ${process.cwd()}?`
        );
      } catch (err: unknown) {
        if (signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(`Cannot connect to server at http://${host}:${port}\n${msg}`);
      } finally {
        if (!signal.aborted) setIsLoading(false);
      }
    }

    void detect();

    return () => {
      controller.abort();
    };
  }, [host, port, projectIdOverride]);

  return { projectId, project, isLoading, error, refetch };
}

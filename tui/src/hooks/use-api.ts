import { useState, useEffect, useCallback, useRef } from "react";
import type { Session, SessionAnalysis, Project } from "@agent-watcher/shared";

interface FetchState<T> {
  readonly data: T | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}

export function useSessionList(
  host: string,
  port: number,
  projectId: string | null
): FetchState<Project> & { refetch: () => void } {
  const [state, setState] = useState<FetchState<Project>>({
    data: null,
    isLoading: false,
    error: null,
  });
  const controllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const res = await fetch(
        `http://${host}:${port}/api/projects/${encodeURIComponent(projectId)}`,
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Project;
      if (controller.signal.aborted) return;
      setState({ data, isLoading: false, error: null });
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : "Fetch failed";
      setState((prev) => ({ ...prev, isLoading: false, error: msg }));
    }
  }, [host, port, projectId]);

  useEffect(() => {
    void fetchData();
    return () => {
      controllerRef.current?.abort();
    };
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}

export function useSession(
  host: string,
  port: number,
  sessionId: string | null,
  projectId: string | null
): FetchState<Session> & { refetch: () => void } {
  const [state, setState] = useState<FetchState<Session>>({
    data: null,
    isLoading: false,
    error: null,
  });
  const controllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!sessionId || !projectId) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const url = `http://${host}:${port}/api/sessions/${encodeURIComponent(sessionId)}?projectId=${encodeURIComponent(projectId)}`;
      const res = await fetch(url, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Session;
      if (controller.signal.aborted) return;
      setState({ data, isLoading: false, error: null });
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : "Fetch failed";
      setState((prev) => ({ ...prev, isLoading: false, error: msg }));
    }
  }, [host, port, sessionId, projectId]);

  useEffect(() => {
    void fetchData();
    return () => {
      controllerRef.current?.abort();
    };
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}

export function useAnalysis(
  host: string,
  port: number,
  sessionId: string | null,
  projectId: string | null
): FetchState<SessionAnalysis> & { refetch: () => void } {
  const [state, setState] = useState<FetchState<SessionAnalysis>>({
    data: null,
    isLoading: false,
    error: null,
  });
  const controllerRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    if (!sessionId || !projectId) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const url = `http://${host}:${port}/api/sessions/${encodeURIComponent(sessionId)}/analyze?projectId=${encodeURIComponent(projectId)}`;
      const res = await fetch(url, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SessionAnalysis;
      if (controller.signal.aborted) return;
      setState({ data, isLoading: false, error: null });
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : "Fetch failed";
      setState((prev) => ({ ...prev, isLoading: false, error: msg }));
    }
  }, [host, port, sessionId, projectId]);

  useEffect(() => {
    void fetchData();
    return () => {
      controllerRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchData]);

  // Debounced refetch (5s) to respect rate limits
  const debouncedRefetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchData();
    }, 5000);
  }, [fetchData]);

  return { ...state, refetch: debouncedRefetch };
}

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import type { SessionSummary, WsEvent } from "@agent-watcher/shared";
import { useProject } from "./hooks/use-project.js";
import { useSession, useAnalysis } from "./hooks/use-api.js";
import { useWs } from "./hooks/use-ws.js";
import { buildPhasesFromAnalysis, detectPhases } from "./lib/tree-layout.js";
import { SessionList } from "./components/session-list.js";
import { WorkflowTree } from "./components/workflow-tree.js";
import { PhaseDetail } from "./components/phase-detail.js";
import { StatusBar } from "./components/status-bar.js";

interface AppProps {
  readonly host: string;
  readonly port: number;
  readonly projectIdOverride?: string;
}

type FocusPanel = "sessions" | "workflow";

export function App({ host, port, projectIdOverride }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const termWidth = stdout?.columns ?? 120;

  // Project detection
  const {
    projectId,
    project,
    isLoading: projectLoading,
    error: projectError,
  } = useProject(host, port, projectIdOverride);

  // Session list (from project data)
  const sessions: readonly SessionSummary[] = useMemo(() => {
    if (!project) return [];
    return [...project.sessions].sort(
      (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );
  }, [project]);

  // UI state
  const [focusPanel, setFocusPanel] = useState<FocusPanel>("sessions");
  const [sessionIndex, setSessionIndex] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<Set<string>>(new Set());

  // Fetch selected session data & analysis (reuses cached server analysis — no LLM call)
  const { data: sessionData, refetch: refetchSession } = useSession(
    host,
    port,
    selectedSessionId,
    projectId
  );

  const { data: analysisData, refetch: refetchAnalysis } = useAnalysis(
    host,
    port,
    selectedSessionId,
    projectId
  );

  // Build phases from server's cached analysis or fallback heuristic
  const phases = useMemo(() => {
    if (!sessionData) return [];
    if (analysisData) {
      return buildPhasesFromAnalysis(analysisData, sessionData.messages);
    }
    return detectPhases(sessionData.messages);
  }, [sessionData, analysisData]);

  // WebSocket: real-time updates
  const { isConnected, subscribe } = useWs(host, port);

  useEffect(() => {
    const unsubscribe = subscribe((event: WsEvent) => {
      if (event.type === "session:active") {
        setActiveSessions(new Set(event.activeSessions.map((s) => s.sessionId)));
      }

      if (event.type === "session:update" && event.sessionId === selectedSessionId) {
        refetchSession();
        refetchAnalysis(); // debounced 5s internally
      }
    });

    return unsubscribe;
  }, [subscribe, selectedSessionId, refetchSession, refetchAnalysis]);

  // Clamp sessionIndex when sessions list changes
  useEffect(() => {
    setSessionIndex((prev) => Math.min(prev, Math.max(0, sessions.length - 1)));
  }, [sessions.length]);

  // Auto-scroll to last phase when phases update
  useEffect(() => {
    if (phases.length > 0 && focusPanel === "workflow") {
      setPhaseIndex(phases.length - 1);
    }
  }, [phases.length, focusPanel]);

  // Keyboard navigation
  const handleSelectSession = useCallback(() => {
    const session = sessions[sessionIndex];
    if (session) {
      setSelectedSessionId(session.id);
      setPhaseIndex(0);
      setFocusPanel("workflow");
    }
  }, [sessions, sessionIndex]);

  useInput((input, key) => {
    // Quit
    if (input === "q") {
      exit();
      return;
    }

    // Tab: switch focus panel
    if (key.tab) {
      setFocusPanel((prev) => (prev === "sessions" ? "workflow" : "sessions"));
      return;
    }

    // Escape: back to session list
    if (key.escape) {
      if (focusPanel === "workflow") {
        setFocusPanel("sessions");
        setSelectedSessionId(null);
      }
      return;
    }

    // Up/Down navigation
    if (key.upArrow) {
      if (focusPanel === "sessions") {
        setSessionIndex((prev) => Math.max(0, prev - 1));
      } else {
        setPhaseIndex((prev) => Math.max(0, prev - 1));
      }
      return;
    }

    if (key.downArrow) {
      if (focusPanel === "sessions") {
        setSessionIndex((prev) => Math.min(sessions.length - 1, prev + 1));
      } else {
        setPhaseIndex((prev) => Math.min(phases.length - 1, prev + 1));
      }
      return;
    }

    // Enter: select
    if (key.return) {
      if (focusPanel === "sessions") {
        handleSelectSession();
      }
      return;
    }
  });

  // ─── Loading state ──────────────────────────────────────────
  if (projectLoading) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color="cyan">⠋ Connecting to agent-watcher server...</Text>
      </Box>
    );
  }

  if (projectError) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color="red">Error: {projectError}</Text>
        <Text dimColor>Make sure the server is running: npm run dev</Text>
      </Box>
    );
  }

  // ─── Layout ─────────────────────────────────────────────────
  const sessionPaneWidth = Math.min(Math.floor(termWidth * 0.35), 50);
  const selectedPhase = phases[phaseIndex] ?? null;

  return (
    <Box flexDirection="column" width={termWidth} height={stdout?.rows ?? 24}>
      {/* Header */}
      <Box paddingX={1}>
        <Text bold color="cyan">
          Agent Watcher
        </Text>
        <Text dimColor> — {project?.name ?? "Unknown"}</Text>
      </Box>

      {/* Main content */}
      <Box flexGrow={1} flexDirection="row">
        {/* Session list panel */}
        <Box
          flexDirection="column"
          width={sessionPaneWidth}
          borderStyle="single"
          borderColor={focusPanel === "sessions" ? "cyan" : "gray"}
        >
          <Box paddingX={1}>
            <Text bold color={focusPanel === "sessions" ? "cyan" : undefined}>
              Sessions ({sessions.length})
            </Text>
          </Box>
          <SessionList
            sessions={sessions}
            activeSessions={activeSessions}
            selectedIndex={sessionIndex}
            isFocused={focusPanel === "sessions"}
          />
        </Box>

        {/* Workflow panel */}
        <Box flexDirection="column" flexGrow={1}>
          {selectedSessionId ? (
            <>
              {/* Workflow tree */}
              <Box
                flexDirection="column"
                flexGrow={1}
                borderStyle="single"
                borderColor={focusPanel === "workflow" ? "cyan" : "gray"}
              >
                <Box paddingX={1}>
                  <Text bold color={focusPanel === "workflow" ? "cyan" : undefined}>
                    Workflow
                  </Text>
                  {sessionData?.aiTitle && <Text dimColor> — {sessionData.aiTitle}</Text>}
                </Box>
                <WorkflowTree
                  phases={phases}
                  selectedIndex={phaseIndex}
                  isFocused={focusPanel === "workflow"}
                />
              </Box>

              {/* Phase detail */}
              {selectedPhase && focusPanel === "workflow" && <PhaseDetail phase={selectedPhase} />}
            </>
          ) : (
            <Box
              flexGrow={1}
              borderStyle="single"
              borderColor="gray"
              alignItems="center"
              justifyContent="center"
            >
              <Text dimColor>Select a session to view workflow</Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Status bar */}
      <StatusBar
        isConnected={isConnected}
        projectName={project?.name ?? ""}
        activeCount={activeSessions.size}
        focusPanel={focusPanel}
      />
    </Box>
  );
}

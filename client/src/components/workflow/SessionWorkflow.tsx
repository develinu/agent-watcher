import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Node, NodeTypes } from "@xyflow/react";
import type { ParsedMessage, Subagent, SessionAnalysis } from "@agent-watcher/shared";
import {
  detectPhases,
  buildPhasesFromAnalysis,
  buildSessionGraph,
  type PhaseNodeData,
} from "../../lib/workflow-graph.js";
import { api } from "../../lib/api.js";
import { WorkflowGraph } from "./WorkflowGraph.js";
import { PhaseNode } from "./PhaseNode.js";
import { DetailPanel, type DetailData } from "./DetailPanel.js";
import { AutoFollowToggle } from "./AutoFollowToggle.js";

const nodeTypes: NodeTypes = {
  phaseNode: PhaseNode,
};

const DEBOUNCE_MS = Number(import.meta.env.VITE_ANALYSIS_DEBOUNCE_MS) || 3000;

type AnalysisState =
  | { status: "initial-loading" }
  | { status: "ready"; data: SessionAnalysis }
  | { status: "updating"; data: SessionAnalysis }
  | { status: "failed" };

interface SessionWorkflowProps {
  readonly messages: readonly ParsedMessage[];
  readonly subagents: readonly Subagent[];
  readonly sessionId: string;
  readonly projectId: string;
}

export function SessionWorkflow({
  messages,
  subagents,
  sessionId,
  projectId,
}: SessionWorkflowProps) {
  const [analysisState, setAnalysisState] = useState<AnalysisState>({ status: "initial-loading" });
  const [autoFollow, setAutoFollow] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const msgCountRef = useRef(messages.length);

  // Track whether this is the very first load
  const isFirstLoad = analysisState.status === "initial-loading";

  const fetchAnalysis = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAnalysisState((prev) => {
      if (prev.status === "ready" || prev.status === "updating") {
        return { status: "updating", data: prev.data };
      }
      return prev; // keep initial-loading as-is
    });

    api
      .analyzeSession(sessionId, projectId)
      .then((result) => {
        if (!controller.signal.aborted) {
          setAnalysisState({ status: "ready", data: result });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAnalysisState((prev) => {
            // If we already have data, keep it instead of failing
            if (prev.status === "updating") {
              return { status: "ready", data: prev.data };
            }
            return { status: "failed" };
          });
        }
      });
  }, [sessionId, projectId]);

  // Initial load — fetch immediately
  useEffect(() => {
    fetchAnalysis();
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchAnalysis]);

  // Subsequent updates — debounce
  useEffect(() => {
    if (messages.length === msgCountRef.current) return;
    msgCountRef.current = messages.length;

    if (isFirstLoad) return; // initial fetch is already in progress

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchAnalysis, DEBOUNCE_MS);
  }, [messages.length, fetchAnalysis, isFirstLoad]);

  const fallbackPhases = useMemo(() => detectPhases(messages, subagents), [messages, subagents]);

  const phases = useMemo(() => {
    const state = analysisState;
    if ((state.status === "ready" || state.status === "updating") && state.data.phases.length > 0) {
      return buildPhasesFromAnalysis(state.data, messages, subagents);
    }
    if (state.status === "failed") {
      return fallbackPhases;
    }
    return null; // initial-loading
  }, [analysisState, messages, subagents, fallbackPhases]);

  const graph = useMemo(() => {
    if (!phases) return null;
    return buildSessionGraph(phases);
  }, [phases]);

  const focusNodeId = useMemo(() => {
    if (!phases || phases.length === 0) return undefined;
    return `phase-${phases[phases.length - 1].index}`;
  }, [phases]);

  const [detail, setDetail] = useState<DetailData>(null);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!phases) return;
      const d = node.data as unknown as PhaseNodeData;
      const phase = phases[d.phaseIndex];
      if (phase) {
        setDetail({ type: "phase", phase, subagents });
      }
    },
    [phases, subagents]
  );

  // Initial loading — full-screen spinner
  if (analysisState.status === "initial-loading") {
    return <AnalyzingIndicator />;
  }

  if (!graph || graph.nodes.length === 0) {
    return <div className="p-6 text-gray-500">No workflow data</div>;
  }

  return (
    <div className="flex h-[calc(100vh-280px)]">
      <div className="relative flex-1">
        {analysisState.status === "updating" && <UpdatingBadge />}
        <AutoFollowToggle enabled={autoFollow} onToggle={setAutoFollow} />
        <WorkflowGraph
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          focusNodeId={autoFollow ? focusNodeId : undefined}
        />
      </div>
      <DetailPanel data={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function AnalyzingIndicator() {
  return (
    <div className="flex h-[calc(100vh-280px)] items-center justify-center">
      <div className="w-72 space-y-4 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-blue-500" />
        <div>
          <p className="text-sm font-medium text-gray-300">Analyzing workflow</p>
          <p className="mt-1 text-xs text-gray-500">AI is analyzing the session workflow</p>
        </div>
        <div className="mx-auto h-1 w-48 overflow-hidden rounded-full bg-gray-800">
          <div className="h-full w-1/2 animate-[shimmer_1.5s_ease-in-out_infinite] rounded-full bg-blue-500/60" />
        </div>
      </div>
    </div>
  );
}

function UpdatingBadge() {
  return (
    <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-md bg-gray-800/90 px-3 py-1.5">
      <div className="h-3 w-3 animate-spin rounded-full border border-gray-600 border-t-blue-400" />
      <span className="text-xs text-gray-400">Updating analysis</span>
    </div>
  );
}

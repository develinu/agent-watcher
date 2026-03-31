import { useCallback, useMemo, useState } from "react";
import type { Node, NodeTypes } from "@xyflow/react";
import type { SessionSummary } from "@agent-watcher/shared";
import { buildProjectGraph, type SessionFlowNodeData } from "../../lib/workflow-graph.js";
import { WorkflowGraph } from "./WorkflowGraph.js";
import { SessionFlowNode } from "./SessionFlowNode.js";
import { DetailPanel, type DetailData } from "./DetailPanel.js";
import { AutoFollowToggle } from "./AutoFollowToggle.js";

const nodeTypes: NodeTypes = {
  sessionFlowNode: SessionFlowNode,
};

interface ProjectWorkflowProps {
  readonly sessions: readonly SessionSummary[];
  readonly projectId: string;
}

export function ProjectWorkflow({ sessions, projectId }: ProjectWorkflowProps) {
  const { nodes, edges } = useMemo(
    () => buildProjectGraph(sessions, projectId),
    [sessions, projectId]
  );

  const focusNodeId = useMemo(() => {
    if (nodes.length === 0) return undefined;
    return nodes[nodes.length - 1].id;
  }, [nodes]);

  const [autoFollow, setAutoFollow] = useState(true);
  const [detail, setDetail] = useState<DetailData>(null);

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
      ),
    [sessions]
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const d = node.data as unknown as SessionFlowNodeData;
      const session = sortedSessions[d.sessionIndex];
      if (session) {
        setDetail({ type: "session", session, projectId });
      }
    },
    [sortedSessions, projectId]
  );

  if (nodes.length === 0) {
    return <div className="p-6 text-gray-500">No sessions</div>;
  }

  return (
    <div className="flex h-[calc(100vh-280px)]">
      <div className="relative flex-1">
        <AutoFollowToggle enabled={autoFollow} onToggle={setAutoFollow} />
        <WorkflowGraph
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          focusNodeId={autoFollow ? focusNodeId : undefined}
        />
      </div>
      <DetailPanel data={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

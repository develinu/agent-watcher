import { useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface WorkflowGraphProps {
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly nodeTypes: NodeTypes;
  readonly onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  readonly focusNodeId?: string;
}

function FlowCanvas({ nodes, edges, nodeTypes, onNodeClick, focusNodeId }: WorkflowGraphProps) {
  const { fitView } = useReactFlow();
  const initializedRef = useRef(false);
  const prevFocusRef = useRef<string | undefined>(undefined);

  const handleInit = useCallback((_instance: ReactFlowInstance) => {
    initializedRef.current = true;
  }, []);

  // Focus on target node when focusNodeId or nodes change
  useEffect(() => {
    if (!initializedRef.current) return;

    if (!focusNodeId) {
      fitView({ duration: 0 });
      return;
    }

    const isNewFocus = prevFocusRef.current !== focusNodeId;
    prevFocusRef.current = focusNodeId;

    const timer = setTimeout(() => {
      fitView({
        nodes: [{ id: focusNodeId }],
        duration: isNewFocus ? 400 : 0,
        padding: 0.5,
        maxZoom: 1,
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [focusNodeId, nodes, fitView]);

  return (
    <ReactFlow
      nodes={nodes as Node[]}
      edges={edges as Edge[]}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onInit={handleInit}
      fitView
      fitViewOptions={
        focusNodeId ? { nodes: [{ id: focusNodeId }], padding: 0.5, maxZoom: 1 } : undefined
      }
      nodesDraggable={false}
      nodesConnectable={false}
      defaultEdgeOptions={{
        style: { stroke: "#4b5563" },
        type: "smoothstep",
      }}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} size={1} color="#374151" />
      <Controls className="!bg-gray-800 !border-gray-700 !shadow-lg [&>button]:!bg-gray-800 [&>button]:!border-gray-700 [&>button]:!fill-gray-300 [&>button:hover]:!bg-gray-700" />
    </ReactFlow>
  );
}

export function WorkflowGraph(props: WorkflowGraphProps) {
  return (
    <div className="h-full">
      <ReactFlowProvider>
        <FlowCanvas {...props} />
      </ReactFlowProvider>
    </div>
  );
}

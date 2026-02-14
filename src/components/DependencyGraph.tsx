"use client";

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Node,
  Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Network } from "lucide-react";
import { DependencyGraph as DepGraph } from "@/types";
import { graphToReactFlowData } from "@/lib/dependencyMapper";

interface DependencyGraphProps {
  graph: DepGraph;
}

export default function DependencyGraph({ graph }: DependencyGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => graphToReactFlowData(graph),
    [graph]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes as Node[]);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges as Edge[]);

  const onInit = useCallback(() => {
    // React Flow initialized
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          Dependency Graph
        </CardTitle>
        <div className="flex gap-2 mt-2">
          <Badge variant="outline" className="text-xs">
            <span className="w-2 h-2 rounded-full bg-[#F7B924] inline-block mr-1" />
            Contract
          </Badge>
          <Badge variant="outline" className="text-xs">
            <span className="w-2 h-2 rounded-full bg-[#38BDF8] inline-block mr-1" />
            Interface
          </Badge>
          <Badge variant="outline" className="text-xs">
            <span className="w-2 h-2 rounded-full bg-[#A78BFA] inline-block mr-1" />
            Library
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[500px] border rounded-lg overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onInit={onInit}
            connectionMode={ConnectionMode.Loose}
            fitView
            attributionPosition="bottom-left"
          >
            <Background />
            <Controls />
            <MiniMap
              nodeStrokeColor="#F7B924"
              nodeColor="#F7B924"
              nodeBorderRadius={4}
            />
          </ReactFlow>
        </div>
      </CardContent>
    </Card>
  );
}

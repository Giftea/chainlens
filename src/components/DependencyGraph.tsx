"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Node,
  Edge,
  ReactFlowInstance,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Network,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Maximize,
  X,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Shield,
  Layers,
  Zap,
  Code,
} from "lucide-react";
import {
  FullDependencyGraph,
  GraphStats,
  graphToReactFlowData,
} from "@/lib/dependencyMapper";
import { NetworkType } from "@/types";
import { getExplorerUrl } from "@/config/chains";

// ============================================================
//                    TYPES
// ============================================================

interface DependencyGraphProps {
  contractAddress: string;
  network: NetworkType;
  sourceCode?: string;
}

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; graph: FullDependencyGraph }
  | { status: "error"; message: string };

// ============================================================
//                    CONSTANTS
// ============================================================

const NODE_TYPE_LABELS: Record<string, string> = {
  main: "Main Contract",
  imported: "Imported",
  external: "External",
  library: "Library",
  interface: "Interface",
};

const NODE_TYPE_COLORS: Record<string, string> = {
  main: "#3B82F6",
  imported: "#10B981",
  external: "#F59E0B",
  library: "#8B5CF6",
  interface: "#EC4899",
};

const EDGE_TYPE_COLORS: Record<string, string> = {
  inheritance: "#EF4444",
  import: "#10B981",
  call: "#3B82F6",
  delegate: "#F59E0B",
};

const EDGE_TYPE_LABELS: Record<string, string> = {
  inheritance: "Inheritance",
  import: "Import",
  call: "Function Call",
  delegate: "Delegate Call",
};

// ============================================================
//                    MAIN COMPONENT
// ============================================================

export default function DependencyGraphViewer({
  contractAddress,
  network,
}: DependencyGraphProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [depth, setDepth] = useState(2);
  const [legendOpen, setLegendOpen] = useState(false);
  const rfInstance = useRef<ReactFlowInstance | null>(null);

  // Load graph
  const loadGraph = useCallback(async () => {
    setLoadState({ status: "loading" });
    setSelectedNode(null);

    try {
      const response = await fetch("/api/build-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: contractAddress,
          network,
          maxDepth: depth,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to build graph");
      }

      setLoadState({ status: "success", graph: data.graph });
    } catch (error) {
      setLoadState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to build graph",
      });
    }
  }, [contractAddress, network, depth]);

  // Load on mount
  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          <span className="font-semibold">Dependency Graph</span>
          {loadState.status === "success" && (
            <Badge variant="secondary" className="text-xs">
              {loadState.graph.stats.totalContracts} contracts
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Depth control */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Depth:</span>
            {[1, 2, 3].map((d) => (
              <button
                key={d}
                onClick={() => setDepth(d)}
                className={`w-6 h-6 rounded text-xs font-medium transition-colors ${
                  depth === d
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadGraph}
            disabled={loadState.status === "loading"}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadState.status === "loading" ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => rfInstance.current?.fitView({ padding: 0.2 })}
          >
            <Maximize className="h-3.5 w-3.5 mr-1" />
            Fit
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLegendOpen(!legendOpen)}
          >
            <BookOpen className="h-3.5 w-3.5 mr-1" />
            Legend
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      {loadState.status === "success" && (
        <StatsBar stats={loadState.graph.stats} />
      )}

      {/* Main graph area */}
      <div className="relative border rounded-lg overflow-hidden bg-[#0d1117]" style={{ height: 600 }}>
        {loadState.status === "loading" && <LoadingOverlay />}
        {loadState.status === "error" && (
          <ErrorOverlay message={loadState.message} onRetry={loadGraph} />
        )}
        {loadState.status === "success" && (
          <GraphCanvas
            graph={loadState.graph}
            onNodeSelect={setSelectedNode}
            onInit={(instance) => { rfInstance.current = instance; }}
          />
        )}
        {loadState.status === "idle" && <LoadingOverlay />}

        {/* Legend overlay */}
        {legendOpen && (
          <div className="absolute top-3 right-3 z-10">
            <GraphLegend onClose={() => setLegendOpen(false)} />
          </div>
        )}

        {/* Node detail panel */}
        {selectedNode && loadState.status === "success" && (
          <div className="absolute bottom-3 left-3 z-10 max-w-xs">
            <NodeDetailPanel
              node={selectedNode}
              graph={loadState.graph}
              network={network}
              onClose={() => setSelectedNode(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
//                    GRAPH CANVAS
// ============================================================

function GraphCanvas({
  graph,
  onNodeSelect,
  onInit,
}: {
  graph: FullDependencyGraph;
  onNodeSelect: (node: Node | null) => void;
  onInit: (instance: ReactFlowInstance) => void;
}) {
  const { nodes: rfNodes, edges: rfEdges } = useMemo(
    () => graphToReactFlowData(graph),
    [graph]
  );

  const [nodes, , onNodesChange] = useNodesState(rfNodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges as Edge[]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeSelect(node);

      // Highlight connected edges
      setEdges((eds) =>
        eds.map((edge) => {
          const connected =
            edge.source === node.id || edge.target === node.id;
          return {
            ...edge,
            animated: connected,
            style: {
              ...edge.style,
              strokeWidth: connected ? 3 : 1,
              opacity: connected ? 1 : 0.4,
            },
          };
        })
      );
    },
    [onNodeSelect, setEdges]
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect(null);
    // Reset edge styles
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        animated: edge.data?.originalAnimated ?? false,
        style: {
          ...edge.style,
          strokeWidth: edge.data?.originalStrokeWidth ?? 1,
          opacity: 1,
        },
      }))
    );
  }, [onNodeSelect, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onPaneClick={handlePaneClick}
      onInit={onInit}
      connectionMode={ConnectionMode.Loose}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={3}
      attributionPosition="bottom-left"
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#1e293b" gap={20} size={1} />
      <Controls
        showInteractive={false}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      />
      <MiniMap
        nodeStrokeColor="#3B82F6"
        nodeColor={(node) => {
          const nodeType = node.data?.nodeType || "imported";
          return NODE_TYPE_COLORS[nodeType] || "#3B82F6";
        }}
        maskColor="rgba(0,0,0,0.7)"
        style={{
          background: "#0d1117",
          border: "1px solid #1e293b",
        }}
      />

      {/* Node count panel */}
      <Panel position="top-left">
        <div className="text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded border">
          {nodes.length} nodes &middot; {edges.length} edges
        </div>
      </Panel>
    </ReactFlow>
  );
}

// ============================================================
//                    STATS BAR
// ============================================================

function StatsBar({ stats }: { stats: GraphStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
      <StatChip
        icon={<Layers className="h-3 w-3" />}
        label="Contracts"
        value={stats.totalContracts}
      />
      <StatChip
        icon={<Zap className="h-3 w-3" />}
        label="Calls"
        value={stats.externalCalls}
      />
      <StatChip
        icon={<Code className="h-3 w-3" />}
        label="Imports"
        value={stats.importCount}
      />
      <StatChip
        icon={<BookOpen className="h-3 w-3" />}
        label="Libraries"
        value={stats.libraryCount}
      />
      <StatChip
        icon={<Shield className="h-3 w-3" />}
        label="Interfaces"
        value={stats.interfaceCount}
      />
      <StatChip
        icon={<Network className="h-3 w-3" />}
        label="Depth"
        value={stats.inheritanceDepth}
      />
      {stats.proxyDetected && (
        <StatChip
          icon={<AlertTriangle className="h-3 w-3 text-amber-500" />}
          label="Proxy"
          value="Yes"
          highlight
        />
      )}
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 border rounded-md px-2.5 py-1.5 text-xs ${
        highlight
          ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
          : "bg-muted/30"
      }`}
    >
      {icon}
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

// ============================================================
//                    LEGEND
// ============================================================

function GraphLegend({ onClose }: { onClose: () => void }) {
  return (
    <Card className="w-56 shadow-lg">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase text-muted-foreground">
            Legend
          </span>
          <button onClick={onClose} className="p-0.5 hover:bg-muted rounded">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Node types */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            Nodes
          </span>
          {Object.entries(NODE_TYPE_LABELS).map(([type, label]) => (
            <div key={type} className="flex items-center gap-2 text-xs">
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ background: NODE_TYPE_COLORS[type] }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Edge types */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            Edges
          </span>
          {Object.entries(EDGE_TYPE_LABELS).map(([type, label]) => (
            <div key={type} className="flex items-center gap-2 text-xs">
              <span
                className="w-4 h-0.5 shrink-0"
                style={{
                  background: EDGE_TYPE_COLORS[type],
                  borderStyle: type === "import" ? "dashed" : "solid",
                }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
//                 NODE DETAIL PANEL
// ============================================================

function NodeDetailPanel({
  node,
  graph,
  network,
  onClose,
}: {
  node: Node;
  graph: FullDependencyGraph;
  network: NetworkType;
  onClose: () => void;
}) {
  const data = node.data || {};
  const nodeType = data.nodeType || "imported";
  const address = data.address || "";
  const hasAddress = address && address.length === 42;

  // Find connected edges
  const connectedEdges = graph.edges.filter(
    (e) => e.source === node.id || e.target === node.id
  );

  const incomingEdges = connectedEdges.filter((e) => e.target === node.id);
  const outgoingEdges = connectedEdges.filter((e) => e.source === node.id);

  return (
    <Card className="w-72 shadow-lg">
      <CardContent className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ background: NODE_TYPE_COLORS[nodeType] || "#888" }}
            />
            <span className="font-semibold text-sm truncate">
              {data.label || node.id}
            </span>
          </div>
          <button onClick={onClose} className="p-0.5 hover:bg-muted rounded">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Type badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className="text-[10px]"
            style={{
              borderColor: NODE_TYPE_COLORS[nodeType],
              color: NODE_TYPE_COLORS[nodeType],
            }}
          >
            {NODE_TYPE_LABELS[nodeType] || nodeType}
          </Badge>
          {data.verified && (
            <Badge variant="outline" className="text-[10px] text-green-500 border-green-500/30">
              Verified
            </Badge>
          )}
          {data.functionCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {data.functionCount} functions
            </Badge>
          )}
        </div>

        {/* Address */}
        {hasAddress && (
          <div className="flex items-center gap-1.5">
            <code className="text-[10px] font-mono text-muted-foreground truncate flex-1">
              {address}
            </code>
            <a
              href={getExplorerUrl(network, address)}
              target="_blank"
              rel="noopener noreferrer"
              className="p-0.5 hover:bg-muted rounded shrink-0"
              title="View on BSCScan"
            >
              <ExternalLink className="h-3 w-3 text-primary" />
            </a>
          </div>
        )}

        {/* Connections */}
        {connectedEdges.length > 0 && (
          <div className="space-y-1 pt-1 border-t">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
              Connections ({connectedEdges.length})
            </span>
            {incomingEdges.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <ChevronRight className="h-3 w-3 inline mr-0.5 text-green-500" />
                {incomingEdges.length} incoming
              </div>
            )}
            {outgoingEdges.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <ChevronDown className="h-3 w-3 inline mr-0.5 text-blue-500" />
                {outgoingEdges.length} outgoing
              </div>
            )}

            {/* Edge details (show up to 5) */}
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {connectedEdges.slice(0, 5).map((edge, i) => {
                const isOutgoing = edge.source === node.id;
                const otherNodeId = isOutgoing ? edge.target : edge.source;
                const otherNode = graph.nodes.find((n) => n.id === otherNodeId);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{
                        background: EDGE_TYPE_COLORS[edge.type] || "#888",
                      }}
                    />
                    <span className="truncate">
                      {isOutgoing ? "\u2192" : "\u2190"}{" "}
                      {otherNode?.label || otherNodeId.slice(0, 12)}
                    </span>
                    {edge.label && (
                      <span className="text-muted-foreground/60">
                        ({edge.label})
                      </span>
                    )}
                  </div>
                );
              })}
              {connectedEdges.length > 5 && (
                <span className="text-[10px] text-muted-foreground/50">
                  +{connectedEdges.length - 5} more...
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
//                    LOADING / ERROR
// ============================================================

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1117] z-10">
      <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
      <p className="text-sm font-medium">Analyzing contract dependencies...</p>
      <p className="text-xs text-muted-foreground mt-1">
        This may take 10-30 seconds for complex protocols
      </p>
    </div>
  );
}

function ErrorOverlay({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1117] z-10">
      <AlertTriangle className="h-8 w-8 text-red-500 mb-3" />
      <p className="text-sm font-medium mb-1">Failed to build dependency graph</p>
      <p className="text-xs text-muted-foreground mb-4 max-w-sm text-center">
        {message}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5 mr-1" />
        Retry
      </Button>
    </div>
  );
}

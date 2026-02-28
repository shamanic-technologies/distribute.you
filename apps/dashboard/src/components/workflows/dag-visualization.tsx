"use client";

import type { DAG, DAGNode, DAGEdge } from "@/lib/api";

/**
 * Topological sort using Kahn's algorithm.
 * Returns nodes in execution order based on edges.
 */
export function topologicalSort(nodes: DAGNode[], edges: DAGEdge[]): DAGNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    adjacency.get(edge.from)?.push(edge.to);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: DAGNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodeMap.get(id);
    if (node) sorted.push(node);
    for (const neighbor of adjacency.get(id) ?? []) {
      const deg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }

  // Add any remaining nodes (disconnected)
  for (const node of nodes) {
    if (!sorted.find((n) => n.id === node.id)) {
      sorted.push(node);
    }
  }

  return sorted;
}

// Node type styling
const NODE_STYLES: Record<string, { gradient: string; border: string; iconBg: string; label: string }> = {
  "http.call": {
    gradient: "from-blue-50 to-blue-100/60",
    border: "border-blue-200",
    iconBg: "bg-blue-500",
    label: "HTTP",
  },
  condition: {
    gradient: "from-amber-50 to-amber-100/60",
    border: "border-amber-200",
    iconBg: "bg-amber-500",
    label: "Condition",
  },
  wait: {
    gradient: "from-slate-50 to-slate-100/60",
    border: "border-slate-200",
    iconBg: "bg-slate-500",
    label: "Wait",
  },
  "for-each": {
    gradient: "from-violet-50 to-violet-100/60",
    border: "border-violet-200",
    iconBg: "bg-violet-500",
    label: "Loop",
  },
};

const ERROR_STYLE = {
  gradient: "from-red-50 to-red-100/60",
  border: "border-red-200",
  iconBg: "bg-red-500",
  label: "Error",
};

const DEFAULT_STYLE = {
  gradient: "from-slate-50 to-slate-100/60",
  border: "border-slate-200",
  iconBg: "bg-slate-500",
  label: "Step",
};

function NodeIcon({ type }: { type: string }) {
  const cls = "w-3.5 h-3.5 text-white";
  switch (type) {
    case "http.call":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
        </svg>
      );
    case "condition":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      );
    case "wait":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "for-each":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    default:
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      );
  }
}

function getNodeConfig(node: DAGNode): string | null {
  const cfg = node.config || {};
  switch (node.type) {
    case "http.call": {
      const method = (cfg.method as string)?.toUpperCase() || "GET";
      const service = (cfg.service as string) || "";
      const path = (cfg.path as string) || "";
      return `${method} ${service}${path}`;
    }
    case "wait":
      return cfg.seconds ? `${cfg.seconds}s delay` : null;
    case "for-each":
      return cfg.iterator ? `Iterator: ${cfg.iterator}` : null;
    default:
      return null;
  }
}

function DAGNodeCard({ node, isErrorHandler }: { node: DAGNode; isErrorHandler: boolean }) {
  const style = isErrorHandler
    ? ERROR_STYLE
    : NODE_STYLES[node.type] ?? DEFAULT_STYLE;
  const configText = getNodeConfig(node);
  const mappings = node.inputMapping ? Object.entries(node.inputMapping) : [];

  return (
    <div
      className={`
        relative bg-gradient-to-br ${style.gradient} border ${style.border}
        rounded-xl p-4 shadow-sm
        ${isErrorHandler ? "border-dashed" : ""}
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`w-7 h-7 ${style.iconBg} rounded-lg flex items-center justify-center shadow-sm`}>
          <NodeIcon type={node.type} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-gray-800 truncate block">{node.id}</span>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 bg-white/70 px-2 py-0.5 rounded-full border border-gray-200/60">
          {style.label}
        </span>
      </div>

      {/* Config */}
      {configText && (
        <div className="bg-white/50 rounded-lg px-3 py-1.5 mb-2">
          <code className="text-xs text-gray-700 font-mono break-all">{configText}</code>
        </div>
      )}

      {/* Input mappings */}
      {mappings.length > 0 && (
        <div className="space-y-1">
          {mappings.map(([key, value]) => (
            <div key={key} className="flex items-baseline gap-1.5 text-xs">
              <span className="text-gray-500 font-medium">{key}:</span>
              <span className="text-brand-600 font-mono truncate">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Retries */}
      {node.retries !== undefined && node.retries !== 3 && (
        <div className="mt-2 text-[10px] text-gray-400">
          {node.retries === 0 ? "No retries" : `${node.retries} retries`}
        </div>
      )}

      {/* Error handler badge */}
      {isErrorHandler && (
        <div className="absolute -top-2.5 left-4 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
          Error Handler
        </div>
      )}
    </div>
  );
}

function Connector({ condition }: { condition?: string }) {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="w-0.5 h-3 bg-gradient-to-b from-gray-300 to-gray-200" />
      <div className="w-2 h-2 bg-brand-400 rounded-full shadow-sm animate-pulse" />
      <div className="w-0.5 h-3 bg-gradient-to-b from-gray-200 to-gray-300" />
      {condition && (
        <div className="absolute mt-1 ml-8 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded max-w-[200px] truncate">
          {condition}
        </div>
      )}
    </div>
  );
}

export function DAGVisualization({ dag }: { dag: DAG }) {
  const errorHandlerNodeId = dag.onError;
  const mainNodes = dag.nodes.filter((n) => n.id !== errorHandlerNodeId);
  const errorNode = dag.nodes.find((n) => n.id === errorHandlerNodeId);
  const mainEdges = dag.edges.filter(
    (e) => e.from !== errorHandlerNodeId && e.to !== errorHandlerNodeId
  );
  const sorted = topologicalSort(mainNodes, mainEdges);

  // Build edge condition lookup: to -> condition
  const edgeConditions = new Map<string, string>();
  for (const edge of mainEdges) {
    if (edge.condition) edgeConditions.set(edge.to, edge.condition);
  }

  return (
    <div className="space-y-0">
      {/* Start marker */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 bg-green-400 rounded-full shadow-sm" />
        <span className="text-xs font-medium text-green-700 uppercase tracking-wider">Start</span>
      </div>

      {sorted.map((node, i) => (
        <div key={node.id}>
          {i > 0 && <Connector condition={edgeConditions.get(node.id)} />}
          <DAGNodeCard node={node} isErrorHandler={false} />
        </div>
      ))}

      {/* End marker */}
      <div className="flex flex-col items-center py-1">
        <div className="w-0.5 h-4 bg-gradient-to-b from-gray-300 to-gray-100" />
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-gray-400 rounded-full shadow-sm" />
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">End</span>
      </div>

      {/* Error handler */}
      {errorNode && (
        <>
          <div className="mt-6 mb-3 flex items-center gap-3">
            <div className="flex-1 border-t border-dashed border-red-200" />
            <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">On Error</span>
            <div className="flex-1 border-t border-dashed border-red-200" />
          </div>
          <DAGNodeCard node={errorNode} isErrorHandler={true} />
        </>
      )}
    </div>
  );
}

import type { DAG, DAGNode } from "./api";

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function nodeLabel(node: DAGNode): string {
  const parts = [node.id];
  if (node.type === "http.call" && node.config) {
    const method = (node.config.method as string)?.toUpperCase() || "GET";
    const service = (node.config.service as string) || "";
    const path = (node.config.path as string) || "";
    parts.push(`${method} ${service}${path}`);
  } else if (node.type === "wait" && node.config?.seconds) {
    parts.push(`Wait ${node.config.seconds}s`);
  } else if (node.type === "for-each") {
    parts.push("Loop");
  } else if (node.type === "condition") {
    parts.push("Condition");
  }
  return parts.join("\\n");
}

function nodeShape(node: DAGNode, isError: boolean): [string, string] {
  if (isError) return ["{{", "}}"];
  switch (node.type) {
    case "condition":
      return ["{", "}"];
    case "wait":
      return ["([", "])"];
    case "for-each":
      return ["[[", "]]"];
    default:
      return ["[", "]"];
  }
}

export function dagToMermaid(dag: DAG): string {
  const lines: string[] = ["graph TD"];
  const errorNodeId = dag.onError;

  for (const node of dag.nodes) {
    const id = sanitizeId(node.id);
    const label = nodeLabel(node);
    const isError = node.id === errorNodeId;
    const [open, close] = nodeShape(node, isError);
    lines.push(`    ${id}${open}"${label}"${close}`);
  }

  for (const edge of dag.edges) {
    const from = sanitizeId(edge.from);
    const to = sanitizeId(edge.to);
    if (edge.condition) {
      lines.push(`    ${from} -->|"${edge.condition}"| ${to}`);
    } else {
      lines.push(`    ${from} --> ${to}`);
    }
  }

  // Style error handler node
  if (errorNodeId) {
    const id = sanitizeId(errorNodeId);
    lines.push(`    style ${id} fill:#fee2e2,stroke:#ef4444,stroke-dasharray: 5 5`);
  }

  return lines.join("\n");
}

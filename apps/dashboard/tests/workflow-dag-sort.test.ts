import { describe, it, expect } from "vitest";
import { topologicalSort } from "../src/components/workflows/dag-visualization";
import type { DAGNode, DAGEdge } from "../src/lib/api";

function makeNode(id: string, type = "http.call"): DAGNode {
  return { id, type };
}

describe("topologicalSort", () => {
  it("should sort a linear DAG correctly", () => {
    const nodes = [makeNode("A"), makeNode("B"), makeNode("C")];
    const edges: DAGEdge[] = [
      { from: "A", to: "B" },
      { from: "B", to: "C" },
    ];

    const sorted = topologicalSort(nodes, edges);
    const ids = sorted.map((n) => n.id);
    expect(ids).toEqual(["A", "B", "C"]);
  });

  it("should sort a diamond DAG with A first and D last", () => {
    const nodes = [makeNode("A"), makeNode("B"), makeNode("C"), makeNode("D")];
    const edges: DAGEdge[] = [
      { from: "A", to: "B" },
      { from: "A", to: "C" },
      { from: "B", to: "D" },
      { from: "C", to: "D" },
    ];

    const sorted = topologicalSort(nodes, edges);
    const ids = sorted.map((n) => n.id);
    expect(ids[0]).toBe("A");
    expect(ids[ids.length - 1]).toBe("D");
    expect(ids).toHaveLength(4);
  });

  it("should handle a single node with no edges", () => {
    const nodes = [makeNode("only")];
    const sorted = topologicalSort(nodes, []);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe("only");
  });

  it("should include disconnected nodes", () => {
    const nodes = [makeNode("A"), makeNode("B"), makeNode("C")];
    const sorted = topologicalSort(nodes, []);
    expect(sorted).toHaveLength(3);
    const ids = sorted.map((n) => n.id);
    expect(ids).toContain("A");
    expect(ids).toContain("B");
    expect(ids).toContain("C");
  });

  it("should handle complex DAG with multiple entry points", () => {
    const nodes = [makeNode("A"), makeNode("B"), makeNode("C"), makeNode("D"), makeNode("E")];
    const edges: DAGEdge[] = [
      { from: "A", to: "C" },
      { from: "B", to: "C" },
      { from: "C", to: "D" },
      { from: "C", to: "E" },
    ];

    const sorted = topologicalSort(nodes, edges);
    const ids = sorted.map((n) => n.id);
    // A and B should come before C
    expect(ids.indexOf("A")).toBeLessThan(ids.indexOf("C"));
    expect(ids.indexOf("B")).toBeLessThan(ids.indexOf("C"));
    // C should come before D and E
    expect(ids.indexOf("C")).toBeLessThan(ids.indexOf("D"));
    expect(ids.indexOf("C")).toBeLessThan(ids.indexOf("E"));
  });
});

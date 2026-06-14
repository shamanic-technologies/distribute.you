import { describe, it, expect } from "vitest";
import { dagToMermaid } from "../src/lib/dag-to-mermaid";
import type { DAG } from "../src/lib/api";

describe("dagToMermaid", () => {
  it("converts a simple linear DAG to mermaid syntax", () => {
    const dag: DAG = {
      nodes: [
        { id: "find-leads", type: "http.call", config: { service: "lead", method: "POST", path: "/search" } },
        { id: "send-email", type: "http.call", config: { service: "email-gateway", method: "POST", path: "/send" } },
      ],
      edges: [{ from: "find-leads", to: "send-email" }],
    };

    const result = dagToMermaid(dag);
    expect(result).toContain("graph TD");
    expect(result).toContain("find_leads");
    expect(result).toContain("send_email");
    expect(result).toContain("find_leads --> send_email");
    expect(result).toContain("POST lead/search");
  });

  it("handles condition nodes with diamond shape", () => {
    const dag: DAG = {
      nodes: [
        { id: "check", type: "condition" },
        { id: "yes-path", type: "http.call" },
        { id: "no-path", type: "http.call" },
      ],
      edges: [
        { from: "check", to: "yes-path", condition: "result.valid" },
        { from: "check", to: "no-path", condition: "!result.valid" },
      ],
    };

    const result = dagToMermaid(dag);
    expect(result).toContain('check{"check\\nCondition"}');
    expect(result).toContain('|"result.valid"|');
  });

  it("handles error handler node with dashed style", () => {
    const dag: DAG = {
      nodes: [
        { id: "step1", type: "http.call" },
        { id: "handle-error", type: "http.call" },
      ],
      edges: [],
      onError: "handle-error",
    };

    const result = dagToMermaid(dag);
    expect(result).toContain("style handle_error fill:#fee2e2,stroke:#ef4444,stroke-dasharray: 5 5");
  });

  it("handles wait and for-each node types", () => {
    const dag: DAG = {
      nodes: [
        { id: "delay", type: "wait", config: { seconds: 30 } },
        { id: "process-batch", type: "for-each" },
      ],
      edges: [{ from: "delay", to: "process-batch" }],
    };

    const result = dagToMermaid(dag);
    expect(result).toContain('delay(["delay\\nWait 30s"])');
    expect(result).toContain('process_batch[["process-batch\\nLoop"]]');
  });

  it("returns valid mermaid for empty DAG", () => {
    const dag: DAG = { nodes: [], edges: [] };
    const result = dagToMermaid(dag);
    expect(result).toBe("graph TD");
  });
});

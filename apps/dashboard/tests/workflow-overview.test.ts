import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("WorkflowOverview component", () => {
  const overviewPath = path.join(
    __dirname,
    "../src/components/workflows/workflow-overview.tsx"
  );

  it("should exist", () => {
    expect(fs.existsSync(overviewPath)).toBe(true);
  });

  it("should be a client component", () => {
    const content = fs.readFileSync(overviewPath, "utf-8");
    expect(content).toContain('"use client"');
  });

  it("should render provider logos using logo.dev", () => {
    const content = fs.readFileSync(overviewPath, "utf-8");
    expect(content).toContain("logo.dev");
    expect(content).toContain("LOGO_DEV_TOKEN");
    expect(content).toContain("ProviderLogo");
  });

  it("should render a step timeline from DAG nodes", () => {
    const content = fs.readFileSync(overviewPath, "utf-8");
    expect(content).toContain("StepTimeline");
    expect(content).toContain("dag.nodes");
    expect(content).toContain("NodeTypeIcon");
  });

  it("should handle all DAG node types", () => {
    const content = fs.readFileSync(overviewPath, "utf-8");
    expect(content).toContain("http.call");
    expect(content).toContain("condition");
    expect(content).toContain("wait");
    expect(content).toContain("for-each");
  });

  it("should show error handler node separately", () => {
    const content = fs.readFileSync(overviewPath, "utf-8");
    expect(content).toContain("errorNodeId");
    expect(content).toContain("Error Handler");
  });

  it("should have a collapsible mermaid diagram section", () => {
    const content = fs.readFileSync(overviewPath, "utf-8");
    expect(content).toContain("MermaidDiagram");
    expect(content).toContain("showDiagram");
    expect(content).toContain("Flow Diagram");
  });

  it("should display the workflow summary text", () => {
    const content = fs.readFileSync(overviewPath, "utf-8");
    expect(content).toContain("summary?.summary");
  });

  it("should extract service and method from http.call nodes", () => {
    const content = fs.readFileSync(overviewPath, "utf-8");
    expect(content).toContain("node.config.service");
    expect(content).toContain("node.config.method");
    expect(content).toContain("node.config.path");
  });
});

describe("WorkflowChat component (chat-only)", () => {
  const chatPath = path.join(
    __dirname,
    "../src/components/workflows/workflow-chat.tsx"
  );

  it("should exist", () => {
    expect(fs.existsSync(chatPath)).toBe(true);
  });

  it("should NOT have an initial assistant message", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    // Messages should start empty — no initialSummary in the chat
    expect(content).toContain("useState<ChatMessage[]>([])");
  });

  it("should NOT accept providers or initialMermaid props", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    // The chat component should only take workflowContext and sessionId
    expect(content).not.toMatch(/interface WorkflowChatProps[\s\S]*?providers/);
    expect(content).not.toMatch(/interface WorkflowChatProps[\s\S]*?initialMermaid/);
  });

  it("should have SSE streaming support", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain("isStreaming");
    expect(content).toContain("reader.read()");
    expect(content).toContain('data: ');
  });

  it("should have auto-growing textarea", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain("el.scrollHeight");
    expect(content).toContain("maxHeight");
  });

  it("should support Enter to submit and Shift+Enter for newline", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain("e.key === \"Enter\"");
    expect(content).toContain("!e.shiftKey");
  });
});

describe("Workflow viewer page composition", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[sectionKey]/workflows/[workflowId]/page.tsx"
  );

  it("should import WorkflowOverview", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("WorkflowOverview");
    expect(content).toContain("workflow-overview");
  });

  it("should import WorkflowChat", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("WorkflowChat");
    expect(content).toContain("workflow-chat");
  });

  it("should pass DAG and summary to WorkflowOverview", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("dag={workflow.dag}");
    expect(content).toContain("summary={");
    expect(content).toContain("mermaidChart={mermaidChart}");
    expect(content).toContain("providers={workflow.requiredProviders}");
  });

  it("should separate overview (scrollable) from chat (sticky bottom)", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("overflow-y-auto");
    expect(content).toContain("WorkflowOverview");
    expect(content).toContain("WorkflowChat");
  });
});

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

  it("should show providers inline with logos", () => {
    const content = fs.readFileSync(overviewPath, "utf-8");
    expect(content).toContain("providers.map");
    expect(content).toContain("ProviderLogo");
    expect(content).toContain("capitalize(p)");
  });

  it("should NOT have any diagram or mermaid rendering", () => {
    const content = fs.readFileSync(overviewPath, "utf-8");
    expect(content).not.toContain("MermaidDiagram");
    expect(content).not.toContain("mermaid");
    expect(content).not.toContain("showDiagram");
    expect(content).not.toContain("Flow Diagram");
    expect(content).not.toContain("dag");
  });

  it("should NOT render a raw pipeline of internal node IDs", () => {
    const content = fs.readFileSync(overviewPath, "utf-8");
    expect(content).not.toContain("StepTimeline");
    expect(content).not.toContain("NodeTypeIcon");
  });

  it("should display the workflow summary text", () => {
    const content = fs.readFileSync(overviewPath, "utf-8");
    expect(content).toContain("summary?.summary");
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
    expect(content).toContain("useState<ChatMessage[]>([])");
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

  it("should handle thinking_start / thinking_delta / thinking_stop events", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain('"thinking_start"');
    expect(content).toContain('"thinking_delta"');
    expect(content).toContain('"thinking_stop"');
  });

  it("should handle tool_call with id, name, args (no delta/stop)", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain('"tool_call"');
    expect(content).toContain("event.id");
    expect(content).toContain("event.name");
    expect(content).toContain("event.args");
    // No streaming tool_call_delta or tool_call_stop
    expect(content).not.toContain('"tool_call_delta"');
    expect(content).not.toContain('"tool_call_stop"');
  });

  it("should handle tool_result with id, name, result fields", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain('"tool_result"');
    expect(content).toContain("event.result");
  });

  it("should render collapsible UI for thinking and tool calls", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain("Collapsible");
    expect(content).toContain("ThinkingBlockUI");
    expect(content).toContain("ToolCallBlockUI");
    expect(content).toContain("CheckCircleIcon");
    expect(content).toContain("ArrowPathIcon");
  });

  it("should use result field (not content) in ToolResultBlock", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    // ToolResultBlock should have result field and toolCallId for matching
    expect(content).toContain("toolCallId: string;");
    expect(content).toContain("result: string;");
    // PrettyJSON component for formatting tool output
    expect(content).toContain("PrettyJSON");
  });
});

describe("Workflow viewer page composition", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[sectionKey]/workflows/[workflowId]/page.tsx"
  );

  it("should NOT import dagToMermaid or mermaid", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).not.toContain("dagToMermaid");
    expect(content).not.toContain("mermaid");
  });

  it("should pass summary and providers to WorkflowOverview", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("summary={");
    expect(content).toContain("providers={workflow.requiredProviders}");
    expect(content).not.toContain("dag={");
    expect(content).not.toContain("mermaidChart={");
  });

  it("should separate overview (scrollable) from chat (sticky bottom)", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("overflow-y-auto");
    expect(content).toContain("WorkflowOverview");
    expect(content).toContain("WorkflowChat");
  });

  it("should pass workflowId in the chat context", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("workflowId: workflow.id");
  });
});

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

  it("should display the workflow summary steps", () => {
    const content = fs.readFileSync(overviewPath, "utf-8");
    expect(content).toContain("summary?.steps");
  });
});

describe("WorkflowChat component (useChat + AI SDK)", () => {
  const chatPath = path.join(
    __dirname,
    "../src/components/workflows/workflow-chat.tsx"
  );

  it("should exist", () => {
    expect(fs.existsSync(chatPath)).toBe(true);
  });

  it("should use Vercel AI SDK useChat hook", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain('from "@ai-sdk/react"');
    expect(content).toContain("useChat");
    expect(content).toContain("DefaultChatTransport");
    expect(content).toContain("UIMessage");
  });

  it("should restore messages from localStorage on mount", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain("loadMessages(workflowId)");
    expect(content).toContain("localStorage.getItem");
  });

  it("should persist messages to localStorage on finish", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain("saveMessages(workflowId");
    expect(content).toContain("localStorage.setItem");
  });

  it("should have auto-growing textarea", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain("el.scrollHeight");
    expect(content).toContain("maxHeight");
  });

  it("should support Enter to submit and Shift+Enter for newline", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain('e.key === "Enter"');
    expect(content).toContain("!e.shiftKey");
  });

  it("should render thinking blocks via reasoning message parts", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain('"reasoning"');
    expect(content).toContain("ThinkingBlockUI");
  });

  it("should render tool invocations via isToolUIPart", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain("isToolUIPart");
    expect(content).toContain("ToolInvocationUI");
  });

  it("should render collapsible UI for thinking and tool calls", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain("Collapsible");
    expect(content).toContain("ThinkingBlockUI");
    expect(content).toContain("ToolInvocationUI");
    expect(content).toContain("CheckCircleIcon");
    expect(content).toContain("ArrowPathIcon");
  });

  it("should handle input_request and buttons as data parts", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain('"data-input-request"');
    expect(content).toContain('"data-buttons"');
    expect(content).toContain("InputRequestBlockUI");
    expect(content).toContain("ButtonsBlockUI");
  });

  it("should have a reset chat button that clears localStorage", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain("resetChat");
    expect(content).toContain("Reset chat");
    expect(content).toContain("localStorage.removeItem");
  });

  it("should manage sessionId via ref and localStorage", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain("sessionIdRef");
    expect(content).toContain("sessionIdRef.current");
    expect(content).toContain("loadSessionId(workflowId)");
    expect(content).toContain("saveSessionId(workflowId");
  });

  it("should capture sessionId from data-session stream events", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain('"data-session"');
    expect(content).toContain("onData");
  });

  it("should accept workflowId prop for storage key", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain("workflowId: string");
  });

  it("should use DefaultChatTransport with prepareSendMessagesRequest", () => {
    const content = fs.readFileSync(chatPath, "utf-8");
    expect(content).toContain("prepareSendMessagesRequest");
    expect(content).toContain('api: "/api/v1/chat"');
  });
});

describe("Chat proxy route (SSE → Data Stream Protocol)", () => {
  const routePath = path.join(
    __dirname,
    "../src/app/api/v1/chat/route.ts"
  );

  it("should exist", () => {
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it("should handle thinking_start / thinking_delta / thinking_stop events", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain('"thinking_start"');
    expect(content).toContain('"thinking_delta"');
    expect(content).toContain('"thinking_stop"');
  });

  it("should handle tool_call with id, name, args (no delta/stop)", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain('"tool_call"');
    expect(content).toContain("event.id");
    expect(content).toContain("event.name");
    expect(content).toContain("event.args");
    expect(content).not.toContain('"tool_call_delta"');
    expect(content).not.toContain('"tool_call_stop"');
  });

  it("should handle tool_result with id and result fields", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain('"tool_result"');
    expect(content).toContain("event.result");
  });

  it("should handle input_request and buttons SSE events", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain('"input_request"');
    expect(content).toContain('"buttons"');
    expect(content).toContain("event.input_type");
    expect(content).toContain("event.label");
    expect(content).toContain("event.buttons");
  });

  it("should transform to Vercel AI SDK Data Stream Protocol", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("createUIMessageStream");
    expect(content).toContain("createUIMessageStreamResponse");
    expect(content).toContain("UIMessageStreamWriter");
  });

  it("should handle session ID from first SSE event", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("event.sessionId");
    expect(content).toContain('"data-session"');
  });

  it("should handle the value field on input_request (OpenAPI update)", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("event.value");
  });
});

describe("Workflow viewer page composition", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/workflows/[workflowId]/page.tsx"
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

  it("should pass workflowId as prop and in the chat context", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("workflowId: workflow.id");
    expect(content).toContain("workflowId={workflowId}");
  });

  it("should NOT generate or pass sessionId (managed by chat component)", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).not.toContain("generateSessionId");
    expect(content).not.toContain("sessionId={");
    expect(content).not.toContain("crypto.randomUUID");
  });
});

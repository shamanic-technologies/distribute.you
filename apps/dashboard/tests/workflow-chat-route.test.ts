import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const chatRoutePath = path.resolve(
  __dirname,
  "../src/app/api/v1/chat/route.ts"
);
const chatComponentPath = path.resolve(
  __dirname,
  "../src/components/workflows/workflow-chat.tsx"
);
const workflowPagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[sectionKey]/workflows/[workflowId]/page.tsx"
);

describe("Workflow chat API route", () => {
  const content = fs.readFileSync(chatRoutePath, "utf-8");

  it("should exist at app/api/v1/chat/route.ts", () => {
    expect(fs.existsSync(chatRoutePath)).toBe(true);
  });

  it("should export a POST handler", () => {
    expect(content).toContain("export async function POST");
  });

  it("should use Clerk auth for authentication", () => {
    expect(content).toContain("@clerk/nextjs/server");
    expect(content).toContain("await auth()");
    expect(content).toContain("clerkUserId");
    expect(content).toContain("clerkOrgId");
  });

  it("should require ANTHROPIC_API_KEY", () => {
    expect(content).toContain("ANTHROPIC_API_KEY");
    expect(content).toContain("createAnthropic");
  });

  it("should use AI SDK streamText with tools", () => {
    expect(content).toContain("streamText");
    expect(content).toContain("toUIMessageStreamResponse");
  });

  it("should define getWorkflowDetails tool", () => {
    expect(content).toContain("getWorkflowDetails");
    expect(content).toContain(`/workflows/\${workflowId}`);
  });

  it("should define getPrompt tool", () => {
    expect(content).toContain("getPrompt");
    expect(content).toContain("/prompts?type=");
  });

  it("should define validateWorkflow tool", () => {
    expect(content).toContain("validateWorkflow");
    expect(content).toContain(`/workflows/\${workflowId}/validate`);
  });

  it("should define updateWorkflow tool", () => {
    expect(content).toContain("updateWorkflow");
    expect(content).toContain('method: "PUT"');
  });

  it("should define versionPrompt tool", () => {
    expect(content).toContain("versionPrompt");
    expect(content).toContain("sourceType");
  });

  it("should forward Clerk auth headers to API service", () => {
    expect(content).toContain('"x-external-org-id"');
    expect(content).toContain('"x-external-user-id"');
    expect(content).toContain('"X-API-Key"');
  });

  it("should use ADMIN_DISTRIBUTE_API_KEY for API calls", () => {
    expect(content).toContain("ADMIN_DISTRIBUTE_API_KEY");
  });

  it("should include node types reference in system prompt", () => {
    expect(content).toContain("http.call");
    expect(content).toContain("condition");
    expect(content).toContain("for-each");
    expect(content).toContain("wait");
    expect(content).toContain("$ref:flow_input");
    expect(content).toContain("$ref:node-id.output");
  });

  it("should require workflowId in request body", () => {
    expect(content).toContain("workflowId is required");
  });

  it("should use stepCountIs for multi-step tool calling", () => {
    expect(content).toContain("stepCountIs");
    expect(content).toContain("stopWhen");
  });
});

describe("Workflow chat component", () => {
  const content = fs.readFileSync(chatComponentPath, "utf-8");

  it("should use @ai-sdk/react useChat hook", () => {
    expect(content).toContain("@ai-sdk/react");
    expect(content).toContain("useChat");
  });

  it("should use DefaultChatTransport with custom API URL", () => {
    expect(content).toContain("DefaultChatTransport");
    expect(content).toContain("/api/v1/chat");
  });

  it("should pass workflowId and workflowContext via transport body", () => {
    expect(content).toContain("workflowId");
    expect(content).toContain("workflowContext");
    expect(content).toContain("body:");
  });

  it("should accept onWorkflowUpdated callback", () => {
    expect(content).toContain("onWorkflowUpdated");
  });

  it("should render tool call indicators", () => {
    expect(content).toContain("ToolIndicator");
    expect(content).toContain("TOOL_LABELS");
    expect(content).toContain("Fetching workflow details");
    expect(content).toContain("Validating workflow");
    expect(content).toContain("Updating workflow");
  });

  it("should support mermaid diagram rendering", () => {
    expect(content).toContain("MermaidDiagram");
    expect(content).toContain("parseMessageSegments");
    expect(content).toContain("mermaid");
  });

  it("should handle sendMessage instead of deprecated handleSubmit", () => {
    expect(content).toContain("sendMessage");
    expect(content).toContain("text: trimmed");
  });
});

describe("Workflow page passes workflowId to chat", () => {
  const content = fs.readFileSync(workflowPagePath, "utf-8");

  it("should pass workflowId prop to WorkflowChat", () => {
    expect(content).toContain("workflowId={workflowId}");
  });

  it("should pass workflowContext with workflow.id", () => {
    expect(content).toContain("id: workflow.id");
  });

  it("should handle onWorkflowUpdated with query invalidation", () => {
    expect(content).toContain("onWorkflowUpdated");
    expect(content).toContain("invalidateQueries");
  });
});

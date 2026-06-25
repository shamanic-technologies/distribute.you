import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Guards the progress / thinking indicators ported into EditWithAIChat
 * (audience + brand-profile editors) from the admin WorkflowChat. The user
 * asked for "indicateurs d'avancée" — these substring checks pin the
 * affordances so a refactor can't silently drop them back to the bare panel.
 */

const chatFile = fs.readFileSync(
  path.join(__dirname, "../src/components/ai-edit/edit-with-ai-chat.tsx"),
  "utf-8",
);
const partsFile = fs.readFileSync(
  path.join(__dirname, "../src/components/chat/chat-message-parts.tsx"),
  "utf-8",
);

describe("chat-message-parts — shared render helpers", () => {
  it("exports the progress-indicator helpers", () => {
    expect(partsFile).toContain("export function ThinkingBlockUI");
    expect(partsFile).toContain("export function ToolInvocationUI");
    expect(partsFile).toContain("export function TextContent");
    expect(partsFile).toContain("export function MessageSkeleton");
    expect(partsFile).toContain("export function BouncingDots");
  });

  it("renders markdown via react-markdown + remark-gfm", () => {
    expect(partsFile).toContain('from "react-markdown"');
    expect(partsFile).toContain('from "remark-gfm"');
  });

  it("shows a Thinking... label while streaming reasoning", () => {
    expect(partsFile).toContain("Thinking...");
  });
});

describe("EditWithAIChat — progress indicators", () => {
  it("renders the reasoning (thinking) block", () => {
    expect(chatFile).toContain("ThinkingBlockUI");
    expect(chatFile).toContain('part.type === "reasoning"');
  });

  it("renders expandable tool-call steps", () => {
    expect(chatFile).toContain("ToolInvocationUI");
  });

  it("shows a pending placeholder the instant the user sends", () => {
    expect(chatFile).toContain("showPendingAssistant");
    expect(chatFile).toContain("MessageSkeleton");
  });

  it("shows a thinking skeleton before the first token", () => {
    expect(chatFile).toContain("showSkeleton");
  });

  it("animates the assistant avatar while streaming", () => {
    expect(chatFile).toContain("BouncingDots");
  });

  it("has a scroll-to-bottom pill with user-scroll detection", () => {
    expect(chatFile).toContain("showScrollPill");
    expect(chatFile).toContain("userHasScrolledRef");
  });

  it("shows an error banner with retry for retryable codes", () => {
    expect(chatFile).toContain("retryLastMessage");
    expect(chatFile).toContain("regenerate");
    expect(chatFile).toContain("RETRYABLE_CODES");
  });

  it("has a reset + copy toolbar", () => {
    expect(chatFile).toContain("resetChat");
    expect(chatFile).toContain("copyConversation");
  });

  it("surfaces a session-reset notice on session_not_found", () => {
    expect(chatFile).toContain("isSessionNotFoundError");
    expect(chatFile).toContain("sessionResetNotice");
  });

  it("does NOT add a token/context usage gauge (excluded for this surface)", () => {
    expect(chatFile).not.toContain("ContextUsageGauge");
    expect(chatFile).not.toContain("context-usage-gauge");
  });

  it("keeps the context ref machinery (stale-closure guard)", () => {
    expect(chatFile).toContain("const contextRef = useRef(requestContext)");
    expect(chatFile).toContain("context: contextRef.current");
  });
});

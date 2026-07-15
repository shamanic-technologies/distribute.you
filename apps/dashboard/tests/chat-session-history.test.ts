import { describe, it, expect } from "vitest";
import {
  historyToUIMessages,
  type ChatHistoryMessage,
} from "../src/lib/chat-session-history";

/**
 * Rehydration mapper: stored chat-service session turns → UIMessage[] the
 * "Edit with AI" panel renders after a refresh. Pins the part shapes the
 * existing render (text / reasoning / tool-<name>) depends on.
 */

function partTypes(parts: unknown[]): string[] {
  return parts.map((p) => (p as { type: string }).type);
}

describe("historyToUIMessages", () => {
  it("maps a user turn to a single text part", () => {
    const msgs: ChatHistoryMessage[] = [
      { id: "u1", role: "user", content: "make it punchier", contentBlocks: null, toolCalls: null },
    ];
    const [m] = historyToUIMessages(msgs);
    expect(m.role).toBe("user");
    expect(partTypes(m.parts)).toEqual(["text"]);
    expect((m.parts[0] as { text: string }).text).toBe("make it punchier");
  });

  it("maps an assistant turn to reasoning + text + tool parts in order", () => {
    const msgs: ChatHistoryMessage[] = [
      {
        id: "a1",
        role: "assistant",
        content: "Done — updated the audience.",
        contentBlocks: [{ type: "thinking", thinking: "consider the ICP" }],
        toolCalls: [{ name: "updateAudience", args: { size: 10 }, result: { ok: true } }],
      },
    ];
    const [m] = historyToUIMessages(msgs);
    expect(m.role).toBe("assistant");
    expect(partTypes(m.parts)).toEqual(["reasoning", "text", "tool-updateAudience"]);
    const tool = m.parts[2] as { state: string; input: unknown; output: unknown };
    expect(tool.state).toBe("output-available");
    expect(tool.input).toEqual({ size: 10 });
    expect(tool.output).toEqual({ ok: true });
  });

  it("marks a tool call without a result as input-available", () => {
    const msgs: ChatHistoryMessage[] = [
      {
        id: "a2",
        role: "assistant",
        content: "",
        contentBlocks: null,
        toolCalls: [{ name: "searchLeads", args: {} }],
      },
    ];
    const [m] = historyToUIMessages(msgs);
    expect(partTypes(m.parts)).toEqual(["tool-searchLeads"]);
    expect((m.parts[0] as { state: string }).state).toBe("input-available");
  });

  it("skips standalone tool-role rows (folded into the assistant turn)", () => {
    const msgs: ChatHistoryMessage[] = [
      { id: "t1", role: "tool", content: "raw result", contentBlocks: null, toolCalls: null },
    ];
    expect(historyToUIMessages(msgs)).toEqual([]);
  });

  it("drops assistant turns with nothing renderable", () => {
    const msgs: ChatHistoryMessage[] = [
      { id: "a3", role: "assistant", content: "", contentBlocks: null, toolCalls: null },
    ];
    expect(historyToUIMessages(msgs)).toEqual([]);
  });

  it("preserves conversation order across turns", () => {
    const msgs: ChatHistoryMessage[] = [
      { id: "u1", role: "user", content: "hi", contentBlocks: null, toolCalls: null },
      { id: "a1", role: "assistant", content: "hello", contentBlocks: null, toolCalls: null },
      { id: "u2", role: "user", content: "again", contentBlocks: null, toolCalls: null },
    ];
    expect(historyToUIMessages(msgs).map((m) => m.id)).toEqual(["u1", "a1", "u2"]);
  });
});

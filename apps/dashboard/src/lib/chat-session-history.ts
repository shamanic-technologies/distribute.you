import type { UIMessage } from "ai";

/**
 * Rehydrate the "Edit with AI" chat panel after a page refresh.
 *
 * chat-service persists every turn and exposes it via the gateway at
 * `GET /v1/chat/sessions/:sessionId` (proxy → chat-service `/sessions/:id`).
 * This module maps that stored history into the `UIMessage` shape `useChat`
 * renders, so a reload restores exactly what the user last saw instead of
 * resetting the panel to the intro. The session id is already kept in
 * localStorage; only the visible turns were missing.
 *
 * Pure (no api import) so it unit-tests without a network layer and stays out
 * of the public-report bundle's `@/lib/api` ban.
 */

/** A tool invocation as returned by the session-history endpoint. */
export interface ChatHistoryToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

/** One stored turn from the session-history endpoint (fields we render). */
export interface ChatHistoryMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  /** Plain-text rendering of the turn. */
  content: string;
  /** Provider content blocks (Anthropic-style), incl. `thinking` reasoning. */
  contentBlocks: unknown[] | null;
  /** Tool calls made on this turn, in order. */
  toolCalls: ChatHistoryToolCall[] | null;
}

interface ThinkingBlock {
  type?: string;
  thinking?: string;
}

/**
 * Map stored history turns → `UIMessage[]` for `useChat`.
 *
 * - `user` → a single text part.
 * - `assistant` → reasoning parts (from `thinking` content blocks) + text +
 *   one `tool-<name>` part per tool call (shape `isToolUIPart` accepts, so the
 *   existing render draws the tool-step / thinking-block affordances).
 * - `tool` role rows are provider plumbing (raw tool results already folded
 *   into the assistant turn's `toolCalls`) — skipped to avoid duplicate steps.
 *
 * Assistant turns with nothing renderable are dropped.
 */
export function historyToUIMessages(messages: ChatHistoryMessage[]): UIMessage[] {
  const out: UIMessage[] = [];

  for (const m of messages) {
    if (m.role === "user") {
      out.push({
        id: m.id,
        role: "user",
        parts: [{ type: "text", text: m.content }],
      } as UIMessage);
      continue;
    }

    if (m.role === "tool") continue;

    const parts: Array<Record<string, unknown>> = [];

    if (m.contentBlocks) {
      for (const block of m.contentBlocks) {
        const b = block as ThinkingBlock;
        if (b?.type === "thinking" && typeof b.thinking === "string" && b.thinking) {
          parts.push({ type: "reasoning", text: b.thinking });
        }
      }
    }

    if (m.content) parts.push({ type: "text", text: m.content });

    if (m.toolCalls) {
      m.toolCalls.forEach((tc, i) => {
        parts.push({
          type: `tool-${tc.name}`,
          toolCallId: `${m.id}-tool-${i}`,
          state: tc.result !== undefined ? "output-available" : "input-available",
          input: tc.args,
          output: tc.result,
        });
      });
    }

    if (parts.length === 0) continue;

    out.push({ id: m.id, role: "assistant", parts } as unknown as UIMessage);
  }

  return out;
}

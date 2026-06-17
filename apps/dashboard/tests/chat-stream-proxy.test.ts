import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the SSE stream processing logic in the chat proxy route.
 * We extract and test the core stream→events parsing to verify:
 *   1. Normal SSE lines are correctly parsed
 *   2. Remaining buffer after stream end is processed
 *   3. Reader errors produce an error event and still close open text parts
 */

// --- Helpers to simulate the stream processing logic ---

interface WriterEvent {
  type: string;
  [key: string]: unknown;
}

function createMockWriter() {
  const events: WriterEvent[] = [];
  return {
    write(event: WriterEvent) {
      events.push(event);
    },
    events,
  };
}

function createMockReader(chunks: (string | Error)[]) {
  let index = 0;
  const encoder = new TextEncoder();
  return {
    async read(): Promise<{ done: boolean; value?: Uint8Array }> {
      if (index >= chunks.length) return { done: true };
      const chunk = chunks[index++];
      if (chunk instanceof Error) throw chunk;
      return { done: false, value: encoder.encode(chunk) };
    },
  };
}

/**
 * Mirrors the execute() logic from route.ts for testing.
 */
async function processStream(
  reader: ReturnType<typeof createMockReader>,
  writer: ReturnType<typeof createMockWriter>,
) {
  const decoder = new TextDecoder();
  let buffer = "";
  let textPartId = "test-text-id";
  let textStarted = false;
  let reasoningPartId = "";

  function processLine(line: string) {
    if (!line.startsWith("data: ")) return;
    const payload = line.slice(6);
    if (payload === "[DONE]" || payload === '"[DONE]"') return;

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(payload);
    } catch {
      return;
    }

    if (event.sessionId && !event.type) {
      writer.write({
        type: "data-session",
        data: { sessionId: event.sessionId as string },
      });
      return;
    }

    if (event.error && !event.type) {
      writer.write({ type: "error", errorText: String(event.error) });
      return;
    }

    switch (event.type) {
      case "context_usage": {
        writer.write({
          type: "data-context-usage",
          data: {
            inputTokens: Number(event.inputTokens) || 0,
            outputTokens: Number(event.outputTokens) || 0,
            maxTokens: Number(event.maxTokens) || 200000,
            percent: Number(event.percent) || 0,
          },
        });
        break;
      }
      case "token": {
        const text = (event.content || event.token || "") as string;
        if (!text) break;
        if (!textStarted) {
          writer.write({ type: "text-start", id: textPartId });
          textStarted = true;
        }
        writer.write({ type: "text-delta", id: textPartId, delta: text });
        break;
      }
      case "thinking_start": {
        if (textStarted) {
          writer.write({ type: "text-end", id: textPartId });
          textStarted = false;
          textPartId = "test-text-id-2";
        }
        reasoningPartId = "test-reasoning-id";
        writer.write({ type: "reasoning-start", id: reasoningPartId });
        break;
      }
      case "thinking_delta": {
        writer.write({
          type: "reasoning-delta",
          id: reasoningPartId,
          delta: (event.thinking || "") as string,
        });
        break;
      }
      case "thinking_stop": {
        writer.write({ type: "reasoning-end", id: reasoningPartId });
        break;
      }
      case "tool_result": {
        const toolCallId = (event.id || "") as string;
        const rawResult = event.result ?? null;
        const output =
          typeof rawResult === "string"
            ? rawResult
            : JSON.stringify(rawResult ?? "");

        writer.write({
          type: "tool-output-available",
          toolCallId,
          output,
        });
        writer.write({ type: "finish-step" });
        writer.write({ type: "start-step" });
        break;
      }
      case "error": {
        const errorCode = event.code as string | undefined;
        if (errorCode) {
          writer.write({
            type: "data-error-info",
            data: { code: errorCode, message: (event.message || "Unknown server error") as string },
          });
        }
        writer.write({
          type: "error",
          errorText: (event.message || "Unknown server error") as string,
        });
        break;
      }
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        processLine(line);
      }
    }

    // Process remaining buffer
    const remaining = buffer.trim();
    if (remaining) {
      processLine(remaining);
    }
  } catch (err) {
    writer.write({
      type: "error",
      errorText: "Connection to chat service was interrupted. Please try again.",
    });
  } finally {
    if (textStarted) {
      writer.write({ type: "text-end", id: textPartId });
    }
  }
}

// --- Tests ---

describe("chat stream proxy", () => {
  it("processes normal SSE token events", async () => {
    const reader = createMockReader([
      'data: {"type":"token","content":"Hello"}\n',
      'data: {"type":"token","content":" world"}\n',
      "data: [DONE]\n",
    ]);
    const writer = createMockWriter();

    await processStream(reader, writer);

    expect(writer.events).toEqual([
      { type: "text-start", id: "test-text-id" },
      { type: "text-delta", id: "test-text-id", delta: "Hello" },
      { type: "text-delta", id: "test-text-id", delta: " world" },
      { type: "text-end", id: "test-text-id" },
    ]);
  });

  it("processes remaining buffer when stream ends without trailing newline", async () => {
    const reader = createMockReader([
      'data: {"type":"token","content":"Hello"}',
      // No trailing newline — stream ends here
    ]);
    const writer = createMockWriter();

    await processStream(reader, writer);

    expect(writer.events).toEqual([
      { type: "text-start", id: "test-text-id" },
      { type: "text-delta", id: "test-text-id", delta: "Hello" },
      { type: "text-end", id: "test-text-id" },
    ]);
  });

  it("sends error event and closes text part when reader throws", async () => {
    const reader = createMockReader([
      'data: {"type":"token","content":"Partial"}\n',
      new Error("Connection reset"),
    ]);
    const writer = createMockWriter();

    await processStream(reader, writer);

    expect(writer.events).toEqual([
      { type: "text-start", id: "test-text-id" },
      { type: "text-delta", id: "test-text-id", delta: "Partial" },
      {
        type: "error",
        errorText: "Connection to chat service was interrupted. Please try again.",
      },
      { type: "text-end", id: "test-text-id" },
    ]);
  });

  it("does not emit text-end when no text was started", async () => {
    const reader = createMockReader([
      'data: {"sessionId":"sess-123"}\n',
      "data: [DONE]\n",
    ]);
    const writer = createMockWriter();

    await processStream(reader, writer);

    expect(writer.events).toEqual([
      { type: "data-session", data: { sessionId: "sess-123" } },
    ]);
    // No text-end emitted since no text was started
    expect(writer.events.find((e) => e.type === "text-end")).toBeUndefined();
  });

  it("handles chunked SSE data split across reads", async () => {
    const reader = createMockReader([
      'data: {"type":"tok',
      'en","content":"chunk"}\n',
    ]);
    const writer = createMockWriter();

    await processStream(reader, writer);

    expect(writer.events).toEqual([
      { type: "text-start", id: "test-text-id" },
      { type: "text-delta", id: "test-text-id", delta: "chunk" },
      { type: "text-end", id: "test-text-id" },
    ]);
  });

  it("handles thinking blocks correctly", async () => {
    const reader = createMockReader([
      'data: {"type":"thinking_start"}\n',
      'data: {"type":"thinking_delta","thinking":"Let me think..."}\n',
      'data: {"type":"thinking_stop"}\n',
      'data: {"type":"token","content":"Answer"}\n',
    ]);
    const writer = createMockWriter();

    await processStream(reader, writer);

    expect(writer.events).toEqual([
      { type: "reasoning-start", id: "test-reasoning-id" },
      { type: "reasoning-delta", id: "test-reasoning-id", delta: "Let me think..." },
      { type: "reasoning-end", id: "test-reasoning-id" },
      { type: "text-start", id: "test-text-id" },
      { type: "text-delta", id: "test-text-id", delta: "Answer" },
      { type: "text-end", id: "test-text-id" },
    ]);
  });

  it("handles backend error events", async () => {
    const reader = createMockReader([
      'data: {"error":"Rate limited"}\n',
    ]);
    const writer = createMockWriter();

    await processStream(reader, writer);

    expect(writer.events).toEqual([
      { type: "error", errorText: "Rate limited" },
    ]);
  });

  it("forwards error code via data-error-info before error event", async () => {
    const reader = createMockReader([
      'data: {"type":"error","code":"model_overloaded","message":"Claude is temporarily overloaded. Please try again in a moment."}\n',
    ]);
    const writer = createMockWriter();

    await processStream(reader, writer);

    expect(writer.events).toEqual([
      {
        type: "data-error-info",
        data: { code: "model_overloaded", message: "Claude is temporarily overloaded. Please try again in a moment." },
      },
      {
        type: "error",
        errorText: "Claude is temporarily overloaded. Please try again in a moment.",
      },
    ]);
  });

  it("does not emit data-error-info when error event has no code", async () => {
    const reader = createMockReader([
      'data: {"type":"error","message":"Something went wrong"}\n',
    ]);
    const writer = createMockWriter();

    await processStream(reader, writer);

    expect(writer.events).toEqual([
      { type: "error", errorText: "Something went wrong" },
    ]);
    expect(writer.events.find((e) => e.type === "data-error-info")).toBeUndefined();
  });

  it("forwards context_usage as data-context-usage", async () => {
    const reader = createMockReader([
      'data: {"type":"context_usage","inputTokens":42100,"outputTokens":1280,"maxTokens":200000,"percent":21}\n',
      "data: [DONE]\n",
    ]);
    const writer = createMockWriter();

    await processStream(reader, writer);

    expect(writer.events).toEqual([
      {
        type: "data-context-usage",
        data: {
          inputTokens: 42100,
          outputTokens: 1280,
          maxTokens: 200000,
          percent: 21,
        },
      },
    ]);
  });

  it("coerces context_usage with missing fields safely", async () => {
    const reader = createMockReader([
      'data: {"type":"context_usage"}\n',
    ]);
    const writer = createMockWriter();

    await processStream(reader, writer);

    expect(writer.events).toEqual([
      {
        type: "data-context-usage",
        data: {
          inputTokens: 0,
          outputTokens: 0,
          maxTokens: 200000,
          percent: 0,
        },
      },
    ]);
  });

  it("ignores unknown event types without throwing", async () => {
    const reader = createMockReader([
      'data: {"type":"future_event_type","payload":{"x":1}}\n',
      'data: {"type":"token","content":"after"}\n',
    ]);
    const writer = createMockWriter();

    await processStream(reader, writer);

    expect(writer.events).toEqual([
      { type: "text-start", id: "test-text-id" },
      { type: "text-delta", id: "test-text-id", delta: "after" },
      { type: "text-end", id: "test-text-id" },
    ]);
  });

  it("forwards session_not_found error code via data-error-info", async () => {
    const reader = createMockReader([
      'data: {"type":"error","code":"session_not_found","message":"Session not found. The provided sessionId does not exist or belongs to a different org. Omit sessionId to start a new conversation."}\n',
    ]);
    const writer = createMockWriter();

    await processStream(reader, writer);

    expect(writer.events[0]).toEqual({
      type: "data-error-info",
      data: {
        code: "session_not_found",
        message:
          "Session not found. The provided sessionId does not exist or belongs to a different org. Omit sessionId to start a new conversation.",
      },
    });
  });

  it("forwards all error code types correctly", async () => {
    for (const code of ["model_overloaded", "rate_limited", "model_error", "internal_error"]) {
      const reader = createMockReader([
        `data: {"type":"error","code":"${code}","message":"Error: ${code}"}\n`,
      ]);
      const writer = createMockWriter();

      await processStream(reader, writer);

      expect(writer.events[0]).toEqual({
        type: "data-error-info",
        data: { code, message: `Error: ${code}` },
      });
      expect(writer.events[1]).toEqual({
        type: "error",
        errorText: `Error: ${code}`,
      });
    }
  });
});

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessageStreamWriter,
} from "ai";

export const maxDuration = 300;

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;

/**
 * Dedicated chat proxy route.
 *
 * Receives requests from the Vercel AI SDK `useChat` hook (via DefaultChatTransport),
 * forwards them to our backend chat-service, and transforms the response SSE events
 * from our custom protocol to the Vercel AI SDK Data Stream Protocol.
 *
 * The request body includes:
 * - message: the latest user message text
 * - sessionId: optional backend session UUID for conversation continuity
 * - context: optional workflow context injected into the system prompt
 */
export async function POST(req: NextRequest) {
  const { userId: clerkUserId, orgId: clerkOrgId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!API_KEY) {
    return NextResponse.json(
      { error: "API key not configured" },
      { status: 500 },
    );
  }
  if (!clerkOrgId) {
    return NextResponse.json(
      { error: "No active organization. Please complete onboarding." },
      { status: 403 },
    );
  }

  const body = await req.json();
  const { message, sessionId, context } = body as {
    message?: string;
    sessionId?: string;
    context?: Record<string, unknown>;
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
    "x-external-org-id": clerkOrgId,
    "x-external-user-id": clerkUserId,
  };

  // currentUser() calls Clerk's API — don't let it break the proxy if Clerk is down
  try {
    const user = await currentUser();
    if (user) {
      const email = user.emailAddresses?.[0]?.emailAddress;
      if (email) headers["x-email"] = email;
      if (user.firstName) headers["x-first-name"] = user.firstName;
      if (user.lastName) headers["x-last-name"] = user.lastName;
    }
  } catch (err) {
    console.warn("[chat-proxy] currentUser() failed, continuing without user details:", err);
  }

  const backendPayload: Record<string, unknown> = { message };
  if (sessionId) backendPayload.sessionId = sessionId;
  if (context) backendPayload.context = context;

  let backendRes: Response;
  try {
    backendRes = await fetch(`${API_URL}/v1/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify(backendPayload),
    });
  } catch (err) {
    console.error("[chat-proxy] Backend fetch failed:", err);
    return NextResponse.json(
      { error: "Chat service unavailable" },
      { status: 502 },
    );
  }

  if (!backendRes.ok) {
    const errText = await backendRes.text().catch(() => "Unknown error");
    // Try to parse as JSON to forward structured error info (e.g. 402 billing fields)
    let errBody: Record<string, unknown>;
    try {
      errBody = JSON.parse(errText);
    } catch {
      errBody = { error: errText };
    }
    return NextResponse.json(errBody, { status: backendRes.status });
  }

  if (!backendRes.body) {
    return NextResponse.json(
      { error: "Empty response from chat service" },
      { status: 502 },
    );
  }

  const reader = backendRes.body.getReader();
  const decoder = new TextDecoder();

  const stream = createUIMessageStream({
    execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
      let buffer = "";
      let textPartId = crypto.randomUUID();
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

        // Session ID event (first event from backend)
        if (event.sessionId && !event.type) {
          writer.write({
            type: "data-session" as `data-${string}`,
            data: { sessionId: event.sessionId as string },
          } as never);
          return;
        }

        // Untyped error event
        if (event.error && !event.type) {
          writer.write({ type: "error", errorText: String(event.error) });
          return;
        }

        switch (event.type) {
          case "token": {
            const text = ((event.content || event.token || "") as string);
            if (!text) break;
            if (!textStarted) {
              writer.write({ type: "text-start", id: textPartId });
              textStarted = true;
            }
            writer.write({
              type: "text-delta",
              id: textPartId,
              delta: text,
            });
            break;
          }

          case "thinking_start": {
            if (textStarted) {
              writer.write({ type: "text-end", id: textPartId });
              textStarted = false;
              textPartId = crypto.randomUUID();
            }
            reasoningPartId = crypto.randomUUID();
            writer.write({
              type: "reasoning-start",
              id: reasoningPartId,
            });
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

          case "tool_call": {
            if (textStarted) {
              writer.write({ type: "text-end", id: textPartId });
              textStarted = false;
              textPartId = crypto.randomUUID();
            }
            const toolCallId = (event.id || `tc_${Date.now()}`) as string;
            const toolName = (event.name || "unknown") as string;
            let input: unknown;
            try {
              input =
                typeof event.args === "string"
                  ? JSON.parse(event.args as string)
                  : (event.args ?? {});
            } catch {
              input = event.args ?? {};
            }

            writer.write({
              type: "tool-input-start",
              toolCallId,
              toolName,
            });
            writer.write({
              type: "tool-input-available",
              toolCallId,
              toolName,
              input,
            });
            break;
          }

          case "tool_result": {
            const toolCallId = (event.id || "") as string;
            const output =
              typeof event.result === "string"
                ? event.result
                : JSON.stringify(event.result ?? "");

            writer.write({
              type: "tool-output-available",
              toolCallId,
              output,
            });
            // Step boundary after tool result
            writer.write({ type: "finish-step" });
            writer.write({ type: "start-step" });
            break;
          }

          case "input_request": {
            writer.write({
              type: "data-input-request" as `data-${string}`,
              data: {
                inputType: (event.input_type || "text") as string,
                label: (event.label || "") as string,
                placeholder: event.placeholder as string | undefined,
                field: (event.field || "") as string,
                value: event.value as string | undefined,
              },
            } as never);
            break;
          }

          case "buttons": {
            writer.write({
              type: "data-buttons" as `data-${string}`,
              data: {
                buttons: (event.buttons || []) as Array<{
                  label: string;
                  value: string;
                }>,
              },
            } as never);
            break;
          }

          case "error": {
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

        // Process any remaining data in the buffer (backend may not send trailing newline)
        const remaining = buffer.trim();
        if (remaining) {
          processLine(remaining);
        }
      } catch (err) {
        console.error("[chat-proxy] Stream read error:", err);
        writer.write({
          type: "error",
          errorText: "Connection to chat service was interrupted. Please try again.",
        });
      } finally {
        // Always close any open text part so the frontend doesn't hang
        if (textStarted) {
          writer.write({ type: "text-end", id: textPartId });
        }
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}

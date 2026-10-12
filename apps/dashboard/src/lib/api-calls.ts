/**
 * One API / MCP call a person made with their own key, whole: what they asked and what we
 * answered (crm-service `GET /orgs/people/api-calls/{callId}`, gateway passthrough, staff
 * Unibox scope). The Unibox thread shows each call as two messages; this is what opens
 * under them. Secrets are already removed by the producer, each body cut at 256 KB.
 *
 * Alias-free (zod and nothing else) so it carries real unit tests.
 */
import { z } from "zod";

const BodySide = {
  body: z.string().nullable(),
  bodyBytes: z.coerce.number(),
  bodyTruncated: z.boolean(),
};

export const ApiCallDetailSchema = z.object({
  callId: z.string(),
  // `api` or `mcp` today; a string so a new channel does not blank the panel.
  channel: z.string(),
  mcpTool: z.string().nullable(),
  callerOrgId: z.string().nullable(),
  callerUserId: z.string(),
  email: z.string(),
  displayName: z.string().nullable(),
  keyFingerprint: z.string().nullable(),
  brandIds: z.array(z.string()),
  calledAt: z.string(),
  durationMs: z.coerce.number(),
  summary: z.object({ asked: z.string(), answered: z.string() }),
  request: z.object({
    method: z.string(),
    path: z.string(),
    query: z.record(z.string(), z.unknown()),
    headers: z.record(z.string(), z.string()),
    ...BodySide,
  }),
  response: z.object({
    status: z.coerce.number(),
    contentType: z.string().nullable(),
    ...BodySide,
  }),
});

export type ApiCallDetail = z.infer<typeof ApiCallDetailSchema>;

/** The thread item's call id, when the item is an API / MCP call. */
export function itemCallId(item: { source: string; ref?: Record<string, string | null> | null }): string | null {
  if (item.source !== "api") return null;
  const id = item.ref?.callId;
  return typeof id === "string" && id ? id : null;
}

/**
 * A body as a reader reads it: JSON indented, anything else verbatim. A body cut at 256 KB
 * is no longer valid JSON and stays verbatim. Pure formatting.
 */
export function prettyBody(body: string | null): { text: string; json: boolean } | null {
  if (body == null || body === "") return null;
  try {
    return { text: JSON.stringify(JSON.parse(body), null, 2), json: true };
  } catch {
    return { text: body, json: false };
  }
}

/** A query value as one line: strings as they are, anything else as JSON. */
export function queryValue(v: unknown): string {
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

/** How a status reads: 2xx/3xx answered, 4xx refused, 5xx failed. */
export function callStatusTone(status: number): "ok" | "refused" | "failed" {
  if (status >= 500) return "failed";
  if (status >= 400) return "refused";
  return "ok";
}

/** A byte count as a reader says it: 652 B, 35.4 KB, 432.1 KB. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

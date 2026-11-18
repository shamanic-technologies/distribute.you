import { randomBytes } from "node:crypto";

import { MAX_TEXT_LENGTH, VISITOR_COOKIE, createIpGuard, isVisitorId, relayWebMessage } from "@/lib/chat/distry-web";
import { prototypeSlugForHost } from "@/lib/prototype-catalogue";

export const dynamic = "force-dynamic";

/**
 * A visitor's message to Distry, from the chat panel of the Distry skin
 * (`public/landing/distry/distry.js`). Open only on a skin host for now: the panel does
 * not exist on the live site yet, and every answer is a model call, so the route stays
 * closed there until the skin goes live.
 */
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });

// One process serves the site: the count per address lives here.
const ipGuard = createIpGuard();
const BUSY = { status: "busy", reply: null, choices: null, continuedOn: null, account: { signedIn: false, email: null } };

function cookieValue(header: string | null, name: string): string | null {
  const match = (header ?? "").split(/;\s*/).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export async function POST(request: Request) {
  if (prototypeSlugForHost(request.headers.get("host")) === null) return json({ error: "not_found" }, 404);

  const body = (await request.json().catch(() => null)) as { messageId?: unknown; text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const messageId = typeof body?.messageId === "string" ? body.messageId : "";
  if (text.length === 0 || text.length > MAX_TEXT_LENGTH || !/^[A-Za-z0-9_-]{8,64}$/.test(messageId)) {
    return json({ error: "invalid_message" }, 400);
  }

  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!ipGuard.allow(ip, messageId)) {
    console.warn(`[landing/chat] page chat: ${ip} wrote faster than a person does, message refused`);
    return json(BUSY);
  }

  const known = cookieValue(request.headers.get("cookie"), VISITOR_COOKIE);
  const visitorId = isVisitorId(known) ? known : randomBytes(24).toString("base64url");
  const setCookie: Record<string, string> = isVisitorId(known)
    ? {}
    : { "set-cookie": `${VISITOR_COOKIE}=${visitorId}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax` };

  const relay = await relayWebMessage(visitorId, messageId, text);
  if (!relay.ok) return json({ error: relay.reason }, 502, setCookie);
  return json(relay.answer, 200, setCookie);
}

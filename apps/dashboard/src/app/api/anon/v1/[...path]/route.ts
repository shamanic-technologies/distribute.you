import { NextRequest, NextResponse } from "next/server";
import { anonCallAllowed } from "@/lib/anon-proxy-allowlist";
import {
  anonSessionCookie,
  anonTokenFromCookieHeader,
  clearAnonSessionCookie,
} from "@/lib/anon-session-cookie";
import { ANON_PRINCIPAL, readAnonSession, signAnonSession } from "@/lib/anon-session-token";

/**
 * The gateway, for a visitor who has not signed up yet.
 *
 * Mirror of the authed `/api/v1` proxy beside it, with the Clerk session
 * replaced by the signed anonymous-session cookie and an ALLOWLIST in front.
 * The org it forwards as is an ordinary org — one whose external id is
 * `anon_<uuid>` rather than a Clerk org id, which the gateway resolves through
 * client-service exactly as it resolves any other. So every producer downstream
 * is untouched: the wizard writes the brand, suggests audiences and extracts an
 * offer against a real org, and at signup that org is re-pointed at the Clerk
 * org the visitor just created. Nothing moves.
 *
 * WHAT BOUNDS IT, in the order the request meets them:
 *
 *  1. The COOKIE is signed, so the org id comes out of a signature we minted.
 *     A browser that edits it produces a token that does not verify.
 *  2. The ALLOWLIST is closed, and carries no sending route and no charging
 *     route. The no-outreach promise is the absence of a line in that file.
 *  3. The BRAND is bound to the session. Brand identity and extracted fields
 *     are keyed on the brand with no org column, so an unbound session could
 *     read any customer's scraped site.
 *  4. The CREDIT LINE is the spend cap. The anonymous org holds a small seed
 *     grant and nothing else, so billing's own affordability gate refuses the
 *     call the moment it is out — no counter of ours, no threshold to tune.
 *
 * Every refusal is logged with its reason and answered as a flat status. The
 * reason never reaches the browser: a visitor learning that their token failed
 * its signature rather than its expiry learns something only an attacker wants.
 */

export const maxDuration = 300;

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;

/** Secure cookies everywhere but a plain-http dev origin. */
const isSecure = (req: NextRequest): boolean =>
  new URL(req.url).protocol === "https:";

async function proxyRequest(
  req: NextRequest,
  segmentData: { params: Promise<{ path: string[] }> },
) {
  try {
    if (!API_KEY) {
      console.error("[anon-proxy] ADMIN_DISTRIBUTE_API_KEY is not set");
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }

    const token = anonTokenFromCookieHeader(req.headers.get("cookie"));
    const { session, refusal } = readAnonSession(token, API_KEY);
    if (!session) {
      console.error(`[anon-proxy] token refused: ${refusal ?? "absent"}`);
      // Clear it on the way out: a browser holding a stale token would
      // otherwise keep sending it on every call for a day.
      const res = NextResponse.json({ error: "No session" }, { status: 401 });
      res.headers.set("Set-Cookie", clearAnonSessionCookie({ secure: isSecure(req) }));
      return res;
    }

    const { path } = await segmentData.params;
    const endpoint = `/${path.join("/")}`;

    const verdict = anonCallAllowed({
      method: req.method,
      endpoint,
      brandId: session.brandId,
    });
    if (!verdict.allowed) {
      console.error(
        `[anon-proxy] refused ${req.method} ${endpoint} for ${session.anonOrgId}: ${verdict.refusal}`,
      );
      return NextResponse.json({ error: "Not available" }, { status: 403 });
    }

    const url = new URL(`/v1${endpoint}`, API_URL);
    req.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      // The gateway upserts this pair through client-service on first sight, so
      // the anonymous org needs no create step of its own. The principal is ONE
      // shared `system-` id rather than one per visitor: a per-session id would
      // mint a `users` row per signup attempt and inflate the public user count.
      "x-external-org-id": session.anonOrgId,
      "x-external-user-id": ANON_PRINCIPAL,
      // Always the SESSION's brand, never a header the browser sent. The
      // allowlist has already refused any path naming another one; this makes
      // the brand-scoped routes that read the header agree by construction.
      "x-brand-id": session.brandId,
    };

    const body =
      req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined;

    const res = await fetch(url.toString(), { method: req.method, headers, body });
    const contentType = res.headers.get("Content-Type") || "application/json";

    // ONE SESSION, ONE BRAND — and this is where the session learns which.
    //
    // A session starts owning no brand: its first act is `POST /brands`, which
    // names none, and the allowlist refuses every brand-scoped route until it
    // does. So the brand id is written into the signature the moment the brand
    // exists, from the RESPONSE rather than from anything the browser said.
    //
    // Done here rather than in a route of its own because the alternative is a
    // second round trip on the one call that must not fail, and because this is
    // the only place that sees both the request and its answer. It is bounded
    // hard: only a successful create, only while the session owns no brand, so
    // it can neither re-point an existing session nor fire twice.
    if (
      session.brandId.length === 0 &&
      req.method === "POST" &&
      endpoint === "/brands" &&
      res.ok
    ) {
      const raw = await res.text();
      let brandId = "";
      try {
        const parsed = JSON.parse(raw) as { brandId?: unknown };
        if (typeof parsed.brandId === "string") brandId = parsed.brandId;
      } catch {
        // Not our shape. The answer still goes back verbatim; the session simply
        // keeps no brand, which is honest and refuses the brand-scoped routes.
        console.error("[anon-proxy] brand create: could not read brandId");
      }

      const out = new NextResponse(raw, {
        status: res.status,
        headers: { "Content-Type": contentType },
      });
      if (brandId.length > 0) {
        // `issuedAt` is CARRIED, not refreshed: re-minting must not extend the
        // session's life, or a browser could hold one indefinitely by creating
        // brands.
        const token = signAnonSession({ ...session, brandId }, API_KEY);
        out.headers.set("Set-Cookie", anonSessionCookie(token, { secure: isSecure(req) }));
      }
      return out;
    }

    // Streamed through rather than buffered, for the reason the authed proxy
    // records: reading the body into a string holds the payload twice and has
    // OOM-killed the function instance, which 500s every concurrent request.
    return new NextResponse(res.body, {
      status: res.status,
      headers: { "Content-Type": contentType },
    });
  } catch (err) {
    console.error("[anon-proxy] request failed:", err);
    return NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, ctx);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, ctx);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, ctx);
}

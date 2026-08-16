import { NextRequest, NextResponse } from "next/server";
import { shareApiAccess } from "@/lib/share-api-allowlist";
import { resolveShareToken } from "@/lib/share-report";
import { SERVICE_IDENTITY } from "@/lib/service-identity";

/**
 * The read path for the public share view.
 *
 * The authed dashboard proxies through `/api/v1/*`, which takes its org from the
 * Clerk session. A share visitor has no session, so this handler derives the org
 * from the credential in the URL instead — and that is exactly why it is a
 * SEPARATE handler rather than a branch inside the authed one: the two have
 * different authorities and must not share a code path where a mistake in one
 * silently widens the other.
 *
 * Only GET is exported. There is no POST/PUT/PATCH/DELETE here, so a share link
 * cannot write anything — not by calling a route the UI hides, not by replaying a
 * request, not by a route added later. That is the boundary; the UI hiding its
 * Save buttons is the experience.
 *
 * Every request is additionally pinned to the credential's own brand by
 * `shareApiAccess`. Without that a recipient could walk sideways into a sibling
 * brand in the same org, since the org identity we forward covers all of them.
 */

export const maxDuration = 300;

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;

export async function GET(
  req: NextRequest,
  segmentData: { params: Promise<{ token: string; path: string[] }> },
) {
  const { token, path } = await segmentData.params;
  const endpoint = `/${path.join("/")}`;

  try {
    if (!API_KEY) {
      console.error("[share-proxy] ADMIN_DISTRIBUTE_API_KEY env var is not set");
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    // The credential is re-resolved on EVERY request rather than trusted from the
    // URL or a cookie: revoking a share link has to stop the next read, not the
    // next full page load.
    const brand = await resolveShareToken(token);
    if (!brand) {
      // Unknown, revoked and rotated-away credentials are one outcome, matching
      // the page itself. The caller never learns which.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const decision = shareApiAccess(
      req.method,
      endpoint,
      req.nextUrl.searchParams,
      brand.id,
    );
    if (!decision.allowed) {
      // Named in the logs so a missing allowlist entry reads as the gap it is,
      // rather than as a broken endpoint.
      console.error(`[share-proxy] refused: ${decision.reason}`);
      return NextResponse.json({ error: "Not available on a shared link" }, { status: 403 });
    }

    const url = new URL(`/v1${endpoint}`, API_URL);
    req.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "x-external-org-id": brand.orgId,
        // A stable synthetic caller, keyed on the JOB rather than the org: the
        // gateway resolves the (org, user) pair through client-service, which
        // upserts a `users` row for whatever it is handed, so a per-org id was a
        // row per org forever. The org travels on its own header above.
        "x-external-user-id": SERVICE_IDENTITY.sharePublic,
        // Pinned to the credential's brand rather than forwarded from the client:
        // the caller does not get to say which brand it is asking about.
        "x-brand-id": brand.id,
      },
    });

    const contentType = res.headers.get("Content-Type") || "application/json";
    // Streamed through, not buffered — the authed proxy learned the hard way that
    // holding a large list response twice OOM-kills the function instance.
    return new NextResponse(res.body, {
      status: res.status,
      headers: { "Content-Type": contentType },
    });
  } catch (err) {
    console.error(`[share-proxy] GET /v1${endpoint} failed:`, err);
    return NextResponse.json(
      { error: "Proxy error", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}

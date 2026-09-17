import { NextResponse } from "next/server";

/**
 * The catalogue the SIGNED-OUT half of onboarding is built from.
 *
 * Everything the first three screens offer — which outcomes we can buy, which
 * channels deliver them, which revenue funnels those channels sell, and what a
 * day of each costs — is published by features-service on two public, org-less
 * routes. This handler is the one place that reads them, for two reasons:
 *
 *  - The visitor has no session yet. The dashboard's own `/api/v1` proxy sits
 *    inside `(authed)` and attaches a Clerk bearer, so it cannot serve a screen
 *    that runs before signup.
 *  - Reading the gateway from the browser would need CORS on a surface that has
 *    none, and would put our API host in a client bundle for no gain.
 *
 * FAIL LOUD. A catalogue we could not read is a screen with nothing to offer, so
 * this returns the upstream's own status rather than an empty list: a visitor
 * shown "no channels" would read it as us selling nothing, which is worse than
 * an error they can retry.
 */

/**
 * The gateway host, resolved EXACTLY as the rest of the app resolves it.
 *
 * `NEXT_PUBLIC_DISTRIBUTE_API_URL` with this literal fallback is what
 * `lib/api.ts` and the `/api/v1` proxy already use, and the fallback is what
 * actually answers: the variable is set in neither the build env nor the
 * runtime env on the box, so a handler reading any other name resolves to
 * nothing and 500s on every request. An invented name looks right in review and
 * is unset everywhere.
 */
const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

/** Long enough for a cold gateway, short enough that a hung upstream does not
 *  hold the visitor's first screen open indefinitely. */
const UPSTREAM_TIMEOUT_MS = 12_000;

async function readPublic(path: string): Promise<Response> {
  return fetch(`${API_URL}/v1/public/${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    // The catalogue changes when somebody edits the channel list, not per
    // request. A minute keeps a burst of signups off the gateway without
    // letting a newly published channel sit invisible for long.
    next: { revalidate: 60 },
  });
}

export async function GET() {
  try {
    const [channelsRes, returnsRes, foundersRes] = await Promise.all([
      readPublic("channels"),
      // Median return on spend per (channel x funnel), with quartiles, over
      // brands past the producer's own spend floor. The visitor sees it on the
      // screen before signup, which is the whole argument for signing up.
      readPublic("features/funnel-return-on-spend"),
      // The platform's own user count, the same public read the landing floors
      // into its trust strip. Third half that may legitimately be missing.
      readPublic("stats/users"),
    ]);

    if (!channelsRes.ok) {
      const body = await channelsRes.text();
      console.error(
        `[start-catalogue] channels read failed: ${channelsRes.status} ${body.slice(0, 200)}`,
      );
      return NextResponse.json({ error: "Catalogue is unavailable" }, { status: 502 });
    }

    const channels = await channelsRes.json();

    // The returns are the one HALF that may legitimately be missing: the producer
    // states a figure only for a pair enough brands have spent on, and a visitor
    // with no numbers beside a channel is a weaker screen, not a broken one. So a
    // failed read here degrades to "we have not measured this" rather than taking
    // the whole catalogue down with it -- but it is logged, never swallowed.
    let returns: unknown = null;
    if (returnsRes.ok) {
      returns = await returnsRes.json();
    } else {
      console.error(
        `[start-catalogue] funnel-return-on-spend read failed: ${returnsRes.status}`,
      );
    }

    let founders: number | null = null;
    if (foundersRes.ok) {
      const data = (await foundersRes.json()) as { totalUsers?: number | null };
      founders = typeof data.totalUsers === "number" ? data.totalUsers : null;
    } else {
      console.error(`[start-catalogue] stats/users read failed: ${foundersRes.status}`);
    }

    return NextResponse.json({ channels, returns, founders });
  } catch (err) {
    console.error("[start-catalogue] catalogue read errored:", err);
    return NextResponse.json({ error: "Catalogue is unavailable" }, { status: 502 });
  }
}

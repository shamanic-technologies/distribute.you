import { NextResponse } from "next/server";

/**
 * What a dollar came back as for a CHANNEL, across every funnel it sells.
 *
 * The screen before signup asks about a (channel x funnel) PAIR, and the
 * producer measures only 2 of the 124 pairs it publishes — a pair pools few
 * brands, so it clears the producer's own floor rarely. The same channel across
 * all its funnels pools far more (cold email: 10 brands at channel scope
 * against 3 at pair scope), so it is measured far more often, and it is what a
 * row falls back to when its pair cannot be stated. The consumer renders the
 * scope beside the figure either way; a channel median must never be read as
 * describing the one funnel somebody picked.
 *
 * Per-channel because that is how features-service publishes it — there is no
 * bulk read — so the fan-out is CAPPED here rather than at the call site: a
 * visitor who kept thirty channels must not turn one screen into thirty
 * upstream requests.
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

/** The floor the producer takes each median over. Stated rather than defaulted:
 *  it selects the POPULATION, so a stripped parameter would publish a figure
 *  over a population nobody asked for. Matches what the homepage asks for. */
const MIN_SPEND_USD = 100;

/** Bounded fan-out. Well past any selection worth rendering on one screen, and
 *  far short of the 42 channels a visitor could theoretically keep. */
const MAX_CHANNELS = 12;

const UPSTREAM_TIMEOUT_MS = 12_000;

/** The shape our own producers use. A slug outside it never reaches the
 *  gateway: this route is public and its query is visitor-supplied. */
const SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export async function GET(request: Request) {
  const slugs = (new URL(request.url).searchParams.get("slugs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => SLUG.test(s))
    .slice(0, MAX_CHANNELS);

  if (slugs.length === 0) return NextResponse.json({ returns: [] });

  // One read per channel, in parallel and bounded. A channel whose read fails is
  // OMITTED rather than faked: its row then falls through to whatever its pair
  // says, and if that is unmeasured too the screen says so. Logged loud -- a
  // silently missing figure is a weaker screen, never a wrong one.
  const settled = await Promise.allSettled(
    slugs.map(async (slug) => {
      const res = await fetch(
        `${API_URL}/v1/public/features/return-on-spend` +
          `?featureSlug=${encodeURIComponent(slug)}&minSpendUsd=${MIN_SPEND_USD}`,
        {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
          next: { revalidate: 300 },
        },
      );
      if (!res.ok) throw new Error(`${res.status} for ${slug}`);
      return res.json();
    }),
  );

  const returns = [];
  for (const [i, r] of settled.entries()) {
    if (r.status === "fulfilled") returns.push(r.value);
    else console.error(`[start-returns] ${slugs[i]} read failed:`, r.reason);
  }

  return NextResponse.json({ returns });
}

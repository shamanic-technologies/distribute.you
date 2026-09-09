import { NextResponse } from "next/server";
import {
  adsConversionFeedConfigFromEnv,
  buildAdsConversionFeed,
  verifyFeedRequest,
} from "@/lib/ads-conversion-feed-fetch";
import { feedWindowStart } from "@/lib/ads-conversion-feed";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/ads-conversion-feed?since=YYYY-MM-DD  (Bearer ADS_CONVERSION_FEED_TOKEN)
 *
 * The Google Ads offline-conversion CSV, read daily by a Google Ads Script that
 * bulk-uploads it into the account. Lives under `/api/cron` because that prefix is
 * public in `proxy.ts` (no Clerk session behind an Ads Script) and token-gated
 * exactly like the outcome digest. Default window is the 90 days Google matches a
 * click within; `?since=` narrows it.
 */
export async function GET(req: Request) {
  try {
    const config = adsConversionFeedConfigFromEnv();
    if (!verifyFeedRequest(req, config)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const since = feedWindowStart(new Date(), new URL(req.url).searchParams.get("since"));
    const result = await buildAdsConversionFeed(config, since);
    console.log(
      `[dashboard-ads-feed] attributedOrgs=${result.attributedOrgs} failedOrgs=${result.failedOrgs} signUpPageViews=${result.signUpPageViews} rows=${result.rows.length} since=${since.toISOString()}`,
    );
    return new NextResponse(result.csv, {
      status: 200,
      headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[dashboard-ads-feed] failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

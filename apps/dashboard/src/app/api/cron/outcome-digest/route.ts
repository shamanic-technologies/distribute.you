import { NextResponse } from "next/server";
import {
  outcomeDigestConfigFromEnv,
  sendOutcomeDigestEmails,
  verifyOutcomeDigestCronRequest,
} from "@/lib/outcome-digest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  try {
    if (!verifyOutcomeDigestCronRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await sendOutcomeDigestEmails(outcomeDigestConfigFromEnv());
    console.log(
      `[dashboard-outcome-digest] scanned=${result.scannedOrgs} eligibleUsers=${result.eligibleUsers} prepared=${result.preparedSends.length} sent=${result.sent} deduped=${result.deduplicated}`,
    );
    return NextResponse.json({
      ok: true,
      scannedOrgs: result.scannedOrgs,
      eligibleUsers: result.eligibleUsers,
      prepared: result.preparedSends.length,
      sent: result.sent,
      deduplicated: result.deduplicated,
    });
  } catch (err) {
    console.error("[dashboard-outcome-digest] cron failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

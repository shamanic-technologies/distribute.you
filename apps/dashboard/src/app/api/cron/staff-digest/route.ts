import { NextResponse } from "next/server";
import { ADMIN_ALLOWED_EMAILS } from "@/lib/admin-allowlist";
import {
  sendStaffDigest,
  staffDigestConfigFromEnv,
  verifyStaffDigestCronRequest,
} from "@/lib/staff-digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One staff email a day, replacing the ~609 per-event pings that were spending
 * the whole Postmark free-plan quota. Reads Clerk, so it needs no new storage
 * and no new secret.
 *
 * The staff address is taken from the allowlist rather than restated here —
 * that list is the single source of truth for who staff is.
 */
export async function GET(req: Request) {
  try {
    if (!verifyStaffDigestCronRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staffEmail = ADMIN_ALLOWED_EMAILS[0];
    const result = await sendStaffDigest(staffDigestConfigFromEnv(staffEmail));
    console.log(
      `[dashboard-staff-digest] signups=${result.signups} signins=${result.signins} sent=${result.sent} skippedEmpty=${result.skippedEmpty}`,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[dashboard-staff-digest] cron failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

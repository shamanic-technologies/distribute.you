import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPaymentOutlook } from "@/lib/billing-service";
import { resolveIdentity } from "@/lib/client-service";

/**
 * Is the org the request is scoped to held over payment RIGHT NOW?
 *
 * Billing's payment outlook is the current truth campaign-service stops campaigns
 * and refuses starts on. A campaign's `stopReason` is history: a campaign stopped
 * over a missing card weeks ago keeps that reason after the org switched to prepaid
 * or added a card. So every "your campaigns are paused over payment, add a card"
 * surface asks this route before it speaks.
 *
 * The outlook is a service-to-service read (`/internal`, billing's key), which is
 * why it goes through this route rather than the gateway. The org is `auth().orgId`,
 * from THIS tab's token, never a value the client picked. Billing unreadable is a
 * 502, never a guess.
 */
export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  try {
    const identity = await resolveIdentity(orgId, userId);
    const outlook = await getPaymentOutlook(identity.orgId);
    return NextResponse.json({
      state: outlook.state,
      blockedReason: outlook.blockedReason,
      paymentMode: outlook.paymentMode,
    });
  } catch (err) {
    console.error(`[payment-hold] could not read billing's payment outlook for org=${orgId}:`, err);
    return NextResponse.json({ error: "billing_unavailable" }, { status: 502 });
  }
}

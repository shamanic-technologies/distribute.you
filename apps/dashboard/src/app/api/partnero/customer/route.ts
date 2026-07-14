import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PARTNERO_CUSTOMERS_URL = "https://api.partnero.com/v1/customers";

/**
 * Server-to-server Partnero attribution. The dashboard runs on a different
 * subdomain (dashboard.distribute.you) than the referral landing
 * (distribute.you), so PartneroJS's own cross-subdomain cookie cannot carry
 * the partner key across. Instead the key is forwarded from the landing as a
 * `?via=` param, persisted to the `partnero_via` cookie, and registered here
 * server-side once the signup completes. Partnero then credits the partner's
 * lifetime commission off this customer's Stripe purchases.
 *
 * Fail-loud: a missing token or a Partnero rejection returns an error status
 * (the client fires this fire-and-forget, so it never blocks signup, but the
 * failure is surfaced + logged rather than silently swallowed).
 */
export async function POST(req: Request) {
  const token = process.env.PARTNERO_API_TOKEN;
  if (!token) {
    console.error("[dashboard-partnero] PARTNERO_API_TOKEN is not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const { via, key, email, name } = (await req.json()) as {
    via?: string;
    key?: string;
    email?: string;
    name?: string;
  };

  if (!via || !key || !email) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const res = await fetch(PARTNERO_CUSTOMERS_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ partner: { key: via }, key, email, name }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(
      `[dashboard-partnero] customer create failed ${res.status}: ${body}`,
    );
    return NextResponse.json(
      { error: "partnero_error", status: res.status },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}

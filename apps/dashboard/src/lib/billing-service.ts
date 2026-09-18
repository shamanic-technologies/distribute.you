/**
 * The two money calls the anonymous flow makes, at its two ends.
 *
 * SEEDING is what makes the signed-out phase possible at all — and it is also
 * what BOUNDS it. The org holds a small amount of free credit and nothing else,
 * so billing's own affordability gate refuses the call the moment it is spent.
 * No counter of ours, no threshold to tune: a credit line IS a spend cap, and
 * inventing a second one in a consumer is how it drifts from the ledger that
 * actually holds the money.
 *
 * SETTLING is what makes signing up land on exactly the welcome amount rather
 * than the welcome amount PLUS whatever we seeded. Billing derives both figures
 * from the same live welcome row, so THIS MODULE KNOWS NEITHER AMOUNT — there
 * is deliberately no number here to keep in step, and no customer-facing copy
 * anywhere may state the seed.
 *
 * Reached on the compose network. The key cannot reach a browser: Next inlines
 * only `NEXT_PUBLIC_*` into a client bundle.
 */

const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL;
const BILLING_SERVICE_API_KEY = process.env.BILLING_SERVICE_API_KEY;

const TIMEOUT_MS = 12_000;

async function post(path: string): Promise<{ status: number; body: unknown }> {
  if (!BILLING_SERVICE_URL || !BILLING_SERVICE_API_KEY) {
    throw new Error("[billing-service] BILLING_SERVICE_URL / BILLING_SERVICE_API_KEY not set");
  }
  const res = await fetch(`${BILLING_SERVICE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": BILLING_SERVICE_API_KEY },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/**
 * Put the trial seed on an org nobody has signed up for.
 *
 * THROWS on failure, and the caller must let that refuse the whole session. An
 * anonymous org with no credit is not a degraded session — every LLM call in
 * the flow is refused by the affordability gate, so the visitor would walk into
 * a wizard where nothing works. Failing here means they get the pay-first flow
 * instead, which is a worse first experience and a working one.
 */
export async function seedTrialCredit(orgId: string): Promise<void> {
  const { status } = await post(
    `/internal/accounts/by-org/${encodeURIComponent(orgId)}/trial-seed`,
  );
  if (status < 200 || status >= 300) {
    throw new Error(`[billing-service] trial-seed failed: ${status}`);
  }
}

/**
 * The org signed up: land its TOTAL free credit on exactly the welcome amount.
 *
 * Returns whether it landed rather than throwing, because by the time this runs
 * the claim has already succeeded and the org IS theirs — losing the signup over
 * a credit settle would be the expensive mistake. A failure is logged loud and
 * the customer continues; billing's own semantics make a retry safe.
 *
 * An org that was never seeded is byte-for-byte unaffected by this call, so the
 * caller does not have to know which kind of signup it is looking at.
 */
export async function settleWelcomeOnSignup(orgId: string): Promise<boolean> {
  try {
    const { status } = await post(
      `/internal/accounts/by-org/${encodeURIComponent(orgId)}/signup`,
    );
    if (status < 200 || status >= 300) {
      console.error(`[billing-service] signup settle failed for ${orgId}: ${status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[billing-service] signup settle errored for ${orgId}:`, err);
    return false;
  }
}

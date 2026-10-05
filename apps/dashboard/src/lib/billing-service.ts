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

async function post(
  path: string,
  extraHeaders: Record<string, string> = {},
): Promise<{ status: number; body: unknown }> {
  if (!BILLING_SERVICE_URL || !BILLING_SERVICE_API_KEY) {
    throw new Error("[billing-service] BILLING_SERVICE_URL / BILLING_SERVICE_API_KEY not set");
  }
  const res = await fetch(`${BILLING_SERVICE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": BILLING_SERVICE_API_KEY,
      ...extraHeaders,
    },
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
 * Declare that an org pays through Revolut (billing relays stripe-service's pin, which
 * also creates the org's Revolut customer). Owner-decided 2026-09-27 for orgs set up in
 * the dashboard. Idempotent. Returns `"pinned"`, or `"card_elsewhere"` when the org
 * already holds a chargeable card on another acquirer (billing's 409), in which case it
 * keeps paying where its card is. Any other failure throws.
 */
export async function declareRevolutAcquirer(
  orgId: string,
  userId: string,
  person: { email?: string; fullName?: string },
): Promise<"pinned" | "card_elsewhere"> {
  if (!BILLING_SERVICE_URL || !BILLING_SERVICE_API_KEY) {
    throw new Error("[billing-service] BILLING_SERVICE_URL / BILLING_SERVICE_API_KEY not set");
  }
  const res = await fetch(`${BILLING_SERVICE_URL}/v1/accounts/acquirer`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": BILLING_SERVICE_API_KEY,
      "x-org-id": orgId,
      "x-user-id": userId,
      "x-run-id": crypto.randomUUID(),
    },
    body: JSON.stringify({
      acquirer: "revolut",
      ...(person.email ? { email: person.email } : {}),
      ...(person.fullName ? { full_name: person.fullName } : {}),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 409) return "card_elsewhere";
  if (!res.ok) throw new Error(`[billing-service] acquirer declaration failed: ${res.status}`);
  return "pinned";
}

/**
 * Credit a NEW org its creation bonus, once. Billing owns the amount and the
 * idempotency (a retry grants nothing twice), and lists it on the org's grants
 * ledger. THROWS on failure: the org's first reads (scraping its site, drafting its
 * offer) are metered, so an org without it starts at $0 and every one is refused.
 */
export async function grantOrgCreationBonus(orgId: string): Promise<void> {
  const { status } = await post(
    `/internal/accounts/by-org/${encodeURIComponent(orgId)}/org-creation-bonus`,
  );
  if (status < 200 || status >= 300) {
    throw new Error(`[billing-service] org-creation-bonus failed: ${status}`);
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
 *
 * THE WELCOME IS ONCE PER PERSON, not once per org (billing-service #507), so
 * billing needs to know WHO signed up: `userId` is the person's client-service
 * INTERNAL user uuid, sent as `x-user-id`. Never a Clerk id, never the zero
 * uuid. When it is null the settle still runs without the header (billing then
 * falls back to per-org) and the gap is logged loudly: a person who already
 * holds a welcome elsewhere could get a second one, which is worth hearing
 * about, and still never worth losing a signup over.
 *
 * `welcomeReceivedElsewhere` is logged, never rendered.
 */
export async function settleWelcomeOnSignup(
  orgId: string,
  userId: string | null,
): Promise<boolean> {
  if (!userId) {
    console.error(
      `[billing-service] signup settle for ${orgId} without x-user-id: internal user id unresolved, billing falls back to a per-org welcome`,
    );
  }
  try {
    const { status, body } = await post(
      `/internal/accounts/by-org/${encodeURIComponent(orgId)}/signup`,
      userId ? { "x-user-id": userId } : {},
    );
    if (status < 200 || status >= 300) {
      console.error(`[billing-service] signup settle failed for ${orgId}: ${status}`);
      return false;
    }
    const elsewhere =
      body !== null &&
      typeof body === "object" &&
      (body as { welcomeReceivedElsewhere?: unknown }).welcomeReceivedElsewhere === true;
    console.log(
      `[billing-service] signup settled org=${orgId} user=${userId ?? "none"} welcomeReceivedElsewhere=${elsewhere}`,
    );
    return true;
  } catch (err) {
    console.error(`[billing-service] signup settle errored for ${orgId}:`, err);
    return false;
  }
}

/**
 * Body of POST /v1/billing/credits/grant (api-service passthrough to billing-service
 * POST /v1/credits/grant, v0.83.23).
 *
 * A grant is a GIFT by default. When the client paid us directly (bank transfer),
 * staff set `paidOffPlatformAt` to the day they paid: billing then counts the credit
 * as cash the client paid on that date, not as a gift (owner rule 2026-10-11:
 * revenue is cash the client paid). The key is ABSENT on a gift, never null.
 */
// A type alias, not an interface: apiCall's body is a Record<string, unknown>.
export type CreditGrantBody = {
  amountCents: number;
  note: string;
  idempotencyKey: string;
  paidOffPlatformAt?: string;
};

/** YYYY-MM-DD, never in the future (billing refuses a future date). */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function buildCreditGrantBody(input: {
  amountCents: number;
  note: string;
  idempotencyKey: string;
  paidOffPlatformAt?: string | null;
}): CreditGrantBody {
  const body: CreditGrantBody = {
    amountCents: input.amountCents,
    note: input.note,
    idempotencyKey: input.idempotencyKey,
  };
  const paidOn = input.paidOffPlatformAt?.trim();
  if (paidOn) {
    if (!DAY.test(paidOn)) throw new Error("Payment date must be YYYY-MM-DD.");
    body.paidOffPlatformAt = paidOn;
  }
  return body;
}

/** Today as YYYY-MM-DD in the staff member's own calendar (the date input's value). */
export function todayIsoDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

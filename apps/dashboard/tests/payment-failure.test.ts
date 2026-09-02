import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  latestPaymentFailure,
  paymentFailureAttemptsLine,
  GENERIC_DECLINE_MESSAGE,
  type PaymentFailureInput,
} from "../src/lib/payment-failure";

function pay(over: Partial<PaymentFailureInput> = {}): PaymentFailureInput {
  return {
    status: "succeeded",
    createdAt: "2026-08-01T00:00:00.000Z",
    amountCents: 5000,
    declineMessage: null,
    declineCode: null,
    ...over,
  };
}

function declined(over: Partial<PaymentFailureInput> = {}): PaymentFailureInput {
  return pay({
    status: "requires_payment_method",
    declineMessage: "Your card has insufficient funds.",
    declineCode: "insufficient_funds",
    ...over,
  });
}

describe("latestPaymentFailure", () => {
  it("returns null when there are no payments at all", () => {
    expect(latestPaymentFailure([])).toBeNull();
  });

  it("returns null when every payment succeeded", () => {
    expect(
      latestPaymentFailure([
        pay({ createdAt: "2026-08-01T00:00:00.000Z" }),
        pay({ createdAt: "2026-08-20T00:00:00.000Z" }),
      ]),
    ).toBeNull();
  });

  it("reports a decline that is newer than the last successful payment", () => {
    const failure = latestPaymentFailure([
      pay({ createdAt: "2026-08-20T00:00:00.000Z" }),
      declined({ createdAt: "2026-08-29T13:51:00.000Z", amountCents: 50000 }),
      declined({ createdAt: "2026-09-02T00:57:00.000Z", amountCents: 50000 }),
    ]);
    expect(failure).not.toBeNull();
    expect(failure!.amountCents).toBe(50000);
    expect(failure!.message).toBe("Your card has insufficient funds.");
    expect(failure!.code).toBe("insufficient_funds");
    expect(failure!.at).toBe("2026-09-02T00:57:00.000Z");
    expect(failure!.attempts).toBe(2);
  });

  it("returns null once a later payment goes through (the problem is over)", () => {
    expect(
      latestPaymentFailure([
        declined({ createdAt: "2026-08-29T13:51:00.000Z" }),
        pay({ createdAt: "2026-08-30T00:00:00.000Z" }),
      ]),
    ).toBeNull();
  });

  it("counts only the declines SINCE the last success, not the whole history", () => {
    const failure = latestPaymentFailure([
      declined({ createdAt: "2026-07-01T00:00:00.000Z" }),
      declined({ createdAt: "2026-07-02T00:00:00.000Z" }),
      pay({ createdAt: "2026-08-01T00:00:00.000Z" }),
      declined({ createdAt: "2026-08-29T00:00:00.000Z" }),
    ]);
    expect(failure!.attempts).toBe(1);
  });

  it("ignores an abandoned checkout: same status, no error object", () => {
    expect(
      latestPaymentFailure([
        pay({ createdAt: "2026-08-01T00:00:00.000Z" }),
        pay({ status: "requires_payment_method", createdAt: "2026-08-30T00:00:00.000Z" }),
      ]),
    ).toBeNull();
  });

  it("an abandoned checkout newer than a real decline does not hide the decline", () => {
    const failure = latestPaymentFailure([
      pay({ createdAt: "2026-08-01T00:00:00.000Z" }),
      declined({ createdAt: "2026-08-29T00:00:00.000Z" }),
      pay({ status: "requires_payment_method", createdAt: "2026-08-31T00:00:00.000Z" }),
    ]);
    expect(failure).not.toBeNull();
    expect(failure!.at).toBe("2026-08-29T00:00:00.000Z");
  });

  it("ignores the stale error Stripe keeps on an intent that later succeeded", () => {
    // Stripe does not clear last_payment_error when a retry on the same intent
    // is accepted. Reading it would report a failure the customer already fixed.
    expect(
      latestPaymentFailure([
        pay({
          status: "succeeded",
          createdAt: "2026-08-30T00:00:00.000Z",
          declineMessage: "Your card was declined.",
          declineCode: "card_declined",
        }),
      ]),
    ).toBeNull();
  });

  it("reports every decline when no payment has ever gone through", () => {
    const failure = latestPaymentFailure([
      declined({ createdAt: "2026-08-29T00:00:00.000Z" }),
      declined({ createdAt: "2026-08-30T00:00:00.000Z" }),
      declined({ createdAt: "2026-08-31T00:00:00.000Z" }),
    ]);
    expect(failure!.attempts).toBe(3);
    expect(failure!.at).toBe("2026-08-31T00:00:00.000Z");
  });

  it("falls back to a generic sentence when Stripe sent no message", () => {
    const failure = latestPaymentFailure([
      declined({ declineMessage: null, declineCode: "card_declined" }),
    ]);
    expect(failure!.message).toBe(GENERIC_DECLINE_MESSAGE);
    expect(failure!.code).toBe("card_declined");
  });

  it("is order-independent", () => {
    const rows = [
      declined({ createdAt: "2026-09-02T00:00:00.000Z" }),
      pay({ createdAt: "2026-08-01T00:00:00.000Z" }),
      declined({ createdAt: "2026-08-29T00:00:00.000Z" }),
    ];
    const a = latestPaymentFailure(rows);
    const b = latestPaymentFailure([...rows].reverse());
    expect(a).toEqual(b);
    expect(a!.attempts).toBe(2);
  });
});

describe("paymentFailureAttemptsLine", () => {
  it("states the count when several attempts failed", () => {
    const line = paymentFailureAttemptsLine({
      amountCents: 50000,
      message: "x",
      code: null,
      at: "2026-09-02T00:57:00.000Z",
      attempts: 12,
    });
    expect(line).toContain("12 payment attempts have failed");
  });

  it("does not say '1 attempt' for a single failure", () => {
    const line = paymentFailureAttemptsLine({
      amountCents: 50000,
      message: "x",
      code: null,
      at: "2026-09-02T00:57:00.000Z",
      attempts: 1,
    });
    expect(line).not.toContain("1 payment attempt");
    expect(line).toContain("Last attempted");
  });
});

// Source-substring guards: the derivation is unit-tested above, these pin that
// the page actually RENDERS it and passes both halves. A banner the page never
// mounts is the feature entirely absent with the component perfectly correct.
const PAGE = readFileSync(
  join(__dirname, "../src/app/(authed)/(dashboard)/orgs/[orgId]/billing/page.tsx"),
  "utf8",
);
const BANNER = readFileSync(
  join(__dirname, "../src/components/billing/payment-failed-banner.tsx"),
  "utf8",
);

describe("billing page call site", () => {
  it("mounts the banner and passes the retry + update-card handlers", () => {
    const at = PAGE.indexOf("<PaymentFailedBanner");
    expect(at).toBeGreaterThan(-1);
    const call = PAGE.slice(at, PAGE.indexOf("/>", at));
    expect(call).toContain("failure={paymentFailure}");
    expect(call).toContain("stopped={paymentsStopped}");
    expect(call).toContain("onRetry=");
    expect(call).toContain("onUpdateCard=");
  });

  it("derives the failure from the UNFILTERED payments, not the succeeded-only list", () => {
    // `payments` is filtered to succeeded for the Payments card; reading it here
    // would make every decline invisible, which is the bug being fixed.
    expect(PAGE).toContain("latestPaymentFailure(paymentsData?.payments ?? [])");
  });

  it("does not pass the refused amount as `required_cents`", () => {
    // The modal renders that as "Required", and the refused amount is what
    // auto-topup tried to charge, not a debt the customer owes.
    const at = PAGE.indexOf("<PaymentFailedBanner");
    const call = PAGE.slice(at, PAGE.indexOf("/>", at));
    expect(call).not.toContain("required_cents");
  });
});

describe("payment-failed banner", () => {
  it("renders Stripe's own message rather than a decline-code map of ours", () => {
    expect(BANNER).toContain("{failure.message}");
    expect(BANNER).not.toContain("insufficient_funds");
  });

  it("states the stopped campaigns only when the balance is out", () => {
    expect(BANNER).toContain('stopped ? " Your campaigns are stopped');
  });

  it("carries a full-perimeter 1px border, never a side accent", () => {
    expect(BANNER).toContain("border border-red-200");
    expect(BANNER).not.toMatch(/border-(l|r|t)-[248]/);
  });

  it("carries no em-dash in customer-facing copy", () => {
    // Scoped to the JSX: the rule exempts comments, and a file-wide check trips
    // on this component's own doc comment.
    const jsx = BANNER.slice(BANNER.indexOf("return ("));
    expect(jsx).not.toContain("—");
  });
});

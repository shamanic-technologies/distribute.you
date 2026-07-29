import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { paymentReturnState, paymentReturnBadge } from "../src/lib/payment-return";

describe("paymentReturnState", () => {
  it("reads a payment with nothing returned as untouched", () => {
    expect(paymentReturnState(1000, 0)).toBe("none");
  });

  it("reads a fully returned payment as full", () => {
    // The live prod case: a $10.00 top-up refunded by hand keeps Stripe status
    // `succeeded` at amount 1000, with amount_returned 1000.
    expect(paymentReturnState(1000, 1000)).toBe("full");
  });

  it("reads a partly returned payment as partial", () => {
    expect(paymentReturnState(1000, 400)).toBe("partial");
  });

  it("treats an over-return as full rather than partial", () => {
    expect(paymentReturnState(1000, 1200)).toBe("full");
  });
});

describe("paymentReturnBadge", () => {
  it("returns null for an untouched payment so the plain status badge still renders", () => {
    expect(paymentReturnBadge("none")).toBeNull();
  });

  it("labels a full return distinctly from a partial one", () => {
    const full = paymentReturnBadge("full");
    const partial = paymentReturnBadge("partial");
    expect(full?.label).toBe("Refunded");
    expect(partial?.label).toBe("Partially refunded");
    expect(full?.label).not.toBe(partial?.label);
  });

  it("never surfaces the words dispute or chargeback to the customer", () => {
    const labels = [paymentReturnBadge("full")?.label, paymentReturnBadge("partial")?.label];
    for (const label of labels) {
      expect(label?.toLowerCase()).not.toContain("dispute");
      expect(label?.toLowerCase()).not.toContain("chargeback");
    }
  });

  it("tints the background without a side or top border accent", () => {
    for (const state of ["full", "partial"] as const) {
      const className = paymentReturnBadge(state)?.className ?? "";
      expect(className).toContain("bg-gray-100");
      expect(className).not.toMatch(/border-[lrt]\b|border-l-|border-r-|border-t-/);
    }
  });
});

describe("billing page payments card", () => {
  const page = readFileSync(
    join(
      __dirname,
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/billing/page.tsx"
    ),
    "utf8"
  );

  it("decides the payment badge from the returned amount", () => {
    expect(page).toContain("paymentReturnState(payment.amountCents, payment.amountReturnedCents)");
    expect(page).toContain("returned ?? paymentStatusBadge(payment.status)");
  });

  it("stops claiming the customer paid money that came back", () => {
    expect(page).toContain("payment.amountCents - payment.amountReturnedCents");
    expect(page).toContain("line-through");
  });

  it("keeps returned payments in the history instead of filtering them out", () => {
    expect(page).not.toContain("amountReturnedCents === 0");
    expect(page).toContain('p.status === "succeeded"');
  });
});

describe("Payment wire shape", () => {
  const api = readFileSync(join(__dirname, "../src/lib/api.ts"), "utf8");

  it("requires amount_returned rather than defaulting an absent value to zero", () => {
    expect(api).toContain("amount_returned: z.coerce.number(),");
    expect(api).not.toContain("amount_returned: z.coerce.number().optional()");
    expect(api).not.toContain("pi.amount_returned ??");
  });

  it("maps it onto the local Payment type", () => {
    expect(api).toContain("amountReturnedCents: pi.amount_returned,");
  });
});

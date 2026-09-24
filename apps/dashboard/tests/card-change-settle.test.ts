import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cardChangeSettleCents,
  cardSessionSettleProblem,
  MIN_SETTLE_CHARGE_CENTS,
} from "../src/lib/card-change-settle";

const base = {
  has_payment_method: true,
  balance_cents: "-9150.0000000000",
};

describe("cardChangeSettleCents", () => {
  it("states the deficit when a card is on file and the balance is negative", () => {
    // The org that surfaced this: $91.50 taken with no warning.
    expect(cardChangeSettleCents(base)).toBe(9150);
  });

  it("rounds a fractional deficit UP, as billing does", () => {
    // Rounding down would state a cent less than what is charged.
    expect(cardChangeSettleCents({ ...base, balance_cents: "-100.4200000000" })).toBe(101);
  });

  it("is null with no card on file — there is nothing to charge", () => {
    expect(cardChangeSettleCents({ ...base, has_payment_method: false })).toBeNull();
  });

  it("is null when the card cannot be charged off_session", () => {
    // India / RBI. billing skips the settle entirely, so warning about a charge
    // that cannot fire teaches the customer to ignore the warning.
    expect(
      cardChangeSettleCents({ ...base, auto_reload_supported: false }),
    ).toBeNull();
  });

  it("treats an ABSENT auto_reload_supported as supported", () => {
    // The field is absent on an older billing deploy; only an explicit false blocks.
    expect(cardChangeSettleCents({ ...base, auto_reload_supported: undefined })).toBe(9150);
  });

  it("is null on a non-negative balance", () => {
    expect(cardChangeSettleCents({ ...base, balance_cents: "0" })).toBeNull();
    expect(cardChangeSettleCents({ ...base, balance_cents: "4200.0000000000" })).toBeNull();
  });

  it("is null under the acquirer minimum, which billing refuses outright", () => {
    expect(cardChangeSettleCents({ ...base, balance_cents: "-49" })).toBeNull();
    expect(cardChangeSettleCents({ ...base, balance_cents: `-${MIN_SETTLE_CHARGE_CENTS}` })).toBe(
      MIN_SETTLE_CHARGE_CENTS,
    );
  });

  it("is null — never 0 — on a balance it cannot read", () => {
    // `Number("")` and `Number("  ")` are both 0, so a blank that fell through
    // would read as a settled account rather than an unreadable one.
    for (const balance_cents of ["", "   ", "not-a-number"]) {
      expect(cardChangeSettleCents({ ...base, balance_cents })).toBeNull();
    }
  });

  it("is null with no account at all", () => {
    expect(cardChangeSettleCents(null)).toBeNull();
    expect(cardChangeSettleCents(undefined)).toBeNull();
  });
});

const PAGE = readFileSync(
  join(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/billing/page.tsx",
  ),
  "utf8",
);
const MODAL = readFileSync(
  join(__dirname, "../src/components/billing/card-change-confirm-modal.tsx"),
  "utf8",
);

describe("the billing page asks before it charges", () => {
  it("derives the amount ONCE, from the shared rule", () => {
    expect(PAGE).toContain("const settleCents = cardChangeSettleCents(account);");
    // A second derivation is how the notice and the modal come to state
    // different amounts for the same click.
    expect(PAGE.match(/cardChangeSettleCents\(/g) ?? []).toHaveLength(1);
  });

  it("gates the click on the confirmation whenever something will be charged", () => {
    const gate = PAGE.slice(
      PAGE.indexOf("function handleManagePayment("),
      PAGE.indexOf("async function openCardPage("),
    );
    expect(gate).toContain("if (settleCents !== null)");
    expect(gate).toContain("setConfirmSource(source)");
    // Nothing owed still opens the page directly — the common case must not grow
    // a confirmation about a charge of nothing.
    expect(gate).toContain("void openCardPage(source)");
  });

  it("routes BOTH buttons through the gate, never the raw open", () => {
    // "View invoices" hits the same endpoint and settles identically, and
    // nothing about its label suggests money moves.
    // Three of them: the failed-payment banner's Update card, the Payment
    // method card, and the auto-topup-unavailable banner.
    expect(PAGE.match(/handleManagePayment\("manage"\)/g) ?? []).toHaveLength(3);
    expect(PAGE.match(/handleManagePayment\("invoices"\)/g) ?? []).toHaveLength(1);
    // The only call site of the un-gated open is the gate itself and the
    // modal's own Confirm.
    expect(PAGE.match(/openCardPage\(/g) ?? []).toHaveLength(3);
  });

  it("mounts the modal and hands it the amount and the in-flight state", () => {
    // Bound by the element that FOLLOWS it. `<h1 className=` is not a bound:
    // the loading branch above carries one, so indexOf lands before the modal
    // and the slice comes back empty.
    const at = PAGE.indexOf("<CardChangeConfirmModal");
    const mount = PAGE.slice(at, PAGE.indexOf('<div className="mb-6', at));
    expect(mount).toContain("settleCents={settleCents}");
    expect(mount).toContain("pending={portalLoadingSource !== null}");
    expect(mount).toContain("onConfirm={() => void openCardPage(confirmSource)}");
  });

  it("declares settleCents ABOVE the JSX that renders it", () => {
    // A const read at render time and declared below the return is a TDZ throw
    // `tsc` cannot see.
    expect(PAGE.indexOf("const settleCents =")).toBeLessThan(
      PAGE.indexOf("<CardChangeConfirmModal"),
    );
  });

  it("states the settle under the button from the same rule", () => {
    expect(PAGE).toContain("{settleCents !== null && (");
    expect(PAGE).toContain("{formatBillingCents(settleCents)} balance to the card on file");
    // The old gate promised a charge for a card that cannot be charged
    // off_session and for a deficit under the acquirer minimum.
    expect(PAGE).not.toContain("formatBillingCents(Math.abs(availableCents))");
  });
});

describe("the confirmation copy", () => {
  it("names the amount before it is taken", () => {
    expect(MODAL).toContain("Charge {amount} now?");
    expect(MODAL).toContain("You owe {amount}");
  });

  it("says the page opens whether or not the charge lands", () => {
    // Without it the charge reads as a toll on the way in, and the customer
    // most likely to be here is the one whose card is failing.
    expect(MODAL).toContain("The page opens either way");
  });

  it("says what is running while it runs", () => {
    // The 6.3-second silent wait is what lost the money: the button only ever
    // changed its own label.
    expect(MODAL).toContain("`Charging ${amount}...`");
    expect(MODAL).toContain("This takes a few seconds");
  });

  it("carries no em-dash", () => {
    const copy = MODAL.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(copy).not.toContain("—");
  });
});


describe("cardSessionSettleProblem", () => {
  it("states a decline with the acquirer's own sentence", () => {
    expect(
      cardSessionSettleProblem({
        settle_result: "declined",
        settle_decline_message: "Your card does not support this type of purchase.",
      }),
    ).toEqual({
      kind: "declined",
      message: "Your card does not support this type of purchase.",
    });
  });

  it("a decline with no sentence still stops the redirect", () => {
    expect(cardSessionSettleProblem({ settle_result: "declined", settle_decline_message: "  " })).toEqual({
      kind: "declined",
      message: null,
    });
  });

  it("a charge that got no answer is its own case, not a decline", () => {
    expect(cardSessionSettleProblem({ settle_result: "failed" })).toEqual({ kind: "failed" });
  });

  it("charged, not attempted, unknown or absent: nothing to say, redirect as before", () => {
    expect(cardSessionSettleProblem({ settle_result: "charged" })).toBeNull();
    expect(cardSessionSettleProblem({ settle_result: "not_attempted" })).toBeNull();
    expect(cardSessionSettleProblem({ settle_result: "something_new" })).toBeNull();
    expect(cardSessionSettleProblem({})).toBeNull();
    expect(cardSessionSettleProblem(null)).toBeNull();
  });
});

describe("billing page: a failed settle is stated before the card page opens", () => {
  const page = readFileSync(
    join(__dirname, "../src/app/(authed)/(dashboard)/orgs/[orgId]/billing/page.tsx"),
    "utf8",
  );
  const open = page.slice(
    page.indexOf("async function openCardPage("),
    page.indexOf("function dismissSettleProblem("),
  );

  it("checks the settle outcome BEFORE continuing to the card page", () => {
    const check = open.indexOf("cardSessionSettleProblem(setup)");
    const go = open.indexOf("continueToCardPage(setup)");
    expect(check).toBeGreaterThan(-1);
    expect(go).toBeGreaterThan(check);
    expect(open).toContain("setSettleProblem({ problem, setup })");
  });

  it("passes the problem and a way on to the modal", () => {
    expect(page).toContain("problem={settleProblem?.problem ?? null}");
    expect(page).toContain("onContinue={continueAfterSettleProblem}");
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chargesAutomatically } from "../src/lib/automatic-charges";

const root = join(__dirname, "../..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("does billing charge the card by itself (owner 2026-10-21: postpaid has no auto top-up)", () => {
  it("postpaid reads its credit line, never the auto top-up flag", () => {
    expect(chargesAutomatically({ payment_mode: "postpaid", credit_line_cents: 5000, has_auto_topup: false })).toBe(true);
    expect(chargesAutomatically({ payment_mode: "postpaid", credit_line_cents: null, has_auto_topup: true })).toBe(false);
    expect(chargesAutomatically({ payment_mode: "postpaid" })).toBe(false);
  });

  it("prepaid and plan read billing's has_auto_topup", () => {
    expect(chargesAutomatically({ payment_mode: "prepaid", has_auto_topup: true })).toBe(true);
    expect(chargesAutomatically({ payment_mode: "prepaid", has_auto_topup: false, credit_line_cents: 5000 })).toBe(false);
    expect(chargesAutomatically({ payment_mode: "subscription", has_auto_topup: false })).toBe(false);
  });

  it("the helper and the pay-balance words are byte-equal twins in dashboard and admin", () => {
    expect(read("admin/src/lib/automatic-charges.ts")).toBe(read("dashboard/src/lib/automatic-charges.ts"));
    expect(read("admin/src/lib/pay-balance.ts")).toBe(read("dashboard/src/lib/v2/pay-balance.ts"));
  });

  it("every launch gate and runway alert asks the helper, never the bare flag", () => {
    for (const f of [
      "admin/src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/new/page.tsx",
      "admin/src/app/(authed)/(dashboard)/features/[featureId]/new/page.tsx",
      "admin/src/components/billing/credit-alerts.tsx",
    ]) {
      const src = read(f);
      expect(src, f).toContain("chargesAutomatically(account)");
      expect(src, f).not.toContain("account.has_auto_topup");
    }
    expect(read("dashboard/src/components/billing/use-billing-controller.ts")).toContain("chargesAutomatically(account)");
  });

  it("no postpaid surface prefills or arms an auto top-up", () => {
    for (const f of ["dashboard/src/lib/billing-guard.tsx", "admin/src/lib/billing-guard.tsx"]) {
      expect(read(f), f).toContain('payment_mode !== "postpaid" && acct.has_auto_topup');
    }
    expect(read("dashboard/src/lib/billing-guard.tsx")).toContain('postpaid && account?.has_payment_method ? (');
    expect(read("dashboard/src/components/v2/get-started/pay-topup.ts")).toContain('acct.payment_mode !== "postpaid" && acct.has_auto_topup');
    expect(read("dashboard/src/lib/budget-gauge.ts")).not.toContain("topup_threshold_cents");
  });
});

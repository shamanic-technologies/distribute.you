import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");
const API = read("src/lib/api.ts");
const PAGE = read("src/app/(authed)/(dashboard)/orgs/[orgId]/billing/page.tsx");

// Owner 2026-10-01: customers no longer switch their payment mode; staff do, here.
describe("staff set an org's payment mode", () => {
  it("calls the staff-gated by-org route, parsed, with the three modes", () => {
    expect(API).toContain("`/billing/accounts/by-org/${encodeURIComponent(orgId)}/payment-mode`");
    expect(API).toContain('payment_mode: z.enum(["prepaid", "postpaid", "subscription"])');
  });

  it("keys the call on billing's org id, never the Clerk id in the URL", () => {
    expect(PAGE).toContain("const billingOrgId = account?.org_id ?? null;");
    expect(PAGE).toContain("setStaffPaymentMode(billingOrgId, next)");
  });

  it("offers every mode and asks before switching", () => {
    expect(PAGE).toContain('(["prepaid", "postpaid", "subscription"] as const).map');
    expect(PAGE).toContain("window.confirm(");
  });
});

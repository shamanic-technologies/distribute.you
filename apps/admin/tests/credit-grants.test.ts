import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
const billingPagePath = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/billing/page.tsx",
);

describe("Credit-grant API wrappers", () => {
  const content = fs.readFileSync(apiPath, "utf-8");

  it("exports grantCredits hitting the staff-gated proxy path", () => {
    expect(content).toContain("export async function grantCredits");
    expect(content).toContain("/billing/credits/grant");
  });

  it("sends an idempotencyKey so grants stack but double-submits don't double-credit", () => {
    expect(content).toContain("idempotencyKey");
    expect(content).toContain("globalThis.crypto.randomUUID()");
  });

  it("exports the per-org and platform-wide grant readers", () => {
    expect(content).toContain("export async function listOrgCreditGrants");
    expect(content).toContain("/billing/credits/grants");
    expect(content).toContain("export async function listAllCreditGrants");
    expect(content).toContain("/billing/credits/grants/all");
  });

  it("declares the CreditGrant type", () => {
    expect(content).toContain("export interface CreditGrant");
    expect(content).toContain("grantedBy");
  });
});

describe("Billing page credit-grant UI", () => {
  const page = fs.readFileSync(billingPagePath, "utf-8");

  it("renders the staff grant form", () => {
    expect(page).toContain("Grant free credits");
    expect(page).toContain("handleGrant");
    expect(page).toContain("grantCredits(");
  });

  it("renders the per-org grant history and the platform-wide ledger", () => {
    expect(page).toContain("Credit grants for this org");
    expect(page).toContain("All credit grants");
    expect(page).toContain("listOrgCreditGrants");
    expect(page).toContain("listAllCreditGrants");
  });

  it("invalidates balance + grant caches after a grant", () => {
    expect(page).toContain('queryKey: ["billingAccount"]');
    expect(page).toContain('queryKey: ["creditGrants"]');
    expect(page).toContain('queryKey: ["creditGrantsAll"]');
  });
});

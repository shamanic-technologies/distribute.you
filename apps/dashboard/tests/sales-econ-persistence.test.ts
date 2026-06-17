import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Brand sales conversion-economics persistence (DIS-115 backend phase).
// The 5 metrics auto-upsert per brand via api-service /v1/brands/:id/sales-economics
// (brand-service store). READ returns the saved set or null (→ defaults); WRITE is an
// idempotent PUT. Source-substring guards — tsc cannot catch copy / key / wiring drift.
// (The campaigns/new create form that consumed these readers was removed; only the
// api.ts client surface is guarded here.)

describe("Brand sales-economics persistence", () => {
  const apiRel = "../src/lib/api.ts";
  const apiContent = fs.readFileSync(path.join(__dirname, apiRel), "utf-8");

  it("api.ts exposes a getBrandSalesEconomics reader on the locked path", () => {
    expect(apiContent).toContain("export async function getBrandSalesEconomics");
    expect(apiContent).toContain("/sales-economics");
  });

  it("api.ts exposes saveBrandSalesEconomics as an idempotent PUT", () => {
    const fnStart = apiContent.indexOf("export async function saveBrandSalesEconomics");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = apiContent.slice(fnStart, apiContent.indexOf("\n}", fnStart) + 2);
    expect(fnBody).toContain('method: "PUT"');
    expect(fnBody).toContain("/sales-economics");
  });

  it("uses separate read(nullable)/write(non-null) schemas with safeParse (per #1221)", () => {
    expect(apiContent).toContain("GetBrandSalesEconomicsResponseSchema");
    expect(apiContent).toContain("SaveBrandSalesEconomicsResponseSchema");
    // read schema is nullable, write schema is not
    expect(apiContent).toMatch(/GetBrandSalesEconomicsResponseSchema[\s\S]{0,160}\.nullable\(\)/);
    // both wrappers validate the wire shape
    expect(apiContent).toContain("GetBrandSalesEconomicsResponseSchema.safeParse");
    expect(apiContent).toContain("SaveBrandSalesEconomicsResponseSchema.safeParse");
  });

  it("locks the wire field names byte-stable (self-serve close decomposed into 2 steps)", () => {
    for (const key of [
      "lifetimeRevenueUsd",
      "replyToMeetingPct",
      "visitToMeetingPct",
      "meetingToClosePct",
      "visitToSignupPct",
      "signupToPaidClientPct",
      // visitToClosePct stays on the READ shape (derived server-side from the 2 steps)
      "visitToClosePct",
    ]) {
      expect(apiContent).toContain(key);
    }
  });

  it("exposes the source-aware effective-economics reader in ONE call", () => {
    expect(apiContent).toContain("export async function getSalesEconomicsEffective");
    expect(apiContent).toContain("/sales-economics-effective");
  });

  it("no client-side cross-brand-average fallback remains (server owns it now)", () => {
    expect(apiContent).not.toContain("getSalesEconomicsAverage");
    expect(apiContent).not.toContain("/sales-economics-average");
  });
});

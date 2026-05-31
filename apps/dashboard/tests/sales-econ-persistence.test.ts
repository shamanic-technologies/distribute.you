import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Brand sales conversion-economics persistence (DIS-115 backend phase).
// The 5 metrics auto-upsert per brand via api-service /v1/brands/:id/sales-economics
// (brand-service store). READ returns the saved set or null (→ defaults); WRITE is an
// idempotent PUT. Source-substring guards — tsc cannot catch copy / key / wiring drift.

describe("Brand sales-economics persistence", () => {
  const apiRel = "../src/lib/api.ts";
  const apiContent = fs.readFileSync(path.join(__dirname, apiRel), "utf-8");

  const pageRel =
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/new/page.tsx";
  const pageContent = fs.readFileSync(path.join(__dirname, pageRel), "utf-8");

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

  it("locks the 5 wire field names byte-stable", () => {
    for (const key of [
      "lifetimeRevenueUsd",
      "replyToMeetingPct",
      "visitToMeetingPct",
      "meetingToClosePct",
      "visitToClosePct",
    ]) {
      expect(apiContent).toContain(key);
    }
  });

  it("page imports both wrappers", () => {
    expect(pageContent).toContain("getBrandSalesEconomics");
    expect(pageContent).toContain("saveBrandSalesEconomics");
  });

  it("page registers the brandSalesEconomics query gated to the sales funnel", () => {
    expect(pageContent).toContain('["brandSalesEconomics", brandId]');
    expect(pageContent).toContain("enabled: isSalesFunnel");
  });

  it("mutation writes the fresh entity into the single-entity cache (rule #1090)", () => {
    expect(pageContent).toContain("useMutation");
    expect(pageContent).toContain('setQueryData(["brandSalesEconomics", brandId]');
  });

  it("auto-upserts on a debounce (no Save button)", () => {
    expect(pageContent).toContain("econSaveTimer");
    expect(pageContent).toContain("setTimeout");
    expect(pageContent).toContain("clearTimeout");
  });

  it("has no Save-metrics button — persistence is auto-upsert", () => {
    expect(pageContent).not.toContain("Save metrics");
  });

  it("keeps the hard-coded defaults for the unset fallback", () => {
    expect(pageContent).toContain("SALES_ECON_DEFAULTS");
  });
});

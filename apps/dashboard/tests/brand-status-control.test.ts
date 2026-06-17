import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

describe("brand overview status control", () => {
  const page = read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx");
  const control = read("components/brand/brand-status-control.tsx");
  const api = read("lib/api.ts");

  it("renders on the brand overview page", () => {
    expect(page).toContain("BrandStatusControl");
    expect(page).not.toContain("/campaigns/new");
  });

  it("shows optimization goal labels with sales meetings as the unset default", () => {
    expect(control).toContain("Maximising signups conversions");
    expect(control).toContain("Maximising sales meetings");
    expect(control).toContain('?? "sales_meetings"');
  });

  it("uses brand-level pause, daily budget, and sales economics data", () => {
    expect(control).toContain("getBrandPause");
    expect(control).toContain("setBrandPause");
    expect(control).toContain("getBrandDailyBudget");
    expect(control).toContain("getBrandSalesEconomics");
    expect(control).toContain('["brandPause", brandId]');
    expect(control).toContain('["brandDailyBudget", brandId]');
    expect(control).toContain('["brandSalesEconomics", brandId]');
  });

  it("wires Pause / Restart to the brand pause API", () => {
    expect(control).toContain("Pause");
    expect(control).toContain("Restart");
    expect(api).toContain("export async function getBrandPause");
    expect(api).toContain("export async function setBrandPause");
    expect(api).toContain("`/brands/${brandId}/pause`");
    expect(api).toContain('method: "PATCH"');
  });
});

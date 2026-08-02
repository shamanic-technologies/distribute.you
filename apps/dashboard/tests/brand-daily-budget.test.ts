import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");
const functionBlock = (content: string, signature: string) =>
  content.split(signature)[1]?.split("\n}\n\n")[0] ?? "";

describe("Brand daily budget API helper", () => {
  const apiContent = read("../src/lib/api.ts");

  it("reads via api-service GET /v1/brands/:brandId/daily-budget", () => {
    const block = functionBlock(apiContent, "export async function getBrandDailyBudget(");
    expect(block).toContain("`/brands/${brandId}/daily-budget`");
    expect(block).toContain("{ token }");
    expect(block).not.toContain("billing");
  });

  it("sets via api-service PATCH /v1/brands/:brandId/daily-budget with the required body", () => {
    const block = functionBlock(apiContent, "export async function saveBrandDailyBudget(");
    expect(block).toContain("`/brands/${brandId}/daily-budget`");
    expect(block).toContain('method: "PATCH"');
    expect(block).toContain("body: { dailyBudgetCents }");
    expect(block).not.toContain("billing");
  });

  it("stamps x-run-id for the PATCH so api-service can forward run identity", () => {
    const block = functionBlock(apiContent, "export async function saveBrandDailyBudget(");
    expect(block).toContain('headers: { "x-run-id": globalThis.crypto.randomUUID() }');
  });
});

describe("BrandDailyBudgetCard", () => {
  const content = read("../src/components/settings/brand-daily-budget-card.tsx");

  it("reads and writes daily budget through the api helper", () => {
    expect(content).toContain("getBrandDailyBudget(brandId)");
    expect(content).toContain("saveBrandDailyBudget(brandId, cents)");
  });

  it("uses the shared brandDailyBudget cache key", () => {
    expect(content).toContain('["brandDailyBudget", brandId]');
    expect(content).toContain('queryClient.setQueryData(["brandDailyBudget", brandId]');
  });

  it("blocks a sub-$1/day budget and opens the pause modal instead of saving", () => {
    expect(content).toContain("MIN_BUDGET_CENTS = 100");
    expect(content).toContain("if (cents < MIN_BUDGET_CENTS)");
    expect(content).toContain("setPauseModalOpen(true)");
  });

  it("the pause modal pauses the brand via setBrandPause(brandId, true)", () => {
    expect(content).toContain("setBrandPause(brandId, true)");
    expect(content).toContain("Pause outreach");
  });
});

describe("Brand Settings page", () => {
  const content = read(
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx",
  );

  it("renders run status only — the money moved to the funnels", () => {
    // Money is funded per SALES FUNNEL now, so the amount lives on the funnel it
    // pays for. A brand-level field here would be a second way to set the same
    // money, and billing already answers the brand total as the SUM of those
    // ceilings — the two could only ever disagree.
    expect(content).toContain("Outreach");
    expect(content).toContain("<BrandStatusControl brandId={brandId} />");
    expect(content).not.toContain("BrandDailyBudgetCard");
    expect(content).not.toContain("PauseOutreachCard");
  });
});

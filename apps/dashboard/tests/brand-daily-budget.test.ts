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
});

describe("Brand Settings page", () => {
  const content = read(
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx",
  );

  it("renders the Daily Budget section with the editor card", () => {
    expect(content).toContain("Daily Budget");
    expect(content).toContain("<BrandDailyBudgetCard brandId={brandId} />");
  });
});

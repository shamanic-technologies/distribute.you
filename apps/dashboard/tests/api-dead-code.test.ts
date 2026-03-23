import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const apiContent = fs.readFileSync(
  path.resolve(__dirname, "../src/lib/api.ts"),
  "utf-8"
);

describe("No dead/broken API functions", () => {
  it("should not have getBrandsCosts (endpoint does not exist)", () => {
    expect(apiContent).not.toContain("export async function getBrandsCosts");
  });

  it("should not have createBrand with wrong params (sends {name, domain} instead of {url})", () => {
    expect(apiContent).not.toMatch(/export async function createBrand\(/);
  });

  it("should not have old sales-profile functions (migrated to extract-fields)", () => {
    expect(apiContent).not.toContain("export async function getBrandSalesProfile");
    expect(apiContent).not.toContain("export async function createBrandSalesProfile");
    expect(apiContent).not.toContain("export async function refreshBrandSalesProfile");
  });

  it("should have upsertBrand as the correct brand creation function", () => {
    expect(apiContent).toContain("export async function upsertBrand");
    // upsertBrand correctly sends { url }
    const fnMatch = apiContent.match(
      /export async function upsertBrand[\s\S]*?^}/m
    );
    expect(fnMatch).toBeTruthy();
    expect(fnMatch![0]).toContain("body: { url }");
  });
});

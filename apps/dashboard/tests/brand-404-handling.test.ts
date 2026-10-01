import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
const apiContent = fs.readFileSync(apiPath, "utf-8");

describe("getBrand handles missing brands gracefully", () => {
  it("should catch ApiError and return null on 404 only", () => {
    expect(apiContent).toMatch(/getBrand.*Promise<.*\| null>/);
    expect(apiContent).toContain("err.status === 404");
    expect(apiContent).not.toContain("err.status === 404 || err.status === 500");
  });

  it("should return null instead of throwing", () => {
    // The function must have a try/catch that returns null
    const fnMatch = apiContent.match(
      /export async function getBrand\(brandId[\s\S]*?^}/m
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    expect(fnBody).toContain("return null");
  });
});

describe("listBrandRuns handles missing brands gracefully", () => {
  it("should catch ApiError and return empty runs on 404 only", () => {
    const fnMatch = apiContent.match(
      /export async function listBrandRuns[\s\S]*?^}/m
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    expect(fnBody).toContain("err.status === 404");
    expect(fnBody).not.toContain("err.status === 404 || err.status === 500");
    expect(fnBody).toContain("{ runs: [] }");
  });
});

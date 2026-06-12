import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const pagePath = path.resolve(
  __dirname,
  "../../src/app/investors/page.tsx"
);
const docPath = path.resolve(
  __dirname,
  "../../../../docs/icp.md"
);

describe("Investors page: ICP #1 section", () => {
  const page = fs.readFileSync(pagePath, "utf-8");

  it("renders Who We Serve heading", () => {
    expect(page).toMatch(/Who We Serve\s+—\s+ICP\s+#1/);
  });

  it("includes Serial Builder framing", () => {
    expect(page).toMatch(/Serial Builder/);
  });

  it("section is placed after Company Overview and before Platform Metrics", () => {
    const companyIdx = page.indexOf("Company Overview");
    const icpIdx = page.indexOf("Who We Serve");
    const platformIdx = page.indexOf("Platform Metrics");
    expect(companyIdx).toBeGreaterThan(-1);
    expect(icpIdx).toBeGreaterThan(companyIdx);
    expect(platformIdx).toBeGreaterThan(icpIdx);
  });

  it("lists refuses / accepts pillars", () => {
    expect(page).toMatch(/Refuses/);
    expect(page).toMatch(/Accepts/);
  });

  it("mentions CAC north-star", () => {
    expect(page).toMatch(/CAC/);
  });

  it("mentions founder proximity expectation", () => {
    expect(page).toMatch(/Founder proximity/);
  });

  it("mentions the public cold-email roadmap expectation", () => {
    expect(page).toMatch(/Roadmap expectation/);
    expect(page).toMatch(/Cold email, compounding/);
  });
});

describe("Internal ICP doc", () => {
  it("docs/icp.md exists at repo root", () => {
    expect(fs.existsSync(docPath)).toBe(true);
  });

  const doc = fs.existsSync(docPath) ? fs.readFileSync(docPath, "utf-8") : "";

  it("documents the Serial Builder persona", () => {
    expect(doc).toMatch(/Serial Builder/);
  });

  it("documents the 3-layer pricing stack", () => {
    expect(doc).toMatch(/PRIMITIVES/);
    expect(doc).toMatch(/WORKFLOWS/);
    expect(doc).toMatch(/OUTCOMES/);
  });

  it("documents how to use this document", () => {
    expect(doc).toMatch(/How to use this document/);
  });
});

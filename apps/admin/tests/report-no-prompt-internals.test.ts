import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// The no-login public client report must never request or render our email
// prompt templates (shared platform IP). The gateway made the prompt routes
// staff-only (api-service #1193); the report drops the surface entirely
// rather than rendering an empty Prompt page.

const root = path.resolve(__dirname, "../src");

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(d.name) ? [p] : [];
  });
}

const reportFiles = [
  ...walk(path.join(root, "app/report")),
  ...walk(path.join(root, "app/api/report")),
  ...walk(path.join(root, "components/report")),
  path.join(root, "lib/report-api.ts"),
];

describe("public report carries no prompt internals", () => {
  it("scans a non-empty set of report files", () => {
    expect(reportFiles.length).toBeGreaterThan(10);
  });

  for (const file of reportFiles) {
    const rel = path.relative(root, file);
    it(`${rel} requests no prompt route`, () => {
      const src = fs.readFileSync(file, "utf-8");
      expect(src).not.toMatch(/prompt-assignments|platform-prompts|["'`]\/prompts/);
      expect(src).not.toContain("PromptAssignment");
    });
  }

  it("has no Prompt route under the report", () => {
    const dir = path.join(root, "app/report/[orgId]/[brandId]/[featureSlug]");
    const entries = fs.readdirSync(dir).map((n) => n.toLowerCase());
    expect(entries.some((n) => n.includes("prompt"))).toBe(false);
  });

  it("sidebar and mobile nav list no Prompt entry", () => {
    for (const f of ["components/report/sidebar.tsx", "components/report/mobile-nav.tsx"]) {
      const src = fs.readFileSync(path.join(root, f), "utf-8");
      expect(src).not.toMatch(/label:\s*["']Prompts?["']/);
    }
  });
});

describe("report email list carries no pipeline label", () => {
  it("lead-emails route returns no workflow field", () => {
    const src = fs.readFileSync(
      path.join(root, "app/api/report/[orgId]/[brandId]/[featureSlug]/lead-emails/route.ts"),
      "utf-8",
    );
    expect(src).not.toContain("workflow:");
    expect(src).not.toContain("generationRun");
    expect(src).not.toContain("fetchWorkflows");
  });

  it("LeadEmailSummary has no workflow field and the drawer renders none", () => {
    const table = fs.readFileSync(path.join(root, "components/report/leads-table.tsx"), "utf-8");
    const start = table.indexOf("export interface LeadEmailSummary");
    const block = table.slice(start, table.indexOf("}", start));
    expect(block).not.toContain("workflow");

    const view = fs.readFileSync(path.join(root, "components/report/public-leads-view.tsx"), "utf-8");
    expect(view).not.toContain("e.workflow");
  });

  it("the dead emails-table (workflow column) is gone", () => {
    expect(fs.existsSync(path.join(root, "components/report/emails-table.tsx"))).toBe(false);
  });
});

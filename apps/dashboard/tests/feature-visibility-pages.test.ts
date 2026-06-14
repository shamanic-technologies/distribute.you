import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── Route roots ──────────────────────────────────────────────────────────────
// Single-feature product: the feature segment was flattened into the brand
// level, so the former feature-level pages now live directly under the brand.
const FEATURE_ROOT = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]",
);
const CAMPAIGN_ROOT = path.join(FEATURE_ROOT, "campaigns/[id]");
const VIEWS_ROOT = path.resolve(__dirname, "../src/components/visibility");

const read = (p: string) => fs.readFileSync(p, "utf-8");

// Feature-level pages were missing entirely → the sidebar (FeatureLevelSidebar)
// linked /features/<slug>/{visibility-runs,prompts,competitors} but no route
// existed, so all three hard-404'd. These pages render the SAME shared views as
// the campaign-level pages, scoped to the brand (union across the brand's
// campaigns) instead of a single campaign.

describe("Feature-level AI-visibility pages (union across the brand's campaigns)", () => {
  const cases = [
    {
      label: "visibility-runs",
      file: "visibility-runs/page.tsx",
      view: "VisibilityRunsView",
      fn: "FeatureVisibilityRunsPage",
      hasBasePath: true,
      hasScope: true,
    },
    {
      // Run detail is fetched by id, so the wrapper passes only basePath — no
      // scope. It must still be brand/feature-scoped (no campaignId in basePath).
      label: "visibility-runs/[runId]",
      file: "visibility-runs/[runId]/page.tsx",
      view: "VisibilityRunDetailView",
      fn: "FeatureVisibilityRunDetailPage",
      hasBasePath: true,
      hasScope: false,
    },
    {
      label: "prompts",
      file: "prompts/page.tsx",
      view: "VisibilityPromptsView",
      fn: "FeaturePromptsPage",
      hasBasePath: false,
      hasScope: true,
    },
    {
      label: "competitors",
      file: "competitors/page.tsx",
      view: "VisibilityCompetitorsView",
      fn: "FeatureCompetitorsPage",
      hasBasePath: false,
      hasScope: true,
    },
  ] as const;

  for (const c of cases) {
    describe(`feature ${c.label} page`, () => {
      const filePath = path.join(FEATURE_ROOT, c.file);

      it("file exists at the feature route (was 404)", () => {
        expect(fs.existsSync(filePath)).toBe(true);
      });

      it("is a client component that default-exports the feature page fn", () => {
        const content = read(filePath);
        expect(content).toContain('"use client"');
        expect(content).toContain(`export default function ${c.fn}`);
      });

      it(`renders the shared ${c.view} (display is shared with the campaign page, never duplicated)`, () => {
        const content = read(filePath);
        expect(content).toContain(c.view);
        expect(content).toContain("@/components/visibility/");
      });

      it("is brand/feature-scoped — never a campaignId or params.id (union, not single-campaign)", () => {
        const content = read(filePath);
        expect(content).not.toContain("campaignId");
        expect(content).not.toContain("params.id");
        if (c.hasScope) {
          // Union across the brand's campaigns: brandId-only scope, no campaignId.
          expect(content).toContain("scope={{ brandId }}");
        }
      });

      if (c.hasBasePath) {
        it("builds a FEATURE-level basePath (no /campaigns/ segment)", () => {
          const content = read(filePath);
          expect(content).toContain(
            "`/orgs/${orgId}/brands/${brandId}`",
          );
          expect(content).not.toContain("/campaigns/${campaignId}");
        });
      }
    });
  }
});

describe("Campaign-level AI-visibility pages render the SAME shared views", () => {
  const cases = [
    { file: "visibility-runs/page.tsx", view: "VisibilityRunsView" },
    { file: "visibility-runs/[runId]/page.tsx", view: "VisibilityRunDetailView" },
    { file: "prompts/page.tsx", view: "VisibilityPromptsView" },
    { file: "competitors/page.tsx", view: "VisibilityCompetitorsView" },
  ] as const;

  for (const c of cases) {
    it(`campaign ${c.file} renders ${c.view} with a campaign-scoped query`, () => {
      const content = read(path.join(CAMPAIGN_ROOT, c.file));
      expect(content).toContain(c.view);
      expect(content).toContain("campaignId");
    });
  }
});

describe("Shared visibility view components own the display", () => {
  const cases = [
    { file: "visibility-runs-view.tsx", testid: 'data-testid="visibility-runs-page"' },
    { file: "visibility-run-detail-view.tsx", testid: 'data-testid="visibility-run-detail-page"' },
    { file: "visibility-prompts-view.tsx", testid: 'data-testid="prompts-page"' },
    { file: "visibility-competitors-view.tsx", testid: 'data-testid="competitors-page"' },
  ] as const;

  for (const c of cases) {
    it(`${c.file} exists and holds the page markup`, () => {
      const p = path.join(VIEWS_ROOT, c.file);
      expect(fs.existsSync(p)).toBe(true);
      expect(read(p)).toContain(c.testid);
    });
  }

  it("the runs + latest-run scope is brand-driven so the feature level can drop campaignId", () => {
    // listVisibilityRuns takes an optional campaignId; the shared hook + runs
    // view pass the caller's scope straight through, so {brandId} alone yields
    // the union across all of the brand's campaigns.
    expect(read(path.join(VIEWS_ROOT, "visibility-runs-view.tsx"))).toContain(
      "listVisibilityRuns({ ...scope, limit: 50 })",
    );
    const hook = read(
      path.resolve(__dirname, "../src/lib/use-latest-visibility-run.ts"),
    );
    expect(hook).toContain("listVisibilityRuns({ ...scope, limit: 1 })");
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  summarizeRanWorkflows,
  workflowShortName,
  WorkflowRunGroupsResponseSchema,
} from "../src/lib/campaign-ran-workflows";

const read = (p: string) => readFileSync(join(__dirname, "../src", p), "utf8");

const g = (slug: string | null, runCount: number, maxStartedAt: string | null) => ({
  dimensions: { workflowSlug: slug },
  runCount,
  maxStartedAt,
});

describe("summarizeRanWorkflows", () => {
  it("orders runs-service's per-workflow groups newest first, keeping counts", () => {
    // Shape measured in prod 2026-09-25 on campaign 3922c8e1 (7-day window).
    const s = summarizeRanWorkflows([
      g("sales-cold-email-outreach-alioth", 2376, "2026-09-24T08:00:50.550Z"),
      g("sales-cold-email-outreach-azalea-v4", 574, "2026-09-25T05:43:23.783Z"),
      g("sales-cold-email-outreach-maelstrom", 1, "2026-09-24T06:07:02.820Z"),
      g(null, 3, "2026-09-20T00:00:00Z"),
    ]);
    expect(s.workflows.map((w) => w.workflowSlug)).toEqual([
      "sales-cold-email-outreach-azalea-v4",
      "sales-cold-email-outreach-alioth",
      "sales-cold-email-outreach-maelstrom",
    ]);
    expect(s.workflows[1].runs).toBe(2376);
    expect(s.totalRuns).toBe(2954);
  });

  it("an empty window is empty, never a fallback", () => {
    expect(summarizeRanWorkflows([])).toEqual({ workflows: [], totalRuns: 0 });
  });
});

describe("workflowShortName", () => {
  it("keeps the whole remainder after the feature prefix", () => {
    expect(workflowShortName("sales-cold-email-outreach-azalea-v4", "sales-cold-email-outreach")).toBe("Azalea v4");
    expect(workflowShortName("sales-cold-email-outreach-alioth", "sales-cold-email-outreach")).toBe("Alioth");
    expect(workflowShortName("other-thing", "sales-cold-email-outreach")).toBe("Other thing");
  });
});

describe("WorkflowRunGroupsResponseSchema", () => {
  it("parses a runs-service stats body (cost totals pass through)", () => {
    const r = WorkflowRunGroupsResponseSchema.parse({
      groups: [{ dimensions: { workflowSlug: "a" }, runCount: 2, maxStartedAt: "2026-09-24T00:00:00Z", totalCostInUsdCents: "0" }],
    });
    expect(r.groups[0].dimensions.workflowSlug).toBe("a");
  });
});

describe("no admin campaign surface presents the creation-time workflowSlug as what runs", () => {
  const sidebar = read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/sidebar-wrapper.tsx");
  const featurePage = read("app/(authed)/(dashboard)/features/[featureId]/page.tsx");
  const campaignPage = read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/page.tsx");

  it("the sidebar links the workflow the campaign last ran and logs no wrong diagnosis", () => {
    expect(sidebar).toContain("useRanWorkflows(");
    expect(sidebar).not.toContain("campaign.workflowSlug");
    expect(sidebar).not.toContain("instead of slug");
  });

  it("the feature page card reads the runs, not the row", () => {
    expect(featurePage).toContain("<RanWorkflowsInline");
    expect(featurePage).not.toContain("workflowLabel");
  });

  it("the campaign page states the workflows it ran", () => {
    expect(campaignPage).toContain("<RanWorkflowsCard");
  });

  it("the read aggregates trigger runs by workflow over a time window", () => {
    const api = read("lib/api.ts");
    const body = api.slice(api.indexOf("export async function listCampaignWorkflowRunGroups("));
    expect(body).toContain('groupBy: "workflowSlug"');
    expect(body).toContain("TRIGGER_TASK_NAME");
    expect(body).toContain("startedAfter");
  });
});

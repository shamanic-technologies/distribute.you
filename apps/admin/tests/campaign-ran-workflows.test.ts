import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  summarizeRanWorkflows,
  workflowShortName,
  TriggerRunsResponseSchema,
} from "../src/lib/campaign-ran-workflows";

const read = (p: string) => readFileSync(join(__dirname, "../src", p), "utf8");

describe("summarizeRanWorkflows", () => {
  it("groups trigger runs by workflow, newest first, with counts", () => {
    const s = summarizeRanWorkflows([
      { workflowSlug: "f-alioth", startedAt: "2026-09-24T08:00:00Z" },
      { workflowSlug: "f-azalea-v4", startedAt: "2026-09-25T05:27:00Z" },
      { workflowSlug: "f-alioth", startedAt: "2026-09-23T08:00:00Z" },
      { workflowSlug: null, startedAt: "2026-09-20T00:00:00Z" },
    ]);
    expect(s.workflows).toEqual([
      { workflowSlug: "f-azalea-v4", runs: 1, lastStartedAt: "2026-09-25T05:27:00Z" },
      { workflowSlug: "f-alioth", runs: 2, lastStartedAt: "2026-09-24T08:00:00Z" },
    ]);
    expect(s.totalRuns).toBe(4);
    expect(s.windowStart).toBe("2026-09-20T00:00:00Z");
  });

  it("an empty window is empty, never a fallback", () => {
    expect(summarizeRanWorkflows([])).toEqual({ workflows: [], totalRuns: 0, windowStart: null });
  });
});

describe("workflowShortName", () => {
  it("keeps the whole remainder after the feature prefix", () => {
    expect(workflowShortName("sales-cold-email-outreach-azalea-v4", "sales-cold-email-outreach")).toBe("Azalea v4");
    expect(workflowShortName("sales-cold-email-outreach-alioth", "sales-cold-email-outreach")).toBe("Alioth");
    expect(workflowShortName("other-thing", "sales-cold-email-outreach")).toBe("Other thing");
  });
});

describe("TriggerRunsResponseSchema", () => {
  it("parses a runs-service body (extra fields pass through)", () => {
    const r = TriggerRunsResponseSchema.parse({
      runs: [{ id: "x", workflowSlug: "a", startedAt: "2026-09-24T00:00:00Z", serviceName: "workflow" }],
      offset: 0,
    });
    expect(r.runs[0].workflowSlug).toBe("a");
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

  it("the read filters to trigger runs", () => {
    const api = read("lib/api.ts");
    const body = api.slice(api.indexOf("export async function listCampaignTriggerRuns("));
    expect(body).toContain("TRIGGER_SERVICE_NAME");
    expect(body).toContain("TRIGGER_TASK_NAME");
  });
});

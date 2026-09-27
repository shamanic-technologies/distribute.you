import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { v2RunHref } from "../src/lib/v2/routes";

const SRC = join(__dirname, "../src");
const read = (p: string) => readFileSync(join(SRC, p), "utf-8");

describe("v2 run page — one workflow run, opened from the email it wrote", () => {
  it("lives under Work", () => {
    expect(v2RunHref("org_1", "b1", "r 1")).toBe("/v2/orgs/org_1/brands/b1/work/runs/r%201");
    expect(existsSync(join(SRC, "app/(authed)/v2/orgs/[orgId]/brands/[brandId]/work/runs/[runId]/page.tsx"))).toBe(true);
  });

  it("reads the run by id and what it wrote, never a setting", () => {
    const page = read("components/v2/run-page.tsx");
    expect(page).toContain("getRunDetail(runId)");
    expect(page).toContain("listRunGenerations(brandId, runId)");
    // The LLM and the template are the GENERATION's own, i.e. what actually wrote it.
    expect(page).toContain("workflowModelMark(gen?.model)");
    expect(page).toContain("workflowTemplateLabel(gen?.promptType)");
    // The audience rides the generation (runs-service leaves it null on the run).
    expect(page).toContain("gen?.audienceId ?? run?.audienceId");
  });

  it("the history reader carries the run lead-service names on each email", () => {
    expect(read("lib/lead-history.ts")).toContain("workflowRunId: z.string().nullable().optional()");
  });

  it("the person timeline links each email to its run", () => {
    const person = read("components/v2/person-page.tsx");
    expect(person).toContain("runHref={(runId) =>");
    expect(person).toContain("v2RunHref(orgId, brandId, runId)");
    const timeline = read("components/audiences/lead-history-timeline.tsx");
    expect(timeline).toContain("runHref && e.workflowRunId ? runHref(e.workflowRunId) : null");
  });

  it("the person side panel no longer states a mission or an audience (they belong to a run)", () => {
    const person = read("components/v2/person-page.tsx");
    expect(person).not.toContain('k="Mission"');
    expect(person).not.toContain('k="Audience"');
  });

  it("Work opens a running run on its own page", () => {
    const work = read("components/v2/work-page.tsx");
    expect(work).toContain("href={v2RunHref(orgId, brandId, r.id)}");
    expect(work).toContain("runHrefFor={(r) => v2RunHref(orgId, brandId, r.id)}");
  });
});

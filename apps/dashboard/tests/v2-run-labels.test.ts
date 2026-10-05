import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { foldSteps, isWorkRun, runTaskLabel, LEAD_RUN_TASK } from "../src/lib/v2/run-labels";

const src = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");
const run = (taskName: string, extra: Partial<{ serviceName: string; status: string; completedAt: string | null; totalCostInUsdCents: string }> = {}) => ({
  serviceName: "x-service",
  status: "completed",
  completedAt: "2026-10-03T13:54:17Z",
  taskName,
  ...extra,
});

/**
 * The run lists a customer reads (owner 2026-10-03: "plein de bruit, plein d'ID
 * incompréhensibles, Send follow-up alors que c'est une queue").
 */
describe("v2 run labels", () => {
  it("a queued email step never says Sent: all steps are queued in the same second", () => {
    expect(runTaskLabel(run("email-send-step-1"))).toBe("Queued the first email");
    expect(runTaskLabel(run("email-send-step-2"))).toBe("Scheduled follow-up 1");
    expect(runTaskLabel(run("email-send-step-3"))).toBe("Scheduled follow-up 2");
    expect(src("lib/v2/run-labels.ts")).not.toMatch(/"Sent |`Sent /);
  });

  it("never prints a raw id or slug", () => {
    const gate = run("8c748ddd-86a2-4d7f-9f67-1528c7136665", { serviceName: "campaign-service" });
    expect(runTaskLabel(gate)).toBe("Checked the budget");
    expect(runTaskLabel(run("3922c8e1-3405-46af-8a56-1eef3f221b19"))).toBe("Ran a step");
    expect(runTaskLabel(run("POST /some/odd_task"))).toBe("Ran a step");
    expect(runTaskLabel(run("judgments", { serviceName: "chat-service" }))).toBe("Checked a lead");
  });

  it("a lead run reads as the work on one lead", () => {
    expect(runTaskLabel(run(LEAD_RUN_TASK))).toBe("Prepared outreach to a new lead");
    expect(runTaskLabel(run(LEAD_RUN_TASK, { status: "running", completedAt: null }))).toBe("Working on a new lead");
  });

  it("a $0 finished lead run (stopped at the budget gate) is not work; running or paid is", () => {
    expect(isWorkRun(run(LEAD_RUN_TASK, { totalCostInUsdCents: "0" }))).toBe(false);
    expect(isWorkRun(run(LEAD_RUN_TASK, { totalCostInUsdCents: "12.5" }))).toBe(true);
    expect(isWorkRun(run(LEAD_RUN_TASK, { status: "running", completedAt: null, totalCostInUsdCents: "0" }))).toBe(true);
  });

  it("consecutive identical steps fold into one row with a count", () => {
    const steps = [run("judgments"), run("judgments"), run("judgments"), run("lead-serve"), run("judgments")];
    expect(foldSteps(steps).map((g) => [g.label, g.count])).toEqual([
      ["Checked a lead", 3],
      ["Found a lead", 1],
      ["Checked a lead", 1],
    ]);
  });
});

describe("v2 run lists show one row per lead", () => {
  const runs = src("components/v2/runs.ts");
  const fn = runs.slice(runs.indexOf("export function useRecentRuns("), runs.indexOf("export function missionCampaignIds("));

  it("useRecentRuns asks runs-service for lead runs with their subtree cost, then drops $0 gate runs", () => {
    expect(fn).toContain("taskName: LEAD_RUN_TASK");
    expect(fn).toContain("subtreeCost: true");
    expect(fn).toContain(".filter(isWorkRun)");
  });


  it("the run page folds its steps and shows the service name to staff only", () => {
    const page = src("components/v2/run-page.tsx");
    expect(page).toContain("foldSteps(steps)");
    expect(page).toContain("{staffMode && <span");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const API = readFileSync(join(__dirname, "../src/lib/api.ts"), "utf8");
const PAGE = readFileSync(join(__dirname, "../src/components/v2/workflow-page.tsx"), "utf8");

// The workflow page's Over time band (a fleet return + actual cost curve) is retired with the
// return fields it drew (ROI-CONSISTENCY-1103): no return curve, and no reader left behind.
describe("workflow page: no Over time return curve", () => {
  it("the fleet return / actual cost history readers are gone", () => {
    expect(API).not.toContain("fleetReturnQuery(");
    expect(API).not.toContain("getFleetWorkflowReturnHistory");
    expect(API).not.toContain("getFleetWorkflowActualCostHistory");
  });

  it("the page draws no Over time band", () => {
    expect(PAGE).not.toContain("<OverTime");
    expect(PAGE).not.toContain('"fleetWorkflowReturn"');
    expect(PAGE).not.toContain('"fleetWorkflowActualCost"');
  });

  it("the heading no longer claims every client on every leg", () => {
    expect(PAGE).not.toContain("all clients combined");
  });
});

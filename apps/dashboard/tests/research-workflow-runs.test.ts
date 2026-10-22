import { describe, expect, it } from "vitest";
import { runVersionLabel } from "../src/lib/research/workflow-runs";

describe("a run's workflow version (WF-RUNS-OUTPUTS-1022-DASH)", () => {
  it("labels a version off its dynasty slug", () => {
    expect(runVersionLabel("sales-cold-email-outreach-acrux", "sales-cold-email-outreach-acrux-v2")).toBe("v2");
    expect(runVersionLabel("sales-cold-email-outreach-acrux", "sales-cold-email-outreach-acrux")).toBe("v1");
    expect(runVersionLabel("a", "other-v3")).toBe("other-v3");
    expect(runVersionLabel("a", null)).toBeNull();
  });
});

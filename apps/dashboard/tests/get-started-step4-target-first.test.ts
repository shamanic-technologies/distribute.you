import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

// 2026-11-03 (dwaar.ai): a visitor left step 4 after 7s of skeleton while the audiences
// were still being split (13s). The drafted target shows as soon as it exists, and the
// walk's offer is read only once its signed-out session exists (it 401'd before).
const FLOW = readFileSync(join(__dirname, "../src/components/v2/get-started/get-started.tsx"), "utf8");

describe("get-started step 4 shows the target while audiences load", () => {
  it("keeps the drafted target in state at every place the ref is written", () => {
    expect(FLOW).toContain("setAudienceTarget(icp);");
    expect(FLOW).toContain("setAudienceTarget(text);");
    expect(FLOW).toContain("if (s.icp) setAudienceTarget(s.icp);");
    expect(FLOW).toContain("target={audienceTarget}");
  });

  it("renders the target inside the running state of the audience step", () => {
    const at = FLOW.indexOf("function AudienceStage(");
    const body = FLOW.slice(at, FLOW.indexOf("function OptionSkeleton(", at));
    const running = body.indexOf('state === "running" || state === "waiting"');
    expect(running).toBeGreaterThan(0);
    expect(body.indexOf("We will write to", running)).toBeGreaterThan(running);
    expect(body.indexOf("We will write to", running)).toBeLessThan(body.indexOf("ownForm\n", running));
  });

  it("reads the walk offer only once the brand (and so the session) exists", () => {
    expect(FLOW).toContain("if (org || !started || !brandId || walkOffer !== null) return;");
    expect(FLOW).toContain("}, [org, started, brandId, walkOffer]);");
  });
});

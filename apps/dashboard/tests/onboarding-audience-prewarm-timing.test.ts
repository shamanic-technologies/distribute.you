import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The audience prewarm (ICP + suggest, ~35 s at p50 in prod) used to be created
// only AFTER the lever extraction had resolved (p90 35 s). A user clicking through
// the services step therefore reached the audience step with `prefetch` still
// null, the step fired its OWN ICP + suggest, and the prewarm that arrived later
// was never adopted (the step's one-shot latch had already run) — two full
// suggest runs per signup, both billed. The prewarm now starts first; the
// lever extraction it never needed runs beside it. (#4037)
const src = readFileSync(
  join(__dirname, "../src/components/onboarding/onboarding.tsx"),
  "utf8",
);

describe("onboarding — the audience prewarm starts before the lever extraction", () => {
  const start = src.indexOf("async function hydrateOnboardingInBackground(id: string)");
  const body = src.slice(start, src.indexOf("const [prof, econRes, proj, feat] = await Promise.all([", start));

  it("creates the prewarm promise before awaiting the extraction", () => {
    const prewarm = body.indexOf("const audiencePrewarm = (async ()");
    const extract = body.indexOf('await extractBrandFields([id], USER_PROFILE_FIELDS, { mode: "suggest" })');
    expect(prewarm).toBeGreaterThan(-1);
    expect(extract).toBeGreaterThan(-1);
    expect(prewarm).toBeLessThan(extract);
  });

  it("hands the prewarm to state before awaiting the extraction", () => {
    const handoff = body.indexOf("setAudiencePrefetch({ promise: audiencePrewarm })");
    const extract = body.indexOf('await extractBrandFields([id], USER_PROFILE_FIELDS, { mode: "suggest" })');
    expect(handoff).toBeGreaterThan(-1);
    expect(handoff).toBeLessThan(extract);
  });
});

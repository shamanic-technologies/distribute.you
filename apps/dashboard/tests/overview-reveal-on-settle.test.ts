import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * Reveal-on-SETTLE: the brand Overview gates every revenue-driven region on the
 * `/revenue` query SETTLING (resolved OR errored), never success-only. `/revenue`
 * is the slowest cold chain and intermittently fails on a cold backend (features
 * → downstream Neon scale-to-zero); gating reveal on `data !== undefined` alone
 * left the whole section skeletoned FOREVER on a transient error, with no error
 * UI and no recovery. This is the durable fix behind the recurring "overview
 * still shows skeleton" reports (sibling of #2574/#2576 backend-down → stale).
 * See CLAUDE.md → local-first cache "backend-DOWN must degrade to STALE".
 */
describe("brand overview reveals on settle (error must not eternally skeleton)", () => {
  const overview = read(
    "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
  );

  it("destructures isError from the /revenue query", () => {
    expect(overview).toContain("isError: revenueIsError");
  });

  it("revenue reveal gates on SETTLE (data present OR error), not success-only", () => {
    expect(overview).toContain(
      "const revenueSettled = data !== undefined || revenueIsError;",
    );
    expect(overview).toContain("useCoordinatedReveal([revenueSettled])");
    // The old success-only barrier must be gone.
    expect(overview).not.toContain("useCoordinatedReveal([data !== undefined])");
  });

  it("the graph + stats + audience + outcome barriers also settle on error", () => {
    expect(overview).toContain("|| pipelineIsError");
    expect(overview).toContain("|| featureStatsIsError");
    expect(overview).toContain("|| audienceStatsIsError");
    expect(overview).toContain("|| outcomeIsError");
  });

  it("keeps the per-card-barrier props (no single page-wide AND gate)", () => {
    expect(overview).toContain("revenuePending={!revenueRevealed}");
    expect(overview).toContain("costPending={!costRevealed}");
    expect(overview).not.toContain("valuesRevealed");
  });
});

describe("RevenueOverviewSection drops the defensive !data re-guard", () => {
  const section = read("components/revenue/revenue-overview-section.tsx");

  it("revenueLoading tracks revenuePending alone", () => {
    expect(section).toContain("const revenueLoading = revenuePending;");
    // The `|| !data` re-guard would re-lock the section into an eternal skeleton
    // on an errored /revenue (revenuePending false, data undefined).
    expect(section).not.toContain("revenuePending || !data");
  });
});

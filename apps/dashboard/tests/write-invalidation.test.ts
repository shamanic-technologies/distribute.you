import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CAMPAIGN_MONEY_ROOTS,
  LEAD_OUTCOME_ROOTS,
  invalidateCampaignMoney,
  invalidateLeadOutcome,
  invalidateRoots,
} from "../src/lib/write-invalidation";

function recorder() {
  const seen: string[] = [];
  return {
    seen,
    client: {
      invalidateQueries: (f: { queryKey: readonly unknown[] }) => {
        seen.push(String(f.queryKey[0]));
      },
    },
  };
}

const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

describe("invalidateRoots", () => {
  it("invalidates one ROOT key per listed root, in order", () => {
    const { seen, client } = recorder();
    invalidateRoots(client, ["a", "b"]);
    expect(seen).toEqual(["a", "b"]);
  });

  it("does nothing on an empty list", () => {
    const { seen, client } = recorder();
    invalidateRoots(client, []);
    expect(seen).toEqual([]);
  });
});

describe("LEAD_OUTCOME_ROOTS", () => {
  it("covers EVERY grain the same money is served under", () => {
    // The bug this closes: `featureRevenue` alone left the brand Overview, the offer
    // money, the funnel walk and the per-campaign rows on the pre-write figure.
    for (const root of [
      "featureRevenue",
      "featureRevenueByCampaign",
      "offerRevenue",
      "brandRevenue",
      "brandOfferMoney",
      "offerFunnelRevenue",
    ]) {
      expect(LEAD_OUTCOME_ROOTS).toContain(root);
    }
  });

  it("covers the per-audience costs, the stat row and both activity grains", () => {
    for (const root of [
      "featureAudienceStats",
      "featureStats",
      "featurePipelineActivity",
      "offerFunnelPipelineActivity",
    ]) {
      expect(LEAD_OUTCOME_ROOTS).toContain(root);
    }
  });

  it("does NOT invalidate the fleet-wide workflow projection", () => {
    // A cross-org benchmark of what an outcome costs everywhere. One lead cannot move
    // it, and it is one of the most expensive reads in the app.
    expect(LEAD_OUTCOME_ROOTS).not.toContain("workflowProjection");
  });

  it("lists every root exactly once", () => {
    expect(new Set(LEAD_OUTCOME_ROOTS).size).toBe(LEAD_OUTCOME_ROOTS.length);
  });

  it("invalidateLeadOutcome asks for all of them", () => {
    const { seen, client } = recorder();
    invalidateLeadOutcome(client);
    expect(seen).toEqual([...LEAD_OUTCOME_ROOTS]);
  });
});

describe("CAMPAIGN_MONEY_ROOTS", () => {
  it("carries the running total the header reads", () => {
    // `brandSpendableBudget` is the join of billing's ceilings to campaign-service's
    // statuses — it moves on a pause exactly as it moves on a budget edit, and it was
    // the one every budget writer forgot.
    expect(CAMPAIGN_MONEY_ROOTS).toContain("brandSpendableBudget");
  });

  it("carries the campaign rows, the single campaign, the brand total and the funnels", () => {
    for (const root of ["campaigns", "campaign", "brandDailyBudget", "offerFunnels"]) {
      expect(CAMPAIGN_MONEY_ROOTS).toContain(root);
    }
  });

  it("does NOT invalidate the budget set the writers just wrote by hand", () => {
    // Both writers `setQueryData` billing's own answer into it. Re-reading would
    // replace a figure we have just been told with one a failed refetch can lose.
    expect(CAMPAIGN_MONEY_ROOTS).not.toContain("brandFunnelBudgets");
  });

  it("invalidateCampaignMoney asks for all of them", () => {
    const { seen, client } = recorder();
    invalidateCampaignMoney(client);
    expect(seen).toEqual([...CAMPAIGN_MONEY_ROOTS]);
  });
});

describe("every listed root is persisted", () => {
  it("appears in PERSISTABLE_QUERY_ROOTS", () => {
    // An unlisted root is default-OFF in the disk cache, so a surface reading it cold
    // skeletons on every visit — invalidating it would then be a cold fetch, not a
    // refresh.
    const persist = read("lib/persist-cache.ts");
    for (const root of [...LEAD_OUTCOME_ROOTS, ...CAMPAIGN_MONEY_ROOTS]) {
      expect(persist).toContain(`"${root}"`);
    }
  });
});

describe("the module stays unit-testable", () => {
  it("imports nothing at all", () => {
    // Alias-free AND dependency-free: the client is taken structurally. A runtime
    // `@/…` import turns these real unit tests into resolution failures.
    const src = read("lib/write-invalidation.ts");
    expect(src).not.toMatch(/^import /m);
  });
});

describe("call sites", () => {
  const sites: [string, string][] = [
    ["lib/use-lead-step-statements.ts", "invalidateLeadOutcome"],
    ["components/audiences/engaged-leads-page.tsx", "invalidateLeadOutcome"],
    ["components/campaigns/campaign-controls-modal.tsx", "invalidateCampaignMoney"],
    ["components/settings/campaign-settings-card.tsx", "invalidateCampaignMoney"],
    ["components/settings/brand-sales-funnels-card.tsx", "invalidateCampaignMoney"],
  ];

  for (const [path, fn] of sites) {
    it(`${path} calls ${fn}`, () => {
      // Pins the CALL SITE, not only the helper: a correct helper nothing calls is the
      // feature entirely absent with the module perfectly correct.
      expect(read(path)).toContain(`${fn}(queryClient)`);
    });
  }

  it("the lead write sites no longer invalidate featureRevenue alone", () => {
    for (const path of [
      "lib/use-lead-step-statements.ts",
      "components/audiences/engaged-leads-page.tsx",
    ]) {
      expect(read(path)).not.toContain('queryKey: ["featureRevenue"]');
    }
  });

  it("the budget writers no longer hand-list their own roots", () => {
    for (const path of [
      "components/campaigns/campaign-controls-modal.tsx",
      "components/settings/campaign-settings-card.tsx",
    ]) {
      expect(read(path)).not.toContain('queryKey: ["campaigns"]');
    }
  });

  it("the three lead-outcome mutations each invalidate the whole set", () => {
    const src = read("lib/use-lead-step-statements.ts");
    expect((src.match(/invalidateLeadOutcome\(queryClient\)/g) ?? []).length).toBe(3);
  });

  it("the three lead-page writes each invalidate the whole set", () => {
    // setReply, withdrawReply and the board move.
    const src = read("components/audiences/engaged-leads-page.tsx");
    expect((src.match(/invalidateLeadOutcome\(queryClient\)/g) ?? []).length).toBe(3);
  });
});

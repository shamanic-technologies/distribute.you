import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PUBLISHED_OUTCOME_COPY, PUBLISHED_OUTCOME_KEYS, PublishedUnitsSchema, isPublishedOutcomeKey, performedByLabel } from "../src/lib/v2/published-units";

/**
 * OUTCOME-FINEST-1106 (owner 2026-11-06: « du hardcode pour chaque [outcome] »): one Outcome page per published outcome
 * (Threads, X, LinkedIn posts, newsletter emails), every customer, every figure served by features-service.
 */
const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

const served = {
  brandId: "b1",
  pricing: "net",
  outcomeKey: "x_post_published",
  computedAt: "2026-11-06T18:00:00.000Z",
  rows: [
    { id: "p1", publishedAt: "2026-11-05T10:00:00.000Z", account: "DistributeYou", performedBy: "client_team", text: "A hand post", url: "https://x.com/i/1", units: 1, views: 120, engagements: 4, spentUsd: 0.01, visits: 1, signups: 0, ledgerUnavailableReason: null },
    { id: "p2", publishedAt: "2026-11-04T10:00:00.000Z", account: "KevinLourd", performedBy: "ours", text: "Ours", url: null, units: 1, views: null, engagements: null, spentUsd: null, visits: null, signups: null, ledgerUnavailableReason: "not_on_ledger_yet" },
  ],
  totals: { all: { rows: 2, units: 2, views: 120, engagements: 4, visits: 1, signups: 0, spentUsd: 0.01 }, ours: { rows: 1, units: 1, views: 0, engagements: 0, visits: 0, signups: 0, spentUsd: 0 } },
  costPerSignupUsd: null,
  learning: true,
  daily: [{ date: "2026-11-04", units: 1, oursUnits: 1, views: 0, visits: 0, signups: 0, spentUsd: 0 }],
};

describe("published outcomes (OUTCOME-FINEST-1106)", () => {
  it("parses the served body; a hand post reads Client's team", () => {
    const parsed = PublishedUnitsSchema.parse(served);
    expect(performedByLabel(parsed.rows[0]!.performedBy)).toBe("Client's team");
    expect(performedByLabel(parsed.rows[1]!.performedBy)).toBe("Ours");
    expect(parsed.costPerSignupUsd).toBeNull();
  });

  it("serves exactly the four published outcomes, each with its own copy", () => {
    expect([...PUBLISHED_OUTCOME_KEYS].sort()).toEqual(["linkedin_post_published", "newsletter_email_sent", "threads_post_published", "x_post_published"]);
    for (const k of PUBLISHED_OUTCOME_KEYS) expect(PUBLISHED_OUTCOME_COPY[k]).toBeDefined();
    expect(isPublishedOutcomeKey("post_published")).toBe(false);
    expect(isPublishedOutcomeKey(null)).toBe(false);
  });

  it("the outcome page opens a published outcome on its own page for EVERY customer, and the overview lists one row each", () => {
    const page = src("src/components/v2/outcomes-page.tsx");
    const at = page.indexOf("export function OutcomePage(");
    const body = page.slice(at);
    expect(body).toContain("if (isPublishedOutcomeKey(stepKey)) return <PublishedOutcomePage outcomeKey={stepKey} />;");
    // Before the staff-only posts feed: no staff gate on it.
    expect(body.indexOf("isPublishedOutcomeKey(stepKey)")).toBeLessThan(body.indexOf("staffMode) return <PostsPage />"));
    expect(page).toContain("<PublishedOutcomeRow");
  });

  it("reads features-service net, and the page divides or sums nothing", () => {
    const api = src("src/lib/api.ts");
    const at = api.indexOf("export async function getBrandPublishedUnits(");
    const fn = api.slice(at, api.indexOf("\n}\n", at));
    expect(fn).toContain("/published-units/");
    expect(fn).toContain('pricing: "net"');
    const page = src("src/components/v2/published-outcome-page.tsx");
    expect(page).not.toMatch(/\.reduce\(|spentUsd\s*\/|\/\s*[a-z.]*signups/);
    expect(page).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border|shadow-2xl/);
  });
});

describe("Outcomes overview: one row per outcome, $ / outcome on every row (OUTCOME-CARD-1108, OUTCOMES-TABLE-1108)", () => {
  const card = src("src/components/v2/published-outcome-page.tsx");
  const overview = src("src/components/v2/outcomes-page.tsx");
  it("the published row prints the served cost per Unit under $ / outcome, never $ / signup", () => {
    const body = overview.slice(overview.indexOf("function PublishedOutcomeRow("), overview.indexOf("function MeasuredExpectedSpark("));
    expect(overview).toContain("min-w-[220px]`}>$ / outcome</th>");
    expect(body).toContain("<CostPerUnit data={data} />");
    expect(body).not.toContain("$ / signup");
    expect(card).toContain("data.accounting?.costPerUnit");
  });
  it("a published outcome with a row is never listed a second time as a generic row", () => {
    expect(overview).toContain(".filter((o) => !publishedKeys.has(o.outcome.key))");
    expect(overview).toContain("const count = ordered.length + published.withRows.length;");
  });
});

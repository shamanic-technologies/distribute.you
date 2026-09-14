import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * ONE MRR BAND, TWO HALVES, AND NOTHING DIVIDED IN THE BROWSER.
 *
 * The Revenue view used to state the fleet's committed run-rate in two places on
 * two different framings — a card beside consumption and a band of its own two
 * screens down. It now states it ONCE, split into the halves it is actually
 * earned in. These guards pin the three things that would quietly bring the
 * contradiction back: a second MRR surface, a browser-side re-derivation of a
 * half, and a fabricated zero where the producer said it could not measure.
 */

const ROOT = join(__dirname, "..");
const VIEW = readFileSync(join(ROOT, "src/components/revenue-view.tsx"), "utf8");
const CARD = readFileSync(join(ROOT, "src/components/revenue/stated-amounts-card.tsx"), "utf8");
const BUCKETS = readFileSync(join(ROOT, "src/lib/revenue-buckets.ts"), "utf8");
const API = readFileSync(join(ROOT, "src/lib/api.ts"), "utf8");

describe("the old undifferentiated run-rate is gone", () => {
  it("no longer states a fleet Current MRR card beside consumption", () => {
    // That card and the split's Total MRR are two answers on two bases; the page
    // may carry only one of them, and it is the split.
    expect(VIEW).not.toContain("Current MRR (committed)");
  });

  it("no longer renders the Committed run-rate band", () => {
    expect(VIEW).not.toContain('title="Committed run-rate"');
  });

  it("stopped reading the undifferentiated committed series into charts", () => {
    expect(VIEW).not.toContain("committedBuckets");
  });

  /**
   * ARR used to be stated on the cards and charted nowhere, on the reasoning that
   * it is MRR × 12 so its curve and its growth are the MRR ones with a multiplier
   * on the axis. That reasoning is still true and is no longer a reason to withhold
   * it: a reader who thinks in years should not have to multiply a chart in their
   * head. Owner-decided 2026-09-14. What the guard holds instead is that the yearly
   * pair is READ off the producer's own served field — the moment anything here
   * multiplies an MRR bucket by twelve, the page carries two answers for one
   * run-rate and they can drift.
   */
  it("charts the yearly run-rate off the producer's served field, never MRR × 12", () => {
    expect(VIEW).toContain('label="Monthly ARR"');
    expect(VIEW).toContain('label="Weekly ARR"');
    expect(VIEW).toContain('"totalArrUsd", "month"');
    expect(VIEW).toContain('"totalArrUsd", "week"');
    expect(VIEW).not.toMatch(/\*\s*12\b/);
  });

  it("puts the yearly pair ABOVE the monthly pair", () => {
    expect(VIEW.indexOf('label="Monthly ARR"')).toBeLessThan(VIEW.indexOf('label="Monthly MRR"'));
    expect(VIEW.indexOf('label="Weekly ARR"')).toBeLessThan(VIEW.indexOf('label="Weekly MRR"'));
  });

  /**
   * Only the TOTAL is charted per year. The two halves are read per month, where
   * the split is the point — six yearly charts restating six monthly ones is the
   * same curve twelve times, and the band's whole subject is the halves.
   */
  it("states the yearly figure for the total alone", () => {
    expect(VIEW).not.toContain('"selfServeArrUsd", "month"');
    expect(VIEW).not.toContain('"agencyArrUsd", "month"');
  });
});

describe("the split band", () => {
  it("states all three figures", () => {
    expect(VIEW).toContain('label="Self-serve MRR"');
    expect(VIEW).toContain('label="Agency MRR"');
    expect(VIEW).toContain('label="Total MRR"');
  });

  it("reads each half off the producer's own served field", () => {
    expect(VIEW).toContain("currentSelfServeMrrUsd");
    expect(VIEW).toContain("currentAgencyMrrUsd");
    expect(VIEW).toContain("currentTotalMrrUsd");
  });

  it("charts both halves and the total, monthly and weekly", () => {
    for (const field of [
      '"selfServeMrrUsd", "month"',
      '"selfServeMrrUsd", "week"',
      '"agencyMrrUsd", "month"',
      '"agencyMrrUsd", "week"',
      '"totalMrrUsd", "month"',
      '"totalMrrUsd", "week"',
    ]) {
      expect(VIEW).toContain(field);
    }
  });

  it("STATES that the split is unavailable rather than rendering a zero agency", () => {
    // A null mrrSplit is "we could not measure this". Reading it as zero would
    // report an agency worth nothing and a self-serve half silently holding the
    // whole fleet — a wrong number that looks exactly like a right one.
    expect(VIEW).toContain("splitUnavailable");
    expect(VIEW).toContain("could not be split");
  });

  it("surfaces agency budget that landed in NEITHER half", () => {
    // An agency brand nobody has stated an amount for leaves the self-serve half
    // and joins nothing, so the total sits below the fleet figure. Say so.
    expect(VIEW).toContain("unstatedAgencyUsd");
    expect(VIEW).toContain("in neither half");
  });

  it("LABELS an approximated period instead of presenting it as measured", () => {
    // features-service only began recording whether a campaign was running, and
    // whether it still had people to contact, on the day it shipped those
    // records. Every earlier period is qualified from the customer's own billed
    // sending and says so on the wire; rendering it identically to a measured
    // month is the one thing the marking exists to prevent.
    expect(VIEW).toContain("approximatedMonths");
    expect(VIEW).toContain("approximated (");
    expect(VIEW).toContain("earningRecordBeginsOn");
  });

  it("states the size of the under-statement rather than filling the amount in", () => {
    // A customer we hold no recorded budget for contributes nothing, however
    // plainly they were working. That under-states, so it is counted and said.
    expect(VIEW).toContain("unrecordedBudgetCustomers");
    expect(VIEW).toContain("no recorded daily budget");
  });

  it("guards the live cards against a null figure before it reaches the formatter", () => {
    expect(VIEW).toContain("split.currentSelfServeMrrUsd !== null");
    expect(VIEW).toContain("split.currentTotalMrrUsd !== null");
  });

  it("mounts the editor — a band nobody can write to states an agency of zero forever", () => {
    expect(VIEW).toContain("<StatedAmountsCard />");
  });
});

describe("nothing is computed in the browser", () => {
  it("the bucket helper only PICKS a served field, it never adds or divides", () => {
    const fn = BUCKETS.slice(
      BUCKETS.indexOf("export function mrrSplitBuckets("),
      BUCKETS.indexOf("/** Distinct weeks tracked"),
    );
    expect(fn).toContain("b[field]");
    // No arithmetic on the two halves: the producer already reconciled them, and
    // re-deriving one here is how a chart comes to disagree with its own card.
    expect(fn).not.toContain("selfServeMrrUsd +");
    expect(fn).not.toContain("- b.agency");
  });

  it("the view never subtracts one half from the other", () => {
    expect(VIEW).not.toContain("currentTotalMrrUsd - ");
    expect(VIEW).not.toContain("currentMrrUsd - split");
  });

  it("the unstated-budget gap is the only arithmetic, and it is a difference of two served fields", () => {
    expect(VIEW).toContain("split.currentAgencyBudgetMrrUsd - split.currentAgencyMrrUsd");
  });
});

describe("the stated-amounts editor", () => {
  it("offers brands from the accounts audit — the key that page already polls", () => {
    expect(CARD).toContain('["auditAccounts"]');
    expect(CARD).toContain("getAuditAccounts");
  });

  it("keys a stated amount on the (org, brand) PAIR, never on the brand alone", () => {
    // A brand can be mapped under two orgs with different budgets; keying on the
    // brand would state one org's amount against the other's money.
    expect(CARD).toContain("function pairKey(orgId: string, brandId: string)");
    expect(CARD).toContain("orgId: orgId ?? \"\", brandId: brandId ?? \"\"");
  });

  it("re-reads the SPLIT after every write — stating an amount moves both halves", () => {
    expect(CARD).toContain('queryKey: ["fleetRevenue"]');
    expect(CARD).toContain('queryKey: ["statedAmounts"]');
  });

  it("renders the producer's refusal, never the thrown error's message", () => {
    expect(CARD).toContain("statedAmountErrorMessage");
    expect(CARD).not.toContain("err.message");
    expect(CARD).not.toContain("error?.message");
  });

  it("sends every bound on a PATCH so clearing a date reaches the producer as null", () => {
    const fn = CARD.slice(CARD.indexOf("const save = useMutation("), CARD.indexOf("const remove = useMutation("));
    expect(fn).toContain("startDate: body.startDate");
    expect(fn).toContain("endDate: body.endDate");
  });

  it("states what an empty bound MEANS instead of leaving it blank", () => {
    expect(CARD).toContain("first day of spend");
    expect(CARD).toContain("still running");
  });
});

describe("the wire contract", () => {
  it("declares mrrSplit nullable — the producer answers null when it could not measure", () => {
    expect(API).toContain("mrrSplit?: MrrSplit | null;");
  });

  it("reads the producer's field names verbatim", () => {
    for (const field of [
      "currentAgencyMrrUsd",
      "currentSelfServeMrrUsd",
      "currentTotalMrrUsd",
      "currentAgencyBudgetMrrUsd",
      "currentSelfServeBasis",
      "earningRecordBeginsOn",
      "selfServeBasis",
      "selfServeApproximatedPairCount",
      "selfServeUnrecordedBudgetPairCount",
      "agencyBudgetBasis",
      "agencyOrgIds",
      "agencyPairKeys",
    ]) {
      expect(API).toContain(field);
    }
  });

  it("calls the gateway path api-service ACTUALLY deployed, not the one its sibling uses", () => {
    // The revenue read next to it is proxied under `/features/audit/…`; this one
    // is not. Read off the deployed gateway rather than assumed from the sibling.
    expect(API).toContain('const STATED_AMOUNTS_PATH = "/features/stated-monthly-amounts";');
  });

  it("treats 204 as a valid empty success — a DELETE that removed the row", () => {
    expect(API).toContain("if (response.status === 204) return undefined as T;");
  });
});
